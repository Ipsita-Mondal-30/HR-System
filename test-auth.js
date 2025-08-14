const axios = require('axios');

async function testAuth() {
  try {
    console.log('🧪 Testing auth endpoints...');
    
    // Test basic server
    const serverTest = await axios.get('http://localhost:8080/api/test');
    console.log('✅ Server test:', serverTest.data.message);
    
    // Test auth test endpoint
    const authTest = await axios.post('http://localhost:8080/api/auth/test-set-role', {
      test: 'data'
    });
    console.log('✅ Auth test:', authTest.data);
    
    console.log('🎉 All tests passed! The set-role endpoint should work now.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Backend server is not running. Start it with: npm run dev');
    }
  }
}

testAuth();