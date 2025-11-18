require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { initMySQL, initMongoDB, checkMySQLHealth } = require('./config/database');
const { initRedis } = require('./config/redis');
const { initRabbitMQ, consumeMessages } = require('./config/rabbitmq');
const { authenticate } = require('./middleware/auth');
const { getMongoDB } = require('./config/database');
const { ObjectId } = require('mongodb'); // NUEVO: Agregado para manejar ObjectIds

// Inicializar Passport para autenticación
const passport = require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar trust proxy para NGINX (requerido para rate limiting con X-Forwarded-For)
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

// Rate limiting - aplicar solo a rutas que NO son de autenticación
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  skip: (req) => {
    // Excluir rutas de autenticación del rate limiting
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

// Aplicar rate limiting solo después de verificar que no es ruta de autenticación
app.use('/api/', (req, res, next) => {
  const path = req.path || req.url || req.originalUrl || '';
  const isAuthRoute = path.includes('/auth/') ||
    path.includes('/users/login') ||
    path.includes('/users/register');

  if (isAuthRoute) {
    // Saltar rate limiting para rutas de autenticación
    return next();
  }
  // Aplicar rate limiting para otras rutas
  return limiter(req, res, next);
});

// Health check endpoint (sin rate limiting)
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
      rabbitmq: await checkRabbitMQHealth()
    },
    circuitBreakers: {
      mongodb: mongoDBCircuitBreaker.getState(), // SPOF intencional - monitoreado
      mysql: mysqlCircuitBreaker.getState() // Read-Only, menos crítico
    }
  };

  const allHealthy = Object.values(health.services).every(v => v === true);
  res.status(allHealthy ? 200 : 503).json(health);
});

// Routes
app.use('/api', require('./routes/index'));

// Queue Worker: Procesa escrituras a MongoDB desde RabbitMQ
// Este worker consume la cola y persiste datos en MongoDB (SPOF intencional)
async function startQueueWorker() {
  try {
    await consumeMessages('user.operations', async (message) => {
      logger.info('Queue Worker: Processing queued operation:', {
        type: message.type,
        userId: message.userId,
        nodeId: message.nodeId
      });

      const { mongoDBCircuitBreaker } = require('./utils/circuitBreaker');

      // Usar Circuit Breaker para MongoDB - todas las operaciones dentro
      await mongoDBCircuitBreaker.execute(
        async () => {
          const db = getMongoDB();
          if (!db) {
            throw new Error('MongoDB connection not available');
          }

          // Procesar operación según tipo
          switch (message.type) {
            case 'register':
              try {
                const { email, password, name, googleId, picture, provider } = message.data;
                const userData = {
                  email,
                  name,
                  createdAt: new Date()
                };

                // Si tiene password, es registro tradicional
                if (password) {
                  userData.password = password; // Ya está hasheado
                }

                // Si tiene googleId, es registro con Google
                if (googleId) {
                  userData.googleId = googleId;
                  userData.provider = provider || 'google';
                  if (picture) userData.picture = picture;
                }

                await db.collection('users').insertOne(userData);
                logger.info('User registered:', email);
              } catch (error) {
                if (error.code !== 11000) { // Duplicate key
                  throw error;
                }
                logger.warn('User already exists:', message.data.email);
              }
              break;

            // ===== CASO FAVORITOS - CORREGIDO =====
            case 'favorite':
              try {
                const { favoriteType, favoriteId, action } = message.data;
                const userId = message.userId; // Este viene como string desde la cola

                logger.info(`Processing favorite ${action}:`, {
                  userId,
                  favoriteType,
                  favoriteId
                });

                if (action === 'add') {
                  // Agregar favorito (evitar duplicados con upsert)
                  const result = await db.collection('favorites').updateOne(
                    {
                      userId: userId, // Guardar como string, es más flexible
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
                    { upsert: true } // Crear si no existe
                  );

                  logger.info(`✅ Favorite added for user: ${userId}`, {
                    type: favoriteType,
                    itemId: favoriteId,
                    upserted: result.upsertedCount,
                    modified: result.modifiedCount
                  });

                } else if (action === 'remove') {
                  // Eliminar favorito
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
          // Fallback: MongoDB no disponible, mensaje se reencola
          logger.warn('MongoDB Circuit Breaker OPEN - operation will be retried later');
          throw new Error('MongoDB unavailable - message will be retried');
        }
      );
    });

    logger.info('✅ Queue worker started successfully');
  } catch (error) {
    logger.error('❌ Error starting queue worker:', error);
    // Reintentar después de 10 segundos
    setTimeout(() => {
      logger.info('Retrying queue worker initialization...');
      startQueueWorker();
    }, 10000);
  }
}

// Inicialización
async function start() {
  try {
    // Inicializar conexiones (no bloqueantes)
    Promise.all([
      initMySQL().catch(err => logger.error('MySQL init failed:', err)),
      initMongoDB().catch(err => logger.error('MongoDB init failed:', err)),
      initRedis().catch(err => logger.warn('Redis init failed:', err)),
      initRabbitMQ().catch(err => logger.warn('RabbitMQ init failed:', err))
    ]).then(() => {
      // Iniciar worker de cola después de conectar RabbitMQ
      setTimeout(() => {
        startQueueWorker().catch(err => logger.error('Queue worker failed:', err));
      }, 5000);
    });

    // Iniciar servidor
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} (Node: ${process.env.NODE_ID || 'unknown'})`);
    });

    // Health check periódico de MongoDB (SPOF intencional)
    setInterval(async () => {
      const { checkMongoDBHealth } = require('./config/database');
      const { mongoDBCircuitBreaker } = require('./utils/circuitBreaker');

      const isHealthy = await checkMongoDBHealth();
      if (!isHealthy) {
        logger.warn('MongoDB health check failed');
      }
      // El Circuit Breaker se actualiza automáticamente en las operaciones
    }, 10000); // Cada 10 segundos

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Manejo de señales
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  const { closeConnections } = require('./config/database');
  const { closeRedis } = require('./config/redis');
  const { closeRabbitMQ } = require('./config/rabbitmq');

  await Promise.all([
    closeConnections(),
    closeRedis(),
    closeRabbitMQ()
  ]);
  process.exit(0);
});

start();