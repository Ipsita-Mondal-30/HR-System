const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('./src/models/Job');
const User = require('./src/models/User');

async function completeFix() {
  try {
    console.log('🔧 Applying complete fix for job visibility issues...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log('✅ Connected to MongoDB');
    
    // 1. Fix job statuses - convert 'open' to 'active' for consistency
    console.log('\n1. Fixing job statuses...');
    const statusUpdate = await Job.updateMany(
      { status: 'open' },
      { status: 'active' }
    );
    console.log(`✅ Updated ${statusUpdate.modifiedCount} jobs from 'open' to 'active'`);
    
    // 2. Verify HR user
    console.log('\n2. Verifying HR user...');
    const hrUser = await User.findOne({ email: 'kgipsita30@gmail.com' });
    if (hrUser) {
      hrUser.isVerified = true;
      hrUser.isActive = true;
      await hrUser.save();
      console.log('✅ HR user verified and activated');
    }
    
    // 3. Fix missing createdBy references
    console.log('\n3. Fixing missing createdBy references...');
    const jobsWithoutCreator = await Job.find({ 
      $or: [
        { createdBy: { $exists: false } },
        { createdBy: null }
      ]
    });
    
    if (jobsWithoutCreator.length > 0 && hrUser) {
      await Job.updateMany(
        { 
          $or: [
            { createdBy: { $exists: false } },
            { createdBy: null }
          ]
        },
        { createdBy: hrUser._id }
      );
      console.log(`✅ Fixed ${jobsWithoutCreator.length} jobs with missing creators`);
    }
    
    // 4. Final verification
    console.log('\n4. Final verification...');
    const allJobs = await Job.find()
      .populate('department', 'name')
      .populate('role', 'title')
      .populate('createdBy', 'name email');
    
    console.log(`📊 Total jobs in database: ${allJobs.length}`);
    allJobs.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.title} (${job.status}) - Created by: ${job.createdBy?.name || 'Unknown'}`);
    });
    
    await mongoose.connection.close();
    
    console.log('\n🎉 Complete fix applied successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Restart the backend server');
    console.log('2. Login as HR user');
    console.log('3. Go to HR > Manage Jobs');
    console.log('4. You should now see all jobs');
    console.log('5. Job creation should work properly');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

completeFix();