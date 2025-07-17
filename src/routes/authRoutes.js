const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');

// --- Google OAuth login ---
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// --- Google OAuth callback ---
router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  const user = req.user;

  const token = jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || null, // Initially null for new users
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 🛑 DEBUGGING TIP: Log token here if you suspect redirect issues
  // console.log('Generated JWT:', token);

  // ⚠️ Ensure the frontend handles this redirect properly (with token in URL)
  res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
});


// --- Set role after user selects a role ---
router.post('/set-role', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { role } = req.body;
  const validRoles = ['admin', 'hr', 'candidate', 'employee'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 🚫 Prevent changing role if already set
    if (user.role) {
      return res.status(400).json({ error: 'Role already set and cannot be changed' });
    }

    user.role = role;
    await user.save();

    const newToken = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Role set successfully',
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error while setting role' });
  }
});


// --- Utility: Get logged-in user's info from JWT ---
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json(decoded);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
