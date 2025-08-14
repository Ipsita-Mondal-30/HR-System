const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const expressSession = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');

dotenv.config(); // ✅ Load env

require('./config/passport');
const employeeRoutes = require('./routes/employeeRoutes');




const app = express(); // ✅ MUST come before app.use()

// Cookie parser middleware
app.use(cookieParser());

// Session + Passport Setup
app.use(expressSession({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization']
}));

// Middlewares
app.use(express.json());

// Debug logger
app.use((req, res, next) => {
  console.log(`🛰️ Incoming Request: ${req.method} ${req.url}`);
  next();
});

  
app.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).send('Not logged in');
    }
  });

  const authRoutes = require('./routes/authRoutes');
  app.use('/api/auth/', authRoutes);
  

  
  const jobRoutes = require('./routes/jobRoutes');
  app.use('/api/jobs', jobRoutes);

  const departmentRoutes = require('./routes/departmentRoutes');
app.use('/api/departments', departmentRoutes);

const roleRoutes = require('./routes/roleRoutes');
app.use('/api/roles', roleRoutes);

const applicationRoutes = require('./routes/applicationRoutes');
app.use('/api/applications', applicationRoutes);

const agentRoutes = require('./routes/agentRoutes');
app.use('/api/agent', agentRoutes);

const analyticsRoutes = require('./routes/analytics');
app.use('/api/analytics', analyticsRoutes);
const interviewRoutes = require('./routes/interviewRoutes');
app.use('/api/interviews', interviewRoutes);


app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/candidate', require('./routes/candidateRoutes'));
app.use('/api/hr', require('./routes/hrRoutes'));

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);




  
  


app.get('/api/me', (req, res) => {
    if (req.isAuthenticated()) {
      res.json({
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });
  

// Routes
app.use('/api/employees', employeeRoutes);

app.get('/health', (req, res) => res.send('API is running 🚀'));
app.get('/api/test', (req, res) => res.json({ message: 'Backend is working!', port: PORT }));

// Debug endpoint to check database data
app.get('/api/debug/data', async (req, res) => {
  try {
    const Job = require('./models/Job');
    const Application = require('./models/Application');
    const User = require('./models/User');
    
    const [jobs, applications, users] = await Promise.all([
      Job.find().limit(5),
      Application.find().limit(5),
      User.find().limit(5)
    ]);
    
    res.json({
      jobsCount: await Job.countDocuments(),
      applicationsCount: await Application.countDocuments(),
      usersCount: await User.countDocuments(),
      sampleJobs: jobs,
      sampleApplications: applications,
      sampleUsers: users.map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed database endpoint
app.post('/api/debug/seed', async (req, res) => {
  try {
    const seedData = require('./utils/seedData');
    await seedData();
    res.json({ message: 'Database seeded successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug applications endpoint
app.get('/api/debug/applications', async (req, res) => {
  try {
    const Application = require('./models/Application');
    const applications = await Application.find()
      .populate('job', 'title')
      .populate('candidate', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      count: applications.length,
      applications: applications.map(app => ({
        _id: app._id,
        name: app.name,
        email: app.email,
        jobTitle: app.job?.title,
        candidateName: app.candidate?.name,
        candidateEmail: app.candidate?.email,
        status: app.status,
        createdAt: app.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Connect DB and Start Server
const PORT = process.env.PORT || 8080;
app.use((req, res) => {
    res.status(404).send(`🔍 Route not found: ${req.method} ${req.originalUrl}`);
  });
  // ... existing code ...

// Global error handler for JSON errors
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});
app.use((req, res, next) => {
  console.log('Headers:', req.headers);
  next();
});
  
// Import and use the proper DB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI + '/hrsystem', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Error connecting to MongoDB:', err);
    throw err;
  }
};

// Connect to database and start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Frontend URL: http://localhost:3000`);
      console.log(`🔗 Backend URL: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
