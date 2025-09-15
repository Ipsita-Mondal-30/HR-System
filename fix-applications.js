const mongoose = require('mongoose');
const Application = require('./src/models/Application');
const User = require('./src/models/User');
const Job = require('./src/models/Job');

require('dotenv').config();

async function fixApplications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find applications where candidate is null but user exists
    const applicationsToFix = await Application.find({
      $or: [
        { candidate: null, user: { $exists: true, $ne: null } },
        { candidate: { $exists: false }, user: { $exists: true, $ne: null } }
      ]
    }).populate('user', 'name email role');
    
    console.log(`🔧 Found ${applicationsToFix.length} applications to fix`);
    
    if (applicationsToFix.length > 0) {
      for (const app of applicationsToFix) {
        if (app.user && app.user.role === 'candidate') {
          console.log(`🔧 Fixing application ${app._id} - setting candidate to ${app.user.name}`);
          
          await Application.findByIdAndUpdate(app._id, {
            candidate: app.user._id
          });
        } else {
          console.log(`⚠️  Application ${app._id} has user but user is not a candidate (role: ${app.user?.role})`);
        }
      }
      
      console.log('✅ Applications fixed!');
    } else {
      console.log('✅ No applications need fixing');
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    const allApplications = await Application.find()
      .populate('job', 'title')
      .populate('candidate', 'name email')
      .limit(5);
    
    allApplications.forEach((app, index) => {
      console.log(`${index + 1}. ${app.name} - Candidate: ${app.candidate ? app.candidate.name : 'Still missing'}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixApplications();