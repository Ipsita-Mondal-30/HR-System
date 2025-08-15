const axios = require('axios');

async function testAdminAPI() {
  try {
    console.log('🧪 Testing admin interviews API endpoint...');
    
    // Test the admin interviews endpoint
    const response = await axios.get('http://localhost:8080/api/admin/interviews', {
      headers: {
        'Authorization': 'Bearer test-token' // You might need a real token
      }
    });
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 Interview Data:', response.data);
    console.log(`📋 Found ${response.data.length} interviews`);
    
    if (response.data.length > 0) {
      console.log('\n📋 Sample interview:');
      const interview = response.data[0];
      console.log(`  Candidate: ${interview.candidateName}`);
      console.log(`  Job: ${interview.jobTitle}`);
      console.log(`  HR: ${interview.hrName}`);
      console.log(`  Status: ${interview.status}`);
      console.log(`  Rating: ${interview.rating || 'No rating'}`);
      console.log(`  Outcome: ${interview.outcome || 'No outcome'}`);
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Network Error:', error.message);
    }
  }
}

testAdminAPI();