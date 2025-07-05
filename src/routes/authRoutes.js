// src/routes/auth.js (or wherever your auth routes are)
const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

// Start OAuth flow
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// OAuth Callback
router.get('/google/callback', passport.authenticate('google', {
  failureRedirect: '/login',
  session: true
}), (req, res) => {
  if (!req.user.role) return res.redirect('/select-role');
  return res.redirect('/redirect');
});

// Get current user info
router.get('/user', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.user);
});

// Set user role
// POST /api/auth/set-role
router.post('/set-role', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { role } = req.body;

  // Optional: validate role
  const validRoles = ['admin', 'hr', 'candidate'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Update user in DB
  req.user.role = role;
  await req.user.save();

  res.status(200).json({ message: 'Role set successfully', user: req.user });
});

// Final redirection based on role
router.get('/redirect', (req, res) => {
  if (!req.user || !req.user.role) return res.redirect('/select-role');

  const role = req.user.role;
  if (role === 'admin') return res.redirect('/admin');
  if (role === 'hr') return res.redirect('/hr');
  if (role === 'candidate') return res.redirect('/candidate');

  res.redirect('/select-role');
});
// Get current logged-in user
router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  
    const { _id, name, email, role } = req.user;
    res.json({ _id, name, email, role });
  });
  router.get('/logout', (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).send("Logout error");
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.send('Logged out');
      });
    });
  });
  

module.exports = router;
