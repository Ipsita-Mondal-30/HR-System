const mongoose = require('mongoose');
const User = require('./src/models/User');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ipsita30:XMw7VFSSxLZUOJkH@cluster0.yqhqb.mongodb.net/hrsystem';

async function fixHRVerification() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find HR user
    const hrUser = await User.findOne({ email: 'ipsitaamondal@gmail.com' });
    if (!hrUser) {
      console.log('❌ HR user not found');
      return;
    }

    console.log('👤 Found HR user:', {
      email: hrUser.email,
      role: hrUser.role,
      isVerified: hrUser.isVerified
    });

    // Update verification status
    hrUser.isVerified = true;
    await hrUser.save();

    console.log('✅ HR user verification updated successfully');
    console.log('👤 Updated HR user:', {
      email: hrUser.email,
      role: hrUser.role,
      isVerified: hrUser.isVerified
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixHRVerification();