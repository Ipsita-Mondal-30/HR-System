const express = require('express');
const { getAllEmployees, createEmployee } = require('../controllers/employeeController');

const router = express.Router();

router.get('/', getAllEmployees);
router.post('/', createEmployee);

module.exports = router;
