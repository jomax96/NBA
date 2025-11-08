const { getMySQLPool, checkMySQLHealth } = require('../config/database');
const cacheService = require('../services/cacheService');
const { mysqlCircuitBreaker } = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

/**
 * Obtiene todos los equipos
 */
async function getAllTeams(req, res) {
  try {
    const cacheKey = 'teams:all';
    
    // Intentar desde caché primero
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        source: 'cache',
        nodeId: process.env.NODE_ID
      });
    }

    // Si no está en caché, intentar desde BD
    const teams = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) throw new Error('MySQL pool not available');
        
        const [rows] = await pool.execute(
          'SELECT team_id, team_name, city, abbreviation, conference, division FROM teams ORDER BY team_name'
        );
        return rows;
      },
      async () => {
        // Fallback: retornar datos vacíos si BD está caída
        logger.warn('MySQL unavailable, returning empty teams list from cache fallback');
        return [];
      }
    );

    // Guardar en caché
    await cacheService.set(cacheKey, teams, 1800); // 30 minutos para datos históricos

    res.json({
      success: true,
      data: teams,
      source: 'database',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting teams:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching teams',
      nodeId: process.env.NODE_ID
    });
  }
}

/**
 * Obtiene estadísticas de un equipo
 */
async function getTeamStats(req, res) {
  try {
    const { teamId } = req.params;
    const cacheKey = `team:stats:${teamId}`;

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

    // Desde BD
    const stats = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) throw new Error('MySQL pool not available');
        
        const [rows] = await pool.execute(
          `SELECT 
            t.team_id, t.team_name, t.city, t.conference, t.division,
            COUNT(DISTINCT g.game_id) as total_games,
            SUM(CASE WHEN (g.home_team_id = t.team_id AND g.home_team_score > g.visitor_team_score) 
                      OR (g.visitor_team_id = t.team_id AND g.visitor_team_score > g.home_team_score) 
                      THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN (g.home_team_id = t.team_id AND g.home_team_score < g.visitor_team_score) 
                      OR (g.visitor_team_id = t.team_id AND g.visitor_team_score < g.home_team_score) 
                      THEN 1 ELSE 0 END) as losses
           FROM teams t
           LEFT JOIN games g ON g.home_team_id = t.team_id OR g.visitor_team_id = t.team_id
           WHERE t.team_id = ?
           GROUP BY t.team_id`,
          [teamId]
        );
        return rows[0] || null;
      },
      async () => {
        logger.warn(`MySQL unavailable for team stats: ${teamId}`);
        return null;
      }
    );

    if (stats) {
      await cacheService.set(cacheKey, stats, 300); // 5 minutos
    }

    res.json({
      success: true,
      data: stats,
      source: 'database',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting team stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching team statistics',
      nodeId: process.env.NODE_ID
    });
  }
}

module.exports = {
  getAllTeams,
  getTeamStats
};

