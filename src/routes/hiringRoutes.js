const express = require('express');
const multer = require('multer');
const router = express.Router();
const { verifyJWT, isAdmin, isHRorAdmin, isCandidate } = require('../middleware/auth');
const hiringController = require('../controllers/hiringController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF resumes are allowed'));
  },
});

const readAccess = (req, res, next) => {
  if (['admin', 'hr', 'candidate'].includes(req.user?.role)) return next();
  return res.status(403).json({ message: 'Access denied' });
};

router.post('/sync', verifyJWT, isAdmin, hiringController.syncMarketJobs);
router.get('/dashboard', verifyJWT, readAccess, hiringController.getDashboard);
router.get('/insights', verifyJWT, readAccess, hiringController.getInsights);
router.get('/status', verifyJWT, readAccess, hiringController.getJobCount);
router.post(
  '/match',
  verifyJWT,
  readAccess,
  upload.single('resume'),
  hiringController.matchResume
);

module.exports = router;
