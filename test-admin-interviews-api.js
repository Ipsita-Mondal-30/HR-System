const mongoose = require('mongoose');
require('dotenv').config();

// Import the admin controller function
const { getInterviews } = require('./src/controllers/adminController');

async function testAdminInterviewsAPI() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Mock request and response objects
    const mockReq = {
      query: {} // No status filter
    };
    
    const mockRes = {
      json: (data) => {
        console.log('📊 Admin API Response:');
        console.log(`Found ${data.length} interviews`);
        
        data.forEach((interview, index) => {
          console.log(`\n📋 Interview ${index + 1}:`);
          console.log(`  ID: ${interview._id}`);
          console.log(`  Candidate: ${interview.candidateName} (${interview.candidateEmail})`);
          console.log(`  Job: ${interview.jobTitle}`);
          console.log(`  HR: ${interview.hrName} (${interview.hrCompany})`);
          console.log(`  Status: ${interview.status}`);
          console.log(`  Type: ${interview.type}`);
          console.log(`  Scheduled: ${interview.scheduledAt}`);
          if (interview.feedback) {
            console.log(`  Feedback: ${interview.feedback}`);
          }
          if (interview.rating) {
            console.log(`  Rating: ${interview.rating}/5`);
          }
          if (interview.outcome) {
            console.log(`  Outcome: ${interview.outcome}`);
          }
        });
      },
      status: (code) => ({
        json: (data) => {
          console.log(`❌ Error response (${code}):`, data);
        }
      })
    };
    
    // Test the admin controller function
    console.log('🧪 Testing admin getInterviews function...');
    await getInterviews(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testAdminInterviewsAPI();