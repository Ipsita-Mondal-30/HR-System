const jwt = require('jsonwebtoken');

exports.verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

exports.isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    return res.status(401).send('Not logged in');
  };
  
  // Role check middleware — use with verifyJWT
exports.isHR = (req, res, next) => {
  if (req.user && req.user.role === 'hr') return next();
  return res.status(403).json({ message: 'Access denied – HRs only' });
};

exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Access denied – Admins only' });
};

exports.isHRorAdmin = (req, res, next) => {
  if (req.user && ['hr', 'admin'].includes(req.user.role)) return next();
  return res.status(403).json({ message: 'Access denied – HR/Admin only' });
};

exports.isCandidate = (req, res, next) => {
  if (req.user && req.user.role === 'candidate') return next();
  return res.status(403).json({ message: 'Access denied – Candidates only' });
};
