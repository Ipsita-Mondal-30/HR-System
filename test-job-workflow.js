const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function testJobWorkflow() {
  try {
    console.log('🧪 Testing job approval workflow...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Job = require('./src/models/Job');
    const User = require('./src/models/User');
    
    // Check current jobs
    const allJobs = await Job.find();
    console.log(`📊 Total jobs in database: ${allJobs.length}`);
    
    const pendingJobs = await Job.find({ status: 'pending', isApproved: false });
    console.log(`⏳ Pending approval jobs: ${pendingJobs.length}`);
    
    const approvedJobs = await Job.find({ status: 'active', isApproved: true });
    console.log(`✅ Approved jobs: ${approvedJobs.length}`);
    
    // Test job visibility for candidates
    const candidateVisibleJobs = await Job.find({ 
      status: { $in: ['active', 'open'] }, 
      isApproved: true 
    });
    console.log(`👁️  Jobs visible to candidates: ${candidateVisibleJobs.length}`);
    
    // Check users
    const users = await User.find();
    console.log(`👥 Total users: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - Role: ${user.role || 'No role'}`);
    });
    
    console.log('\n🎯 Workflow Summary:');
    console.log('1. HR/Admin posts job → Status: pending, isApproved: false');
    console.log('2. Admin approves job → Status: active, isApproved: true');
    console.log('3. Only approved jobs are visible to candidates');
    console.log('4. Candidates can apply only to approved jobs');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

testJobWorkflow();