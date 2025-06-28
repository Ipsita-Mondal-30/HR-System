const Department = require('../models/Department');

exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    const department = await Department.create({ name });
    res.status(201).json(department);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create department' });
  }
};

exports.getDepartments = async (req, res) => {
  const departments = await Department.find();
  res.json(departments);
};
