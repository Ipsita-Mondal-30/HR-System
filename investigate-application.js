const mongoose = require('mongoose');
const Application = require('./src/models/Application');
const User = require('./src/models/User');
const Job = require('./src/models/Job');

require('dotenv').config();

async function investigateApplication() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find the specific application for Ruchi Sachdev
    const ruchiApp = await Application.findOne({ name: 'Ruchi Sachdev' });
    
    if (ruchiApp) {
      console.log('🔍 Ruchi Sachdev application details:');
      console.log('Application ID:', ruchiApp._id);
      console.log('Name:', ruchiApp.name);
      console.log('Email:', ruchiApp.email);
      console.log('Candidate field:', ruchiApp.candidate);
      console.log('User field:', ruchiApp.user);
      console.log('Job field:', ruchiApp.job);
      
      // Check if there's a user with this email
      const user = await User.findOne({ email: ruchiApp.email });
      if (user) {
        console.log('\n👤 Found user with matching email:');
        console.log('User ID:', user._id);
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('Role:', user.role);
        
        // Update the application to set the candidate field
        if (user.role === 'candidate') {
          console.log('\n🔧 Updating application to set candidate field...');
          await Application.findByIdAndUpdate(ruchiApp._id, {
            candidate: user._id,
            user: user._id // Also ensure user field is set
          });
          console.log('✅ Application updated!');
        } else {
          console.log('⚠️  User is not a candidate, role:', user.role);
        }
      } else {
        console.log('❌ No user found with email:', ruchiApp.email);
        
        // Check all users to see what's available
        const allUsers = await User.find({ role: 'candidate' }).select('name email');
        console.log('\n👥 Available candidates:');
        allUsers.forEach(u => {
          console.log(`- ${u.name} (${u.email})`);
        });
      }
    } else {
      console.log('❌ Application for Ruchi Sachdev not found');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

investigateApplication();