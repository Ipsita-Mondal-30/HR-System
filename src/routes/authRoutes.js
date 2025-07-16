// routes/authRoute.js
const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');

// Google Login Start
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Google OAuth callback

router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  const user = req.user;

  const token = jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || null, // default is null
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Redirect to select-role page on frontend
  res.redirect(`http://localhost:3000/select-role?token=${token}`);
});


// Set role after login
const { verifyJWT } = require('../middleware/auth'); // or wherever you keep this

router.post('/set-role', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(" ")[1];
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

  const user = await User.findById(decoded.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

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

  res.status(200).json({ message: 'Role set successfully', token: newToken });
});



// Utility to get user from token
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json(decoded);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
