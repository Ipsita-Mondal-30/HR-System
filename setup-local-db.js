const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Try local MongoDB first, then Atlas
const LOCAL_MONGODB_URI = 'mongodb://localhost:27017/hrsystem';
const ATLAS_MONGODB_URI = process.env.MONGODB_URI;

async function setupDatabase() {
  console.log('🔗 Setting up database connection...');
  
  let connectionUri = LOCAL_MONGODB_URI;
  let usingLocal = true;
  
  try {
    // First try local MongoDB
    console.log('🏠 Trying local MongoDB...');
    await mongoose.connect(LOCAL_MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log('✅ Connected to local MongoDB');
  } catch (localError) {
    console.log('❌ Local MongoDB not available:', localError.message);
    
    try {
      // Fallback to Atlas
      console.log('☁️ Trying MongoDB Atlas...');
      await mongoose.connect(ATLAS_MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
      });
      console.log('✅ Connected to MongoDB Atlas');
      connectionUri = ATLAS_MONGODB_URI;
      usingLocal = false;
    } catch (atlasError) {
      console.error('❌ Both local and Atlas connections failed');
      console.error('Local error:', localError.message);
      console.error('Atlas error:', atlasError.message);
      
      console.log('\n🔧 TROUBLESHOOTING STEPS:');
      console.log('1. For local MongoDB:');
      console.log('   - Install MongoDB locally: https://docs.mongodb.com/manual/installation/');
      console.log('   - Start MongoDB service: brew services start mongodb/brew/mongodb-community');
      console.log('');
      console.log('2. For MongoDB Atlas:');
      console.log('   - Check if your IP is whitelisted in Atlas Network Access');
      console.log('   - Verify the cluster is not paused');
      console.log('   - Check your internet connection');
      console.log('   - Try adding 0.0.0.0/0 to whitelist (for development only)');
      
      process.exit(1);
    }
  }
  
  console.log('Database name:', mongoose.connection.db.databaseName);
  console.log('Using:', usingLocal ? 'Local MongoDB' : 'MongoDB Atlas');
  
  // Create models
  const User = require('./src/models/User');
  const Job = require('./src/models/Job');
  const Application = require('./src/models/Application');
  const Department = require('./src/models/Department');
  const Role = require('./src/models/Role');
  
  // Check existing data
  const counts = {
    users: await User.countDocuments(),
    jobs: await Job.countDocuments(),
    applications: await Application.countDocuments(),
    departments: await Department.countDocuments(),
    roles: await Role.countDocuments()
  };
  
  console.log('📊 Current data counts:', counts);
  
  // Create sample data if database is empty
  if (counts.users === 0 && counts.jobs === 0) {
    console.log('🌱 Creating sample data...');
    
    try {
      // Create department
      const department = await Department.create({
        name: 'Engineering',
        description: 'Software development and engineering roles'
      });
      
      // Create role
      const role = await Role.create({
        title: 'Software Engineer',
        description: 'Full-stack software development'
      });
      
      // Create sample users
      const hrUser = await User.create({
        name: 'HR Manager',
        email: 'hr@company.com',
        role: 'hr',
        isActive: true,
        isVerified: true,
        company: 'Tech Company Inc.',
        position: 'HR Manager'
      });
      
      const candidate = await User.create({
        name: 'John Developer',
        email: 'john@example.com',
        role: 'candidate',
        phone: '+1234567890',
        location: 'San Francisco, CA',
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        experience: '3 years',
        bio: 'Experienced full-stack developer passionate about creating great user experiences.',
        isActive: true
      });
      
      const admin = await User.create({
        name: 'System Admin',
        email: 'admin@company.com',
        role: 'admin',
        isActive: true,
        isVerified: true
      });
      
      // Create sample jobs
      const jobs = await Job.create([
        {
          title: 'Senior React Developer',
          description: 'We are looking for a senior React developer to join our frontend team.',
          companyName: 'Tech Company Inc.',
          location: 'San Francisco, CA',
          employmentType: 'full-time',
          experienceRequired: 3,
          minSalary: 90000,
          maxSalary: 130000,
          skills: ['React', 'JavaScript', 'TypeScript', 'CSS'],
          department: department._id,
          role: role._id,
          createdBy: hrUser._id,
          status: 'active'
        },
        {
          title: 'Full Stack Developer',
          description: 'Join our team as a full-stack developer working with modern technologies.',
          companyName: 'Startup Inc.',
          location: 'Remote',
          remote: true,
          employmentType: 'full-time',
          experienceRequired: 2,
          minSalary: 70000,
          maxSalary: 100000,
          skills: ['Node.js', 'React', 'MongoDB', 'Express'],
          department: department._id,
          role: role._id,
          createdBy: hrUser._id,
          status: 'active'
        }
      ]);
      
      // Create sample applications
      const application = await Application.create({
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        job: jobs[0]._id,
        candidate: candidate._id,
        status: 'pending',
        resumeText: `${candidate.name} - ${candidate.experience} experience in ${candidate.skills.join(', ')}`,
        coverLetter: 'I am very interested in this position and believe my skills align well with your requirements.',
        matchScore: 85,
        matchInsights: {
          explanation: 'Strong match based on technical skills and experience level',
          matchingSkills: ['React', 'JavaScript'],
          missingSkills: ['TypeScript'],
          tags: ['experienced', 'frontend-focused']
        }
      });
      
      console.log('✅ Sample data created successfully!');
      console.log('Created:');
      console.log('- 1 Department:', department.name);
      console.log('- 1 Role:', role.title);
      console.log('- 3 Users: HR, Candidate, Admin');
      console.log('- 2 Jobs');
      console.log('- 1 Application');
      
    } catch (error) {
      console.error('❌ Error creating sample data:', error);
    }
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
  
  // Update .env file to use the working connection
  if (usingLocal) {
    console.log('\n💡 TIP: Update your .env file to use local MongoDB:');
    console.log('MONGODB_URI=mongodb://localhost:27017/hrsystem');
  }
  
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
  console.log('🎉 Database setup completed!');
}

setupDatabase().catch(console.error);