const mongoose = require('mongoose');
require('dotenv').config();

async function fixConnection() {
  console.log('🔧 Attempting to fix MongoDB connection...');
  
  // Try different connection options
  const connectionOptions = [
    {
      name: 'Standard Connection',
      uri: process.env.MONGODB_URI,
      options: {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4
        maxPoolSize: 10,
        minPoolSize: 5,
      }
    },
    {
      name: 'Alternative Connection',
      uri: process.env.MONGODB_URI.replace('retryWrites=true&w=majority', 'retryWrites=true&w=majority&ssl=true'),
      options: {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 60000,
        bufferCommands: false,
        maxPoolSize: 5,
      }
    },
    {
      name: 'Simple Connection',
      uri: process.env.MONGODB_URI.split('?')[0], // Remove all query parameters
      options: {
        serverSelectionTimeoutMS: 20000,
      }
    }
  ];

  for (const config of connectionOptions) {
    try {
      console.log(`\n🔄 Trying ${config.name}...`);
      console.log(`URI: ${config.uri.substring(0, 50)}...`);
      
      await mongoose.connect(config.uri, config.options);
      
      console.log('✅ Connection successful!');
      console.log('Database:', mongoose.connection.db.databaseName);
      
      // Test with a simple query
      const User = require('./src/models/User');
      const userCount = await User.countDocuments();
      console.log(`📊 Users in database: ${userCount}`);
      
      console.log('\n🎉 MongoDB connection is working!');
      console.log('💡 Use this configuration in your main server');
      
      await mongoose.connection.close();
      return config;
      
    } catch (error) {
      console.log(`❌ ${config.name} failed:`, error.message);
      
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    }
  }
  
  console.log('\n❌ All connection attempts failed');
  console.log('\n🔧 Troubleshooting steps:');
  console.log('1. Check if your IP is whitelisted in MongoDB Atlas');
  console.log('2. Verify the cluster is not paused');
  console.log('3. Check your internet connection');
  console.log('4. Try using 0.0.0.0/0 in Atlas Network Access (for development)');
  
  return null;
}

fixConnection().catch(console.error);