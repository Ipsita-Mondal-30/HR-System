// middleware/auth.js
const jwt = require('jsonwebtoken');

exports.verifyJWT = (req, res, next) => {
  try {
    // Check for token in cookies first, then Authorization header
    let token = req.cookies.auth_token || req.cookies.token;
    
    console.log('🔐 Auth middleware - Cookies:', req.cookies);
    console.log('🔐 Auth middleware - Headers:', req.headers.authorization);
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        console.log('❌ No token found in cookies or Authorization header');
        return res.status(401).json({ message: "No token provided" });
      }
      token = authHeader.split(" ")[1];
      console.log('🔐 Using token from Authorization header');
    } else {
      console.log('🔐 Using token from cookies');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified successfully:', decoded);
      req.user = decoded; // attach user
      console.log('🔧 req.user set to:', req.user);
      console.log('🔧 req.user._id after setting:', req.user._id);
      console.log('🔧 About to call next() with req.user:', !!req.user);
      next();
    } catch (err) {
      console.log('❌ Token verification failed:', err.message);
      return res.status(401).json({ message: "Invalid token" });
    }
  } catch (outerErr) {
    console.log('❌ Middleware error:', outerErr.message);
    return res.status(500).json({ message: "Middleware error" });
  }
};

// Role checks (after verifyJWT)
exports.isHR = (req, res, next) => {
  console.log('🔍 Checking HR role. User role:', req.user?.role);
  console.log('🔍 User details:', { 
    id: req.user?._id, 
    email: req.user?.email, 
    role: req.user?.role 
  });
  
  if (req.user?.role === 'hr' || req.user?.role === 'admin') {
    console.log('✅ HR/Admin access granted');
    return next();
  }
  
  console.log('❌ HR access denied');
  res.status(403).json({ message: "HR or Admin access required" });
};

exports.isAdmin = (req, res, next) => {
  console.log('🔍 Checking Admin role. User role:', req.user?.role);
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ message: "Admins only" });
};

exports.isCandidate = (req, res, next) => {
  console.log('🔍 Checking Candidate role. User role:', req.user?.role);
  if (req.user?.role === 'candidate') return next();
  res.status(403).json({ message: "Candidates only" });
};

exports.isHRorAdmin = (req, res, next) => {
  console.log('🔍 Checking HR/Admin role. User role:', req.user?.role);
  if (['hr', 'admin'].includes(req.user?.role)) return next();
  res.status(403).json({ message: "HR/Admin only" });
};

/** HR users must be admin-verified before posting or editing jobs. Admins bypass. */
exports.requireVerifiedHR = async (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ message: 'HR access required' });
  }

  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('isVerified');
    if (!user?.isVerified) {
      return res.status(403).json({
        error: 'Your HR account must be verified by an admin before you can post jobs.',
        code: 'HR_NOT_VERIFIED',
      });
    }
    next();
  } catch (err) {
    console.error('requireVerifiedHR error:', err);
    res.status(500).json({ error: 'Verification check failed' });
  }
};

// Generic auth token verification (alias for verifyJWT)
exports.authenticateToken = exports.verifyJWT;

// Role requirement middleware
exports.requireRole = (roles) => {
  return (req, res, next) => {
    console.log('🔍 Checking role requirement. Required:', roles, 'User role:', req.user?.role);
    
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (roles.includes(req.user.role)) {
      console.log('✅ Role requirement satisfied');
      return next();
    }
    
    console.log('❌ Role requirement not met');
    res.status(403).json({ message: `Access denied. Required roles: ${roles.join(', ')}` });
  };
};
