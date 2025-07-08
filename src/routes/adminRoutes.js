const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const { getAdminStats } = require('../controllers/adminController');

router.get('/stats', isAdmin, getAdminStats);

module.exports = router;
