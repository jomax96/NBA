// backend/src/services/cacheWarmupService.js
const { getMySQLPool } = require('../config/database');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Servicio para precargar datos críticos en Redis al iniciar
 * Esto garantiza disponibilidad incluso si MySQL cae
 */
class CacheWarmupService {
    constructor() {
        this.isWarmedUp = false;
        this.criticalDataLoaded = false;
    }

    /**
     * Precarga todos los datos críticos
     */
    async warmupCache() {
        try {
            logger.info('🔥 Starting cache warm-up process...');

            // Intentar precargar datos críticos
            const results = await Promise.allSettled([
                this.loadAllTeams(),
                this.loadTopPlayers(),
                this.loadRecentGames()
            ]);

            // Verificar cuántos se cargaron exitosamente
            const successCount = results.filter(r => r.status === 'fulfilled').length;

            if (successCount >= 2) {
                this.criticalDataLoaded = true;
                logger.info(`✅ Cache warm-up completed: ${successCount}/3 datasets loaded`);
            } else {
                logger.warn(`⚠️ Cache warm-up partial: only ${successCount}/3 datasets loaded`);
            }

            this.isWarmedUp = true;
            return true;
        } catch (error) {
            logger.error('❌ Cache warm-up failed:', error);
            this.isWarmedUp = true; // Marcar como completado para no bloquear
            return false;
        }
    }

    /**
     * Precarga todos los equipos
     */
    async loadAllTeams() {
        try {
            const pool = getMySQLPool();
            if (!pool) {
                logger.warn('MySQL not available for teams warm-up');
                return false;
            }

            const [teams] = await pool.execute(
                'SELECT id, full_name, abbreviation, nickname, city, state, year_founded FROM team ORDER BY full_name'
            );

            await cacheService.set('teams:all', teams, 3600); // 1 hora
            logger.info(`✅ Preloaded ${teams.length} teams to cache`);
            return true;
        } catch (error) {
            logger.error('Error loading teams:', error);
            return false;
        }
    }

    /**
     * Precarga top 100 jugadores
     */
    async loadTopPlayers() {
        try {
            const pool = getMySQLPool();
            if (!pool) {
                logger.warn('MySQL not available for players warm-up');
                return false;
            }

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

            await cacheService.set('players:top100', players, 600); // 10 minutos
            logger.info(`✅ Preloaded ${players.length} players to cache`);
            return true;
        } catch (error) {
            logger.error('Error loading players:', error);
            return false;
        }
    }

    /**
     * Precarga partidos recientes más consultados
     */
    async loadRecentGames() {
        try {
            const pool = getMySQLPool();
            if (!pool) {
                logger.warn('MySQL not available for games warm-up');
                return false;
            }

            // Cargar últimos 100 partidos (los más probables de ser consultados)
            const [games] = await pool.execute(
                `SELECT 
          game_id, 
          game_date,
          season_id,
          team_id_home,
          team_name_home as home_team,
          team_abbreviation_home as home_abbr,
          pts_home as home_team_score,
          team_id_away,
          team_name_away as visitor_team,
          team_abbreviation_away as visitor_abbr,
          pts_away as visitor_team_score,
          wl_home,
          wl_away,
          season_type
        FROM game
        ORDER BY game_date DESC 
        LIMIT 100`
            );

            await cacheService.set('games:recent', games, 600); // 10 minutos
            logger.info(`✅ Preloaded ${games.length} recent games to cache`);
            return true;
        } catch (error) {
            logger.error('Error loading recent games:', error);
            return false;
        }
    }

    /**
     * Recarga periódica del cache (mientras MySQL esté disponible)
     */
    async schedulePeriodicRefresh(intervalMinutes = 15) {
        setInterval(async () => {
            const { checkMySQLHealth } = require('../config/database');
            const isHealthy = await checkMySQLHealth();

            if (isHealthy) {
                logger.info('🔄 Refreshing cache with fresh data from MySQL...');
                await this.warmupCache();
            } else {
                logger.warn('⏭️ Skipping cache refresh - MySQL unavailable');
            }
        }, intervalMinutes * 60 * 1000);

        logger.info(`📅 Scheduled cache refresh every ${intervalMinutes} minutes`);
    }

    /**
     * Verifica si el cache está listo
     */
    isCacheReady() {
        return this.isWarmedUp && this.criticalDataLoaded;
    }
}

// Instancia singleton
const cacheWarmupService = new CacheWarmupService();

module.exports = cacheWarmupService;