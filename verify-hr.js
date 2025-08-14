const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');

async function verifyHR() {
  try {
    console.log('🔧 Verifying HR user...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Find HR user
    const hrUser = await User.findOne({ email: 'kgipsita30@gmail.com' });
    
    if (!hrUser) {
      console.log('❌ HR user not found');
      return;
    }
    
    console.log('👤 Found HR user:', hrUser.name, hrUser.email);
    console.log('Current status:', {
      role: hrUser.role,
      isActive: hrUser.isActive,
      isVerified: hrUser.isVerified
    });
    
    // Verify the HR user
    hrUser.isVerified = true;
    hrUser.isActive = true;
    await hrUser.save();
    
    console.log('✅ HR user verified and activated');
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error verifying HR:', error);
  }
}

verifyHR();