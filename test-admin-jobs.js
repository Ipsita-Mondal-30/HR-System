const mongoose = require('mongoose');
const Job = require('./src/models/Job');
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Department = require('./src/models/Department');
const Role = require('./src/models/Role');

// Connect to MongoDB
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI);

async function testAdminJobs() {
  try {
    console.log('🔍 Testing admin jobs functionality...');
    
    // Test 1: Check if we can fetch jobs
    const jobs = await Job.find()
      .populate('department', 'name')
      .populate('role', 'title')
      .populate('createdBy', 'name email companyName')
      .sort({ createdAt: -1 });
    
    console.log(`📊 Found ${jobs.length} jobs in database`);
    
    if (jobs.length > 0) {
      console.log('📋 Sample job:', {
        title: jobs[0].title,
        companyName: jobs[0].companyName,
        status: jobs[0].status,
        createdBy: jobs[0].createdBy ? {
          name: jobs[0].createdBy.name,
          email: jobs[0].createdBy.email
        } : 'No creator found'
      });
    }
    
    // Test 2: Check HR users
    const hrUsers = await User.find({ role: 'hr' })
      .select('name email companyName isVerified createdAt')
      .sort({ createdAt: -1 });
    
    console.log(`👥 Found ${hrUsers.length} HR users`);
    
    if (hrUsers.length > 0) {
      console.log('👤 Sample HR user:', {
        name: hrUsers[0].name,
        email: hrUsers[0].email,
        companyName: hrUsers[0].companyName,
        isVerified: hrUsers[0].isVerified
      });
      
      // Check jobs created by this HR user
      const hrJobs = await Job.find({ createdBy: hrUsers[0]._id });
      console.log(`💼 HR user ${hrUsers[0].name} has created ${hrJobs.length} jobs`);
    }
    
    // Test 3: Check applications
    const applications = await Application.find()
      .populate('job', 'title')
      .populate('candidate', 'name email');
    
    console.log(`📝 Found ${applications.length} applications`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing admin jobs:', error);
    process.exit(1);
  }
}

testAdminJobs();