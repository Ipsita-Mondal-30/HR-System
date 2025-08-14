const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./src/models/User');
const Job = require('./src/models/Job');
const Application = require('./src/models/Application');
const Department = require('./src/models/Department');
const Role = require('./src/models/Role');

async function testDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Connected to MongoDB');
    console.log('Database name:', mongoose.connection.db.databaseName);
    
    // Check existing data
    const counts = {
      users: await User.countDocuments(),
      jobs: await Job.countDocuments(),
      applications: await Application.countDocuments(),
      departments: await Department.countDocuments(),
      roles: await Role.countDocuments()
    };
    
    console.log('📊 Current data counts:', counts);
    
    // Create test data if none exists
    if (counts.users === 0) {
      console.log('🧪 Creating test data...');
      
      // Create test department
      const department = await Department.create({
        name: 'Engineering',
        description: 'Software development and engineering roles'
      });
      
      // Create test role
      const role = await Role.create({
        title: 'Software Engineer',
        description: 'Full-stack software development'
      });
      
      // Create test HR user
      const hrUser = await User.create({
        name: 'Test HR Manager',
        email: 'hr@test.com',
        role: 'hr',
        isActive: true,
        isVerified: true
      });
      
      // Create test candidate
      const candidate = await User.create({
        name: 'Test Candidate',
        email: 'candidate@test.com',
        role: 'candidate',
        phone: '+1234567890',
        location: 'San Francisco, CA',
        skills: ['JavaScript', 'React', 'Node.js'],
        experience: '3 years',
        bio: 'Experienced full-stack developer',
        isActive: true
      });
      
      // Create test job
      const job = await Job.create({
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
        status: 'active'
      });
      
      // Create test application
      const application = await Application.create({
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        job: job._id,
        candidate: candidate._id,
        status: 'pending',
        resumeText: `${candidate.name} - ${candidate.experience} experience in ${candidate.skills.join(', ')}`,
        coverLetter: 'I am very interested in this position and believe I would be a great fit.',
        matchScore: 85
      });
      
      console.log('✅ Test data created successfully!');
      console.log('Created:', {
        department: department._id,
        role: role._id,
        hrUser: hrUser._id,
        candidate: candidate._id,
        job: job._id,
        application: application._id
      });
    }
    
    // Final counts
    const finalCounts = {
      users: await User.countDocuments(),
      jobs: await Job.countDocuments(),
      applications: await Application.countDocuments(),
      departments: await Department.countDocuments(),
      roles: await Role.countDocuments()
    };
    
    console.log('📊 Final data counts:', finalCounts);
    
    // Sample data
    const sampleUsers = await User.find().limit(3).select('name email role isActive');
    const sampleJobs = await Job.find().limit(3).select('title companyName status').populate('createdBy', 'name');
    
    console.log('👥 Sample users:', sampleUsers);
    console.log('💼 Sample jobs:', sampleJobs);
    
    console.log('🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testDatabase();