const mongoose = require('mongoose');
require('dotenv').config();

const adminController = require('./src/controllers/adminController');

// Mock request and response objects
const mockReq = {
  query: {}
};

const mockRes = {
  json: (data) => {
    console.log('📊 Analytics Response:');
    console.log(JSON.stringify(data, null, 2));
  },
  status: (code) => ({
    json: (data) => {
      console.log(`❌ Error ${code}:`, data);
    }
  })
};

async function testAnalytics() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('\n📊 Testing analytics endpoint...');
    await adminController.getAnalytics(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testAnalytics();