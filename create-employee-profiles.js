const mongoose = require('mongoose');
const User = require('./src/models/User');
const Employee = require('./src/models/Employee');
const Department = require('./src/models/Department');
require('dotenv').config();

async function createEmployeeProfiles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get all departments
    const departments = await Department.find();
    const deptMap = {};
    departments.forEach(dept => {
      deptMap[dept.name] = dept._id;
    });
    
    console.log('Available departments:', Object.keys(deptMap));
    
    // Get all users
    const users = await User.find();
    console.log('\n=== Creating Employee Profiles ===');
    
    for (const user of users) {
      // Check if employee profile already exists
      const existingEmployee = await Employee.findOne({ user: user._id });
      
      if (!existingEmployee) {
        let employeeData = {
          user: user._id,
          status: 'active',
          hireDate: new Date('2024-01-15'),
          salary: 75000,
          employmentType: 'full-time'
        };
        
        // Assign position and department based on user role and name
        if (user.role === 'admin') {
          employeeData.position = 'System Administrator';
          employeeData.department = deptMap['Operations'];
          employeeData.salary = 95000;
        } else if (user.role === 'hr') {
          employeeData.position = 'HR Manager';
          employeeData.department = deptMap['HR'];
          employeeData.salary = 85000;
        } else if (user.role === 'employee') {
          employeeData.position = 'Software Developer';
          employeeData.department = deptMap['Engineering'];
          employeeData.salary = 75000;
        }
        
        const employee = new Employee(employeeData);
        await employee.save();
        
        console.log(`✅ Created employee profile for ${user.name} (${user.role})`);
      } else {
        console.log(`⏭️ Employee profile already exists for ${user.name}`);
      }
    }
    
    // Add some additional test employees
    const additionalEmployees = [
      {
        name: 'Alice Johnson',
        email: 'alice.johnson@company.com',
        phone: '+1234567890',
        position: 'Senior Software Engineer',
        department: 'Engineering',
        salary: 95000
      },
      {
        name: 'Bob Smith',
        email: 'bob.smith@company.com',
        phone: '+1234567891',
        position: 'UX Designer',
        department: 'Design',
        salary: 80000
      },
      {
        name: 'Carol Davis',
        email: 'carol.davis@company.com',
        phone: '+1234567892',
        position: 'Marketing Manager',
        department: 'Marketing',
        salary: 85000
      },
      {
        name: 'David Wilson',
        email: 'david.wilson@company.com',
        phone: '+1234567893',
        position: 'DevOps Engineer',
        department: 'Engineering',
        salary: 90000
      }
    ];
    
    console.log('\n=== Adding Additional Test Employees ===');
    
    for (const empData of additionalEmployees) {
      // Check if user exists
      let user = await User.findOne({ email: empData.email });
      
      if (!user) {
        user = new User({
          name: empData.name,
          email: empData.email,
          phone: empData.phone,
          role: 'employee',
          isActive: true,
          isVerified: true
        });
        await user.save();
        console.log(`✅ Created user: ${user.name}`);
      }
      
      // Check if employee profile exists
      const existingEmployee = await Employee.findOne({ user: user._id });
      
      if (!existingEmployee) {
        const employee = new Employee({
          user: user._id,
          position: empData.position,
          department: deptMap[empData.department],
          hireDate: new Date('2024-01-15'),
          salary: empData.salary,
          employmentType: 'full-time',
          status: 'active'
        });
        await employee.save();
        console.log(`✅ Created employee profile: ${empData.name} - ${empData.position}`);
      } else {
        console.log(`⏭️ Employee profile already exists for ${empData.name}`);
      }
    }
    
    // Verify final state
    const allEmployees = await Employee.find({ status: 'active' })
      .populate('user', 'name email role')
      .populate('department', 'name');
    
    console.log('\n=== Final Employee List ===');
    allEmployees.forEach(emp => {
      console.log(`- ${emp.user.name} (${emp.user.role}) - ${emp.position} - ${emp.department?.name || 'No Department'}`);
    });
    
    console.log(`\n✅ Total active employees: ${allEmployees.length}`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createEmployeeProfiles();