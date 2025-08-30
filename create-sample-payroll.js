const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');
const Employee = require('./src/models/Employee');
const Payroll = require('./src/models/Payroll');

async function createSamplePayroll() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-system');
    console.log('Connected to database');

    // Get all employees
    const employees = await Employee.find().populate('user');
    console.log('Found employees:', employees.length);

    if (employees.length === 0) {
      console.log('No employees found. Please create employees first.');
      process.exit(1);
    }

    // Create payroll for each employee for the last 3 months
    const currentDate = new Date();
    const months = [
      { month: currentDate.getMonth() + 1, year: currentDate.getFullYear() },
      { month: currentDate.getMonth(), year: currentDate.getFullYear() },
      { month: currentDate.getMonth() - 1, year: currentDate.getFullYear() }
    ];

    // Fix month boundaries
    months.forEach(period => {
      if (period.month <= 0) {
        period.month += 12;
        period.year -= 1;
      }
    });

    for (const employee of employees) {
      for (const period of months) {
        // Check if payroll already exists
        const existing = await Payroll.findOne({
          employee: employee._id,
          month: period.month,
          year: period.year
        });

        if (existing) {
          console.log(`Payroll already exists for ${employee.user?.name} - ${period.month}/${period.year}`);
          continue;
        }

        // Create payroll data
        const baseSalary = 75000 + Math.floor(Math.random() * 50000); // Random salary between 75k-125k
        const payrollData = {
          employee: employee._id,
          month: period.month,
          year: period.year,
          baseSalary: baseSalary,
          allowances: {
            housing: Math.floor(baseSalary * 0.2), // 20% housing allowance
            transport: 5000,
            medical: 3000,
            other: 2000
          },
          deductions: {
            tax: Math.floor(baseSalary * 0.15), // 15% tax
            insurance: 2000,
            providentFund: Math.floor(baseSalary * 0.05), // 5% PF
            other: 500
          },
          overtime: {
            hours: Math.floor(Math.random() * 20), // 0-20 overtime hours
            rate: 50,
            amount: 0 // Will be calculated automatically
          },
          bonus: Math.random() > 0.7 ? Math.floor(Math.random() * 10000) : 0, // 30% chance of bonus
          status: ['pending', 'approved', 'paid'][Math.floor(Math.random() * 3)]
        };

        // Calculate overtime amount
        payrollData.overtime.amount = payrollData.overtime.hours * payrollData.overtime.rate;

        const payroll = new Payroll(payrollData);
        await payroll.save();

        console.log(`✅ Created payroll for ${employee.user?.name} - ${period.month}/${period.year} - $${payroll.netSalary}`);
      }
    }

    console.log('Sample payroll data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating sample payroll:', error);
    process.exit(1);
  }
}

createSamplePayroll();