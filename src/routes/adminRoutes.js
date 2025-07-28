const express = require('express');
const router = express.Router();
const { verifyJWT, isAdmin, isHRorAdmin } = require('../middleware/auth');
const { getAdminStats } = require('../controllers/adminController');
const adminController = require('../controllers/adminController');

router.get('/stats', verifyJWT, isAdmin, getAdminStats);

router.get('/dashboard', verifyJWT, isHRorAdmin, adminController.getHRDashboardData);

module.exports = router;
