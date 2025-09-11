const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const User = require('./src/models/User');
const Employee = require('./src/models/Employee');
const Payroll = require('./src/models/Payroll');

async function fixDataIssues() {
  try {
    console.log('🔧 Starting data fix process...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Connected to MongoDB');

    // 1. Fix employees with missing user references
    console.log('\n1. Fixing employees with missing user references...');
    const employeesWithoutUsers = await Employee.find({ user: null });
    console.log(`Found ${employeesWithoutUsers.length} employees without user references`);
    
    for (const employee of employeesWithoutUsers) {
      console.log(`❌ Removing employee without user: ${employee._id}`);
      await Employee.findByIdAndDelete(employee._id);
    }

    // 2. Create employee profiles for users with employee role but no profile
    console.log('\n2. Creating employee profiles for users without profiles...');
    const employeeUsers = await User.find({ role: 'employee' });
    console.log(`Found ${employeeUsers.length} users with employee role`);
    
    for (const user of employeeUsers) {
      const existingEmployee = await Employee.findOne({ user: user._id });
      if (!existingEmployee) {
        console.log(`➕ Creating employee profile for: ${user.name} (${user.email})`);
        const newEmployee = new Employee({
          user: user._id,
          position: 'Employee',
          hireDate: new Date(),
          salary: 50000,
          employmentType: 'full-time',
          status: 'active',
          performanceScore: 75
        });
        await newEmployee.save();
      }
    }

    // 3. Fix payrolls with missing employee references
    console.log('\n3. Fixing payrolls with missing employee references...');
    const payrollsWithoutEmployees = await Payroll.find({ employee: null });
    console.log(`Found ${payrollsWithoutEmployees.length} payrolls without employee references`);
    
    for (const payroll of payrollsWithoutEmployees) {
      console.log(`❌ Removing payroll without employee: ${payroll._id}`);
      await Payroll.findByIdAndDelete(payroll._id);
    }

    // 4. Verify all employees have valid user references
    console.log('\n4. Verifying employee-user relationships...');
    const allEmployees = await Employee.find().populate('user');
    let fixedCount = 0;
    
    for (const employee of allEmployees) {
      if (!employee.user) {
        console.log(`❌ Removing employee with invalid user reference: ${employee._id}`);
        await Employee.findByIdAndDelete(employee._id);
        fixedCount++;
      }
    }
    console.log(`Fixed ${fixedCount} employees with invalid user references`);

    // 5. Create sample payroll data for employees without payroll
    console.log('\n5. Creating sample payroll data...');
    const activeEmployees = await Employee.find({ status: 'active' }).populate('user');
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    for (const employee of activeEmployees) {
      const existingPayroll = await Payroll.findOne({
        employee: employee._id,
        month: currentMonth,
        year: currentYear
      });
      
      if (!existingPayroll && employee.user) {
        console.log(`💰 Creating payroll for: ${employee.user.name}`);
        const baseSalary = employee.salary || 50000;
        const payroll = new Payroll({
          employee: employee._id,
          month: currentMonth,
          year: currentYear,
          baseSalary: baseSalary,
          allowances: {
            housing: baseSalary * 0.2,
            transport: baseSalary * 0.1,
            medical: baseSalary * 0.05,
            other: 0
          },
          deductions: {
            tax: baseSalary * 0.15,
            insurance: baseSalary * 0.03,
            providentFund: baseSalary * 0.12,
            other: 0
          },
          overtime: {
            hours: 0,
            rate: 0,
            amount: 0
          },
          bonus: 0,
          status: 'approved'
        });
        await payroll.save();
      }
    }

    // 6. Final verification
    console.log('\n6. Final verification...');
    const finalEmployeeCount = await Employee.countDocuments();
    const finalUserCount = await User.countDocuments({ role: 'employee' });
    const finalPayrollCount = await Payroll.countDocuments();
    
    console.log(`✅ Final counts:`);
    console.log(`   - Users with employee role: ${finalUserCount}`);
    console.log(`   - Employee profiles: ${finalEmployeeCount}`);
    console.log(`   - Payroll records: ${finalPayrollCount}`);

    // Test data integrity
    console.log('\n7. Testing data integrity...');
    const employeesWithUsers = await Employee.find().populate('user');
    const employeesWithoutValidUsers = employeesWithUsers.filter(emp => !emp.user);
    
    if (employeesWithoutValidUsers.length === 0) {
      console.log('✅ All employees have valid user references');
    } else {
      console.log(`❌ ${employeesWithoutValidUsers.length} employees still have invalid user references`);
    }

    const payrollsWithEmployees = await Payroll.find().populate({
      path: 'employee',
      populate: {
        path: 'user'
      }
    });
    const payrollsWithoutValidEmployees = payrollsWithEmployees.filter(pay => !pay.employee?.user);
    
    if (payrollsWithoutValidEmployees.length === 0) {
      console.log('✅ All payrolls have valid employee/user references');
    } else {
      console.log(`❌ ${payrollsWithoutValidEmployees.length} payrolls still have invalid employee/user references`);
    }

    console.log('\n🎉 Data fix process completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
}

// Run the fix
fixDataIssues();