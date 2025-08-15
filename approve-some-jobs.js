const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('./src/models/Job');

async function approveSomeJobs() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all pending jobs
    const pendingJobs = await Job.find({ status: 'pending' });
    console.log(`📋 Found ${pendingJobs.length} pending jobs`);
    
    if (pendingJobs.length === 0) {
      console.log('❌ No pending jobs found');
      return;
    }
    
    // Approve the first 3 jobs
    const jobsToApprove = pendingJobs.slice(0, 3);
    
    for (const job of jobsToApprove) {
      job.status = 'active';
      job.isApproved = true;
      await job.save();
      console.log(`✅ Approved job: ${job.title} at ${job.companyName}`);
    }
    
    console.log(`\n🎉 Approved ${jobsToApprove.length} jobs successfully!`);
    
    // Show current status
    const allJobs = await Job.find().populate('createdBy', 'name');
    console.log(`\n📊 Current job status:`);
    
    const approved = allJobs.filter(j => j.isApproved && j.status === 'active');
    const pending = allJobs.filter(j => !j.isApproved && j.status === 'pending');
    
    console.log(`✅ Approved (visible to candidates): ${approved.length}`);
    approved.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.title} at ${job.companyName}`);
    });
    
    console.log(`⏳ Pending approval: ${pending.length}`);
    pending.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.title} at ${job.companyName}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

approveSomeJobs();