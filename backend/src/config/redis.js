const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Inicializa cliente Redis
 */
async function initRedis() {
  try {
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis: Connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis connected and ready');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis: Reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('❌ Redis connection error:', error.message);
    // Redis no es crítico, continuamos sin él
    return null;
  }
}

/**
 * Obtiene cliente Redis
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Verifica salud de Redis
 */
async function checkRedisHealth() {
  try {
    if (!redisClient || !redisClient.isOpen) return false;
    await redisClient.ping();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Cierra conexión Redis
 */
async function closeRedis() {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis:', error);
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  checkRedisHealth,
  closeRedis
};

