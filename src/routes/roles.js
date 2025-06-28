
const express = require('express');
const Role = require('../models/Role');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/', isAdmin, async (req, res) => {
  const { title, department, level } = req.body;
  const role = await Role.create({ title, department, level });
  res.status(201).json(role);
});

router.get('/', async (req, res) => {
  const roles = await Role.find();
  res.json(roles);
});

module.exports = router;
