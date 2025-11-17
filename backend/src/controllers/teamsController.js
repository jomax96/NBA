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
          'SELECT id, full_name, abbreviation, nickname, city, state, year_founded FROM team ORDER BY full_name'
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
            t.id as team_id,
            t.full_name,
            t.abbreviation,
            t.nickname,
            t.city,
            t.state,
            t.year_founded,
            COUNT(DISTINCT g.game_id) as total_games,
            SUM(CASE WHEN g.team_id_home = t.id AND g.wl_home = 'W' THEN 1 
                     WHEN g.team_id_away = t.id AND g.wl_away = 'W' THEN 1 
                     ELSE 0 END) as wins,
            SUM(CASE WHEN g.team_id_home = t.id AND g.wl_home = 'L' THEN 1 
                     WHEN g.team_id_away = t.id AND g.wl_away = 'L' THEN 1 
                     ELSE 0 END) as losses,
            AVG(CASE WHEN g.team_id_home = t.id THEN g.pts_home 
                     WHEN g.team_id_away = t.id THEN g.pts_away 
                     END) as avg_points_scored,
            AVG(CASE WHEN g.team_id_home = t.id THEN g.pts_away 
                     WHEN g.team_id_away = t.id THEN g.pts_home 
                     END) as avg_points_allowed
           FROM team t
           LEFT JOIN game g ON g.team_id_home = t.id OR g.team_id_away = t.id
           WHERE t.id = ?
           GROUP BY t.id, t.full_name, t.abbreviation, t.nickname, t.city, t.state, t.year_founded`,
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