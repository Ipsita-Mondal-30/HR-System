const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const expressSession = require('express-session');
const passport = require('passport');

dotenv.config(); // ✅ Load env

require('./config/auth');
const employeeRoutes = require('./routes/employeeRoutes');




const app = express(); // ✅ MUST come before app.use()

// Session + Passport Setup
app.use(expressSession({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(cors({
    origin: 'http://localhost:3000', // your frontend
    credentials: true               // allow cookies
  }));

// Debug logger
app.use((req, res, next) => {
  console.log(`🛰️ Incoming Request: ${req.method} ${req.url}`);
  next();
});

// Middlewares
app.use(express.json());

// Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback',
    passport.authenticate('google', {
      failureRedirect: '/login',
      session: true
    }),
    (req, res) => {
      // 👤 User is now authenticated
      const user = req.user;
  
      // 🔄 Redirect based on role
      if (!user.role) {
        return res.redirect('http://localhost:3000/select-role');
      }
  
      if (user.role === 'admin') {
        return res.redirect('http://localhost:3000/admin/dashboard');
      } else if (user.role === 'hr') {
        return res.redirect('http://localhost:3000/hr/dashboard');
      } else if (user.role === 'candidate') {
        return res.redirect('http://localhost:3000/jobs');
      } else {
        // 🚨 Fallback (just in case)
        return res.redirect('http://localhost:3000');
      }
    }
  );
  
app.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).send('Not logged in');
    }
  });

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

const agentRoutes = require('./routes/agentRoutes');
app.use('/api/agent', agentRoutes);

const analyticsRoutes = require('./routes/analytics');
app.use('/api/analytics', analyticsRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);


app.use((req, res, next) => {
    console.log(`🛰️ Incoming Request: ${req.method} ${req.url}`);
    console.log("📦 Body:", JSON.stringify(req.body));
    next();
  });
  
  
app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));

});

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
  
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch((err) => console.log(err));
