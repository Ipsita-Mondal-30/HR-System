const mongoose = require('mongoose');
const Department = require('./src/models/Department');
require('dotenv').config();

async function seedDepartments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-system');
    console.log('Connected to MongoDB');
    
    const departments = [
      { name: 'Engineering', description: 'Software development and technical operations' },
      { name: 'Design', description: 'UI/UX design and creative services' },
      { name: 'Marketing', description: 'Marketing and brand management' },
      { name: 'Sales', description: 'Sales and business development' },
      { name: 'HR', description: 'Human resources and people operations' },
      { name: 'Finance', description: 'Financial planning and accounting' },
      { name: 'Operations', description: 'Business operations and administration' }
    ];
    
    for (const dept of departments) {
      const existingDept = await Department.findOne({ name: dept.name });
      if (!existingDept) {
        await Department.create(dept);
        console.log(`✅ Created department: ${dept.name}`);
      } else {
        console.log(`⏭️ Department already exists: ${dept.name}`);
      }
    }
    
    console.log('✅ Departments seeded successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error seeding departments:', error);
    process.exit(1);
  }
}

seedDepartments();