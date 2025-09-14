const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Fix HR user verification status
router.post('/fix-hr-verification', async (req, res) => {
  try {
    console.log('🔧 Fixing HR user verification status...');
    
    // Find HR user
    const hrUser = await User.findOne({ email: 'ipsitaamondal@gmail.com' });
    if (!hrUser) {
      return res.status(404).json({ error: 'HR user not found' });
    }

    console.log('👤 Found HR user:', {
      email: hrUser.email,
      role: hrUser.role,
      isVerified: hrUser.isVerified
    });

    // Update verification status
    hrUser.isVerified = true;
    await hrUser.save();

    console.log('✅ HR user verification updated successfully');
    
    res.json({
      success: true,
      message: 'HR user verification updated successfully',
      user: {
        email: hrUser.email,
        role: hrUser.role,
        isVerified: hrUser.isVerified
      }
    });

  } catch (error) {
    console.error('❌ Error fixing HR verification:', error);
    res.status(500).json({ error: 'Failed to fix HR verification' });
  }
});

module.exports = router;