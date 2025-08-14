const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const User = require('./src/models/User');

async function testHRJobs() {
  try {
    console.log('🧪 Testing HR Jobs Management...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Get HR user
    const hrUser = await User.findOne({ email: 'kgipsita30@gmail.com' });
    if (!hrUser) {
      console.log('❌ HR user not found');
      return;
    }
    
    console.log('👤 HR user found:', hrUser.name, '- Verified:', hrUser.isVerified);
    
    // Create JWT token for HR user
    const token = jwt.sign({
      _id: hrUser._id,
      name: hrUser.name,
      email: hrUser.email,
      role: hrUser.role
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    console.log('🔑 JWT token created for HR user');
    
    // Test HR jobs endpoint with authentication
    console.log('\n🔄 Testing HR jobs management endpoint...');
    try {
      const response = await axios.get('http://localhost:8080/api/jobs/manage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log(`✅ HR Jobs Management: ${response.data.length} jobs found`);
      response.data.forEach((job, index) => {
        console.log(`   ${index + 1}. ${job.title} (${job.status}) - ${job.companyName}`);
      });
      
    } catch (err) {
      console.log('❌ HR jobs management failed:', err.response?.data || err.message);
    }
    
    // Test job creation
    console.log('\n🔄 Testing job creation...');
    try {
      const newJob = {
        title: 'Test Job Position',
        description: 'This is a test job created via API',
        companyName: 'Test Company',
        location: 'Remote',
        department: '689d7260e78d531735cbba8e', // Engineering department ID
        role: '689d7261e78d531735cbba96', // Software Engineer role ID
        employmentType: 'full-time',
        status: 'active'
      };
      
      const createResponse = await axios.post('http://localhost:8080/api/jobs', newJob, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Job created successfully:', createResponse.data.title);
      
      // Clean up - delete the test job
      await axios.delete(`http://localhost:8080/api/jobs/${createResponse.data._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {}); // Ignore delete errors
      
    } catch (err) {
      console.log('❌ Job creation failed:', err.response?.data || err.message);
    }
    
    await mongoose.connection.close();
    console.log('\n🎉 HR Jobs testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testHRJobs();