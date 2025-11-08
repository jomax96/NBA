const { publishMessage, QUEUE_NAME } = require('../config/rabbitmq');
const logger = require('../utils/logger');

/**
 * Servicio de cola para escrituras asíncronas
 */
class QueueService {
  /**
   * Encola operación de usuario
   */
  async enqueueUserOperation(operation) {
    try {
      const message = {
        type: operation.type, // 'register', 'favorite', 'alert', 'search_history', 'prediction'
        userId: operation.userId,
        data: operation.data,
        timestamp: new Date().toISOString(),
        nodeId: process.env.NODE_ID || 'unknown'
      };

      await publishMessage(QUEUE_NAME, message);
      logger.info(`Operation enqueued: ${operation.type}`, { userId: operation.userId });
      return true;
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
        favoriteType, // 'team' o 'player'
        favoriteId,
        action // 'add' o 'remove'
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
}

// Instancia singleton
const queueService = new QueueService();

module.exports = queueService;

