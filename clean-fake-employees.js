const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const User = require('./src/models/User');
const Employee = require('./src/models/Employee');
const Payroll = require('./src/models/Payroll');

async function cleanFakeEmployees() {
  try {
    console.log('🧹 Cleaning fake employees...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Connected to MongoDB');

    // Find and remove fake employees (those with "No Name" or test data)
    const fakeEmployees = await Employee.find({
      $or: [
        { 'user': null },
        { 'user': { $exists: false } }
      ]
    }).populate('user');

    console.log(`Found ${fakeEmployees.length} employees with invalid user references`);

    // Also find employees with users that have no name or fake names
    const allEmployees = await Employee.find().populate('user');
    const employeesToDelete = [];

    for (const employee of allEmployees) {
      if (!employee.user || 
          !employee.user.name || 
          employee.user.name === 'No Name' ||
          employee.user.name.includes('Test') ||
          employee.user.name.includes('Fake') ||
          employee.user.email.includes('test') ||
          employee.user.email.includes('fake')) {
        employeesToDelete.push(employee);
      }
    }

    console.log(`Found ${employeesToDelete.length} fake/test employees to delete`);

    // Delete fake employees and their related data
    for (const employee of employeesToDelete) {
      console.log(`🗑️ Deleting employee: ${employee.user?.name || 'No Name'} (${employee.user?.email || 'No Email'})`);
      
      // Delete related payroll records
      await Payroll.deleteMany({ employee: employee._id });
      
      // Delete the employee
      await Employee.findByIdAndDelete(employee._id);
      
      // Delete the user if it's a test user
      if (employee.user && (
          employee.user.email.includes('test') || 
          employee.user.email.includes('fake') ||
          employee.user.name === 'No Name'
        )) {
        await User.findByIdAndDelete(employee.user._id);
      }
    }

    // Clean up orphaned payroll records
    const orphanedPayrolls = await Payroll.find().populate('employee');
    let orphanedCount = 0;
    
    for (const payroll of orphanedPayrolls) {
      if (!payroll.employee) {
        await Payroll.findByIdAndDelete(payroll._id);
        orphanedCount++;
      }
    }

    console.log(`🗑️ Deleted ${orphanedCount} orphaned payroll records`);

    // Final verification
    const remainingEmployees = await Employee.find().populate('user');
    console.log('\n📊 Remaining employees:');
    
    for (const employee of remainingEmployees) {
      console.log(`✅ ${employee.user?.name || 'No Name'} - ${employee.user?.email || 'No Email'} - ${employee.position}`);
    }

    console.log(`\n🎉 Cleanup completed! ${employeesToDelete.length} fake employees removed.`);
    console.log(`📊 ${remainingEmployees.length} legitimate employees remain.`);
    
  } catch (error) {
    console.error('❌ Error cleaning fake employees:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
}

// Run the cleanup
cleanFakeEmployees();