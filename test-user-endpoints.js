const mongoose = require('mongoose');
require('dotenv').config();

const adminController = require('./src/controllers/adminController');

// Mock request and response objects
const createMockRes = (label) => ({
  json: (data) => {
    console.log(`📊 ${label} Response:`);
    if (Array.isArray(data)) {
      console.log(`Found ${data.length} items:`);
      data.slice(0, 2).forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.name || 'Unknown'} (${item.email || 'Unknown'})`);
        if (item.companyName) console.log(`   Company: ${item.companyName}`);
        if (item.skills) console.log(`   Skills: ${item.skills.slice(0, 3).join(', ')}`);
        if (item.applications) console.log(`   Applications: ${item.applications.length}`);
        if (item.jobs) console.log(`   Jobs Posted: ${item.jobs.length}`);
        if (item.interviews) console.log(`   Interviews: ${item.interviews.length}`);
      });
      if (data.length > 2) {
        console.log(`   ... and ${data.length - 2} more`);
      }
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  },
  status: (code) => ({
    json: (data) => {
      console.log(`❌ ${label} Error ${code}:`, data);
    }
  })
});

async function testUserEndpoints() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('\n📊 Testing candidates endpoint...');
    await adminController.getCandidates({ query: {} }, createMockRes('Candidates'));
    
    console.log('\n📊 Testing HR users endpoint...');
    await adminController.getHRUsers({ query: {} }, createMockRes('HR Users'));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testUserEndpoints();