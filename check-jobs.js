const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('./src/models/Job');
const User = require('./src/models/User');
const Department = require('./src/models/Department');
const Role = require('./src/models/Role');

async function checkJobs() {
  try {
    console.log('🔍 Checking jobs in database...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Get all jobs with populated data
    const jobs = await Job.find()
      .populate('department', 'name')
      .populate('role', 'title')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    console.log(`\n📊 Found ${jobs.length} jobs in database:`);
    
    jobs.forEach((job, index) => {
      console.log(`\n${index + 1}. ${job.title}`);
      console.log(`   Company: ${job.companyName}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Department: ${job.department?.name || 'None'}`);
      console.log(`   Role: ${job.role?.title || 'None'}`);
      console.log(`   Created by: ${job.createdBy?.name || 'Unknown'} (${job.createdBy?.email || 'No email'})`);
      console.log(`   Created: ${job.createdAt}`);
      console.log(`   ID: ${job._id}`);
    });
    
    // Check departments and roles
    const departments = await Department.find();
    const roles = await Role.find();
    const hrUsers = await User.find({ role: 'hr' });
    
    console.log(`\n📋 Available departments: ${departments.length}`);
    departments.forEach(dept => console.log(`   - ${dept.name} (${dept._id})`));
    
    console.log(`\n📋 Available roles: ${roles.length}`);
    roles.forEach(role => console.log(`   - ${role.title} (${role._id})`));
    
    console.log(`\n👥 HR users: ${hrUsers.length}`);
    hrUsers.forEach(user => console.log(`   - ${user.name} (${user.email}) - Verified: ${user.isVerified}`));
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error checking jobs:', error);
  }
}

checkJobs();