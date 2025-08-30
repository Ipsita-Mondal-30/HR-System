const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Employee = require('./src/models/Employee');

async function cleanEmployees() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-system');
    console.log('Connected to database');
    
    // Find all employees
    const employees = await Employee.find().populate('user');
    console.log('Total employees found:', employees.length);
    
    let cleanedCount = 0;
    
    for (const emp of employees) {
      if (!emp.user || !emp.user.name) {
        console.log('Removing bad employee:', emp._id, 'Position:', emp.position);
        await Employee.findByIdAndDelete(emp._id);
        cleanedCount++;
      } else {
        console.log('Good employee:', emp.user.name, '-', emp.position);
      }
    }
    
    console.log(`Cleaned ${cleanedCount} bad employee records`);
    
    // Check final count
    const finalCount = await Employee.countDocuments();
    console.log('Final employee count:', finalCount);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanEmployees();