const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');
const queueService = require('../services/queueService');
const { authenticate } = require('../middleware/auth');

/**
 * Solicitar predicción de partido (REQUIERE AUTENTICACIÓN)
 */
router.post('/predict', authenticate, async (req, res) => {
  try {
    const { homeTeamId, visitorTeamId } = req.body;

    // Validación de parámetros
    if (!homeTeamId || !visitorTeamId) {
      return res.status(400).json({
        success: false,
        error: 'homeTeamId and visitorTeamId are required',
        nodeId: process.env.NODE_ID
      });
    }

    // Convertir a strings (los team_id son TEXT en la BD)
    const homeId = String(homeTeamId);
    const visitorId = String(visitorTeamId);

    logger.info('Requesting game prediction', {
      homeTeamId: homeId,
      visitorTeamId: visitorId,
      userId: req.user._id
    });

    // Intentar llamar al microservicio ML
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml-predictions:5000';

      const response = await axios.post(`${mlServiceUrl}/predict`, {
        home_team_id: homeId,      // Enviar como string
        visitor_team_id: visitorId  // Enviar como string
      }, {
        timeout: 10000, // 10 segundos (las predicciones pueden tardar)
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('ML prediction successful', {
        homeTeamId: homeId,
        visitorTeamId: visitorId,
        prediction: response.data.predicted_winner
      });

      // Encolar solicitud para historial (usuario autenticado)
      try {
        const userId = req.user._id.toString();
        await queueService.enqueuePredictionRequest(userId, {
          homeTeamId: homeId,
          visitorTeamId: visitorId,
          prediction: response.data,
          timestamp: new Date()
        });
      } catch (queueError) {
        // No fallar si falla el encolado
        logger.warn('Could not enqueue prediction request:', queueError);
      }

      return res.json({
        success: true,
        data: response.data,
        source: 'ml-service',
        nodeId: process.env.NODE_ID
      });

    } catch (mlError) {
      // Logging detallado del error
      logger.error('ML service error', {
        code: mlError.code,
        message: mlError.message,
        response: mlError.response?.data,
        status: mlError.response?.status
      });

      // Fallback si el servicio ML no está disponible
      if (mlError.code === 'ECONNREFUSED' ||
        mlError.code === 'ETIMEDOUT' ||
        mlError.code === 'ENOTFOUND' ||
        mlError.code === 'ECONNRESET') {

        logger.warn('ML service unavailable, returning fallback response', {
          homeTeamId: homeId,
          visitorTeamId: visitorId
        });

        // Fallback básico con ventaja de local
        return res.json({
          success: true,
          data: {
            home_team_id: homeId,
            visitor_team_id: visitorId,
            home_team_win_probability: 55.0,
            visitor_team_win_probability: 45.0,
            predicted_winner: 'home',
            estimated_score: {
              home: 105,
              visitor: 100
            },
            confidence: 'low',
            note: 'ML service temporarily unavailable - using fallback prediction'
          },
          source: 'fallback',
          nodeId: process.env.NODE_ID
        });
      }

      // Si es otro tipo de error, propagarlo
      throw mlError;
    }

  } catch (error) {
    logger.error('Error in prediction endpoint', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    // Evitar enviar respuesta duplicada
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Error getting prediction',
        details: error.message,
        nodeId: process.env.NODE_ID
      });
    }
  }
});

/**
 * Obtener historial de predicciones del usuario autenticado
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const limit = parseInt(req.query.limit) || 20;

    logger.info('Fetching prediction history', { userId, limit });

    // Aquí deberías implementar la lógica para obtener el historial
    // Por ahora, respuesta placeholder
    res.json({
      success: true,
      data: [],
      message: 'Prediction history feature coming soon',
      nodeId: process.env.NODE_ID
    });

  } catch (error) {
    logger.error('Error fetching prediction history:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching prediction history',
      nodeId: process.env.NODE_ID
    });
  }
});

module.exports = router;