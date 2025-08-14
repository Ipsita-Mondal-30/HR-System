const axios = require('axios');

async function testJobsAPI() {
  try {
    console.log('🧪 Testing Jobs API endpoints...');
    
    // Test public jobs endpoint
    console.log('\n1. Testing public /jobs endpoint...');
    try {
      const publicJobs = await axios.get('http://localhost:8080/api/jobs');
      console.log(`✅ Public jobs: ${publicJobs.data.length} jobs found`);
      console.log('Sample job statuses:', publicJobs.data.map(j => ({ title: j.title, status: j.status })));
    } catch (err) {
      console.log('❌ Public jobs failed:', err.response?.data || err.message);
    }
    
    // Test HR jobs management endpoint (this will fail without auth, but we can see the route)
    console.log('\n2. Testing HR /jobs/manage endpoint...');
    try {
      const hrJobs = await axios.get('http://localhost:8080/api/jobs/manage');
      console.log(`✅ HR jobs: ${hrJobs.data.length} jobs found`);
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('✅ HR jobs endpoint exists (requires authentication)');
      } else {
        console.log('❌ HR jobs failed:', err.response?.data || err.message);
      }
    }
    
    // Test departments endpoint
    console.log('\n3. Testing /departments endpoint...');
    try {
      const departments = await axios.get('http://localhost:8080/api/departments');
      console.log(`✅ Departments: ${departments.data.length} found`);
      console.log('Departments:', departments.data.map(d => d.name));
    } catch (err) {
      console.log('❌ Departments failed:', err.response?.data || err.message);
    }
    
    // Test roles endpoint
    console.log('\n4. Testing /roles endpoint...');
    try {
      const roles = await axios.get('http://localhost:8080/api/roles');
      console.log(`✅ Roles: ${roles.data.length} found`);
      console.log('Roles:', roles.data.map(r => r.title || r.name));
    } catch (err) {
      console.log('❌ Roles failed:', err.response?.data || err.message);
    }
    
    console.log('\n🎉 API testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testJobsAPI();