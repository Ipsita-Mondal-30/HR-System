const express = require('express');
const { getAllEmployees, createEmployee } = require('../controllers/employeeController');
const { isHR, isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Protect GET: only logged-in users can view employees
router.get('/', isAuthenticated, getAllEmployees);

// Protect POST: only HRs can create employees
router.post('/', isHR, createEmployee);

module.exports = router;
