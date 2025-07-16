// src/routes/employeeRoutes.js
const express = require('express');
const { getAllEmployees, createEmployee } = require('../controllers/employeeController');
const { isHR, verifyJWT } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyJWT, getAllEmployees);       // ✅ should now work
router.post('/', verifyJWT, isHR, createEmployee); // ✅

module.exports = router;
