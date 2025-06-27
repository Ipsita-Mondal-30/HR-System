const Employee = require('../models/Employee');

const getAllEmployees = async (req, res) => {
  const employees = await Employee.find();
  res.json(employees);
  console.log("REQ BODY:", req.body);

};


const createEmployee = async (req, res) => {
    console.log("💥 HIT: createEmployee");
    const { name, department, role } = req.body;
    const newEmp = await Employee.create({ name, department, role });
    res.status(201).json(newEmp);
  };

module.exports = { getAllEmployees, createEmployee };
