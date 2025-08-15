const mongoose = require('mongoose');
require('dotenv').config();
const Job = require('./src/models/Job');
const User = require('./src/models/User');
const Department = require('./src/models/Department');
const Role = require('./src/models/Role');

mongoose.connect(process.env.MONGODB_URI);

async function checkHRJobs() {
  try {
    const hrUsers = await User.find({ role: 'hr' });
    console.log('👥 HR Users:');
    
    for (const hr of hrUsers) {
      const jobs = await Job.find({ createdBy: hr._id });
      console.log(`  - ${hr.name} (${hr.email}) - Verified: ${hr.isVerified} - Jobs: ${jobs.length}`);
      
      if (jobs.length > 0) {
        jobs.forEach(job => {
          console.log(`    * ${job.title} (${job.status})`);
        });
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkHRJobs();