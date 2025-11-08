const express = require('express');
const router = express.Router();
const { getMySQLPool } = require('../config/database');
const cacheService = require('../services/cacheService');
const { mysqlCircuitBreaker } = require('../utils/circuitBreaker');
const { optionalAuth } = require('../middleware/auth');
const queueService = require('../services/queueService');
const logger = require('../utils/logger');

/**
 * Buscar partidos con filtros (público, pero guarda historial si está autenticado)
 */
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { teamId, dateFrom, dateTo, limit = 50 } = req.query;
    const cacheKey = `games:search:${JSON.stringify(req.query)}`;

    // Intentar desde caché
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        source: 'cache',
        nodeId: process.env.NODE_ID
      });
    }

    // Construir query
    let query = `
      SELECT g.game_id, g.game_date, 
             ht.team_name as home_team, ht.abbreviation as home_abbr,
             vt.team_name as visitor_team, vt.abbreviation as visitor_abbr,
             g.home_team_score, g.visitor_team_score
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.team_id
      JOIN teams vt ON g.visitor_team_id = vt.team_id
      WHERE 1=1
    `;
    const params = [];

    if (teamId) {
      query += ' AND (g.home_team_id = ? OR g.visitor_team_id = ?)';
      params.push(teamId, teamId);
    }
    if (dateFrom) {
      query += ' AND g.game_date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND g.game_date <= ?';
      params.push(dateTo);
    }

    query += ' ORDER BY g.game_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const games = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) throw new Error('MySQL pool not available');
        const [rows] = await pool.execute(query, params);
        return rows;
      },
      async () => {
        logger.warn('MySQL unavailable for games search');
        return [];
      }
    );

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
        // No fallar si no se puede guardar historial
        logger.warn('Could not enqueue search history:', error);
      }
    }

    res.json({
      success: true,
      data: games,
      source: 'database',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error searching games:', error);
    res.status(500).json({
      success: false,
      error: 'Error searching games',
      nodeId: process.env.NODE_ID
    });
  }
});

module.exports = router;

