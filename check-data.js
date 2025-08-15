const mongoose = require('mongoose');
const User = require('./src/models/User');
const Job = require('./src/models/Job');

mongoose.connect('mongodb://localhost:27017/hr-platform');

async function checkData() {
  try {
    const users = await User.find().select('name email role isVerified');
    console.log('👥 Users in database:');
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - Role: ${user.role}, Verified: ${user.isVerified}`);
    });
    
    const jobs = await Job.find().populate('createdBy', 'name email');
    console.log(`\n💼 Jobs in database: ${jobs.length}`);
    jobs.forEach(job => {
      console.log(`  - ${job.title} by ${job.createdBy?.name || 'Unknown'} - Status: ${job.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();