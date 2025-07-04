const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');

// router.get('/dashboard', isAdmin, getDashboardStats);
router.get('/dashboard', getDashboardStats);

module.exports = router;
