const { publishMessage, QUEUE_NAME, checkRabbitMQHealth } = require('../config/rabbitmq');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Servicio de cola para escrituras asíncronas con fallback
 */
class QueueService {
  constructor() {
    this.fallbackQueue = [];
    this.maxFallbackSize = 1000;
    this.fallbackDir = path.join(__dirname, '../queue_fallback');
    this.processingFallback = false;

    // Inicializar directorio de fallback
    this.initFallbackDir();

    // Intentar procesar fallback cada 30 segundos
    setInterval(() => {
      this.processFallbackQueue().catch(err =>
        logger.error('Error processing fallback queue:', err)
      );
    }, 30000);
  }

  /**
   * Inicializa directorio de fallback
   */
  async initFallbackDir() {
    try {
      await fs.mkdir(this.fallbackDir, { recursive: true });

      // Cargar mensajes pendientes del disco al arrancar
      await this.loadFallbackFromDisk();
    } catch (error) {
      logger.error('Error initializing fallback directory:', error);
    }
  }

  /**
   * Carga mensajes de fallback desde disco
   */
  async loadFallbackFromDisk() {
    try {
      const files = await fs.readdir(this.fallbackDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(this.fallbackDir, file);
            const data = await fs.readFile(filepath, 'utf8');
            const message = JSON.parse(data);

            this.fallbackQueue.push(message);

            // Eliminar archivo después de cargarlo
            await fs.unlink(filepath);
          } catch (err) {
            logger.error(`Error loading fallback file ${file}:`, err);
          }
        }
      }

      if (this.fallbackQueue.length > 0) {
        logger.info(`✅ Loaded ${this.fallbackQueue.length} messages from fallback storage`);
      }
    } catch (error) {
      logger.debug('No fallback messages to load');
    }
  }

  /**
   * Guarda mensaje en fallback de disco
   */
  async saveFallbackToDisk(message) {
    try {
      const filename = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
      const filepath = path.join(this.fallbackDir, filename);

      await fs.writeFile(filepath, JSON.stringify(message, null, 2));
      logger.debug('Message saved to fallback disk:', filename);
    } catch (error) {
      logger.error('Error saving message to fallback disk:', error);
    }
  }

  /**
   * Procesa cola de fallback
   */
  async processFallbackQueue() {
    if (this.processingFallback || this.fallbackQueue.length === 0) {
      return;
    }

    // Verificar si RabbitMQ está disponible
    const isHealthy = await checkRabbitMQHealth();
    if (!isHealthy) {
      logger.debug('RabbitMQ not available, skipping fallback processing');
      return;
    }

    this.processingFallback = true;
    logger.info(`Processing ${this.fallbackQueue.length} messages from fallback queue`);

    const batch = this.fallbackQueue.splice(0, 10); // Procesar en lotes de 10

    for (const message of batch) {
      try {
        await publishMessage(QUEUE_NAME, message);
        logger.info('Fallback message published successfully:', message.type);
      } catch (error) {
        logger.error('Failed to publish fallback message:', error);
        // Devolver a la cola
        this.fallbackQueue.unshift(message);
        break; // Detener procesamiento si falla
      }
    }

    this.processingFallback = false;
  }

  /**
   * Encola operación con fallback automático
   */
  async enqueueUserOperation(operation) {
    try {
      const message = {
        type: operation.type,
        userId: operation.userId,
        data: operation.data,
        timestamp: new Date().toISOString(),
        nodeId: process.env.NODE_ID || 'unknown'
      };

      // Intentar publicar en RabbitMQ
      try {
        await publishMessage(QUEUE_NAME, message);
        logger.info(`Operation enqueued: ${operation.type}`, { userId: operation.userId });
        return { success: true, queued: true };
      } catch (error) {
        logger.warn(`Failed to enqueue to RabbitMQ, using fallback: ${error.message}`);

        // Fallback: guardar en memoria
        if (this.fallbackQueue.length < this.maxFallbackSize) {
          this.fallbackQueue.push(message);

          // Persistir en disco para seguridad
          await this.saveFallbackToDisk(message);

          logger.info(`Operation saved to fallback queue: ${operation.type}`, {
            userId: operation.userId,
            queueSize: this.fallbackQueue.length
          });

          return { success: true, queued: false, fallback: true };
        } else {
          logger.error('Fallback queue is full, operation will be lost');
          throw new Error('Queue system is full');
        }
      }
    } catch (error) {
      logger.error('Error enqueueing operation:', error);
      throw error;
    }
  }

  /**
   * Encola registro de usuario
   */
  async enqueueUserRegistration(userData) {
    return this.enqueueUserOperation({
      type: 'register',
      userId: null,
      data: userData
    });
  }

  /**
   * Encola favorito
   */
  async enqueueFavorite(userId, favoriteType, favoriteId, action) {
    return this.enqueueUserOperation({
      type: 'favorite',
      userId,
      data: {
        favoriteType,
        favoriteId,
        action
      }
    });
  }

  /**
   * Encola alerta personalizada
   */
  async enqueueAlert(userId, alertData) {
    return this.enqueueUserOperation({
      type: 'alert',
      userId,
      data: alertData
    });
  }

  /**
   * Encola historial de búsqueda
   */
  async enqueueSearchHistory(userId, searchData) {
    return this.enqueueUserOperation({
      type: 'search_history',
      userId,
      data: searchData
    });
  }

  /**
   * Encola solicitud de predicción ML
   */
  async enqueuePredictionRequest(userId, predictionData) {
    return this.enqueueUserOperation({
      type: 'prediction',
      userId,
      data: predictionData
    });
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats() {
    return {
      fallbackQueueSize: this.fallbackQueue.length,
      maxFallbackSize: this.maxFallbackSize,
      processingFallback: this.processingFallback
    };
  }
}

// Instancia singleton
const queueService = new QueueService();

module.exports = queueService;