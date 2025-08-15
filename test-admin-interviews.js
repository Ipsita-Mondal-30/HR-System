const mongoose = require('mongoose');
require('dotenv').config();

const adminController = require('./src/controllers/adminController');

// Mock request and response objects
const mockReq = {
  query: {}
};

const mockRes = {
  json: (data) => {
    console.log('📊 Interviews Response:');
    console.log(`Found ${data.length} interviews:`);
    data.forEach((interview, index) => {
      console.log(`\n${index + 1}. ${interview.candidateName} - ${interview.jobTitle}`);
      console.log(`   HR: ${interview.hrName}`);
      console.log(`   Status: ${interview.status}`);
      console.log(`   Type: ${interview.type}`);
      console.log(`   Scheduled: ${new Date(interview.scheduledAt).toLocaleString()}`);
      if (interview.rating) {
        console.log(`   Rating: ${interview.rating}/5`);
      }
      if (interview.outcome) {
        console.log(`   Outcome: ${interview.outcome}`);
      }
    });
  },
  status: (code) => ({
    json: (data) => {
      console.log(`❌ Error ${code}:`, data);
    }
  })
};

async function testAdminInterviews() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('\n📊 Testing admin interviews endpoint...');
    await adminController.getInterviews(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testAdminInterviews();