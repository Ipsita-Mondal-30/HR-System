const mongoose = require('mongoose');
require('dotenv').config();

const Interview = require('./src/models/Interview');
const Application = require('./src/models/Application');
const User = require('./src/models/User');

async function createTestInterview() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find an application and HR user
    const application = await Application.findOne();
    const hrUser = await User.findOne({ role: 'hr' });
    
    if (!application) {
      console.log('❌ No applications found');
      return;
    }
    
    if (!hrUser) {
      console.log('❌ No HR users found');
      return;
    }
    
    console.log(`📋 Using application: ${application._id}`);
    console.log(`👤 Using HR user: ${hrUser.name} (${hrUser.email})`);
    
    // Create test interview
    const interview = new Interview({
      application: application._id,
      interviewer: hrUser._id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      duration: 60,
      type: 'video',
      status: 'scheduled',
      meetingLink: 'https://zoom.us/j/123456789',
      notes: 'Test interview created for admin visibility'
    });
    
    await interview.save();
    console.log('✅ Test interview created successfully!');
    console.log(`   Interview ID: ${interview._id}`);
    
    // Verify it was created
    const createdInterview = await Interview.findById(interview._id)
      .populate('application')
      .populate('interviewer', 'name email');
    
    console.log('📊 Interview details:');
    console.log(`   Scheduled: ${createdInterview.scheduledAt}`);
    console.log(`   Status: ${createdInterview.status}`);
    console.log(`   Type: ${createdInterview.type}`);
    console.log(`   HR: ${createdInterview.interviewer.name}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createTestInterview();