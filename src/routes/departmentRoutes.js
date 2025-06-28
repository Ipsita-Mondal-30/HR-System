const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const departmentController = require('../controllers/departmentcontroller');

// Create Department (only admin)
router.post('/', isAdmin, departmentController.createDepartment);

// Get All Departments
router.get('/', departmentController.getDepartments);

module.exports = router;
