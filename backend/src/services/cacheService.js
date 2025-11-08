const { getRedisClient, checkRedisHealth } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Servicio de caché usando Redis
 */
class CacheService {
  constructor() {
    this.defaultTTL = parseInt(process.env.REDIS_TTL) || 300; // 5 minutos
    this.redisClient = null;
  }

  /**
   * Inicializa servicio de caché
   */
  async init() {
    this.redisClient = getRedisClient();
    return checkRedisHealth();
  }

  /**
   * Obtiene valor de caché
   */
  async get(key) {
    try {
      if (!this.redisClient || !this.redisClient.isOpen) {
        return null;
      }

      const value = await this.redisClient.get(key);
      if (value) {
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(value);
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Establece valor en caché
   */
  async set(key, value, ttl = null) {
    try {
      if (!this.redisClient || !this.redisClient.isOpen) {
        return false;
      }

      const ttlSeconds = ttl || this.defaultTTL;
      await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Elimina clave de caché
   */
  async delete(key) {
    try {
      if (!this.redisClient || !this.redisClient.isOpen) {
        return false;
      }

      await this.redisClient.del(key);
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
      if (!this.redisClient || !this.redisClient.isOpen) {
        return false;
      }

      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        logger.debug(`Cache DELETE PATTERN: ${pattern} (${keys.length} keys)`);
      }
      return true;
    } catch (error) {
      logger.error(`Cache DELETE PATTERN error for ${pattern}:`, error);
      return false;
    }
  }

  /**
   * Verifica si el servicio está disponible
   */
  isAvailable() {
    return this.redisClient && this.redisClient.isOpen;
  }
}

// Instancia singleton
const cacheService = new CacheService();

module.exports = cacheService;

