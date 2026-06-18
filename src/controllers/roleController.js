const Role = require('../models/Role');

exports.createRole = async (req, res) => {
  try {
    const { title, description, department, departmentId } = req.body;
    const deptId = departmentId || department || null;
    const role = await Role.create({
      title,
      description: description || '',
      departmentId: deptId,
    });
    const populated = await Role.findById(role._id).populate('departmentId', 'name');
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create role' });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 });
    res.json(roles);
  } catch (err) {
    console.error('❌ Error in getRoles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate('departmentId', 'name');
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json(role);
  } catch (err) {
    console.error("❌ Error in getRoleById:", err);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};