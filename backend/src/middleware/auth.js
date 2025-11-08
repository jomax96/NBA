const passport = require('passport');

/**
 * Middleware de autenticación JWT usando Passport
 */
const authenticate = passport.authenticate('jwt', { session: false });

/**
 * Middleware opcional - verifica si hay usuario pero no requiere autenticación
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('authHeader', authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  // Si hay token, validarlo
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) {
      req.user = user;
    } else {
      req.user = null;
    }
    next();
  })(req, res, next);
}

module.exports = { authenticate, optionalAuth };

