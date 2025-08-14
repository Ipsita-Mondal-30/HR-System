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

// Test routes for debugging
app.use('/api/test', require('./routes/testRoutes'));

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
    const Department = require('./models/Department');
    const Role = require('./models/Role');
    
    console.log('🔍 Checking database connection...');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    console.log('Database state:', mongoose.connection.readyState);
    
    const [jobs, applications, users, departments, roles] = await Promise.all([
      Job.find().limit(5).populate('department', 'name').populate('role', 'title').populate('createdBy', 'name email'),
      Application.find().limit(5).populate('job', 'title').populate('candidate', 'name email'),
      User.find().limit(5).select('name email role createdAt isActive'),
      Department.find().limit(5),
      Role.find().limit(5)
    ]);
    
    const counts = {
      jobsCount: await Job.countDocuments(),
      applicationsCount: await Application.countDocuments(),
      usersCount: await User.countDocuments(),
      departmentsCount: await Department.countDocuments(),
      rolesCount: await Role.countDocuments()
    };
    
    console.log('📊 Database counts:', counts);
    
    res.json({
      databaseStatus: 'connected',
      connectionState: mongoose.connection.readyState,
      ...counts,
      sampleData: {
        jobs: jobs.map(j => ({
          _id: j._id,
          title: j.title,
          companyName: j.companyName,
          status: j.status,
          department: j.department?.name,
          role: j.role?.title,
          createdBy: j.createdBy?.name,
          createdAt: j.createdAt
        })),
        applications: applications.map(a => ({
          _id: a._id,
          name: a.name,
          email: a.email,
          status: a.status,
          jobTitle: a.job?.title,
          candidateName: a.candidate?.name,
          createdAt: a.createdAt
        })),
        users: users.map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt
        })),
        departments: departments.map(d => ({
          _id: d._id,
          name: d.name,
          description: d.description
        })),
        roles: roles.map(r => ({
          _id: r._id,
          title: r.title,
          name: r.name
        }))
      }
    });
  } catch (err) {
    console.error('❌ Database debug error:', err);
    res.status(500).json({ 
      error: err.message,
      stack: err.stack,
      databaseStatus: 'error',
      connectionState: mongoose.connection.readyState
    });
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
const connectDB = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔗 Attempting MongoDB connection (attempt ${i + 1}/${retries})...`);
      
      // Use the working simple connection configuration
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 20000, // 20 seconds - working config
      });
      
      console.log('✅ Connected to MongoDB');
      console.log('Database name:', mongoose.connection.db.databaseName);
      
      // Test the connection with a simple query
      const User = require('./models/User');
      const userCount = await User.countDocuments();
      console.log(`📊 Database test successful - ${userCount} users found`);
      
      return; // Success, exit the retry loop
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${i + 1} failed:`, err.message);
      
      if (i === retries - 1) {
        // Last attempt failed
        console.error('❌ All MongoDB connection attempts failed');
        console.error('Connection string:', process.env.MONGODB_URI);
        throw err;
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting 3 seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
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
