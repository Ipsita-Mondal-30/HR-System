// controllers/userController.js

const User = require('../models/User');

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'name email role'); // select only required fields
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
};

module.exports = { getAllUsers };
