const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { getMongoDB } = require('../config/database');
const queueService = require('../services/queueService');
const { mongoDBCircuitBreaker } = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

/**
 * Rutas públicas de autenticación
 */

/**
 * Iniciar autenticación con Google
 */
router.get('/google', (req, res) => {
  // Verificar si Google OAuth está configurado ANTES de intentar usar passport
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Attempt to use Google OAuth without credentials configured');
    return res.status(503).json({
      success: false,
      error: 'Google OAuth is not configured',
      message: 'Para usar autenticación con Google, el administrador debe configurar las credenciales de Google OAuth. Por favor, use el método de autenticación tradicional (email/password).',
      instructions: 'Contacta al administrador o revisa la documentación en docs/GOOGLE_OAUTH_SETUP.md'
    });
  }
  
  // Si está configurado, usar passport (la estrategia debe estar registrada)
  try {
    return passport.authenticate('google', {
      scope: ['profile', 'email']
    })(req, res);
  } catch (error) {
    logger.error('Error in Google OAuth authentication:', error);
    return res.status(500).json({
      success: false,
      error: 'Error de configuración del servidor',
      message: 'Error al iniciar autenticación con Google. Por favor, contacta al administrador.'
    });
  }
});

/**
 * Callback de Google OAuth
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=google_auth_failed' }),
  async (req, res) => {
    try {
      const user = req.user;
      const db = getMongoDB();

      if (!db) {
        // Si MongoDB está caído, encolar la creación del usuario
        await queueService.enqueueUserRegistration({
          googleId: user.googleId,
          email: user.email,
          name: user.name,
          picture: user.picture,
          provider: 'google'
        });

        // Generar token temporal (se validará cuando MongoDB recupere)
        const tempToken = jwt.sign(
          { email: user.email, provider: 'google', temp: true },
          process.env.JWT_SECRET || 'secret',
          { expiresIn: '1h' }
        );

        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost'}/auth/callback?token=${tempToken}&temp=true`);
      }

      // Verificar si el usuario ya existe o crear uno nuevo
      let finalUser = await mongoDBCircuitBreaker.execute(
        async () => {
          if (!db) {
            throw new Error('MongoDB connection not available');
          }
          
          // Buscar usuario existente
          const existingUser = await db.collection('users').findOne({
            $or: [
              { googleId: user.googleId },
              { email: user.email }
            ]
          });

          if (existingUser) {
            // Si existe pero no tiene googleId, actualizarlo
            if (!existingUser.googleId) {
              await db.collection('users').updateOne(
                { _id: existingUser._id },
                { $set: { googleId: user.googleId } }
              );
            }
            return existingUser;
          }

          // Crear nuevo usuario directamente (síncrono)
          const userData = {
            googleId: user.googleId,
            email: user.email,
            name: user.name,
            picture: user.picture,
            provider: 'google',
            createdAt: new Date()
          };

          const result = await db.collection('users').insertOne(userData);
          return {
            _id: result.insertedId,
            ...userData
          };
        },
        async () => {
          // MongoDB no disponible - encolar y generar token temporal
          logger.warn('MongoDB unavailable, enqueuing user registration');
          const userData = {
            googleId: user.googleId,
            email: user.email,
            name: user.name,
            picture: user.picture,
            provider: 'google'
          };
          await queueService.enqueueUserRegistration(userData);
          
          // Retornar null para generar token temporal
          return null;
        }
      );

      // Generar JWT
      let token;
      if (finalUser) {
        // Usuario existe o fue creado - token normal
        token = jwt.sign(
          {
            id: finalUser._id.toString(),
            email: finalUser.email,
            provider: 'google'
          },
          process.env.JWT_SECRET || 'secret',
          { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
      } else {
        // MongoDB caído - token temporal basado en email
        token = jwt.sign(
          {
            email: user.email,
            provider: 'google',
            temp: true
          },
          process.env.JWT_SECRET || 'secret',
          { expiresIn: '1h' }
        );
      }

      // Redirigir al frontend con el token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      logger.error('Error in Google OAuth callback:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost'}/login?error=server_error`);
    }
  }
);

/**
 * Verificar token (para validar autenticación)
 */
router.get('/verify', async (req, res, next) => {
  // Verificar si hay token en el header
  const authHeader = req.headers.authorization;
  logger.info('Verifying token - authHeader:', authHeader ? `present: ${authHeader.substring(0, 30)}...` : 'missing');
  logger.info('All headers:', JSON.stringify(req.headers));
  
  if (!authHeader) {
    logger.warn('No Authorization header found');
    return res.status(401).json({
      success: false,
      error: 'No token provided',
      debug: 'Authorization header missing'
    });
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Authorization header does not start with Bearer, value:', authHeader.substring(0, 50));
    return res.status(401).json({
      success: false,
      error: 'Invalid token format',
      debug: 'Authorization header must start with "Bearer "'
    });
  }
  
  const token = authHeader.substring(7).trim(); // Remover "Bearer " y espacios
  logger.info('Token extracted, length:', token.length, 'First 20 chars:', token.substring(0, 20));
  
  // Verificar que el token sea una cadena válida
  if (!token || typeof token !== 'string' || token.length === 0) {
    logger.error('Invalid token format - not a string or empty');
    return res.status(401).json({
      success: false,
      error: 'Invalid token format'
    });
  }
  
  // Verificar el token manualmente primero para debug
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    logger.info('Token decoded successfully, payload:', { id: decoded.id, email: decoded.email });
    
    // Si el token es válido, buscar el usuario
    const db = getMongoDB();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable'
      });
    }
    
    const { ObjectId } = require('mongodb');
    const userId = decoded.id;
    const user = await mongoDBCircuitBreaker.execute(
      async () => {
        if (ObjectId.isValid(userId)) {
          return await db.collection('users').findOne({ _id: new ObjectId(userId) });
        }
        return await db.collection('users').findOne({ _id: userId });
      },
      async () => {
        return null;
      }
    );
    
    if (!user) {
      logger.warn('User not found for token, userId:', userId);
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    logger.info('Token verified successfully for user:', user.email);
    req.user = user;
    return res.json({
      success: true,
      user: {
        id: user._id?.toString() || user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider || 'google'
      }
    });
  } catch (jwtError) {
    logger.error('JWT verification error:', jwtError.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      details: jwtError.message
    });
  }
});

module.exports = router;

