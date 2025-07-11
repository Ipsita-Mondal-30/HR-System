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
    const roles = await Role.find()
      .populate({ path: 'department', select: 'name', strictPopulate: false }); // ✅ Add strictPopulate: false
    res.json(roles);
  } catch (err) {
    console.error("❌ Error in getRoles:", err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate({ path: 'department', select: 'name', strictPopulate: false }); // ✅ Add strictPopulate: false
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json(role);
  } catch (err) {
    console.error("❌ Error in getRoleById:", err);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};