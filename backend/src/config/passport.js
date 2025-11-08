const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passportJwt = require('passport-jwt');
const JwtStrategy = passportJwt.Strategy;
const ExtractJwt = passportJwt.ExtractJwt;
const { getMongoDB } = require('./database');
const { mongoDBCircuitBreaker } = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

// Función personalizada para extraer JWT del header con logging
// Esta función DEBE retornar un string o null, nunca undefined
const extractJwtFromHeader = function(req) {
  try {
    const authHeader = req.headers.authorization;
    logger.info('extractJwtFromHeader CALLED, authHeader type:', typeof authHeader, 'exists:', !!authHeader, 'value:', authHeader ? authHeader.substring(0, 30) : 'null');
    
    if (!authHeader) {
      logger.warn('No Authorization header found');
      return null;
    }
    
    if (typeof authHeader !== 'string') {
      logger.error('Authorization header is not a string, type:', typeof authHeader);
      return null;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Authorization header does not start with Bearer');
      return null;
    }
    
    const token = authHeader.substring(7).trim();
    
    // Asegurarse de que el token es una cadena válida
    if (!token || token.length === 0) {
      logger.warn('Token is empty after extraction');
      return null;
    }
    
    // Forzar conversión a string
    const tokenString = String(token);
    logger.info('Extracting JWT SUCCESS, token length:', tokenString.length, 'type:', typeof tokenString, 'first 20:', tokenString.substring(0, 20));
    
    // Verificar que es realmente un string
    if (typeof tokenString !== 'string') {
      logger.error('Token is not a string after conversion, type:', typeof tokenString);
      return null;
    }
    
    return tokenString;
  } catch (error) {
    logger.error('Error extracting JWT from header:', error);
    return null;
  }
};

// JWT Strategy para tokens
// Usar ExtractJwt.fromAuthHeaderAsBearerToken() que es la forma estándar
// Si no funciona, usar función personalizada
let jwtExtractor;

try {
  // Intentar usar ExtractJwt estándar primero
  if (ExtractJwt && ExtractJwt.fromAuthHeaderAsBearerToken) {
    jwtExtractor = ExtractJwt.fromAuthHeaderAsBearerToken();
    logger.info('Using ExtractJwt.fromAuthHeaderAsBearerToken()');
  } else {
    throw new Error('ExtractJwt.fromAuthHeaderAsBearerToken not available');
  }
} catch (error) {
  logger.warn('ExtractJwt failed, using custom function:', error.message);
  jwtExtractor = extractJwtFromHeader;
}

const jwtStrategyConfig = {
  jwtFromRequest: jwtExtractor,
  secretOrKey: process.env.JWT_SECRET || 'secret'
};

logger.info('JWT Strategy configured');

passport.use(
  new JwtStrategy(
    jwtStrategyConfig,
    async (payload, done) => {
      try {
        const db = getMongoDB();
        if (!db) {
          return done(null, false);
        }

        // Manejar tokens temporales (cuando MongoDB está caído)
        if (payload.temp && payload.email) {
          // Token temporal - buscar por email
          const user = await mongoDBCircuitBreaker.execute(
            async () => {
              return await db.collection('users').findOne({ email: payload.email });
            },
            async () => {
              return null;
            }
          );
          
          if (user) {
            return done(null, user);
          }
          // Si no existe aún, retornar datos temporales para permitir acceso limitado
          return done(null, {
            _id: `temp_${payload.email}`,
            email: payload.email,
            provider: payload.provider || 'google',
            temp: true
          });
        }

        // El payload puede tener 'id' (string) o '_id' (ObjectId)
        const userId = payload.id || payload._id;
        if (!userId) {
          // Si no tiene ID pero tiene email, buscar por email
          if (payload.email) {
            const user = await mongoDBCircuitBreaker.execute(
              async () => {
                return await db.collection('users').findOne({ email: payload.email });
              },
              async () => {
                return null;
              }
            );
            if (user) {
              return done(null, user);
            }
          }
          return done(null, false);
        }

        const { ObjectId } = require('mongodb');
        const user = await mongoDBCircuitBreaker.execute(
          async () => {
            // Intentar buscar por ObjectId o string
            try {
              // Si userId es un string válido de ObjectId, convertirlo
              if (typeof userId === 'string' && ObjectId.isValid(userId)) {
                const objectId = new ObjectId(userId);
                const foundUser = await db.collection('users').findOne({ _id: objectId });
                if (foundUser) {
                  return foundUser;
                }
              }
              // Si no se encontró, intentar como string directo
              return await db.collection('users').findOne({ _id: userId });
            } catch (e) {
              // Si falla la conversión, intentar búsqueda alternativa
              logger.warn('Error converting userId to ObjectId:', e.message);
              // Intentar buscar por string
              return await db.collection('users').findOne({ _id: userId });
            }
          },
          async () => {
            return null;
          }
        );

        if (user) {
          logger.info('User found by ID:', { userId, userEmail: user.email });
          return done(null, user);
        }
        
        logger.warn('User not found by ID:', { userId, payload });
        return done(null, false);
      } catch (error) {
        logger.error('JWT Strategy error:', error);
        return done(error, false);
      }
    }
  )
);

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost/api/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const db = getMongoDB();
          if (!db) {
            return done(new Error('MongoDB connection not available'), null);
          }

          // Buscar usuario existente por Google ID
          const existingUser = await mongoDBCircuitBreaker.execute(
            async () => {
              return await db.collection('users').findOne({
                $or: [
                  { googleId: profile.id },
                  { email: profile.emails[0]?.value }
                ]
              });
            },
            async () => {
              return null;
            }
          );

          if (existingUser) {
            // Actualizar con Google ID si no lo tiene
            if (!existingUser.googleId) {
              await mongoDBCircuitBreaker.execute(
                async () => {
                  await db.collection('users').updateOne(
                    { _id: existingUser._id },
                    { $set: { googleId: profile.id } }
                  );
                },
                async () => {}
              );
            }
            return done(null, existingUser);
          }

          // Crear nuevo usuario (se encolará para procesar después)
          const newUser = {
            googleId: profile.id,
            email: profile.emails[0]?.value,
            name: profile.displayName || profile.name?.givenName,
            picture: profile.photos[0]?.value,
            provider: 'google',
            createdAt: new Date()
          };

          return done(null, newUser);
        } catch (error) {
          logger.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
  logger.info('Google OAuth strategy registered successfully');
} else {
  logger.warn('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  // NO registrar ninguna estrategia - el middleware en auth.js manejará el error
  // Esto evita el error "Unknown authentication strategy" porque nunca se intentará usar
}

module.exports = passport;
