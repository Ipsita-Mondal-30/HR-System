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
  console.log('🔐 OAuth callback - User data:', user);
  
  const token = jwt.sign(
    {
      _id: user._id, // ✅ not "id"
      name: user.name,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  

  // 🛑 DEBUGGING TIP: Log token here if you suspect redirect issues
  console.log('Generated JWT:', token);

  // Set cookie with token
  res.cookie('auth_token', token, {
    httpOnly: false, // Allow client-side access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  // Direct redirect based on role to avoid callback page issues
  if (!user.role) {
    res.redirect(`http://localhost:3000/role-select?token=${token}`);
  } else {
    switch (user.role) {
      case 'admin':
        res.redirect(`http://localhost:3000/admin/dashboard?token=${token}`);
        break;
      case 'hr':
        res.redirect(`http://localhost:3000/hr/dashboard?token=${token}`);
        break;
      case 'candidate':
        res.redirect(`http://localhost:3000/candidate/dashboard?token=${token}`);
        break;
      case 'employee':
        res.redirect(`http://localhost:3000/employee/dashboard?token=${token}`);
        break;
      default:
        res.redirect(`http://localhost:3000/?token=${token}`);
    }
  }
});


// --- Set role after user selects a role ---
router.post('/set-role', async (req, res) => {
  // Check for token in cookies first, then Authorization header
  let token = req.cookies.auth_token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    token = authHeader.split(' ')[1];
  }

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
    const user = await User.findById(decoded._id || decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.role = role;
    await user.save();

    const newToken = jwt.sign(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set new cookie with updated token
    res.cookie('auth_token', newToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      message: 'Role set successfully',
      token: newToken,
      user: {
        _id: user._id,
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
  // Check for token in cookies first, then Authorization header
  let token = req.cookies.auth_token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    token = authHeader.split(' ')[1];
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json(decoded);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// --- Logout route ---
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
