const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const User = require('./src/models/User');

async function createAdmin() {
  try {
    console.log('🔧 Creating admin user...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('👤 Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user
    const admin = new User({
      name: 'System Admin',
      email: 'admin@company.com',
      role: 'admin',
      isActive: true,
      isVerified: true,
      lastLogin: new Date()
    });

    await admin.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@company.com');
    console.log('🔑 You can now login with this email using any password');
    
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
}

// Run the script
createAdmin();