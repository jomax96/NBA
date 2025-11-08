const express = require('express');
const router = express.Router();

// Health check
router.get('/health', async (req, res) => {
  const { checkMySQLHealth, checkMongoDBHealth } = require('../config/database');
  const { checkRedisHealth } = require('../config/redis');
  const { checkRabbitMQHealth } = require('../config/rabbitmq');
  const { mongoDBCircuitBreaker, mysqlCircuitBreaker } = require('../utils/circuitBreaker');

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

// API routes
// Rutas públicas (sin autenticación requerida)
router.use('/teams', require('./teams'));
router.use('/players', require('./players'));
router.use('/games', require('./games'));
router.use('/predictions', require('./predictions'));

// Rutas de autenticación (públicas)
router.use('/auth', require('./auth'));

// Rutas de usuarios (algunas públicas, algunas requieren auth)
router.use('/users', require('./users'));

module.exports = router;

