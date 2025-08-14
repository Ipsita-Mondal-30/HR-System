const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function testConnection() {
  console.log('🔗 Testing MongoDB connection...');
  console.log('URI:', process.env.MONGODB_URI);
  
  try {
    // Try with different connection options
    const options = {
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
    };

    console.log('Attempting connection with options:', options);
    
    await mongoose.connect(process.env.MONGODB_URI, options);
    
    console.log('✅ Successfully connected to MongoDB!');
    console.log('Database name:', mongoose.connection.db.databaseName);
    console.log('Connection state:', mongoose.connection.readyState);
    
    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Available collections:', collections.map(c => c.name));
    
    // Try to create a test document
    const TestModel = mongoose.model('ConnectionTest', new mongoose.Schema({
      message: String,
      timestamp: { type: Date, default: Date.now }
    }));
    
    const testDoc = await TestModel.create({
      message: 'Connection test successful'
    });
    
    console.log('✅ Test document created:', testDoc._id);
    
    // Clean up test document
    await TestModel.deleteOne({ _id: testDoc._id });
    console.log('🧹 Test document cleaned up');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.name === 'MongooseServerSelectionError') {
      console.error('🔍 Server selection error details:');
      console.error('- This usually means the MongoDB server is unreachable');
      console.error('- Check if your IP is whitelisted in MongoDB Atlas');
      console.error('- Verify the connection string is correct');
      console.error('- Check if the cluster is paused or deleted');
    }
    
    if (error.code === 'ENOTFOUND') {
      console.error('🔍 DNS resolution failed - check your internet connection');
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔍 Connection refused - check if MongoDB is running');
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🔌 Connection closed');
    }
  }
}

testConnection();