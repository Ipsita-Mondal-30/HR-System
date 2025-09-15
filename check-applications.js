const mongoose = require('mongoose');
const Application = require('./src/models/Application');
const User = require('./src/models/User');
const Job = require('./src/models/Job');

require('dotenv').config();

async function checkApplications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const applications = await Application.find()
      .populate('job', 'title companyName')
      .populate('candidate', 'name email')
      .limit(5);
    
    console.log(`📋 Found ${applications.length} applications in database`);
    
    if (applications.length > 0) {
      console.log('\n📋 Sample applications:');
      applications.forEach((app, index) => {
        console.log(`${index + 1}. Application ID: ${app._id}`);
        console.log(`   Name: ${app.name}`);
        console.log(`   Email: ${app.email}`);
        console.log(`   Candidate: ${app.candidate ? app.candidate.name : 'Not populated'}`);
        console.log(`   Job: ${app.job ? app.job.title : 'Not populated'}`);
        console.log(`   Status: ${app.status}`);
        console.log('---');
      });
    } else {
      console.log('❌ No applications found in database');
      
      // Check if there are any users and jobs
      const userCount = await User.countDocuments({ role: 'candidate' });
      const jobCount = await Job.countDocuments();
      
      console.log(`👥 Candidates in database: ${userCount}`);
      console.log(`💼 Jobs in database: ${jobCount}`);
    }
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkApplications();