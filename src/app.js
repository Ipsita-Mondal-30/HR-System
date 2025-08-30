// server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('passport');
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');

// Load environment variables early
dotenv.config();

// Validate critical envs
if (!process.env.MONGODB_URI) {
  console.warn('⚠️ MONGODB_URI is missing in environment');
}
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️ SESSION_SECRET is missing in environment');
}

const app = express();

// Show brief connection string (safe preview)
console.log('🌐 MongoDB URI loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');
if (process.env.MONGODB_URI) {
  console.log('🔗 Connection preview:', process.env.MONGODB_URI.slice(0, 50) + '...');
}

// Middlewares (order matters)
// Cookies before session
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
  expressSession({
    secret: process.env.SESSION_SECRET || 'change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,       // set true only behind HTTPS proxy
      httpOnly: true,      // safer: prevents JS access to session cookie
      sameSite: 'lax',     // good default for local dev with cross-site redirects
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// IMPORTANT: Passport config path from root-level server.js
require('./config/passport'); // <-- if your file is src/config/passport.js
// If your file is at config/passport.js (root/config), use this instead:
// require('./config/passport');

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health/test endpoint USED by frontend probe
app.get('/api/test', (req, res) => {
  res.json({
    message: 'HR Server Running!',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    dbName: mongoose.connection.db ? mongoose.connection.db.databaseName : 'Not connected',
  });
});

// Basic me endpoint (optional)
app.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json(req.user);
  }
  return res.status(401).json({ error: 'Not logged in' });
});

// Authenticated current user payload
app.get('/api/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const u = req.user;
    return res.json({ _id: u._id, name: u.name, email: u.email, role: u.role });
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

// Routes (server.js at root imports src/*)
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const jobRoutes = require('./routes/jobRoutes');
app.use('/api/jobs', jobRoutes);

const departmentRoutes = require('./routes/departmentRoutes');
app.use('/api/departments', departmentRoutes);

const roleRoutes = require('./routes/roleRoutes');
app.use('/api/roles', roleRoutes);

const applicationRoutes = require('./routes/applicationRoutes');
app.use('/api/applications', applicationRoutes);

const interviewRoutes = require('./routes/interviewRoutes');
app.use('/api/interviews', interviewRoutes);

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/candidate', require('./routes/candidateRoutes'));
app.use('/api/hr', require('./routes/hrRoutes'));


// Debug users endpoint (safe)
app.get('/api/debug/users', async (req, res) => {
  try {
    const User = require('./models/User');
    const users = await User.find().select('name email role googleId isActive createdAt');
    res.json({
      success: true,
      userCount: users.length,
      database: mongoose.connection.db ? mongoose.connection.db.databaseName : 'Not connected',
      users,
    });
  } catch (err) {
    console.error('Debug users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// OAuth test endpoint
app.get('/api/oauth-test', (req, res) => {
  res.json({
    message: 'OAuth routes are accessible',
    googleClientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing',
    oauthUrl: 'http://localhost:8080/api/auth/google',
    callbackUrl: 'http://localhost:8080/api/auth/google/callback',
    timestamp: new Date().toISOString()
  });
});

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.db ? mongoose.connection.db.databaseName : 'Not connected',
  });
});

// 404 LAST
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// Error handler LAST
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting HR Server...\n');

    console.log('🌐 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to MongoDB successfully!');
    console.log('📊 Database name:', mongoose.connection.db.databaseName);

    // Optional visibility: existing users
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    console.log(`👥 Found ${userCount} users in database`);
    if (userCount > 0) {
      const users = await User.find().select('name email role googleId');
      users.forEach((u) => {
        console.log(`   👤 ${u.name} (${u.email}) - ${u.role || 'No role'}`);
      });
    } else {
      console.log('📝 No users found - they will be created upon first login');
    }

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`\n🌐 HR Server running on http://localhost:${PORT}`);
      console.log('🔗 Connected to MongoDB');
      console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
      console.log('\n🎯 Ready for login:');
      console.log('1. Start frontend: npm run dev (in hr-frontend)');
      console.log('2. Go to: http://localhost:3000/login');
      console.log('3. Login with Google - user will be saved to database');
      console.log('\n⏹️  Press Ctrl+C to stop');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('- Check internet connection');
    console.error('- Verify MongoDB credentials');
    console.error('- Ensure MongoDB is running');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  mongoose.connection.close();
  process.exit(0);
});

startServer();
