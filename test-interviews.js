const mongoose = require('mongoose');
require('dotenv').config();

const Interview = require('./src/models/Interview');
const Application = require('./src/models/Application');
const User = require('./src/models/User');
const Job = require('./src/models/Job');

mongoose.connect(process.env.MONGODB_URI);

async function testInterviews() {
  try {
    console.log('🧪 Testing interview functionality...\n');
    
    // Test 1: Check existing interviews
    console.log('1️⃣ Checking existing interviews...');
    const interviews = await Interview.find()
      .populate({
        path: 'application',
        populate: [
          { path: 'candidate', select: 'name email' },
          { path: 'job', select: 'title companyName' }
        ]
      })
      .populate('interviewer', 'name email companyName');
    
    console.log(`   📊 Found ${interviews.length} interviews`);
    
    if (interviews.length === 0) {
      console.log('   ⚠️ No interviews found. Creating a test interview...');
      
      // Get an application and HR user to create a test interview
      const application = await Application.findOne().populate('candidate job');
      const hrUser = await User.findOne({ role: 'hr' });
      
      if (application && hrUser) {
        const testInterview = new Interview({
          application: application._id,
          interviewer: hrUser._id,
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          duration: 60,
          type: 'video',
          status: 'scheduled',
          meetingLink: 'https://zoom.us/j/123456789',
          notes: 'Technical interview for React developer position'
        });
        
        await testInterview.save();
        console.log('   ✅ Created test interview');
        
        // Fetch again to verify
        const newInterviews = await Interview.find()
          .populate({
            path: 'application',
            populate: [
              { path: 'candidate', select: 'name email' },
              { path: 'job', select: 'title companyName' }
            ]
          })
          .populate('interviewer', 'name email companyName');
        
        console.log(`   📊 Now have ${newInterviews.length} interviews`);
        
        if (newInterviews.length > 0) {
          const interview = newInterviews[0];
          console.log('   📋 Sample interview:');
          console.log(`      Candidate: ${interview.application?.candidate?.name || 'Unknown'}`);
          console.log(`      Job: ${interview.application?.job?.title || 'Unknown'}`);
          console.log(`      HR: ${interview.interviewer?.name || 'Unknown'}`);
          console.log(`      Status: ${interview.status}`);
          console.log(`      Type: ${interview.type}`);
        }
      } else {
        console.log('   ❌ Cannot create test interview - missing application or HR user');
      }
    } else {
      interviews.forEach((interview, index) => {
        console.log(`   📋 Interview ${index + 1}:`);
        console.log(`      Candidate: ${interview.application?.candidate?.name || 'Unknown'}`);
        console.log(`      Job: ${interview.application?.job?.title || 'Unknown'}`);
        console.log(`      HR: ${interview.interviewer?.name || 'Unknown'}`);
        console.log(`      Status: ${interview.status}`);
        console.log(`      Type: ${interview.type}`);
      });
    }
    
    console.log('\n✅ Interview test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testInterviews();