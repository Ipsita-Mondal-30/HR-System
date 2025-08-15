const mongoose = require('mongoose');
require('dotenv').config();

const adminController = require('./src/controllers/adminController');

// Mock request for scheduled interviews
const mockReq = {
  query: { status: 'scheduled' }
};

const mockRes = {
  json: (data) => {
    console.log('📊 Scheduled Interviews Response:');
    console.log(`Found ${data.length} scheduled interviews:`);
    data.forEach((interview, index) => {
      console.log(`\n${index + 1}. ${interview.candidateName} - ${interview.jobTitle}`);
      console.log(`   HR: ${interview.hrName}`);
      console.log(`   Status: ${interview.status}`);
      console.log(`   Type: ${interview.type}`);
      console.log(`   Scheduled: ${new Date(interview.scheduledAt).toLocaleString()}`);
    });
  },
  status: (code) => ({
    json: (data) => {
      console.log(`❌ Error ${code}:`, data);
    }
  })
};

async function testScheduledInterviews() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('\n📊 Testing scheduled interviews endpoint...');
    await adminController.getInterviews(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testScheduledInterviews();