const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Feedback = require('../models/Feedback');
const OKR = require('../models/OKR');

async function seedEmployeeData() {
  try {
    console.log('🌱 Seeding employee performance data...');

    // Create sample employees (if they don't exist)
    const sampleEmployees = [
      {
        name: 'Alice Johnson',
        email: 'alice.johnson@company.com',
        role: 'employee',
        position: 'Senior Software Engineer',
        department: 'Engineering',
        performanceScore: 85,
        projectContribution: 78
      },
      {
        name: 'Bob Smith',
        email: 'bob.smith@company.com',
        role: 'employee',
        position: 'UX Designer',
        department: 'Design',
        performanceScore: 92,
        projectContribution: 88
      },
      {
        name: 'Carol Davis',
        email: 'carol.davis@company.com',
        role: 'employee',
        position: 'Marketing Manager',
        department: 'Marketing',
        performanceScore: 76,
        projectContribution: 82
      },
      {
        name: 'David Wilson',
        email: 'david.wilson@company.com',
        role: 'employee',
        position: 'DevOps Engineer',
        department: 'Engineering',
        performanceScore: 89,
        projectContribution: 85
      },
      {
        name: 'Eva Brown',
        email: 'eva.brown@company.com',
        role: 'employee',
        position: 'Product Manager',
        department: 'Product',
        performanceScore: 94,
        projectContribution: 91
      }
    ];

    const createdEmployees = [];

    for (const empData of sampleEmployees) {
      // Check if user exists
      let user = await User.findOne({ email: empData.email });
      
      if (!user) {
        // Create user
        user = new User({
          name: empData.name,
          email: empData.email,
          role: empData.role,
          isActive: true
        });
        await user.save();
        console.log(`👤 Created user: ${user.name}`);
      }

      // Check if employee exists
      let employee = await Employee.findOne({ user: user._id });
      
      if (!employee) {
        // Create employee
        employee = new Employee({
          user: user._id,
          position: empData.position,
          hireDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
          performanceScore: empData.performanceScore,
          projectContribution: empData.projectContribution,
          skills: [
            { name: 'JavaScript', level: 'advanced' },
            { name: 'React', level: 'intermediate' },
            { name: 'Node.js', level: 'intermediate' }
          ]
        });
        await employee.save();
        console.log(`👥 Created employee: ${employee.user} (${empData.position})`);
      }

      createdEmployees.push(employee);
    }

    // Create sample projects
    const sampleProjects = [
      {
        name: 'Website Redesign',
        description: 'Complete redesign of company website',
        status: 'active',
        priority: 'high',
        startDate: new Date('2024-01-15'),
        estimatedHours: 400,
        actualHours: 320
      },
      {
        name: 'Mobile App Development',
        description: 'New mobile application for customers',
        status: 'completed',
        priority: 'high',
        startDate: new Date('2023-10-01'),
        endDate: new Date('2024-02-15'),
        estimatedHours: 800,
        actualHours: 750
      },
      {
        name: 'API Integration',
        description: 'Integration with third-party APIs',
        status: 'active',
        priority: 'medium',
        startDate: new Date('2024-02-01'),
        estimatedHours: 200,
        actualHours: 150
      }
    ];

    for (const projData of sampleProjects) {
      const existingProject = await Project.findOne({ name: projData.name });
      
      if (!existingProject) {
        const project = new Project({
          ...projData,
          projectManager: createdEmployees[0]._id, // Alice as project manager
          teamMembers: createdEmployees.slice(0, 3).map((emp, index) => ({
            employee: emp._id,
            role: index === 0 ? 'project-manager' : 'team-member',
            contributionPercentage: 70 + Math.random() * 25, // 70-95%
            hoursWorked: Math.floor(Math.random() * 100) + 50
          })),
          completionPercentage: projData.status === 'completed' ? 100 : Math.floor(Math.random() * 60) + 30
        });
        
        await project.save();
        console.log(`📊 Created project: ${project.name}`);
      }
    }

    // Create sample feedback
    const feedbackTypes = ['project-feedback', 'performance-review', 'peer-feedback'];
    
    for (let i = 0; i < 10; i++) {
      const reviewer = createdEmployees[Math.floor(Math.random() * createdEmployees.length)];
      const employee = createdEmployees[Math.floor(Math.random() * createdEmployees.length)];
      
      if (reviewer._id.toString() !== employee._id.toString()) {
        const existingFeedback = await Feedback.findOne({
          reviewer: reviewer.user,
          employee: employee._id
        });
        
        if (!existingFeedback) {
          const feedback = new Feedback({
            reviewer: reviewer.user,
            employee: employee._id,
            type: feedbackTypes[Math.floor(Math.random() * feedbackTypes.length)],
            title: `Performance feedback for ${employee.user?.name || 'Employee'}`,
            content: `Great work on recent projects. Shows strong technical skills and good collaboration with the team. Areas for improvement include time management and communication.`,
            ratings: {
              technical: Math.floor(Math.random() * 2) + 4, // 4-5
              communication: Math.floor(Math.random() * 3) + 3, // 3-5
              teamwork: Math.floor(Math.random() * 2) + 4, // 4-5
              leadership: Math.floor(Math.random() * 3) + 3, // 3-5
              problemSolving: Math.floor(Math.random() * 2) + 4, // 4-5
              timeManagement: Math.floor(Math.random() * 3) + 3 // 3-5
            },
            status: 'submitted'
          });
          
          // Calculate overall rating
          const ratings = Object.values(feedback.ratings).filter(r => r > 0);
          feedback.overallRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
          
          await feedback.save();
          console.log(`💬 Created feedback for: ${employee.user?.name || 'Employee'}`);
        }
      }
    }

    // Create sample OKRs
    const currentYear = new Date().getFullYear();
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    for (const employee of createdEmployees.slice(0, 3)) {
      const quarter = quarters[Math.floor(Math.random() * quarters.length)];
      
      const existingOKR = await OKR.findOne({
        employee: employee._id,
        year: currentYear,
        period: quarter
      });
      
      if (!existingOKR) {
        const okr = new OKR({
          employee: employee._id,
          period: quarter,
          year: currentYear,
          objective: `Improve technical skills and project delivery for ${quarter} ${currentYear}`,
          description: 'Focus on enhancing technical capabilities and ensuring timely project completion',
          keyResults: [
            {
              title: 'Complete 3 major project milestones',
              description: 'Deliver key project components on time',
              targetValue: 3,
              currentValue: Math.floor(Math.random() * 3) + 1,
              unit: 'milestones'
            },
            {
              title: 'Achieve 90% code review approval rate',
              description: 'Maintain high code quality standards',
              targetValue: 90,
              currentValue: Math.floor(Math.random() * 20) + 75,
              unit: 'percentage'
            },
            {
              title: 'Complete 2 training courses',
              description: 'Enhance technical skills through learning',
              targetValue: 2,
              currentValue: Math.floor(Math.random() * 2),
              unit: 'courses'
            }
          ],
          status: 'active'
        });
        
        okr.calculateProgress();
        await okr.save();
        console.log(`🎯 Created OKR for: ${employee.user?.name || 'Employee'} (${quarter} ${currentYear})`);
      }
    }

    console.log('✅ Employee performance data seeded successfully!');
    
    return {
      employees: createdEmployees.length,
      projects: sampleProjects.length,
      feedback: 10,
      okrs: 3
    };

  } catch (error) {
    console.error('❌ Error seeding employee data:', error);
    throw error;
  }
}

module.exports = { seedEmployeeData };