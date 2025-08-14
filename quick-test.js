const mongoose = require('mongoose');
require('dotenv').config();

async function quickTest() {
  try {
    console.log('🔗 Testing MongoDB connection...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✅ Connected successfully!');
    console.log('Database:', mongoose.connection.db.databaseName);
    
    // Test creating a simple document
    const TestSchema = new mongoose.Schema({
      message: String,
      timestamp: { type: Date, default: Date.now }
    });
    
    const TestModel = mongoose.model('Test', TestSchema);
    
    const doc = await TestModel.create({
      message: 'Connection test successful'
    });
    
    console.log('✅ Document created:', doc._id);
    
    // Clean up
    await TestModel.deleteOne({ _id: doc._id });
    console.log('🧹 Test document cleaned up');
    
    await mongoose.connection.close();
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

quickTest();