const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Department = require('../models/Department');
const Role = require('../models/Role');

// Test database connection and create sample data
router.post('/create-test-data', async (req, res) => {
  try {
    console.log('🧪 Creating test data...');

    // Create test department
    let department = await Department.findOne({ name: 'Engineering' });
    if (!department) {
      department = await Department.create({
        name: 'Engineering',
        description: 'Software development and engineering roles'
      });
      console.log('✅ Created test department:', department._id);
    }

    // Create test role
    let role = await Role.findOne({ title: 'Software Engineer' });
    if (!role) {
      role = await Role.create({
        title: 'Software Engineer',
        description: 'Full-stack software development'
      });
      console.log('✅ Created test role:', role._id);
    }

    // Create test HR user
    let hrUser = await User.findOne({ email: 'hr@test.com' });
    if (!hrUser) {
      hrUser = await User.create({
        name: 'Test HR Manager',
        email: 'hr@test.com',
        role: 'hr'
      });
      console.log('✅ Created test HR user:', hrUser._id);
    }

    // Create test candidate
    let candidate = await User.findOne({ email: 'candidate@test.com' });
    if (!candidate) {
      candidate = await User.create({
        name: 'Test Candidate',
        email: 'candidate@test.com',
        role: 'candidate',
        phone: '+1234567890',
        location: 'San Francisco, CA',
        skills: ['JavaScript', 'React', 'Node.js'],
        experience: '3 years',
        bio: 'Experienced full-stack developer'
      });
      console.log('✅ Created test candidate:', candidate._id);
    }

    // Create test job
    let job = await Job.findOne({ title: 'Senior Software Engineer' });
    if (!job) {
      job = await Job.create({
        title: 'Senior Software Engineer',
        description: 'We are looking for a senior software engineer to join our team.',
        companyName: 'Test Company Inc.',
        location: 'San Francisco, CA',
        employmentType: 'full-time',
        experienceRequired: 3,
        minSalary: 80000,
        maxSalary: 120000,
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        department: department._id,
        role: role._id,
        createdBy: hrUser._id,
        status: 'open'
      });
      console.log('✅ Created test job:', job._id);
    }

    // Create test application
    let application = await Application.findOne({ 
      candidate: candidate._id, 
      job: job._id 
    });
    if (!application) {
      application = await Application.create({
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        job: job._id,
        candidate: candidate._id,
        status: 'pending',
        resumeText: `${candidate.name} - ${candidate.experience} experience in ${candidate.skills.join(', ')}`,
        coverLetter: 'I am very interested in this position and believe I would be a great fit.',
        matchScore: 85,
        matchInsights: {
          explanation: 'Strong match based on technical skills and experience',
          matchingSkills: ['JavaScript', 'React', 'Node.js'],
          missingSkills: ['MongoDB'],
          tags: ['experienced', 'full-stack']
        }
      });
      console.log('✅ Created test application:', application._id);
    }

    // Get counts
    const counts = {
      users: await User.countDocuments(),
      jobs: await Job.countDocuments(),
      applications: await Application.countDocuments(),
      departments: await Department.countDocuments(),
      roles: await Role.countDocuments()
    };

    res.json({
      message: 'Test data created successfully!',
      counts,
      testData: {
        department: department._id,
        role: role._id,
        hrUser: hrUser._id,
        candidate: candidate._id,
        job: job._id,
        application: application._id
      }
    });

  } catch (err) {
    console.error('❌ Error creating test data:', err);
    res.status(500).json({ 
      error: 'Failed to create test data', 
      details: err.message,
      stack: err.stack 
    });
  }
});

// Get all data counts
router.get('/data-counts', async (req, res) => {
  try {
    const [users, jobs, applications, departments, roles] = await Promise.all([
      User.find().select('name email role createdAt'),
      Job.find().select('title companyName status createdAt').populate('createdBy', 'name email'),
      Application.find().select('name email status createdAt').populate('job', 'title').populate('candidate', 'name email'),
      Department.find().select('name'),
      Role.find().select('title')
    ]);

    res.json({
      counts: {
        users: users.length,
        jobs: jobs.length,
        applications: applications.length,
        departments: departments.length,
        roles: roles.length
      },
      sampleData: {
        users: users.slice(0, 5),
        jobs: jobs.slice(0, 5),
        applications: applications.slice(0, 5),
        departments,
        roles
      }
    });
  } catch (err) {
    console.error('❌ Error fetching data counts:', err);
    res.status(500).json({ error: 'Failed to fetch data counts', details: err.message });
  }
});

// Clear all test data
router.delete('/clear-test-data', async (req, res) => {
  try {
    const results = await Promise.all([
      User.deleteMany({ email: { $in: ['hr@test.com', 'candidate@test.com'] } }),
      Job.deleteMany({ title: 'Senior Software Engineer' }),
      Application.deleteMany({}),
      Department.deleteMany({ name: 'Engineering' }),
      Role.deleteMany({ title: 'Software Engineer' })
    ]);

    res.json({
      message: 'Test data cleared successfully!',
      deletedCounts: {
        users: results[0].deletedCount,
        jobs: results[1].deletedCount,
        applications: results[2].deletedCount,
        departments: results[3].deletedCount,
        roles: results[4].deletedCount
      }
    });
  } catch (err) {
    console.error('❌ Error clearing test data:', err);
    res.status(500).json({ error: 'Failed to clear test data', details: err.message });
  }
});

module.exports = router;