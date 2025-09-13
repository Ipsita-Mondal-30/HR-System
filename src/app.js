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

const {
  PORT = 8080,
  MONGODB_URI,
  SESSION_SECRET,
  CORS_ORIGIN,
  FRONTEND_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET
} = process.env;

// Fix BASE_URL for production - Force redeploy
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://hr-system-x2uf.onrender.com'
  : process.env.BASE_URL || `http://localhost:${PORT}`;

// Validate critical envs
if (!MONGODB_URI) console.warn('⚠️ MONGODB_URI is missing in environment');
if (!SESSION_SECRET) console.warn('⚠️ SESSION_SECRET is missing in environment');

// Debug environment variables
console.log('🔧 Environment Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('BASE_URL from env:', process.env.BASE_URL);
console.log('BASE_URL resolved:', BASE_URL);
console.log('FRONTEND_URL:', FRONTEND_URL);

const app = express();

// MongoDB preview
console.log('🌐 MongoDB URI loaded:', MONGODB_URI ? 'Yes' : 'No');
if (MONGODB_URI) {
  console.log('🔗 Connection preview:', MONGODB_URI.slice(0, 50) + '...');
}

// Middlewares (order matters)
app.use(cookieParser());

// --- Dynamic & Secure CORS ---
const allowedOrigins = [
  ...(CORS_ORIGIN ? CORS_ORIGIN.split(',').map(o => o.trim()) : []),
  FRONTEND_URL
].filter(Boolean);

console.log('✅ Allowed CORS origins:', allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn('❌ CORS blocked for origin:', origin);
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
  expressSession({
    secret: SESSION_SECRET || 'change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Passport
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});


// Health/test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'HR Server Running!',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    dbName: mongoose.connection.db ? mongoose.connection.db.databaseName : 'Not connected',
  });
});

// Authenticated current user payload
app.get('/api/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const u = req.user;
    return res.json({ _id: u._id, name: u.name, email: u.email, role: u.role });
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/interviews', require('./routes/interviewRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/candidate', require('./routes/candidateRoutes'));
app.use('/api/hr', require('./routes/hrRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/okrs', require('./routes/okrRoutes'));
app.use('/api/achievements', require('./routes/achievementRoutes'));
app.use('/api/admin/achievements', require('./routes/achievementRoutes'));

// Debug users endpoint
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
    nodeEnv: process.env.NODE_ENV,
    baseUrlFromEnv: process.env.BASE_URL,
    baseUrlResolved: BASE_URL,
    googleClientId: GOOGLE_CLIENT_ID ? 'Set' : 'Missing',
    googleClientSecret: GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing',
    oauthUrl: `${BASE_URL}/api/auth/google`,
    callbackUrl: `${BASE_URL}/api/auth/google/callback`,
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

// 404 + Error handler
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` }));
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting HR Server...\n');

    console.log('🌐 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to MongoDB successfully!');
    console.log('📊 Database name:', mongoose.connection.db.databaseName);

    const User = require('./models/User');
    const userCount = await User.countDocuments();
    console.log(`👥 Found ${userCount} users in database`);

    const port = PORT || 8080;
    app.listen(port, () => {
      console.log(`\n🌐 HR Server running on ${BASE_URL}`);
      console.log('🔗 Connected to MongoDB');
      console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
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
