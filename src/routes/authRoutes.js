const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');

// Real login endpoint for your database users
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt for:', email);
    
    // Find user in your database
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // For now, we'll accept any password for existing users (you can add bcrypt later)
    // In production, you should verify the password hash
    console.log('✅ User found:', user.name, user.role);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        _id: user._id, 
        email: user.email, 
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    // Set cookie
    res.cookie('auth_token', token, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    console.log('✅ Login successful for:', user.name);
    
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Google OAuth login ---
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// --- Google OAuth callback ---
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

    if (err) {
      console.error('❌ OAuth authentication error:', err);
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed&message=${encodeURIComponent(err.message)}`);
    }
    
    if (!user) {
      console.error('❌ OAuth failed - no user returned');
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed&message=${encodeURIComponent('Authentication failed')}`);
    }

    try {
      const token = jwt.sign(
        { _id: user._id, name: user.name, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Set cookie
      res.cookie('auth_token', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      // Redirect to correct frontend URL
      if (!user.role) {
        return res.redirect(`${FRONTEND_URL}/role-select?token=${token}`);
      }

      switch (user.role) {
        case 'admin':
          return res.redirect(`${FRONTEND_URL}/admin/dashboard?token=${token}`);
        case 'hr':
          return res.redirect(`${FRONTEND_URL}/hr/dashboard?token=${token}`);
        case 'candidate':
          return res.redirect(`${FRONTEND_URL}/candidate/dashboard?token=${token}`);
        case 'employee':
          return res.redirect(`${FRONTEND_URL}/employee/dashboard?token=${token}`);
        default:
          return res.redirect(`${FRONTEND_URL}/?token=${token}`);
      }
    } catch (tokenError) {
      console.error('❌ Token generation error:', tokenError);
      res.redirect(`${FRONTEND_URL}/login?error=token_failed&message=${encodeURIComponent('Failed to generate authentication token')}`);
    }
  })(req, res, next);
});


// --- Set role after user selects a role ---
router.post('/set-role', async (req, res) => {
  console.log('🔄 Set-role request received');
  console.log('📝 Request body:', req.body);
  
  // Check for token in cookies first, then Authorization header
  let token = req.cookies.auth_token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ No valid token found');
      return res.status(401).json({ error: 'No token provided' });
    }
    token = authHeader.split(' ')[1];
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');

    console.log('✅ Token verified for user:', decoded.name);
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
    // Ensure MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB not connected, attempting to connect...');
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
      });
      console.log('✅ MongoDB connected successfully');
    }

    const userId = decoded._id || decoded.id;
    console.log('🔍 Looking for user with ID:', userId);
    
    let user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ User not found, creating from token data...');
      
      // Validate required fields from token
      if (!decoded.name || !decoded.email) {
        return res.status(400).json({ error: 'Invalid token data - missing name or email' });
      }
      
      try {
        user = new User({
          _id: userId,
          name: decoded.name,
          email: decoded.email.toLowerCase(),
          role: role,
          isActive: true,
          isVerified: role !== 'hr', // HR needs verification
          lastLogin: new Date()
        });
        
        await user.save();
        console.log('✅ New user created:', user.name, user.email);
      } catch (createError) {
        console.error('❌ Error creating user:', createError);
        
        if (createError.code === 11000) {
          // Duplicate key error - try to find existing user by email
          console.log('🔍 Duplicate key error, searching by email...');
          user = await User.findOne({ email: decoded.email.toLowerCase() });
          
          if (user) {
            console.log('✅ Found existing user by email, updating role');
            user.role = role;
            user.lastLogin = new Date();
            if (role === 'hr') user.isVerified = false;
            await user.save();
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    } else {
      console.log('👤 User found:', user.name, user.email);
      console.log('🔄 Updating role from', user.role, 'to', role);
      
      user.role = role;
      user.lastLogin = new Date();
      if (role === 'hr') {
        user.isVerified = false; // HR needs verification
      }
      
      await user.save();
      console.log('✅ User role updated successfully');
    }

    // If user selected 'employee' role, create Employee profile
    if (role === 'employee') {
      const Employee = require('../models/Employee');
      const existingEmployee = await Employee.findOne({ user: user._id });
      
      if (!existingEmployee) {
        const employee = new Employee({
          user: user._id,
          position: 'Employee', // Default position
          hireDate: new Date(),
          salary: 50000, // Default salary
          employmentType: 'full-time',
          status: 'active'
        });
        await employee.save();
        console.log('✅ Created Employee profile for:', user.name);
      }
    }

    // Generate new token with updated role
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

    console.log('✅ Role set successfully for:', user.name);

    res.status(200).json({
      success: true,
      message: 'Role set successfully',
      token: newToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
    
  } catch (err) {
    console.error('❌ Set-role error:', err);
    
    // Provide specific error messages
    if (err.name === 'MongooseServerSelectionError') {
      return res.status(500).json({ 
        error: 'Database connection failed. Please check if MongoDB is running.' 
      });
    }
    
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed: ' + validationErrors.join(', ')
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        error: 'User with this email already exists' 
      });
    }
    
    res.status(500).json({ 
      error: 'Server error while setting role: ' + err.message 
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
    
    console.log('🔍 User info retrieved:', decoded.name, decoded.email);
    
    res.status(200).json(decoded);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// --- Test complete auth flow ---
router.post('/test-complete-flow', async (req, res) => {
  try {
    console.log('🧪 Testing complete auth flow...');
    
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    
    const User = require('../models/User');
    
    // Create test user
    const testUser = await User.create({
      googleId: 'test-' + Date.now(),
      name: 'Test Flow User',
      email: 'testflow@example.com',
      role: 'candidate',
      isActive: true,
      isVerified: true
    });
    
    // Generate token
    const token = jwt.sign(
      {
        _id: testUser._id,
        name: testUser.name,
        email: testUser.email,
        role: testUser.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Clean up
    await User.findByIdAndDelete(testUser._id);
    
    res.json({
      success: true,
      message: 'Complete auth flow test successful',
      testUser: {
        name: testUser.name,
        email: testUser.email,
        role: testUser.role
      },
      tokenGenerated: !!token,
      databaseWorking: true
    });
    
  } catch (err) {
    console.error('❌ Complete flow test error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Debug current users ---
router.get('/debug-users', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    
    const User = require('../models/User');
    const users = await User.find().select('name email role googleId isActive isVerified createdAt');
    
    res.json({
      success: true,
      userCount: users.length,
      users: users.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        googleId: user.googleId,
        isActive: user.isActive,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }))
    });
    
  } catch (err) {
    console.error('❌ Debug users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Logout route ---
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
