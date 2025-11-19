require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { initMySQL, initMongoDB, checkMySQLHealth, getMongoDB } = require('./config/database');
const { initRedis } = require('./config/redis');
const { initRabbitMQ, consumeMessages } = require('./config/rabbitmq');
const resilientCacheService = require('./services/resilientCacheService'); // NUEVO
const { authenticate } = require('./middleware/auth');
const { ObjectId } = require('mongodb');
const cacheWarmupService = require('./services/cacheWarmupService');

// Inicializar Passport para autenticación
const passport = require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar trust proxy para NGINX
app.set('trust proxy', true);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: (req) => {
    const path = req.path || req.url || req.originalUrl || '';
    const isAuthRoute = path.includes('/auth/') ||
      path.includes('/users/login') ||
      path.includes('/users/register');
    return isAuthRoute;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.'
});

app.use('/api/', (req, res, next) => {
  const path = req.path || req.url || req.originalUrl || '';
  const isAuthRoute = path.includes('/auth/') ||
    path.includes('/users/login') ||
    path.includes('/users/register');

  if (isAuthRoute) {
    return next();
  }
  return limiter(req, res, next);
});

// Health check endpoint mejorado
app.get('/health', async (req, res) => {
  const { checkMySQLHealth, checkMongoDBHealth } = require('./config/database');
  const { checkRedisHealth } = require('./config/redis');
  const { checkRabbitMQHealth } = require('./config/rabbitmq');
  const { mongoDBCircuitBreaker, mysqlCircuitBreaker } = require('./utils/circuitBreaker');

  const health = {
    status: 'healthy',
    nodeId: process.env.NODE_ID || 'unknown',
    timestamp: new Date().toISOString(),
    services: {
      mysql: await checkMySQLHealth(),
      mongodb: await checkMongoDBHealth(),
      redis: await checkRedisHealth(),
      rabbitmq: await checkRabbitMQHealth(),
      cache: resilientCacheService.isAvailable() // NUEVO
    },
    circuitBreakers: {
      mongodb: mongoDBCircuitBreaker.getState(),
      mysql: mysqlCircuitBreaker.getState()
    },
    cache: resilientCacheService.getStats() // NUEVO: estadísticas del cache
  };

  // El sistema está sano si al menos cache y rabbitmq están disponibles
  const isCriticalHealthy = health.services.cache && health.services.rabbitmq;

  res.status(isCriticalHealthy ? 200 : 503).json(health);
});

// Routes
app.use('/api', require('./routes/index'));

/**
 * Queue Worker: Procesa escrituras a MongoDB desde RabbitMQ
 * Maneja errores y reintentos automáticamente
 */
async function startQueueWorker() {
  const maxRetries = 5;
  let retryCount = 0;

  async function attemptStart() {
    try {
      await consumeMessages('user.operations', async (message) => {
        logger.info('Queue Worker: Processing queued operation:', {
          type: message.type,
          userId: message.userId,
          nodeId: message.nodeId
        });

        const { mongoDBCircuitBreaker } = require('./utils/circuitBreaker');

        await mongoDBCircuitBreaker.execute(
          async () => {
            const db = getMongoDB();
            if (!db) {
              throw new Error('MongoDB connection not available');
            }

            switch (message.type) {
              case 'register':
                try {
                  const { email, password, name, googleId, picture, provider } = message.data;
                  const userData = {
                    email,
                    name,
                    createdAt: new Date()
                  };

                  if (password) {
                    userData.password = password;
                  }

                  if (googleId) {
                    userData.googleId = googleId;
                    userData.provider = provider || 'google';
                    if (picture) userData.picture = picture;
                  }

                  await db.collection('users').insertOne(userData);
                  logger.info('User registered:', email);
                } catch (error) {
                  if (error.code !== 11000) {
                    throw error;
                  }
                  logger.warn('User already exists:', message.data.email);
                }
                break;

              case 'favorite':
                try {
                  const { favoriteType, favoriteId, action } = message.data;
                  const userId = message.userId;

                  logger.info(`Processing favorite ${action}:`, {
                    userId,
                    favoriteType,
                    favoriteId
                  });

                  if (action === 'add') {
                    const result = await db.collection('favorites').updateOne(
                      {
                        userId: userId,
                        type: favoriteType,
                        itemId: favoriteId
                      },
                      {
                        $set: {
                          userId: userId,
                          type: favoriteType,
                          itemId: favoriteId,
                          createdAt: new Date(),
                          updatedAt: new Date()
                        }
                      },
                      { upsert: true }
                    );

                    logger.info(`✅ Favorite added for user: ${userId}`, {
                      type: favoriteType,
                      itemId: favoriteId,
                      upserted: result.upsertedCount,
                      modified: result.modifiedCount
                    });

                  } else if (action === 'remove') {
                    const result = await db.collection('favorites').deleteOne({
                      userId: userId,
                      type: favoriteType,
                      itemId: favoriteId
                    });

                    logger.info(`✅ Favorite removed for user: ${userId}`, {
                      type: favoriteType,
                      itemId: favoriteId,
                      deleted: result.deletedCount
                    });
                  } else {
                    logger.warn(`Unknown favorite action: ${action}`);
                  }
                } catch (error) {
                  logger.error('❌ Error processing favorite:', error);
                  throw error;
                }
                break;

              case 'alert':
                try {
                  const { type, targetId, condition, value } = message.data;
                  const userId = message.userId;

                  await db.collection('alerts').insertOne({
                    userId,
                    type,
                    targetId,
                    condition,
                    value,
                    active: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });

                  logger.info(`Alert created for user: ${userId}`, { type });
                } catch (error) {
                  logger.error('Error processing alert:', error);
                  throw error;
                }
                break;

              case 'search_history':
                try {
                  await db.collection('search_history').insertOne({
                    userId: message.userId,
                    ...message.data,
                    timestamp: new Date()
                  });
                  logger.info('Search history saved for user:', message.userId);
                } catch (error) {
                  logger.error('Error saving search history:', error);
                  throw error;
                }
                break;

              case 'prediction':
                try {
                  await db.collection('predictions').insertOne({
                    userId: message.userId,
                    ...message.data,
                    timestamp: new Date()
                  });
                  logger.info('Prediction saved for user:', message.userId);
                } catch (error) {
                  logger.error('Error saving prediction:', error);
                  throw error;
                }
                break;

              default:
                logger.warn('Unknown operation type:', message.type);
            }
          },
          async () => {
            logger.warn('MongoDB Circuit Breaker OPEN - operation will be retried later');
            throw new Error('MongoDB unavailable - message will be retried');
          }
        );
      });

      logger.info('✅ Queue worker started successfully');
      retryCount = 0; // Reset counter on success

    } catch (error) {
      retryCount++;
      logger.error(`❌ Error starting queue worker (attempt ${retryCount}/${maxRetries}):`, error);

      if (retryCount < maxRetries) {
        const delay = Math.min(retryCount * 5000, 30000); // Max 30 segundos
        logger.info(`Retrying queue worker in ${delay / 1000} seconds...`);

        setTimeout(() => {
          attemptStart();
        }, delay);
      } else {
        logger.error('❌ Max retries reached for queue worker. Manual intervention may be required.');
        // No detener el servidor, solo registrar el error
      }
    }
  }

  return attemptStart();
}

/**
 * Inicialización ordenada y resiliente
 */
async function start() {
  try {
    // 1. Inicializar conexiones (no bloqueantes)
    logger.info('🚀 Initializing services...');

    const initResults = await Promise.allSettled([
      initMySQL().catch(err => {
        logger.error('MySQL init failed:', err);
        return null;
      }),
      initMongoDB().catch(err => {
        logger.error('MongoDB init failed:', err);
        return null;
      }),
      initRedis().catch(err => {
        logger.warn('Redis init failed:', err);
        return null;
      }),
      initRabbitMQ().catch(err => {
        logger.warn('RabbitMQ init failed:', err);
        return null;
      })
    ]);

    // 2. IMPORTANTE: Precarga de cache (Cache Warmup)
    logger.info('🔥 Starting cache warm-up...');
    setTimeout(async () => {
      try {
        await cacheWarmupService.warmupCache();

        // Programar refrescos periódicos
        cacheWarmupService.schedulePeriodicRefresh(15); // Cada 15 minutos

        logger.info('✅ Cache warm-up completed successfully');
      } catch (error) {
        logger.error('❌ Cache warm-up failed:', error);
      }
    }, 5000); // Esperar 5 segundos para que MySQL esté listo

    // 3. Iniciar Queue Worker
    setTimeout(() => {
      startQueueWorker().catch(err => logger.error('Queue worker failed:', err));
    }, 7000); // Esperar 7 segundos

    // 4. Iniciar servidor (NO bloqueante)
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} (Node: ${process.env.NODE_ID || 'unknown'})`);
      logger.info('📊 Services status:', {
        mysql: initResults[0].status,
        mongodb: initResults[1].status,
        redis: initResults[2].status,
        rabbitmq: initResults[3].status
      });
    });

    // 5. Health checks periódicos
    // MongoDB (SPOF intencional)
    setInterval(async () => {
      const { checkMongoDBHealth } = require('./config/database');
      const isHealthy = await checkMongoDBHealth();

      if (!isHealthy) {
        logger.warn('⚠️ MongoDB health check failed - Circuit Breaker monitoring');
      }
    }, 10000); // Cada 10 segundos

    // MySQL (Read-Only)
    setInterval(async () => {
      const { checkMySQLHealth } = require('./config/database');
      const isHealthy = await checkMySQLHealth();

      if (!isHealthy) {
        logger.warn('⚠️ MySQL health check failed - serving from cache');
      } else {
        // Si MySQL recupera y cache no está actualizado, refrescar
        if (!cacheWarmupService.isCacheReady()) {
          logger.info('🔄 MySQL recovered, refreshing cache...');
          cacheWarmupService.warmupCache();
        }
      }
    }, 15000); // Cada 15 segundos

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Manejo de señales (ya existente, pero asegurar que cierre todo)
process.on('SIGTERM', async () => {
  logger.info('⚠️ SIGTERM received, shutting down gracefully...');

  const { closeConnections } = require('./config/database');
  const { closeRedis } = require('./config/redis');
  const { closeRabbitMQ } = require('./config/rabbitmq');

  await Promise.all([
    closeConnections(),
    closeRedis(),
    closeRabbitMQ()
  ]);

  logger.info('✅ All connections closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('⚠️ SIGINT received, shutting down gracefully...');

  const { closeConnections } = require('./config/database');
  const { closeRedis } = require('./config/redis');
  const { closeRabbitMQ } = require('./config/rabbitmq');

  await Promise.all([
    closeConnections(),
    closeRedis(),
    closeRabbitMQ()
  ]);

  logger.info('✅ All connections closed');
  process.exit(0);
});

start();