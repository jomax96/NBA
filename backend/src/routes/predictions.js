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
    const userId = req.user?.id || null;

    if (!homeTeamId || !visitorTeamId) {
      return res.status(400).json({
        success: false,
        error: 'homeTeamId and visitorTeamId are required'
      });
    }

    // Intentar llamar al microservicio ML
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml-predictions:5000';
      const response = await axios.post(`${mlServiceUrl}/predict`, {
        home_team_id: homeTeamId,
        visitor_team_id: visitorTeamId
      }, {
        timeout: 5000
      });

      // Encolar solicitud para historial (usuario autenticado - requerido por middleware)
    const userId = req.user._id.toString();
    await queueService.enqueuePredictionRequest(userId, {
      homeTeamId,
      visitorTeamId,
      prediction: response.data
    });

      return res.json({
        success: true,
        data: response.data,
        source: 'ml-service',
        nodeId: process.env.NODE_ID
      });
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.warn('ML service unavailable, returning placeholder');
        return res.json({
          success: true,
          data: {
            prediction: 'ML service temporarily unavailable',
            home_team_win_probability: 50,
            visitor_team_win_probability: 50
          },
          source: 'fallback',
          nodeId: process.env.NODE_ID
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error getting prediction:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting prediction',
      nodeId: process.env.NODE_ID
    });
  }
});

module.exports = router;

