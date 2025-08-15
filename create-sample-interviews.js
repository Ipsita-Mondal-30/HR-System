const mongoose = require('mongoose');
require('dotenv').config();

const Interview = require('./src/models/Interview');
const Application = require('./src/models/Application');
const User = require('./src/models/User');
const Job = require('./src/models/Job');

async function createSampleInterviews() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check existing interviews
    const existingInterviews = await Interview.find();
    console.log(`📊 Found ${existingInterviews.length} existing interviews`);
    
    if (existingInterviews.length > 0) {
      console.log('📋 Existing interviews:');
      for (const interview of existingInterviews) {
        console.log(`  - ${interview._id}: ${interview.status} (${interview.type})`);
      }
      
      // Also check if they have proper population
      const populatedInterviews = await Interview.find()
        .populate({
          path: 'application',
          populate: [
            { path: 'candidate', select: 'name email' },
            { path: 'job', select: 'title companyName' }
          ]
        })
        .populate('interviewer', 'name email companyName');
      
      console.log('\n📋 Populated interview data:');
      for (const interview of populatedInterviews) {
        console.log(`  - Candidate: ${interview.application?.candidate?.name || 'Unknown'}`);
        console.log(`  - Job: ${interview.application?.job?.title || 'Unknown'}`);
        console.log(`  - HR: ${interview.interviewer?.name || 'Unknown'}`);
        console.log(`  - Status: ${interview.status}`);
        console.log(`  - Scorecard: ${interview.scorecard ? 'Yes' : 'No'}`);
        console.log('  ---');
      }
      
      return;
    }
    
    // Find applications and HR users to create sample interviews
    const applications = await Application.find().populate('candidate job');
    const hrUsers = await User.find({ role: 'hr' });
    
    console.log(`📋 Found ${applications.length} applications and ${hrUsers.length} HR users`);
    
    if (applications.length === 0 || hrUsers.length === 0) {
      console.log('❌ Need applications and HR users to create interviews');
      return;
    }
    
    // Create sample interviews
    const sampleInterviews = [];
    
    // Interview 1: Scheduled
    if (applications[0] && hrUsers[0]) {
      const interview1 = new Interview({
        application: applications[0]._id,
        interviewer: hrUsers[0]._id,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        duration: 60,
        type: 'video',
        status: 'scheduled',
        meetingLink: 'https://zoom.us/j/123456789',
        notes: 'Technical interview for React developer position'
      });
      sampleInterviews.push(interview1);
    }
    
    // Interview 2: Completed with scorecard
    if (applications[1] && hrUsers[0]) {
      const interview2 = new Interview({
        application: applications[1]._id,
        interviewer: hrUsers[0]._id,
        scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        duration: 45,
        type: 'phone',
        status: 'completed',
        notes: 'Phone screening completed',
        scorecard: {
          technicalSkills: 4,
          communication: 5,
          problemSolving: 4,
          culturalFit: 5,
          overall: 4.5,
          feedback: 'Excellent candidate with strong technical skills and great communication. Recommended for next round.',
          recommendation: 'hire'
        }
      });
      sampleInterviews.push(interview2);
    }
    
    // Interview 3: Completed with different scorecard
    if (applications[2] && hrUsers[1]) {
      const interview3 = new Interview({
        application: applications[2]._id,
        interviewer: hrUsers[1]._id,
        scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        completedAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 1.5 days ago
        duration: 30,
        type: 'in-person',
        status: 'completed',
        notes: 'In-person interview at office',
        scorecard: {
          technicalSkills: 3,
          communication: 3,
          problemSolving: 2,
          culturalFit: 3,
          overall: 2.8,
          feedback: 'Candidate needs more experience. Technical skills are below requirements.',
          recommendation: 'no-hire'
        }
      });
      sampleInterviews.push(interview3);
    }
    
    // Save all interviews
    for (const interview of sampleInterviews) {
      await interview.save();
      console.log(`✅ Created interview: ${interview._id}`);
    }
    
    console.log(`\n🎉 Created ${sampleInterviews.length} sample interviews!`);
    
    // Verify they were created correctly
    const createdInterviews = await Interview.find()
      .populate({
        path: 'application',
        populate: [
          { path: 'candidate', select: 'name email' },
          { path: 'job', select: 'title companyName' }
        ]
      })
      .populate('interviewer', 'name email companyName');
    
    console.log('\n📊 Verification - Created interviews:');
    for (const interview of createdInterviews) {
      console.log(`  - ${interview.application?.candidate?.name || 'Unknown'} for ${interview.application?.job?.title || 'Unknown'}`);
      console.log(`    HR: ${interview.interviewer?.name || 'Unknown'}`);
      console.log(`    Status: ${interview.status}`);
      console.log(`    Scorecard: ${interview.scorecard ? `${interview.scorecard.overall}/5 (${interview.scorecard.recommendation})` : 'None'}`);
      console.log('  ---');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createSampleInterviews();