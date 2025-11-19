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

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        source: 'cache',
        nodeId: process.env.NODE_ID
      });
    }

    const players = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) throw new Error('MySQL pool not available');

        const [rows] = await pool.execute(
          `SELECT 
            p.id as player_id,
            p.full_name AS player_name,
            dc.position,
            t.full_name AS team_name,
            t.abbreviation as team_abbr,
            dc.height_w_shoes_ft_in AS height,
            dc.weight
          FROM player p
          INNER JOIN draft_combine_stats dc ON p.id = dc.player_id
          INNER JOIN draft_history dh ON p.id = dh.person_id
          INNER JOIN team t ON dh.team_id = t.id
          WHERE p.is_active = 1
          ORDER BY p.full_name
          LIMIT 100`
        );
        return rows;
      },
      async () => {
        logger.warn('MySQL unavailable, returning empty players list');
        return [];
      }
    );

    await cacheService.set(cacheKey, players, 300);

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

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        source: 'cache',
        nodeId: process.env.NODE_ID
      });
    }

    const stats = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) throw new Error('MySQL pool not available');

        const [rows] = await pool.execute(
          `SELECT 
            p.id as player_id,
            p.full_name as player_name,
            p.first_name,
            p.last_name,
            dc.position,
            dc.height_w_shoes_ft_in as height,
            dc.weight,
            t.id as team_id,
            t.full_name as team_name,
            t.abbreviation as team_abbr,
            t.city as team_city,
            dh.season as draft_year,
            dh.round_number as draft_round,
            dh.overall_pick as draft_number
          FROM player p
          LEFT JOIN draft_combine_stats dc ON p.id = dc.player_id
          LEFT JOIN draft_history dh ON p.id = dh.person_id
          LEFT JOIN team t ON dh.team_id = t.id
          WHERE p.id = ?
          LIMIT 1`,
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
      source: stats ? 'database' : 'cache',
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

/**
 * Buscar jugadores por nombre
 */
async function searchPlayers(req, res) {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters',
        nodeId: process.env.NODE_ID
      });
    }

    const cacheKey = `players:search:${query.toLowerCase()}`;

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        source: 'cache',
        nodeId: process.env.NODE_ID
      });
    }

    const players = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) throw new Error('MySQL pool not available');

        const searchTerm = `%${query}%`;
        const [rows] = await pool.execute(
          `SELECT 
            p.id as player_id,
            p.full_name as player_name,
            dc.position,
            t.full_name as team_name,
            t.abbreviation as team_abbr,
            dc.height_w_shoes_ft_in as height,
            dc.weight
          FROM player p
          LEFT JOIN draft_combine_stats dc ON p.id = dc.player_id
          LEFT JOIN draft_history dh ON p.id = dh.person_id
          LEFT JOIN team t ON dh.team_id = t.id
          WHERE p.full_name LIKE ? 
            OR p.first_name LIKE ?
            OR p.last_name LIKE ?
          ORDER BY p.full_name
          LIMIT 50`,
          [searchTerm, searchTerm, searchTerm]
        );
        return rows;
      },
      async () => {
        logger.warn('MySQL unavailable for player search');
        return [];
      }
    );

    await cacheService.set(cacheKey, players, 180);

    res.json({
      success: true,
      data: players,
      source: 'database',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error searching players:', error);
    res.status(500).json({
      success: false,
      error: 'Error searching players',
      nodeId: process.env.NODE_ID
    });
  }
}

/**
 * Obtener jugadores por equipo
 */
async function getPlayersByTeam(req, res) {
  try {
    const { teamId } = req.params;
    const cacheKey = `team:${teamId}:players`;

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        source: 'cache',
        nodeId: process.env.NODE_ID
      });
    }

    const players = await mysqlCircuitBreaker.execute(
      async () => {
        const pool = getMySQLPool();
        if (!pool) throw new Error('MySQL pool not available');

        const [rows] = await pool.execute(
          `SELECT 
            p.id as player_id,
            p.full_name as player_name,
            dc.position,
            dc.height_w_shoes_ft_in as height,
            dc.weight,
            t.full_name as team_name,
            t.abbreviation as team_abbr,
            p.is_active
          FROM player p
          INNER JOIN draft_history dh ON p.id = dh.person_id
          INNER JOIN team t ON dh.team_id = t.id
          LEFT JOIN draft_combine_stats dc ON p.id = dc.player_id
          WHERE t.id = ?
          ORDER BY p.full_name`,
          [teamId]
        );
        return rows;
      },
      async () => {
        logger.warn(`MySQL unavailable for team players: ${teamId}`);
        return [];
      }
    );

    await cacheService.set(cacheKey, players, 300);

    res.json({
      success: true,
      data: players,
      source: 'database',
      nodeId: process.env.NODE_ID
    });
  } catch (error) {
    logger.error('Error getting team players:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching team players',
      nodeId: process.env.NODE_ID
    });
  }
}

module.exports = {
  getTopPlayers,
  getPlayerStats,
  searchPlayers,
  getPlayersByTeam
};