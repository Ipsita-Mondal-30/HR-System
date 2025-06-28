const Role = require('../models/Role');

exports.createRole = async (req, res) => {
  try {
    const { title, department } = req.body;
    const role = await Role.create({ title, department });
    res.status(201).json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create role' });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find().populate('department', 'name');
    res.json(roles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};
