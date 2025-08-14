const { spawn } = require('child_process');
const mongoose = require('mongoose');
require('dotenv').config();

async function restartServer() {
  console.log('🔄 Restarting backend server with fixed MongoDB connection...');
  
  // First test the connection
  try {
    console.log('🔗 Testing MongoDB connection...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    
    console.log('✅ MongoDB connection test successful');
    console.log('Database:', mongoose.connection.db.databaseName);
    
    const User = require('./src/models/User');
    const userCount = await User.countDocuments();
    console.log(`📊 Users in database: ${userCount}`);
    
    await mongoose.connection.close();
    
    console.log('\n🚀 Starting server...');
    console.log('💡 The server should now connect to MongoDB successfully');
    console.log('🌐 Frontend can now set roles without "Database connection failed" error');
    
    // Start the server
    const server = spawn('node', ['src/app.js'], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    server.on('error', (err) => {
      console.error('❌ Server start error:', err);
    });
    
    server.on('close', (code) => {
      console.log(`Server exited with code ${code}`);
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection test failed:', error.message);
    console.log('\n🔧 Please check:');
    console.log('1. Internet connection');
    console.log('2. MongoDB Atlas cluster status');
    console.log('3. IP whitelist in Atlas');
  }
}

restartServer();