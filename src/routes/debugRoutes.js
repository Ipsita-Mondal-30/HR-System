const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { verifyJWT, isHRorAdmin } = require('../middleware/auth');

// Seed data endpoint
router.post('/seed', async (req, res) => {
  try {
    // Check if departments exist, create if not
    const departments = [
      { name: 'Engineering', description: 'Software development and technical operations' },
      { name: 'Design', description: 'UI/UX design and creative services' },
      { name: 'Marketing', description: 'Marketing and brand management' },
      { name: 'Sales', description: 'Sales and business development' },
      { name: 'HR', description: 'Human resources and people operations' },
      { name: 'Finance', description: 'Financial planning and accounting' },
      { name: 'Operations', description: 'Business operations and administration' }
    ];
    
    // Create departments if they don't exist
    for (const dept of departments) {
      const existingDept = await Department.findOne({ name: dept.name });
      if (!existingDept) {
        await Department.create(dept);
        console.log(`Created department: ${dept.name}`);
      }
    }
    
    // Get department IDs
    const deptIds = {};
    const allDepts = await Department.find();
    allDepts.forEach(dept => {
      deptIds[dept.name] = dept._id;
    });
    
    // Create real employees with proper references
    const employees = [
      {
        name: 'John Smith',
        email: 'john.smith@example.com',
        position: 'Senior Developer',
        department: deptIds['Engineering'],
        employeeId: 'EMP001',
        hireDate: new Date('2020-01-15'),
        salary: 95000,
        performanceScore: 4.2
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        position: 'UX Designer',
        department: deptIds['Design'],
        employeeId: 'EMP002',
        hireDate: new Date('2021-03-10'),
        salary: 85000,
        performanceScore: 4.5
      },
      {
        name: 'Michael Chen',
        email: 'michael.chen@example.com',
        position: 'Marketing Manager',
        department: deptIds['Marketing'],
        employeeId: 'EMP003',
        hireDate: new Date('2019-11-05'),
        salary: 90000,
        performanceScore: 4.0
      },
      {
        name: 'Emily Davis',
        email: 'emily.davis@example.com',
        position: 'HR Specialist',
        department: deptIds['HR'],
        employeeId: 'EMP004',
        hireDate: new Date('2022-02-20'),
        salary: 75000,
        performanceScore: 4.3
      },
      {
        name: 'David Wilson',
        email: 'david.wilson@example.com',
        position: 'Financial Analyst',
        department: deptIds['Finance'],
        employeeId: 'EMP005',
        hireDate: new Date('2021-07-15'),
        salary: 82000,
        performanceScore: 3.9
      }
    ];
    
    // Create users and employees
    let createdCount = 0;
    for (const emp of employees) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: emp.email });
      if (!existingUser) {
        // Create user
        const user = new User({
          name: emp.name,
          email: emp.email,
          role: 'employee',
          isActive: true,
          isVerified: true
        });
        await user.save();
        
        // Create employee
        const employee = new Employee({
          user: user._id,
          employeeId: emp.employeeId,
          department: emp.department,
          position: emp.position,
          hireDate: emp.hireDate,
          employmentType: 'full-time',
          salary: emp.salary,
          performanceScore: emp.performanceScore
        });
        await employee.save();
        createdCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Created ${createdCount} employees and departments`,
      departmentsCreated: Object.keys(deptIds).length,
      employeesCreated: createdCount
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    res.status(500).json({ error: 'Failed to seed data', details: error.message });
  }
});

// Clear seed data
router.delete('/clear', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    // Delete employees and their users
    const employees = await Employee.find();
    for (const emp of employees) {
      await User.findByIdAndDelete(emp.user);
      await Employee.findByIdAndDelete(emp._id);
    }
    
    res.json({
      success: true,
      message: `Cleared ${employees.length} employees and their user accounts`
    });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Failed to clear data', details: error.message });
  }
});

// Get database stats
router.get('/data', async (req, res) => {
  try {
    const [jobsCount, applicationsCount, usersCount, employeesCount] = await Promise.all([
      Job.countDocuments(),
      Application.countDocuments(),
      User.countDocuments(),
      Employee.countDocuments()
    ]);
    
    res.json({
      jobsCount,
      applicationsCount,
      usersCount,
      employeesCount
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ error: 'Failed to get database stats', details: error.message });
  }
});

module.exports = router;