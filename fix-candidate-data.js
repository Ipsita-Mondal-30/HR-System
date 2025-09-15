const mongoose = require('mongoose');
const Application = require('./src/models/Application');
const User = require('./src/models/User');
const Job = require('./src/models/Job');

require('dotenv').config();

async function fixCandidateData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all applications
    const applications = await Application.find();
    console.log(`🔍 Found ${applications.length} applications to check`);
    
    for (const app of applications) {
      let needsUpdate = false;
      let updateData = {};
      
      // Check if candidate field points to a valid candidate user
      if (app.candidate) {
        const candidateUser = await User.findById(app.candidate);
        if (!candidateUser || candidateUser.role !== 'candidate') {
          console.log(`❌ Application ${app._id} (${app.name}) has invalid candidate reference`);
          
          // Try to find any user with this email
          const existingUser = await User.findOne({ email: app.email });
          
          if (existingUser) {
            console.log(`✅ Found existing user: ${existingUser.name} with role: ${existingUser.role}`);
            
            // If the user is not a candidate, we need to decide what to do
            if (existingUser.role !== 'candidate') {
              console.log(`⚠️  User ${existingUser.name} has role '${existingUser.role}' but applied as candidate`);
              console.log(`🔧 Updating application to reference the existing user regardless of role`);
            }
            
            updateData.candidate = existingUser._id;
            updateData.user = existingUser._id;
            needsUpdate = true;
          } else {
            console.log(`⚠️  No user found for email: ${app.email}`);
            // Create a candidate user for this application
            const newCandidate = new User({
              name: app.name,
              email: app.email,
              role: 'candidate',
              isVerified: true,
              password: 'temp123' // They'll need to reset this
            });
            
            await newCandidate.save();
            console.log(`✅ Created new candidate user: ${newCandidate.name}`);
            
            updateData.candidate = newCandidate._id;
            updateData.user = newCandidate._id;
            needsUpdate = true;
          }
        } else {
          console.log(`✅ Application ${app._id} (${app.name}) has valid candidate reference`);
        }
      } else {
        // No candidate field, try to find existing user
        console.log(`⚠️  Application ${app._id} (${app.name}) has no candidate field`);
        
        const existingUser = await User.findOne({ email: app.email });
        
        if (existingUser) {
          console.log(`✅ Found existing user: ${existingUser.name} with role: ${existingUser.role}`);
          updateData.candidate = existingUser._id;
          updateData.user = existingUser._id;
          needsUpdate = true;
        } else {
          console.log(`⚠️  Creating new candidate for: ${app.email}`);
          const newCandidate = new User({
            name: app.name,
            email: app.email,
            role: 'candidate',
            isVerified: true,
            password: 'temp123'
          });
          
          await newCandidate.save();
          console.log(`✅ Created new candidate user: ${newCandidate.name}`);
          
          updateData.candidate = newCandidate._id;
          updateData.user = newCandidate._id;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await Application.findByIdAndUpdate(app._id, updateData);
        console.log(`🔧 Updated application ${app._id}`);
      }
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    const fixedApplications = await Application.find()
      .populate('job', 'title')
      .populate('candidate', 'name email role')
      .limit(5);
    
    fixedApplications.forEach((app, index) => {
      console.log(`${index + 1}. ${app.name} - Candidate: ${app.candidate ? `${app.candidate.name} (${app.candidate.role})` : 'Still missing'}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCandidateData();