const { getRedisClient, checkRedisHealth } = require('../config/redis');
const { getMySQLPool } = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Servicio de caché resiliente con múltiples niveles de fallback
 */
class ResilientCacheService {
    constructor() {
        this.defaultTTL = parseInt(process.env.REDIS_TTL) || 300;
        this.redisClient = null;
        this.memoryCache = new Map(); // Cache en memoria como fallback
        this.diskCachePath = path.join(__dirname, '../cache');
        this.isInitialized = false;
        this.warmupInProgress = false;
    }

    /**
     * Inicializa el servicio de caché
     */
    async init() {
        try {
            this.redisClient = getRedisClient();

            // Crear directorio de cache en disco si no existe
            try {
                await fs.mkdir(this.diskCachePath, { recursive: true });
            } catch (err) {
                logger.warn('Could not create disk cache directory:', err.message);
            }

            // Cargar cache desde disco al arrancar
            await this.loadFromDisk();

            this.isInitialized = true;
            logger.info('✅ Resilient Cache Service initialized');

            // Iniciar warmup en background
            this.warmupCache().catch(err =>
                logger.error('Cache warmup error:', err)
            );

            return true;
        } catch (error) {
            logger.error('Cache service init error:', error);
            this.isInitialized = true; // Continuar sin Redis
            return false;
        }
    }

    /**
     * Pre-carga datos críticos en cache (Cache Warming)
     */
    async warmupCache() {
        if (this.warmupInProgress) return;

        this.warmupInProgress = true;
        logger.info('🔥 Starting cache warmup...');

        try {
            const pool = getMySQLPool();
            if (!pool) {
                logger.warn('MySQL not available for warmup, using existing cache');
                return;
            }

            // 1. Pre-cargar todos los equipos
            try {
                const [teams] = await pool.execute(
                    'SELECT id, full_name, abbreviation, nickname, city, state, year_founded FROM team ORDER BY full_name'
                );
                await this.set('teams:all', teams, 3600); // 1 hora
                logger.info(`✅ Warmed up ${teams.length} teams`);
            } catch (err) {
                logger.error('Failed to warmup teams:', err.message);
            }

            // 2. Pre-cargar top 100 jugadores
            try {
                const [players] = await pool.execute(
                    `SELECT 
            p.id as player_id,
            p.full_name AS player_name,
            dc.position,
            t.full_name AS team_name,
            t.abbreviation as team_abbr,
            dc.height_w_shoes_ft_in AS height,
            dc.weight
          FROM player p
          INNER JOIN draft_combine_stats dc ON p.id = dc.player_id
          INNER JOIN draft_history dh ON p.id = dh.person_id
          INNER JOIN team t ON dh.team_id = t.id
          WHERE p.is_active = 1
          ORDER BY p.full_name
          LIMIT 100`
                );
                await this.set('players:top100', players, 600); // 10 minutos
                logger.info(`✅ Warmed up ${players.length} players`);
            } catch (err) {
                logger.error('Failed to warmup players:', err.message);
            }

            // 3. Pre-cargar jugadores por equipo (equipos más populares)
            try {
                const [popularTeams] = await pool.execute(
                    'SELECT id FROM team LIMIT 10'
                );

                for (const team of popularTeams) {
                    const [teamPlayers] = await pool.execute(
                        `SELECT 
              p.id as player_id,
              p.full_name as player_name,
              dc.position,
              dc.height_w_shoes_ft_in as height,
              dc.weight,
              t.full_name as team_name,
              t.abbreviation as team_abbr,
              p.is_active
            FROM player p
            INNER JOIN draft_history dh ON p.id = dh.person_id
            INNER JOIN team t ON dh.team_id = t.id
            LEFT JOIN draft_combine_stats dc ON p.id = dc.player_id
            WHERE t.id = ?
            ORDER BY p.full_name`,
                        [team.id]
                    );
                    await this.set(`team:${team.id}:players`, teamPlayers, 600);
                }
                logger.info(`✅ Warmed up players for ${popularTeams.length} teams`);
            } catch (err) {
                logger.error('Failed to warmup team players:', err.message);
            }

            // 4. Persistir cache crítico en disco
            await this.persistCriticalData();

            logger.info('✅ Cache warmup completed');
        } catch (error) {
            logger.error('Cache warmup failed:', error);
        } finally {
            this.warmupInProgress = false;
        }
    }

    /**
     * Obtiene valor del cache (multi-nivel: Redis -> Memory -> Disk)
     */
    async get(key) {
        try {
            // Nivel 1: Redis
            if (this.redisClient && this.redisClient.isOpen) {
                const value = await this.redisClient.get(key);
                if (value) {
                    logger.debug(`Cache HIT (Redis): ${key}`);
                    // Sincronizar con memoria
                    this.memoryCache.set(key, {
                        value: JSON.parse(value),
                        timestamp: Date.now()
                    });
                    return JSON.parse(value);
                }
            }

            // Nivel 2: Memory Cache
            const memCached = this.memoryCache.get(key);
            if (memCached) {
                const age = Date.now() - memCached.timestamp;
                // Retornar datos de memoria incluso si están viejos (mejor que nada)
                logger.debug(`Cache HIT (Memory): ${key} (age: ${Math.floor(age / 1000)}s)`);
                return memCached.value;
            }

            // Nivel 3: Disk Cache (solo para datos críticos)
            const diskValue = await this.getFromDisk(key);
            if (diskValue) {
                logger.debug(`Cache HIT (Disk): ${key}`);
                // Restaurar a memory cache
                this.memoryCache.set(key, {
                    value: diskValue,
                    timestamp: Date.now()
                });
                return diskValue;
            }

            logger.debug(`Cache MISS: ${key}`);
            return null;
        } catch (error) {
            logger.error(`Cache GET error for key ${key}:`, error);
            // Intentar obtener de memoria como último recurso
            const memCached = this.memoryCache.get(key);
            return memCached ? memCached.value : null;
        }
    }

    /**
     * Establece valor en cache (todos los niveles)
     */
    async set(key, value, ttl = null) {
        const ttlSeconds = ttl || this.defaultTTL;
        let success = false;

        try {
            // Nivel 1: Redis
            if (this.redisClient && this.redisClient.isOpen) {
                await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
                logger.debug(`Cache SET (Redis): ${key} (TTL: ${ttlSeconds}s)`);
                success = true;
            }

            // Nivel 2: Memory Cache (siempre)
            this.memoryCache.set(key, {
                value,
                timestamp: Date.now(),
                ttl: ttlSeconds
            });
            logger.debug(`Cache SET (Memory): ${key}`);

            // Nivel 3: Disk Cache (solo para datos críticos)
            if (this.isCriticalKey(key)) {
                await this.setToDisk(key, value);
                logger.debug(`Cache SET (Disk): ${key}`);
            }

            // Limpiar memoria cache si crece mucho
            if (this.memoryCache.size > 1000) {
                this.cleanupMemoryCache();
            }

            return true;
        } catch (error) {
            logger.error(`Cache SET error for key ${key}:`, error);
            return success; // true si al menos Redis funcionó
        }
    }

    /**
     * Determina si una clave es crítica y debe persistirse en disco
     */
    isCriticalKey(key) {
        const criticalPatterns = [
            'teams:all',
            'players:top100',
            'team:.*:players',
            'player:stats:.*'
        ];
        return criticalPatterns.some(pattern =>
            new RegExp(pattern).test(key)
        );
    }

    /**
     * Persiste datos críticos en disco
     */
    async persistCriticalData() {
        try {
            const criticalKeys = Array.from(this.memoryCache.keys())
                .filter(key => this.isCriticalKey(key));

            for (const key of criticalKeys) {
                const cached = this.memoryCache.get(key);
                if (cached) {
                    await this.setToDisk(key, cached.value);
                }
            }
            logger.info(`✅ Persisted ${criticalKeys.length} critical keys to disk`);
        } catch (error) {
            logger.error('Failed to persist critical data:', error);
        }
    }

    /**
     * Guarda en disco
     */
    async setToDisk(key, value) {
        try {
            const filename = this.getFilenameForKey(key);
            const filepath = path.join(this.diskCachePath, filename);
            await fs.writeFile(filepath, JSON.stringify({
                key,
                value,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error(`Failed to write to disk cache: ${key}`, error);
        }
    }

    /**
     * Lee desde disco
     */
    async getFromDisk(key) {
        try {
            const filename = this.getFilenameForKey(key);
            const filepath = path.join(this.diskCachePath, filename);
            const data = await fs.readFile(filepath, 'utf8');
            const parsed = JSON.parse(data);

            // Verificar si está muy viejo (más de 24 horas)
            const age = Date.now() - parsed.timestamp;
            if (age > 24 * 60 * 60 * 1000) {
                logger.debug(`Disk cache too old: ${key}`);
                return null;
            }

            return parsed.value;
        } catch (error) {
            // Archivo no existe o error de lectura
            return null;
        }
    }

    /**
     * Carga cache desde disco al iniciar
     */
    async loadFromDisk() {
        try {
            const files = await fs.readdir(this.diskCachePath);
            let loaded = 0;

            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filepath = path.join(this.diskCachePath, file);
                        const data = await fs.readFile(filepath, 'utf8');
                        const parsed = JSON.parse(data);

                        this.memoryCache.set(parsed.key, {
                            value: parsed.value,
                            timestamp: parsed.timestamp
                        });
                        loaded++;
                    } catch (err) {
                        logger.warn(`Failed to load cache file ${file}:`, err.message);
                    }
                }
            }

            if (loaded > 0) {
                logger.info(`✅ Loaded ${loaded} cached entries from disk`);
            }
        } catch (error) {
            // Directorio no existe o está vacío
            logger.debug('No disk cache to load');
        }
    }

    /**
     * Genera nombre de archivo seguro para una clave
     */
    getFilenameForKey(key) {
        return key.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
    }

    /**
     * Limpia cache en memoria (LRU simple)
     */
    cleanupMemoryCache() {
        const entries = Array.from(this.memoryCache.entries());
        // Ordenar por timestamp y mantener solo los 800 más recientes
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);

        this.memoryCache.clear();
        entries.slice(0, 800).forEach(([key, value]) => {
            this.memoryCache.set(key, value);
        });

        logger.debug(`Memory cache cleaned up, ${this.memoryCache.size} entries remaining`);
    }

    /**
     * Elimina clave del cache
     */
    async delete(key) {
        try {
            if (this.redisClient && this.redisClient.isOpen) {
                await this.redisClient.del(key);
            }
            this.memoryCache.delete(key);

            // Eliminar de disco
            try {
                const filename = this.getFilenameForKey(key);
                const filepath = path.join(this.diskCachePath, filename);
                await fs.unlink(filepath);
            } catch (err) {
                // Archivo no existe, ok
            }

            logger.debug(`Cache DELETE: ${key}`);
            return true;
        } catch (error) {
            logger.error(`Cache DELETE error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Elimina múltiples claves por patrón
     */
    async deletePattern(pattern) {
        try {
            if (this.redisClient && this.redisClient.isOpen) {
                const keys = await this.redisClient.keys(pattern);
                if (keys.length > 0) {
                    await this.redisClient.del(keys);
                }
            }

            // Limpiar de memoria
            const regex = new RegExp(pattern.replace('*', '.*'));
            for (const key of this.memoryCache.keys()) {
                if (regex.test(key)) {
                    this.memoryCache.delete(key);
                }
            }

            logger.debug(`Cache DELETE PATTERN: ${pattern}`);
            return true;
        } catch (error) {
            logger.error(`Cache DELETE PATTERN error for ${pattern}:`, error);
            return false;
        }
    }

    /**
     * Obtiene estadísticas del cache
     */
    getStats() {
        return {
            redisAvailable: this.redisClient && this.redisClient.isOpen,
            memoryCacheSize: this.memoryCache.size,
            isInitialized: this.isInitialized,
            warmupInProgress: this.warmupInProgress
        };
    }

    /**
     * Verifica si el servicio está disponible
     */
    isAvailable() {
        return this.isInitialized;
    }
}

// Instancia singleton
const resilientCacheService = new ResilientCacheService();

module.exports = resilientCacheService;