const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Department = require('../models/Department');
const Role = require('../models/Role');

const seedData = async () => {
  try {
    console.log('🌱 Checking if database needs seeding...');
    
    // Check if we already have data
    const [jobCount, appCount, userCount] = await Promise.all([
      Job.countDocuments(),
      Application.countDocuments(),
      User.countDocuments({ role: { $in: ['hr', 'candidate'] } })
    ]);
    
    if (jobCount > 0 && appCount > 0) {
      console.log('✅ Database already has data, skipping seed');
      return;
    }
    
    console.log('🌱 Seeding database with sample data...');
    
    // Create sample department and role if they don't exist
    let department = await Department.findOne({ name: 'Engineering' });
    if (!department) {
      department = await Department.create({
        name: 'Engineering',
        description: 'Software development and engineering roles'
      });
    }
    
    let role = await Role.findOne({ title: 'Software Developer' });
    if (!role) {
      role = await Role.create({
        title: 'Software Developer',
        description: 'Develops software applications',
        department: department._id
      });
    }
    
    // Find or create an HR user
    let hrUser = await User.findOne({ role: 'hr' });
    if (!hrUser) {
      hrUser = await User.create({
        name: 'HR Manager',
        email: 'hr@company.com',
        role: 'hr'
      });
    }
    
    // Create sample jobs
    const sampleJobs = [
      {
        title: 'Senior React Developer',
        description: 'We are looking for a senior React developer to join our team.',
        companyName: 'Tech Corp',
        location: 'San Francisco, CA',
        remote: true,
        employmentType: 'full-time',
        experienceRequired: 5,
        minSalary: 120000,
        maxSalary: 180000,
        skills: ['React', 'JavaScript', 'TypeScript', 'Node.js'],
        tags: ['frontend', 'react', 'senior'],
        department: department._id,
        role: role._id,
        createdBy: hrUser._id,
        status: 'open'
      },
      {
        title: 'Full Stack Developer',
        description: 'Full stack developer position with modern tech stack.',
        companyName: 'Startup Inc',
        location: 'New York, NY',
        remote: false,
        employmentType: 'full-time',
        experienceRequired: 3,
        minSalary: 90000,
        maxSalary: 130000,
        skills: ['React', 'Node.js', 'MongoDB', 'Express'],
        tags: ['fullstack', 'javascript', 'mid-level'],
        department: department._id,
        role: role._id,
        createdBy: hrUser._id,
        status: 'open'
      },
      {
        title: 'Junior Frontend Developer',
        description: 'Entry level frontend developer position.',
        companyName: 'Web Agency',
        location: 'Remote',
        remote: true,
        employmentType: 'full-time',
        experienceRequired: 1,
        minSalary: 60000,
        maxSalary: 80000,
        skills: ['HTML', 'CSS', 'JavaScript', 'React'],
        tags: ['frontend', 'junior', 'entry-level'],
        department: department._id,
        role: role._id,
        createdBy: hrUser._id,
        status: 'open'
      }
    ];
    
    const createdJobs = await Job.insertMany(sampleJobs);
    console.log(`✅ Created ${createdJobs.length} sample jobs`);
    
    // Create sample candidate users
    const sampleCandidates = [
      {
        name: 'John Doe',
        email: 'john.doe@email.com',
        role: 'candidate',
        phone: '+1-555-0101',
        location: 'San Francisco, CA',
        expectedSalary: '$120,000 - $150,000',
        experience: '3-5',
        skills: ['React', 'JavaScript', 'Node.js', 'TypeScript', 'MongoDB'],
        bio: 'Passionate full-stack developer with 4 years of experience building scalable web applications. Love working with modern JavaScript frameworks and cloud technologies.',
        resumeUrl: 'https://example.com/resume-john-doe.pdf',
        portfolio: 'https://johndoe.dev',
        linkedIn: 'https://linkedin.com/in/johndoe',
        github: 'https://github.com/johndoe',
        savedJobs: []
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@email.com',
        role: 'candidate',
        phone: '+1-555-0102',
        location: 'New York, NY',
        expectedSalary: '$100,000 - $130,000',
        experience: '5-8',
        skills: ['Python', 'Django', 'PostgreSQL', 'AWS', 'Docker'],
        bio: 'Senior backend developer with expertise in Python and cloud architecture. Experienced in building high-performance APIs and microservices.',
        resumeUrl: 'https://example.com/resume-jane-smith.pdf',
        portfolio: 'https://janesmith.dev',
        linkedIn: 'https://linkedin.com/in/janesmith',
        github: 'https://github.com/janesmith',
        savedJobs: []
      },
      {
        name: 'Mike Johnson',
        email: 'mike.johnson@email.com',
        role: 'candidate',
        phone: '+1-555-0103',
        location: 'Austin, TX',
        expectedSalary: '$70,000 - $90,000',
        experience: '0-1',
        skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Git'],
        bio: 'Recent computer science graduate eager to start my career in web development. Strong foundation in frontend technologies and quick learner.',
        resumeUrl: 'https://example.com/resume-mike-johnson.pdf',
        portfolio: 'https://mikejohnson.dev',
        linkedIn: 'https://linkedin.com/in/mikejohnson',
        github: 'https://github.com/mikejohnson',
        savedJobs: []
      }
    ];
    
    const createdCandidates = await User.insertMany(sampleCandidates);
    console.log(`✅ Created ${createdCandidates.length} sample candidates`);
    
    // Create sample applications
    const sampleApplications = [
      {
        name: 'John Doe',
        email: 'john.doe@email.com',
        phone: '+1234567890',
        job: createdJobs[0]._id,
        candidate: createdCandidates[0]._id,
        matchScore: 85,
        status: 'pending',
        resumeText: 'Experienced React developer with 5 years of experience...'
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@email.com',
        phone: '+1234567891',
        job: createdJobs[1]._id,
        candidate: createdCandidates[1]._id,
        matchScore: 92,
        status: 'reviewed',
        resumeText: 'Full stack developer with expertise in MERN stack...'
      },
      {
        name: 'Mike Johnson',
        email: 'mike.johnson@email.com',
        phone: '+1234567892',
        job: createdJobs[2]._id,
        candidate: createdCandidates[2]._id,
        matchScore: 78,
        status: 'shortlisted',
        resumeText: 'Junior developer eager to learn and grow...'
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah.wilson@email.com',
        phone: '+1234567893',
        job: createdJobs[0]._id,
        matchScore: 88,
        status: 'pending',
        resumeText: 'Senior React developer with TypeScript experience...'
      }
    ];
    
    const createdApplications = await Application.insertMany(sampleApplications);
    console.log(`✅ Created ${createdApplications.length} sample applications`);
    
    console.log('🌱 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
};

module.exports = seedData;