const mongoose = require('mongoose');
require('dotenv').config();

// Test MongoDB connection first
async function testConnection() {
  try {
    console.log('🔗 Testing MongoDB connection...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
    await mongoose.connection.close();
    
    // Start the main server
    console.log('🚀 Starting main server...');
    require('./src/app.js');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your internet connection');
    console.log('2. Verify MongoDB Atlas cluster is running');
    console.log('3. Check if your IP is whitelisted in Atlas');
    console.log('4. Verify the connection string in .env file');
    process.exit(1);
  }
}

testConnection();