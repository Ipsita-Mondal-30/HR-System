const { seedEmployeeData } = require('./src/utils/seedEmployeeData');
const mongoose = require('mongoose');
require('dotenv').config();

async function runSeed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-system');
    console.log('Connected to MongoDB');
    
    const result = await seedEmployeeData();
    console.log('Seed completed:', result);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

runSeed();