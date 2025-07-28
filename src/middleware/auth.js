// middleware/auth.js
const jwt = require('jsonwebtoken');

exports.verifyJWT = (req, res, next) => {
  // Check for token in cookies first, then Authorization header
  let token = req.cookies.auth_token;
  
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
    next();
  } catch (err) {
    console.log('❌ Token verification failed:', err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Role checks (after verifyJWT)
exports.isHR = (req, res, next) => {
  console.log('🔍 Checking HR role. User role:', req.user?.role);
  if (req.user?.role === 'hr') return next();
  res.status(403).json({ message: "HRs only" });
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
