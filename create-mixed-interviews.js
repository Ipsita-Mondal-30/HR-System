const mongoose = require('mongoose');
require('dotenv').config();

const Interview = require('./src/models/Interview');
const Application = require('./src/models/Application');
const User = require('./src/models/User');
const Job = require('./src/models/Job');

async function createMixedInterviews() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing interviews
    console.log('🧹 Clearing existing interviews...');
    await Interview.deleteMany({});
    
    // Get applications and HR users
    const applications = await Application.find().populate('candidate job');
    const hrUsers = await User.find({ role: 'hr' });
    
    console.log(`📋 Found ${applications.length} applications and ${hrUsers.length} HR users`);
    
    if (applications.length === 0 || hrUsers.length === 0) {
      console.log('❌ No applications or HR users found. Please run create-initial-data.js first');
      return;
    }
    
    // Create mixed interviews
    const interviews = [];
    
    // Interview 1: Scheduled for tomorrow
    interviews.push({
      application: applications[0]._id,
      interviewer: hrUsers[0]._id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      duration: 60,
      type: 'video',
      status: 'scheduled',
      notes: 'Technical interview focusing on React and Node.js. Please prepare coding questions.',
      meetingLink: 'https://zoom.us/j/123456789'
    });
    
    // Interview 2: Completed with hire recommendation
    interviews.push({
      application: applications[1]._id,
      interviewer: hrUsers[0]._id,
      scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      duration: 45,
      type: 'phone',
      status: 'completed',
      notes: 'Phone screening completed successfully',
      scorecard: {
        technicalSkills: 4,
        communication: 5,
        problemSolving: 4,
        culturalFit: 5,
        overall: 4.5,
        feedback: 'Excellent candidate with strong technical skills and great communication. Demonstrated deep understanding of requirements and showed enthusiasm for the role. Highly recommended for next round.',
        recommendation: 'hire'
      }
    });
    
    // Interview 3: Completed with no-hire recommendation
    interviews.push({
      application: applications[2]._id,
      interviewer: hrUsers[1] ? hrUsers[1]._id : hrUsers[0]._id,
      scheduledAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
      completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
      duration: 30,
      type: 'in-person',
      status: 'completed',
      notes: 'In-person interview at office',
      scorecard: {
        technicalSkills: 2,
        communication: 3,
        problemSolving: 3,
        culturalFit: 3,
        overall: 2.8,
        feedback: 'Candidate showed basic understanding but lacks the depth of experience required for this senior role. Technical skills need improvement and would benefit from more hands-on experience.',
        recommendation: 'no-hire'
      }
    });
    
    // Create interviews
    for (const interviewData of interviews) {
      const interview = new Interview(interviewData);
      await interview.save();
      console.log(`✅ Created interview: ${interview._id} (${interview.status})`);
    }
    
    console.log('\\n🎉 Created mixed interviews successfully!');
    
    // Verify the interviews
    console.log('\\n📊 Verification - Created interviews:');
    const createdInterviews = await Interview.find()
      .populate({
        path: 'application',
        populate: [
          { path: 'candidate', select: 'name' },
          { path: 'job', select: 'title' }
        ]
      })
      .populate('interviewer', 'name')
      .sort({ scheduledAt: -1 });
    
    createdInterviews.forEach((interview, index) => {
      console.log(`  ${index + 1}. ${interview.application?.candidate?.name || 'Unknown'} for ${interview.application?.job?.title || 'Unknown'}`);
      console.log(`     HR: ${interview.interviewer?.name || 'Unknown'}`);
      console.log(`     Status: ${interview.status}`);
      console.log(`     Type: ${interview.type}`);
      console.log(`     Scheduled: ${interview.scheduledAt.toLocaleString()}`);
      if (interview.scorecard) {
        console.log(`     Rating: ${interview.scorecard.overall}/5 (${interview.scorecard.recommendation})`);
      }
      console.log('  ---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createMixedInterviews();