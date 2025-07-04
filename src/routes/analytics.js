const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { isAdmin } = require('../middleware/auth');

router.get('/overview', isAdmin, analyticsController.getOverviewStats);
router.get('/summary', isAdmin, analyticsController.getSummary);
router.get('/match-distribution', isAdmin, analyticsController.getMatchDistribution);

module.exports = router;
