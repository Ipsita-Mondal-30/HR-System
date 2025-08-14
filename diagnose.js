const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function diagnose() {
  console.log('🔍 HR System Diagnostic Tool');
  console.log('============================\n');

  // 1. Check environment variables
  console.log('1. Environment Variables:');
  console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
  console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
  console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
  console.log('   PORT:', process.env.PORT || '8080');
  console.log('');

  // 2. Test MongoDB connection
  console.log('2. MongoDB Connection:');
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('   ✅ MongoDB connection successful');
    console.log('   Database:', mongoose.connection.db.databaseName);
    
    // Test data
    const User = require('./src/models/User');
    const userCount = await User.countDocuments();
    console.log('   Users in database:', userCount);
    
    await mongoose.connection.close();
  } catch (error) {
    console.log('   ❌ MongoDB connection failed:', error.message);
  }
  console.log('');

  // 3. Test if backend server is running
  console.log('3. Backend Server:');
  try {
    const response = await axios.get('http://localhost:8080/api/test', {
      timeout: 3000
    });
    console.log('   ✅ Backend server is running');
    console.log('   Response:', response.data.message);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('   ❌ Backend server is not running');
      console.log('   💡 Start it with: npm run dev');
    } else {
      console.log('   ❌ Backend server error:', error.message);
    }
  }
  console.log('');

  // 4. Test auth endpoint
  console.log('4. Auth Endpoint:');
  try {
    const response = await axios.post('http://localhost:8080/api/test/auth', {
      test: 'data'
    }, {
      timeout: 3000
    });
    console.log('   ✅ Auth endpoint accessible');
  } catch (error) {
    console.log('   ❌ Auth endpoint error:', error.message);
  }
  console.log('');

  // 5. Recommendations
  console.log('5. Recommendations:');
  console.log('   📋 To fix "failed to set-role" error:');
  console.log('   1. Make sure backend server is running: npm run dev');
  console.log('   2. Check MongoDB connection is working');
  console.log('   3. Verify frontend is calling http://localhost:8080');
  console.log('   4. Check browser console for detailed errors');
  console.log('   5. Try logging in again after starting backend');
  console.log('');
  
  console.log('🎯 Quick Start Commands:');
  console.log('   Backend: cd hr-backend && npm run dev');
  console.log('   Frontend: cd hr-frontend && npm run dev');
  console.log('   Seed DB: cd hr-backend && npm run seed');
}

diagnose().catch(console.error);