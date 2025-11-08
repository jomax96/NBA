const express = require('express');
const router = express.Router();
const playersController = require('../controllers/playersController');

router.get('/top', playersController.getTopPlayers);
router.get('/:playerId', playersController.getPlayerStats);

module.exports = router;

