exports.isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    return res.status(401).send('Not logged in');
  };
  
  exports.isHR = (req, res, next) => {
    console.log("Authenticated?", req.isAuthenticated());
    console.log("User:", req.user);
  
    if (req.isAuthenticated() && req.user.role === 'hr') return next();
    return res.status(403).send('Access denied – HRs only');
  };
  exports.isHRorAdmin = (req, res, next) => {
    if (req.user && ['hr', 'admin'].includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Access denied' });
  };
  
  exports.isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'admin') return next();
    return res.status(403).send('Access denied – Admins only');
  };
exports.isCandidate = (req, res, next) => {
    if (req.user && req.user.role === 'candidate') {
      next();
    } else {
      return res.status(403).json({ message: 'Access denied: Candidates only' });
    }
  };
  
    