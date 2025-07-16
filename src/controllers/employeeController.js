// controllers/employeeController.js
const Employee = require('../models/Employee');

// GET /employees
const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().populate('department role');
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

// POST /employees
const createEmployee = async (req, res) => {
  try {
    const { name, email, department, role, joiningDate } = req.body;
    const employee = await Employee.create({
      name,
      email,
      department,
      role,
      joiningDate,
    });
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create employee' });
  }
};

module.exports = {
  getAllEmployees,
  createEmployee,
};
