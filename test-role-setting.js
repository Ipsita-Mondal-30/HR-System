const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('./src/models/User');

async function testRoleSetting() {
  try {
    console.log('🧪 Testing role setting functionality...');
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Create a test user (simulating OAuth user)
    const testUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test User',
      email: 'test@example.com',
      role: null // No role initially
    };
    
    // Create JWT token (simulating OAuth callback)
    const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('🔑 Test token created');
    
    // Simulate the set-role process
    console.log('🔄 Simulating role setting...');
    
    // Check if user exists
    let user = await User.findById(testUser._id);
    if (!user) {
      console.log('👤 User not found, creating new user...');
      user = await User.create({
        _id: testUser._id,
        name: testUser.name,
        email: testUser.email,
        role: 'hr', // Setting role to HR
        isActive: true,
        isVerified: false
      });
      console.log('✅ User created successfully');
    } else {
      console.log('👤 User found, updating role...');
      user.role = 'hr';
      await user.save();
      console.log('✅ User role updated successfully');
    }
    
    // Create new token with role
    const newToken = jwt.sign({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    console.log('✅ New token with role created');
    console.log('📊 Final user data:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    
    // Clean up test user
    await User.findByIdAndDelete(testUser._id);
    console.log('🧹 Test user cleaned up');
    
    await mongoose.connection.close();
    console.log('\n🎉 Role setting test completed successfully!');
    console.log('💡 The set-role endpoint should now work without "Database connection failed" error');
    
  } catch (error) {
    console.error('❌ Role setting test failed:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

testRoleSetting();