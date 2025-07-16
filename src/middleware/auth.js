// middleware/auth.js
const jwt = require('jsonwebtoken');

exports.verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Role checks (after verifyJWT)
exports.isHR = (req, res, next) => {
  if (req.user?.role === 'hr') return next();
  res.status(403).json({ message: "HRs only" });
};

exports.isAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ message: "Admins only" });
};

exports.isCandidate = (req, res, next) => {
  if (req.user?.role === 'candidate') return next();
  res.status(403).json({ message: "Candidates only" });
};

exports.isHRorAdmin = (req, res, next) => {
  if (['hr', 'admin'].includes(req.user?.role)) return next();
  res.status(403).json({ message: "HR/Admin only" });
};
