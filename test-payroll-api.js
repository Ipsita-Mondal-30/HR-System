const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testPayrollAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-system');
    
    const User = require('./src/models/User');
    const Employee = require('./src/models/Employee');
    const Payroll = require('./src/models/Payroll');
    
    // Get admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log('✅ Admin user found:', admin.email);
    
    // Generate JWT token for admin
    const token = jwt.sign(
      { 
        _id: admin._id, 
        name: admin.name, 
        email: admin.email, 
        role: admin.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ JWT token generated for admin');
    
    // Test payroll data
    const payrolls = await Payroll.find()
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .sort({ year: -1, month: -1 });
    
    console.log('📊 Payroll records found:', payrolls.length);
    payrolls.forEach((p, i) => {
      console.log(`${i+1}. ${p.employee?.user?.name} - ${p.month}/${p.year} - $${p.netSalary} (${p.status})`);
    });
    
    // Test payroll stats
    const stats = await Payroll.getStats();
    console.log('📊 Payroll stats:', stats);
    
    console.log('\\n🔑 Use this token to test API calls:');
    console.log('Authorization: Bearer', token);
    
    console.log('\\n🧪 Test with curl:');
    console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:8080/api/admin/payroll`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPayrollAPI();