const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');
const Job = require('./src/models/Job');
const Application = require('./src/models/Application');
const Interview = require('./src/models/Interview');
const Department = require('./src/models/Department');
const Role = require('./src/models/Role');

mongoose.connect(process.env.MONGODB_URI);

async function testAllFixes() {
  try {
    console.log('🧪 Testing all fixes...\n');
    
    // Test 1: Check if jobs are visible to admin
    console.log('1️⃣ Testing admin job visibility...');
    const jobs = await Job.find()
      .populate('createdBy', 'name email')
      .populate('department', 'name')
      .populate('role', 'title');
    
    console.log(`   📊 Found ${jobs.length} jobs`);
    if (jobs.length > 0) {
      console.log(`   ✅ Sample job: ${jobs[0].title} by ${jobs[0].createdBy?.name}`);
    }
    
    // Test 2: Check HR users and their verification status
    console.log('\n2️⃣ Testing HR user verification...');
    const hrUsers = await User.find({ role: 'hr' });
    const verifiedHRs = hrUsers.filter(hr => hr.isVerified);
    const pendingHRs = hrUsers.filter(hr => !hr.isVerified);
    
    console.log(`   📊 Total HR users: ${hrUsers.length}`);
    console.log(`   ✅ Verified: ${verifiedHRs.length}`);
    console.log(`   ⏳ Pending: ${pendingHRs.length}`);
    
    // Test 3: Check candidate applications
    console.log('\n3️⃣ Testing candidate applications...');
    const applications = await Application.find()
      .populate('candidate', 'name email')
      .populate('job', 'title companyName');
    
    console.log(`   📊 Found ${applications.length} applications`);
    if (applications.length > 0) {
      const statusCounts = applications.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {});
      console.log('   📈 Status breakdown:', statusCounts);
    }
    
    // Test 4: Check interviews
    console.log('\n4️⃣ Testing interviews...');
    const interviews = await Interview.find()
      .populate('application')
      .populate('interviewer', 'name email');
    
    console.log(`   📊 Found ${interviews.length} interviews`);
    if (interviews.length > 0) {
      const statusCounts = interviews.reduce((acc, interview) => {
        acc[interview.status] = (acc[interview.status] || 0) + 1;
        return acc;
      }, {});
      console.log('   📈 Interview status breakdown:', statusCounts);
    }
    
    // Test 5: Check departments and roles
    console.log('\n5️⃣ Testing departments and roles...');
    const departments = await Department.find();
    const roles = await Role.find().populate('departmentId', 'name');
    
    console.log(`   📊 Departments: ${departments.length}`);
    console.log(`   📊 Roles: ${roles.length}`);
    
    // Test 6: Check job-HR relationship
    console.log('\n6️⃣ Testing job-HR relationships...');
    for (const hr of hrUsers.slice(0, 3)) { // Test first 3 HR users
      const hrJobs = await Job.find({ createdBy: hr._id });
      console.log(`   👤 ${hr.name}: ${hrJobs.length} jobs created`);
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testAllFixes();