const mongoose = require('mongoose');
const User = require('./src/models/User');
const Employee = require('./src/models/Employee');
require('dotenv').config();

async function convertExistingEmployees() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find all users with 'employee' role
    const employeeUsers = await User.find({ role: 'employee' });
    console.log(`Found ${employeeUsers.length} users with employee role`);
    
    for (const user of employeeUsers) {
      // Check if Employee profile already exists
      const existingEmployee = await Employee.findOne({ user: user._id });
      
      if (!existingEmployee) {
        const employee = new Employee({
          user: user._id,
          position: 'Employee', // Default position - can be updated later
          hireDate: new Date(),
          salary: 50000, // Default salary - can be updated later
          employmentType: 'full-time',
          status: 'active'
        });
        await employee.save();
        console.log(`✅ Created Employee profile for: ${user.name} (${user.email})`);
      } else {
        console.log(`⏭️ Employee profile already exists for: ${user.name}`);
      }
    }
    
    // Verify the result
    const allEmployees = await Employee.find({ status: 'active' })
      .populate('user', 'name email role');
    
    console.log('\n=== Current Employee Profiles ===');
    allEmployees.forEach(emp => {
      console.log(`- ${emp.user.name} (${emp.user.email}) - ${emp.position}`);
    });
    
    console.log(`\n✅ Total active employees: ${allEmployees.length}`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

convertExistingEmployees();