const express = require('express');
const router = express.Router();
const teamsController = require('../controllers/teamsController');

router.get('/', teamsController.getAllTeams);
router.get('/:teamId', teamsController.getTeamStats);

module.exports = router;

