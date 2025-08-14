// Mock database setup for testing when MongoDB is not available
const fs = require('fs');
const path = require('path');

// Create a simple JSON-based mock database
const mockData = {
  users: [
    {
      _id: "mock_user_1",
      name: "HR Manager",
      email: "hr@company.com",
      role: "hr",
      isActive: true,
      isVerified: true,
      company: "Tech Company Inc.",
      position: "HR Manager",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    },
    {
      _id: "mock_user_2", 
      name: "John Developer",
      email: "john@example.com",
      role: "candidate",
      phone: "+1234567890",
      location: "San Francisco, CA",
      skills: ["JavaScript", "React", "Node.js", "MongoDB"],
      experience: "3 years",
      bio: "Experienced full-stack developer",
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      _id: "mock_user_3",
      name: "System Admin", 
      email: "admin@company.com",
      role: "admin",
      isActive: true,
      isVerified: true,
      createdAt: new Date().toISOString()
    }
  ],
  jobs: [
    {
      _id: "mock_job_1",
      title: "Senior React Developer",
      description: "We are looking for a senior React developer to join our frontend team.",
      companyName: "Tech Company Inc.",
      location: "San Francisco, CA", 
      employmentType: "full-time",
      experienceRequired: 3,
      minSalary: 90000,
      maxSalary: 130000,
      skills: ["React", "JavaScript", "TypeScript", "CSS"],
      status: "active",
      createdBy: "mock_user_1",
      createdAt: new Date().toISOString(),
      applicationsCount: 1
    },
    {
      _id: "mock_job_2",
      title: "Full Stack Developer", 
      description: "Join our team as a full-stack developer working with modern technologies.",
      companyName: "Startup Inc.",
      location: "Remote",
      remote: true,
      employmentType: "full-time", 
      experienceRequired: 2,
      minSalary: 70000,
      maxSalary: 100000,
      skills: ["Node.js", "React", "MongoDB", "Express"],
      status: "active",
      createdBy: "mock_user_1", 
      createdAt: new Date().toISOString(),
      applicationsCount: 0
    }
  ],
  applications: [
    {
      _id: "mock_app_1",
      name: "John Developer",
      email: "john@example.com", 
      phone: "+1234567890",
      job: "mock_job_1",
      candidate: "mock_user_2",
      status: "pending",
      resumeText: "John Developer - 3 years experience in JavaScript, React, Node.js, MongoDB",
      coverLetter: "I am very interested in this position and believe my skills align well with your requirements.",
      matchScore: 85,
      createdAt: new Date().toISOString()
    }
  ],
  departments: [
    {
      _id: "mock_dept_1",
      name: "Engineering",
      description: "Software development and engineering roles"
    }
  ],
  roles: [
    {
      _id: "mock_role_1", 
      title: "Software Engineer",
      description: "Full-stack software development"
    }
  ]
};

// Save mock data to file
const mockDbPath = path.join(__dirname, 'mock-database.json');
fs.writeFileSync(mockDbPath, JSON.stringify(mockData, null, 2));

console.log('✅ Mock database created at:', mockDbPath);
console.log('📊 Mock data counts:');
console.log('- Users:', mockData.users.length);
console.log('- Jobs:', mockData.jobs.length); 
console.log('- Applications:', mockData.applications.length);
console.log('- Departments:', mockData.departments.length);
console.log('- Roles:', mockData.roles.length);

console.log('\n💡 To use this mock data:');
console.log('1. The backend will automatically fall back to mock data if MongoDB is unavailable');
console.log('2. You can test the admin interface with this data');
console.log('3. Fix your MongoDB connection when ready for production');

module.exports = mockData;