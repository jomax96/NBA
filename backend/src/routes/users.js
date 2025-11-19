const express = require('express');
const router = express.Router();
const { getMongoDB } = require('../config/database');
const queueService = require('../services/queueService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { publishMessage } = require('../config/rabbitmq');

/**
 * Función helper para publicar notificación de registro
 */
async function publishRegistrationNotification(userId, userData) {
  try {
    await publishMessage('notifications.queue', {
      userId: userId,
      type: 'auth.register',
      data: {
        name: userData.name,
        email: userData.email,
        provider: userData.provider || 'local',
        timestamp: new Date().toISOString()
      }
    });
    logger.info('Registration notification published for user:', userId);
  } catch (error) {
    logger.error('Error publishing registration notification:', error);
    // No lanzar error - la notificación no es crítica
  }
}

/**
 * Función helper para publicar notificación de login
 */
async function publishLoginNotification(userId, loginData) {
  try {
    await publishMessage('notifications.queue', {
      userId: userId,
      type: 'auth.login',
      data: {
        email: loginData.email,
        provider: loginData.provider || 'local',
        ip: loginData.ip,
        userAgent: loginData.userAgent,
        timezone: loginData.timezone || 'UTC',
        timestamp: new Date().toISOString()
      }
    });
    logger.info('Login notification published for user:', userId);
  } catch (error) {
    logger.error('Error publishing login notification:', error);
    // No lanzar error - la notificación no es crítica
  }
}

/**
 * Registrar nuevo usuario
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const db = getMongoDB();
    const { mongoDBCircuitBreaker } = require('../utils/circuitBreaker');

    // Intentar crear el usuario directamente si MongoDB está disponible
    const result = await mongoDBCircuitBreaker.execute(
      async () => {
        if (!db) {
          throw new Error('MongoDB connection not available');
        }

        // Verificar si el usuario ya existe
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
          throw new Error('USER_EXISTS');
        }

        // Crear usuario
        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = {
          email,
          password: hashedPassword,
          name,
          provider: 'local',
          createdAt: new Date()
        };

        const insertResult = await db.collection('users').insertOne(userData);

        return {
          userId: insertResult.insertedId.toString(),
          email,
          name
        };
      },
      async () => {
        // Fallback: Si MongoDB no está disponible, encolar
        logger.warn('MongoDB unavailable, enqueuing user registration');
        await queueService.enqueueUserRegistration({
          email,
          password: await bcrypt.hash(password, 10),
          name,
          provider: 'local'
        });
        return null;
      }
    );

    if (!result) {
      // Usuario encolado
      return res.json({
        success: true,
        message: 'Registration request queued. You will receive confirmation shortly.',
        nodeId: process.env.NODE_ID
      });
    }

    // Usuario creado exitosamente - enviar notificación
    await publishRegistrationNotification(result.userId, {
      name: name || email,
      email: email,
      provider: 'local'
    });

    // Generar token automáticamente
    const token = jwt.sign(
      {
        id: result.userId,
        email: email,
        provider: 'local'
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: result.userId,
        email: email,
        name: name,
        provider: 'local'
      },
      nodeId: process.env.NODE_ID
    });

  } catch (error) {
    if (error.message === 'USER_EXISTS') {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        nodeId: process.env.NODE_ID
      });
    }

    logger.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      error: 'Error registering user',
      nodeId: process.env.NODE_ID
    });
  }
});

/**
 * Login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const { mongoDBCircuitBreaker } = require('../utils/circuitBreaker');
    const db = getMongoDB();

    // Usar Circuit Breaker para MongoDB (SPOF intencional)
    const user = await mongoDBCircuitBreaker.execute(
      async () => {
        if (!db) {
          throw new Error('MongoDB connection not available');
        }
        return await db.collection('users').findOne({ email });
      },
      async () => {
        // Fallback: retornar null si MongoDB no disponible
        return null;
      }
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verificar si el usuario tiene password (puede ser usuario de Google)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        error: 'This account uses Google authentication. Please login with Google.'
      });
    }

    // Verificar password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generar token
    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        provider: user.provider || 'local'
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Enviar notificación de login
    await publishLoginNotification(user._id.toString(), {
      email: user.email, // IMPORTANTE: incluir email
      provider: 'local',
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider || 'local'
      },
      nodeId: process.env.NODE_ID
    });

  } catch (error) {
    logger.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      error: 'Error logging in',
      nodeId: process.env.NODE_ID
    });
  }
});

/**
 * Obtener favoritos del usuario (requiere autenticación)
 * CORREGIDO: Mapear campos de MongoDB a formato esperado por frontend
 */
router.get('/favorites', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { mongoDBCircuitBreaker } = require('../utils/circuitBreaker');
    const db = getMongoDB();

    const favorites = await mongoDBCircuitBreaker.execute(
      async () => {
        if (!db) throw new Error('MongoDB connection not available');
        const docs = await db.collection('favorites').find({ userId }).toArray();

        // IMPORTANTE: Mapear campos de MongoDB a formato esperado por frontend
        return docs.map(fav => ({
          _id: fav._id,
          userId: fav.userId,
          favoriteType: fav.type,      // type -> favoriteType
          favoriteId: fav.itemId,      // itemId -> favoriteId
          createdAt: fav.createdAt,
          updatedAt: fav.updatedAt
        }));
      },
      async () => {
        // Fallback: retornar vacío
        return [];
      }
    );

    res.json({
      success: true,
      data: favorites,
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting favorites',
      nodeId: process.env.NODE_ID
    });
  }
});

/**
 * Añadir/eliminar favorito (requiere autenticación)
 */
router.post('/favorites', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { type, id, action = 'add' } = req.body;

    if (!type || !id) {
      return res.status(400).json({
        success: false,
        error: 'type and id are required'
      });
    }

    // Encolar operación
    await queueService.enqueueFavorite(userId, type, id, action);

    res.json({
      success: true,
      message: `Favorite ${action} operation queued`,
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error managing favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Error managing favorite',
      nodeId: process.env.NODE_ID
    });
  }
});

/**
 * Obtener historial de búsquedas (requiere autenticación)
 */
router.get('/search-history', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { limit = 50 } = req.query;
    const { mongoDBCircuitBreaker } = require('../utils/circuitBreaker');
    const db = getMongoDB();

    const history = await mongoDBCircuitBreaker.execute(
      async () => {
        if (!db) throw new Error('MongoDB connection not available');
        return await db.collection('search_history')
          .find({ userId })
          .sort({ timestamp: -1 })
          .limit(parseInt(limit))
          .toArray();
      },
      async () => {
        return [];
      }
    );

    res.json({
      success: true,
      data: history,
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting search history:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting search history',
      nodeId: process.env.NODE_ID
    });
  }
});

/**
 * Obtener alertas del usuario (requiere autenticación)
 */
router.get('/alerts', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { mongoDBCircuitBreaker } = require('../utils/circuitBreaker');
    const db = getMongoDB();

    const alerts = await mongoDBCircuitBreaker.execute(
      async () => {
        if (!db) throw new Error('MongoDB connection not available');
        return await db.collection('alerts').find({ userId }).toArray();
      },
      async () => {
        return [];
      }
    );

    res.json({
      success: true,
      data: alerts,
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting alerts',
      nodeId: process.env.NODE_ID
    });
  }
});

/**
 * Crear alerta (requiere autenticación)
 */
router.post('/alerts', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { type, targetId, condition, value } = req.body;

    if (!type || !targetId || !condition) {
      return res.status(400).json({
        success: false,
        error: 'type, targetId, and condition are required'
      });
    }

    // Encolar operación
    await queueService.enqueueAlert(userId, { type, targetId, condition, value });

    res.json({
      success: true,
      message: 'Alert creation queued',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating alert',
      nodeId: process.env.NODE_ID
    });
  }
});

/**
 * Perfil del usuario actual (requiere autenticación)
 */
router.get('/profile', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        provider: req.user.provider,
        createdAt: req.user.createdAt
      },
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting profile',
      nodeId: process.env.NODE_ID
    });
  }
});

module.exports = router;