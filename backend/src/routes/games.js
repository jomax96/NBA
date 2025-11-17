const express = require('express');
const router = express.Router();
const { getMySQLPool } = require('../config/database');
const cacheService = require('../services/cacheService');
const { mysqlCircuitBreaker } = require('../utils/circuitBreaker');
const { optionalAuth } = require('../middleware/auth');
const queueService = require('../services/queueService');
const logger = require('../utils/logger');

/**
 * Buscar últimos partidos entre equipos (público, pero guarda historial si está autenticado)
 */
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { homeTeamId, awayTeamId, limit = 10 } = req.query;

    if (!homeTeamId || !awayTeamId) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren los parámetros homeTeamId y awayTeamId',
        nodeId: process.env.NODE_ID
      });
    }

    // Mantenerlos como strings porque en la BD son TEXT
    const homeId = String(homeTeamId);
    const awayId = String(awayTeamId);
    const resultLimit = Number(limit);

    if (isNaN(resultLimit) || resultLimit < 1) {
      return res.status(400).json({
        success: false,
        error: 'El límite debe ser un número válido mayor a 0',
        nodeId: process.env.NODE_ID
      });
    }

    const cacheKey = `games:search:${homeId}:${awayId}:${resultLimit}`;

    // Intentar desde caché
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        count: cached.length,
        source: 'cache',
        nodeId: process.env.NODE_ID
      });
    }

    // Construir query
    const query = `
      SELECT 
        game_id, 
        game_date,
        season_id,
        team_id_home,
        team_name_home as home_team,
        team_abbreviation_home as home_abbr,
        pts_home as home_team_score,
        team_id_away,
        team_name_away as visitor_team,
        team_abbreviation_away as visitor_abbr,
        pts_away as visitor_team_score,
        wl_home,
        wl_away,
        season_type
      FROM game
      WHERE team_id_home = ?
        AND team_id_away = ?
      ORDER BY game_date DESC 
      LIMIT ${resultLimit}
    `;

    const params = [homeId, awayId];

    // Ejecutar con circuit breaker
    const games = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) {
          throw new Error('MySQL pool not available');
        }

        logger.info('Executing games search query', {
          homeId,
          awayId,
          resultLimit
        });

        const [rows] = await pool.execute(query, params);

        logger.info('Games search successful', { rowCount: rows.length });

        return rows;
      },
      async () => {
        logger.warn('MySQL unavailable for games search - Circuit breaker fallback triggered', {
          nodeId: process.env.NODE_ID,
          homeId,
          awayId
        });
        return [];
      }
    );

    // Guardar en caché por 5 minutos
    await cacheService.set(cacheKey, games, 300);

    // Si el usuario está autenticado, guardar en historial (encolar)
    if (req.user && req.user._id) {
      try {
        await queueService.enqueueSearchHistory(req.user._id.toString(), {
          query: req.query,
          resultsCount: games.length,
          timestamp: new Date()
        });
      } catch (error) {
        logger.warn('Could not enqueue search history:', error);
      }
    }

    res.json({
      success: true,
      data: games,
      count: games.length,
      source: 'database',
      nodeId: process.env.NODE_ID
    });

  } catch (error) {
    logger.error('Error searching games', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error searching games',
      nodeId: process.env.NODE_ID
    });
  }
});

module.exports = router;