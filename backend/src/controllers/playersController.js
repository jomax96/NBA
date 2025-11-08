const { getMySQLPool } = require('../config/database');
const cacheService = require('../services/cacheService');
const { mysqlCircuitBreaker } = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

/**
 * Obtiene top 100 jugadores más consultados
 */
async function getTopPlayers(req, res) {
  try {
    const cacheKey = 'players:top100';

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
    const players = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) throw new Error('MySQL pool not available');
        
        const [rows] = await pool.execute(
          `SELECT 
            p.player_id, p.player_name, p.position, p.height, p.weight,
            t.team_name, t.abbreviation as team_abbr
           FROM players p
           LEFT JOIN teams t ON p.team_id = t.team_id
           ORDER BY p.player_name
           LIMIT 100`
        );
        return rows;
      },
      async () => {
        logger.warn('MySQL unavailable, returning empty players list');
        return [];
      }
    );

    await cacheService.set(cacheKey, players, 300); // 5 minutos

    res.json({
      success: true,
      data: players,
      source: 'database',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting top players:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching players',
      nodeId: process.env.NODE_ID
    });
  }
}

/**
 * Obtiene estadísticas de un jugador
 */
async function getPlayerStats(req, res) {
  try {
    const { playerId } = req.params;
    const cacheKey = `player:stats:${playerId}`;

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
            p.player_id, p.player_name, p.position, p.height, p.weight,
            t.team_name, t.abbreviation as team_abbr,
            AVG(gp.points) as avg_points,
            AVG(gp.rebounds) as avg_rebounds,
            AVG(gp.assists) as avg_assists,
            COUNT(gp.game_id) as games_played
           FROM players p
           LEFT JOIN teams t ON p.team_id = t.team_id
           LEFT JOIN game_players gp ON p.player_id = gp.player_id
           WHERE p.player_id = ?
           GROUP BY p.player_id`,
          [playerId]
        );
        return rows[0] || null;
      },
      async () => {
        logger.warn(`MySQL unavailable for player stats: ${playerId}`);
        return null;
      }
    );

    if (stats) {
      await cacheService.set(cacheKey, stats, 300);
    }

    res.json({
      success: true,
      data: stats,
      source: 'database',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting player stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching player statistics',
      nodeId: process.env.NODE_ID
    });
  }
}

module.exports = {
  getTopPlayers,
  getPlayerStats
};

