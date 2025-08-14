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
  console.log('🔄 Set-role request received');
  console.log('📝 Request body:', req.body);
  console.log('🍪 Cookies:', req.cookies);
  console.log('📋 Headers:', req.headers);
  
  // Check for token in cookies first, then Authorization header
  let token = req.cookies.auth_token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    console.log('🔑 Authorization header:', authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ No valid token found');
      return res.status(401).json({ error: 'No token provided' });
    }
    token = authHeader.split(' ')[1];
  }

  console.log('🔑 Token found:', token ? 'Yes' : 'No');

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified:', decoded);
  } catch (err) {
    console.log('❌ Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { role } = req.body;
  const validRoles = ['admin', 'hr', 'candidate', 'employee'];

  if (!validRoles.includes(role)) {
    console.log('❌ Invalid role:', role);
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Check MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB not connected, attempting to connect...');
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected successfully');
      } catch (dbError) {
        console.log('❌ MongoDB connection failed:', dbError.message);
        return res.status(500).json({ error: 'Database connection failed' });
      }
    }

    console.log('🔍 Looking for user with ID:', decoded._id || decoded.id);
    const user = await User.findById(decoded._id || decoded.id);
    
    if (!user) {
      console.log('❌ User not found in database');
      // If user doesn't exist, create them from the token data
      console.log('🔄 Creating user from token data...');
      const newUser = await User.create({
        _id: decoded._id,
        name: decoded.name,
        email: decoded.email,
        role: role,
        isActive: true,
        isVerified: role === 'hr' ? false : true // HR needs verification
      });
      console.log('✅ New user created:', newUser.name, newUser.email);
      
      const newToken = jwt.sign(
        {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.cookie('auth_token', newToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.status(200).json({
        message: 'Role set successfully',
        token: newToken,
        user: {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        }
      });
    }

    console.log('👤 User found:', user.name, user.email);
    console.log('🔄 Setting role from', user.role, 'to', role);
    
    user.role = role;
    if (role === 'hr') {
      user.isVerified = false; // HR needs verification
    }
    await user.save();
    
    console.log('✅ User role updated successfully');

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

    console.log('✅ New token generated and cookie set');

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
    console.error('❌ Database error:', err);
    
    // Provide more specific error messages
    if (err.name === 'MongooseServerSelectionError') {
      return res.status(500).json({ 
        error: 'Database connection failed. Please try again in a moment.' 
      });
    }
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Invalid user data: ' + err.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Server error while setting role. Please try again.' 
    });
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

// --- Test set-role endpoint ---
router.post('/test-set-role', async (req, res) => {
  try {
    console.log('🧪 Testing set-role functionality...');
    
    // Check MongoDB connection
    const mongoose = require('mongoose');
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    // Test user creation
    const testUser = {
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin'
    };
    
    const User = require('../models/User');
    const userCount = await User.countDocuments();
    
    res.json({
      message: 'Set-role test successful',
      mongoState: mongoose.connection.readyState,
      database: mongoose.connection.db.databaseName,
      userCount: userCount,
      testUser: testUser
    });
    
  } catch (err) {
    console.error('❌ Test set-role error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Logout route ---
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
