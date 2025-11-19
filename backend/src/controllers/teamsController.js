const { getMySQLPool } = require('../config/database');
const cacheService = require('../services/resilientCacheService');
const { mysqlCircuitBreaker } = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

/**
 * Obtiene todos los equipos
 */
async function getAllTeams(req, res) {
  try {
    const cacheKey = 'teams:all';

    // SIEMPRE intentar desde cache primero
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        source: 'cache',
        nodeId: process.env.NODE_ID
      });
    }

    // Si no hay cache, intentar desde BD
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
        // Fallback: retornar cache aunque esté viejo
        logger.warn('MySQL unavailable, checking for stale cache');
        const staleCache = await cacheService.get(cacheKey);
        return staleCache || [];
      }
    );

    // Guardar en caché con TTL largo (datos históricos)
    if (teams && teams.length > 0) {
      await cacheService.set(cacheKey, teams, 3600); // 1 hora
    }

    res.json({
      success: true,
      data: teams,
      source: teams.length > 0 ? 'database' : 'fallback',
      nodeId: process.env.NODE_ID,
      warning: teams.length === 0 ? 'Database unavailable, no cached data' : null
    });
  } catch (error) {
    logger.error('Error getting teams:', error);

    // Último intento: devolver cache de emergencia
    try {
      const emergencyCache = await cacheService.get('teams:all');
      if (emergencyCache) {
        return res.json({
          success: true,
          data: emergencyCache,
          source: 'emergency-cache',
          nodeId: process.env.NODE_ID,
          warning: 'Using cached data due to system issues'
        });
      }
    } catch (cacheError) {
      logger.error('Emergency cache also failed:', cacheError);
    }

    res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
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
      await cacheService.set(cacheKey, stats, 600); // 10 minutos

      return res.json({
        success: true,
        data: stats,
        source: 'database',
        nodeId: process.env.NODE_ID
      });
    }

    // No hay datos
    res.status(404).json({
      success: false,
      error: 'Team not found or database unavailable',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting team stats:', error);
    res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      nodeId: process.env.NODE_ID
    });
  }
}

module.exports = {
  getAllTeams,
  getTeamStats
};