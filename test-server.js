const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!', 
    timestamp: new Date().toISOString(),
    port: PORT 
  });
});

// Test MongoDB connection
app.get('/api/test/db', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      res.json({ 
        status: 'connected', 
        database: mongoose.connection.db.databaseName 
      });
    } else {
      await mongoose.connect(process.env.MONGODB_URI);
      res.json({ 
        status: 'connected', 
        database: mongoose.connection.db.databaseName 
      });
    }
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      error: err.message 
    });
  }
});

// Test auth endpoint
app.post('/api/test/auth', (req, res) => {
  console.log('Test auth request:', req.body);
  res.json({ 
    message: 'Auth endpoint working',
    received: req.body,
    headers: req.headers
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`🌐 Test URL: http://localhost:${PORT}/api/test`);
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });