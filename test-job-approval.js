const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('./src/models/Job');

async function testJobApproval() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check job status
    const allJobs = await Job.find();
    const approvedJobs = await Job.find({ isApproved: true, status: 'active' });
    const pendingJobs = await Job.find({ isApproved: false, status: 'pending' });
    
    console.log(`\n📊 Job Status Summary:`);
    console.log(`Total Jobs: ${allJobs.length}`);
    console.log(`✅ Approved (visible to candidates): ${approvedJobs.length}`);
    console.log(`⏳ Pending approval: ${pendingJobs.length}`);
    
    console.log(`\n✅ Approved Jobs (candidates can see these):`);
    approvedJobs.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.title} at ${job.companyName} (Status: ${job.status})`);
    });
    
    console.log(`\n⏳ Pending Jobs (admin needs to approve):`);
    pendingJobs.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.title} at ${job.companyName} (Status: ${job.status})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testJobApproval();