const express = require('express');
const router = express.Router();
const { isAdmin, isHR } = require('../middleware/auth');
const { getAdminStats } = require('../controllers/adminController');
const adminController = require('../controllers/adminController');

router.get('/stats', isAdmin, getAdminStats);

router.get('/dashboard', isHR, adminController.getHRDashboardData);

module.exports = router;

module.exports = router;
