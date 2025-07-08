// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const { getAllUsers } = require('../controllers/userController');

router.get('/', isAdmin, getAllUsers); // Admin can fetch all users

module.exports = router;
