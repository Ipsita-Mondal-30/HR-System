const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('./src/models/Job');
const User = require('./src/models/User');
const Department = require('./src/models/Department');
const Role = require('./src/models/Role');

async function createPendingJobs() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get HR users and departments
    const hrUsers = await User.find({ role: 'hr' });
    const departments = await Department.find();
    const roles = await Role.find();
    
    console.log(`📋 Found ${hrUsers.length} HR users, ${departments.length} departments, ${roles.length} roles`);
    
    if (hrUsers.length === 0) {
      console.log('❌ No HR users found. Please run create-initial-data.js first');
      return;
    }
    
    // Update existing jobs to be pending
    console.log('🔄 Setting existing jobs to pending status...');
    await Job.updateMany({}, { 
      status: 'pending', 
      isApproved: false 
    });
    
    // Create additional pending jobs
    const pendingJobs = [
      {
        title: 'Senior Frontend Developer',
        description: 'We are looking for an experienced frontend developer to join our team. You will be responsible for building user-facing features using React, TypeScript, and modern web technologies.',
        companyName: 'TechStart Inc.',
        location: 'San Francisco, CA',
        employmentType: 'full-time',
        minSalary: 100000,
        maxSalary: 150000,
        skills: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML'],
        department: departments[0]?._id,
        role: roles[0]?._id,
        createdBy: hrUsers[0]._id,
        status: 'pending',
        isApproved: false
      },
      {
        title: 'Backend Engineer',
        description: 'Join our backend team to build scalable APIs and microservices. Experience with Node.js, Python, and cloud technologies required.',
        companyName: 'CloudTech Solutions',
        location: 'New York, NY',
        employmentType: 'full-time',
        minSalary: 90000,
        maxSalary: 140000,
        skills: ['Node.js', 'Python', 'AWS', 'MongoDB', 'PostgreSQL'],
        department: departments[0]?._id,
        role: roles[0]?._id,
        createdBy: hrUsers[1] ? hrUsers[1]._id : hrUsers[0]._id,
        status: 'pending',
        isApproved: false
      },
      {
        title: 'Product Manager',
        description: 'Lead product strategy and work with cross-functional teams to deliver innovative solutions. Experience in agile methodologies and user research required.',
        companyName: 'Innovation Labs',
        location: 'Austin, TX',
        employmentType: 'full-time',
        minSalary: 110000,
        maxSalary: 160000,
        skills: ['Product Strategy', 'Agile', 'User Research', 'Analytics', 'Roadmapping'],
        department: departments[1]?._id,
        role: roles[1]?._id,
        createdBy: hrUsers[2] ? hrUsers[2]._id : hrUsers[0]._id,
        status: 'pending',
        isApproved: false
      }
    ];
    
    // Create the new pending jobs
    for (const jobData of pendingJobs) {
      const job = new Job(jobData);
      await job.save();
      console.log(`✅ Created pending job: ${job.title} at ${job.companyName}`);
    }
    
    console.log('\n🎉 Created pending jobs successfully!');
    
    // Verify pending jobs
    const allPendingJobs = await Job.find({ status: 'pending' })
      .populate('createdBy', 'name email')
      .populate('department', 'name');
    
    console.log(`\n📊 Total pending jobs: ${allPendingJobs.length}`);
    allPendingJobs.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.title} at ${job.companyName}`);
      console.log(`     Posted by: ${job.createdBy?.name || 'Unknown'} (${job.createdBy?.email || 'Unknown'})`);
      console.log(`     Department: ${job.department?.name || 'Unknown'}`);
      console.log(`     Status: ${job.status} (Approved: ${job.isApproved})`);
      console.log('  ---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createPendingJobs();