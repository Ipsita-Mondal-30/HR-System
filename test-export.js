const mongoose = require('mongoose');
require('dotenv').config();

const adminController = require('./src/controllers/adminController');

// Mock request and response objects for export
const mockReq = {
  query: {
    type: 'interviews',
    format: 'csv'
  }
};

const mockRes = {
  setHeader: (name, value) => {
    console.log(`Header: ${name} = ${value}`);
  },
  send: (data) => {
    console.log('📊 Export Response:');
    console.log('--- CSV Content ---');
    console.log(data);
    console.log('--- End CSV ---');
  },
  status: (code) => ({
    json: (data) => {
      console.log(`❌ Error ${code}:`, data);
    }
  })
};

async function testExport() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('\n📊 Testing export endpoint...');
    await adminController.exportData(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testExport();