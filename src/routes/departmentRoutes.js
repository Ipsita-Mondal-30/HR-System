const express = require('express');
const Department = require('../models/Department');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/', isAdmin, async (req, res) => {
  const { name } = req.body;
  const dept = await Department.create({ name });
  res.status(201).json(dept);
});

router.get('/', async (req, res) => {
  const depts = await Department.find();
  res.json(depts);
});

module.exports = router;
