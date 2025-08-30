const mongoose = require('mongoose');
const Employee = require('./src/models/Employee');
const User = require('./src/models/User');
require('dotenv').config();

async function testEmployeeAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Test the same query that the API uses
    const employees = await Employee.find({ status: 'active' })
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate('manager', 'user position')
      .sort({ createdAt: -1 });

    console.log('\n=== API Test Results ===');
    console.log(`Found ${employees.length} active employees:`);
    
    employees.forEach(emp => {
      console.log(`- ${emp.user.name} (${emp.user.email})`);
      console.log(`  Position: ${emp.position}`);
      console.log(`  Department: ${emp.department?.name || 'No Department'}`);
      console.log(`  Status: ${emp.status}`);
      console.log('');
    });
    
    // Test the response format
    const response = { employees };
    console.log('API Response format:', JSON.stringify(response, null, 2));
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testEmployeeAPI();