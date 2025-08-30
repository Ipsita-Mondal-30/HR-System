const mongoose = require('mongoose');
require('dotenv').config();

async function testAuth() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-system');
    
    const User = require('./src/models/User');
    
    // Check all users and their roles
    const users = await User.find().select('name email role isVerified');
    
    console.log('📊 All users in database:');
    users.forEach((user, i) => {
      console.log(`${i+1}. ${user.name} (${user.email}) - Role: ${user.role} - Verified: ${user.isVerified}`);
    });
    
    // Check admin users
    const admins = await User.find({ role: 'admin' });
    console.log('\n👑 Admin users:', admins.length);
    
    // Check HR users
    const hrs = await User.find({ role: 'hr' });
    console.log('👥 HR users:', hrs.length);
    
    // Check unverified HR users
    const unverifiedHRs = await User.find({ role: 'hr', isVerified: false });
    console.log('⚠️ Unverified HR users:', unverifiedHRs.length);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAuth();