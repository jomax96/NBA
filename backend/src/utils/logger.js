const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'nba-backend',
    nodeId: process.env.NODE_ID || 'unknown'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// En producción, agregar transporte a archivo
// Comentado temporalmente para evitar problemas de permisos en Docker
// El directorio /app/logs se crea en el Dockerfile con permisos correctos
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_FILE_LOGS === 'true') {
  try {
    logger.add(new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }));
    logger.add(new winston.transports.File({
      filename: 'logs/combined.log'
    }));
  } catch (error) {
    // Si no se pueden crear archivos de log, continuar solo con console
    logger.warn('No se pudieron crear archivos de log, usando solo console');
  }
}

module.exports = logger;

