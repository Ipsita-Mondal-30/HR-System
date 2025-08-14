const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');
const Department = require('./src/models/Department');
const Role = require('./src/models/Role');
const Job = require('./src/models/Job');
const Application = require('./src/models/Application');

async function createInitialData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if data already exists
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log(`📊 Database already has ${userCount} users. Skipping initial data creation.`);
      await mongoose.connection.close();
      return;
    }

    console.log('🌱 Creating initial data...');

    // Create departments
    const departments = await Department.create([
      {
        name: 'Engineering',
        description: 'Software development and technical roles'
      },
      {
        name: 'Marketing',
        description: 'Marketing and brand management'
      },
      {
        name: 'Sales',
        description: 'Sales and business development'
      },
      {
        name: 'Human Resources',
        description: 'HR and people operations'
      }
    ]);

    console.log(`✅ Created ${departments.length} departments`);

    // Create roles
    const roles = await Role.create([
      {
        title: 'Software Engineer',
        description: 'Full-stack software development',
        departmentId: departments[0]._id
      },
      {
        title: 'Senior Software Engineer',
        description: 'Senior level software development',
        departmentId: departments[0]._id
      },
      {
        title: 'Marketing Manager',
        description: 'Marketing strategy and execution',
        departmentId: departments[1]._id
      },
      {
        title: 'Sales Representative',
        description: 'Sales and customer acquisition',
        departmentId: departments[2]._id
      },
      {
        title: 'HR Manager',
        description: 'Human resources management',
        departmentId: departments[3]._id
      }
    ]);

    console.log(`✅ Created ${roles.length} roles`);

    // Create admin user
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@company.com',
      role: 'admin',
      isActive: true,
      isVerified: true
    });

    console.log('✅ Created admin user');

    // Create HR users (some verified, some pending)
    const hrUsers = await User.create([
      {
        name: 'HR Manager',
        email: 'hr@company.com',
        role: 'hr',
        isActive: true,
        isVerified: true,
        company: 'Tech Company Inc.',
        position: 'HR Manager',
        industry: 'Technology'
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.hr@startup.com',
        role: 'hr',
        isActive: true,
        isVerified: false, // Pending verification
        company: 'Startup Inc.',
        position: 'People Operations',
        industry: 'Technology'
      },
      {
        name: 'Mike Wilson',
        email: 'mike@consulting.com',
        role: 'hr',
        isActive: true,
        isVerified: false, // Pending verification
        company: 'Consulting Group',
        position: 'Talent Acquisition',
        industry: 'Consulting'
      }
    ]);

    console.log(`✅ Created ${hrUsers.length} HR users`);

    // Create candidate users
    const candidates = await User.create([
      {
        name: 'John Developer',
        email: 'john@example.com',
        role: 'candidate',
        phone: '+1234567890',
        location: 'San Francisco, CA',
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        experience: '3 years',
        bio: 'Experienced full-stack developer passionate about creating great user experiences.',
        expectedSalary: '$90,000 - $120,000',
        isActive: true
      },
      {
        name: 'Alice Smith',
        email: 'alice@example.com',
        role: 'candidate',
        phone: '+1987654321',
        location: 'New York, NY',
        skills: ['Python', 'Django', 'PostgreSQL', 'AWS'],
        experience: '5 years',
        bio: 'Senior backend developer with expertise in scalable systems.',
        expectedSalary: '$110,000 - $140,000',
        isActive: true
      },
      {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        role: 'candidate',
        phone: '+1555123456',
        location: 'Austin, TX',
        skills: ['React', 'TypeScript', 'GraphQL', 'Docker'],
        experience: '2 years',
        bio: 'Frontend developer with a passion for modern web technologies.',
        expectedSalary: '$70,000 - $90,000',
        isActive: true
      }
    ]);

    console.log(`✅ Created ${candidates.length} candidates`);

    // Create jobs
    const jobs = await Job.create([
      {
        title: 'Senior React Developer',
        description: 'We are looking for a senior React developer to join our frontend team. You will be responsible for building user interfaces and ensuring great user experience.',
        companyName: 'Tech Company Inc.',
        location: 'San Francisco, CA',
        employmentType: 'full-time',
        experienceRequired: 3,
        minSalary: 90000,
        maxSalary: 130000,
        skills: ['React', 'JavaScript', 'TypeScript', 'CSS', 'HTML'],
        department: departments[0]._id,
        role: roles[1]._id, // Senior Software Engineer
        createdBy: hrUsers[0]._id,
        status: 'active'
      },
      {
        title: 'Full Stack Developer',
        description: 'Join our team as a full-stack developer working with modern technologies. You will work on both frontend and backend systems.',
        companyName: 'Startup Inc.',
        location: 'Remote',
        remote: true,
        employmentType: 'full-time',
        experienceRequired: 2,
        minSalary: 70000,
        maxSalary: 100000,
        skills: ['Node.js', 'React', 'MongoDB', 'Express', 'JavaScript'],
        department: departments[0]._id,
        role: roles[0]._id, // Software Engineer
        createdBy: hrUsers[1]._id,
        status: 'pending' // Pending approval
      },
      {
        title: 'Marketing Manager',
        description: 'Lead our marketing efforts and develop strategies to grow our brand presence.',
        companyName: 'Tech Company Inc.',
        location: 'San Francisco, CA',
        employmentType: 'full-time',
        experienceRequired: 4,
        minSalary: 80000,
        maxSalary: 110000,
        skills: ['Digital Marketing', 'SEO', 'Content Strategy', 'Analytics'],
        department: departments[1]._id,
        role: roles[2]._id,
        createdBy: hrUsers[0]._id,
        status: 'active'
      }
    ]);

    console.log(`✅ Created ${jobs.length} jobs`);

    // Create applications
    const applications = await Application.create([
      {
        name: candidates[0].name,
        email: candidates[0].email,
        phone: candidates[0].phone,
        job: jobs[0]._id,
        candidate: candidates[0]._id,
        status: 'pending',
        resumeText: `${candidates[0].name} - ${candidates[0].experience} experience in ${candidates[0].skills.join(', ')}`,
        coverLetter: 'I am very interested in this position and believe my skills align well with your requirements.',
        matchScore: 85,
        matchInsights: {
          explanation: 'Strong match based on React and JavaScript skills',
          matchingSkills: ['React', 'JavaScript'],
          missingSkills: ['TypeScript'],
          tags: ['experienced', 'frontend-focused']
        }
      },
      {
        name: candidates[1].name,
        email: candidates[1].email,
        phone: candidates[1].phone,
        job: jobs[1]._id,
        candidate: candidates[1]._id,
        status: 'reviewed',
        resumeText: `${candidates[1].name} - ${candidates[1].experience} experience in ${candidates[1].skills.join(', ')}`,
        coverLetter: 'I would love to contribute to your team with my backend expertise.',
        matchScore: 78,
        matchInsights: {
          explanation: 'Good match with strong backend skills',
          matchingSkills: ['Node.js', 'MongoDB'],
          missingSkills: ['React'],
          tags: ['experienced', 'backend-focused']
        }
      },
      {
        name: candidates[2].name,
        email: candidates[2].email,
        phone: candidates[2].phone,
        job: jobs[0]._id,
        candidate: candidates[2]._id,
        status: 'shortlisted',
        resumeText: `${candidates[2].name} - ${candidates[2].experience} experience in ${candidates[2].skills.join(', ')}`,
        coverLetter: 'Excited about the opportunity to work with modern frontend technologies.',
        matchScore: 92,
        matchInsights: {
          explanation: 'Excellent match with modern frontend skills',
          matchingSkills: ['React', 'TypeScript'],
          missingSkills: [],
          tags: ['modern-stack', 'frontend-expert']
        }
      }
    ]);

    console.log(`✅ Created ${applications.length} applications`);

    // Final summary
    const finalCounts = {
      users: await User.countDocuments(),
      departments: await Department.countDocuments(),
      roles: await Role.countDocuments(),
      jobs: await Job.countDocuments(),
      applications: await Application.countDocuments()
    };

    console.log('\n📊 Final data summary:');
    console.log(`- Users: ${finalCounts.users} (1 admin, ${hrUsers.length} HR, ${candidates.length} candidates)`);
    console.log(`- Departments: ${finalCounts.departments}`);
    console.log(`- Roles: ${finalCounts.roles}`);
    console.log(`- Jobs: ${finalCounts.jobs} (2 active, 1 pending approval)`);
    console.log(`- Applications: ${finalCounts.applications}`);

    console.log('\n🎉 Initial data created successfully!');
    console.log('\n👤 Test accounts:');
    console.log('Admin: admin@company.com');
    console.log('HR (verified): hr@company.com');
    console.log('HR (pending): sarah.hr@startup.com, mike@consulting.com');
    console.log('Candidates: john@example.com, alice@example.com, bob@example.com');

  } catch (error) {
    console.error('❌ Error creating initial data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createInitialData();