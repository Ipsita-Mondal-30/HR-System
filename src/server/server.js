/**
 * Production entry point for Render / cloud hosts.
 * Uses CommonJS so all existing backend code works without "type": "module".
 */
const path = require('path');
const fs = require('fs');

// Load .env from project root (hr-backend/)
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// app.js connects to MongoDB and starts the HTTP server
require('../app.js');
