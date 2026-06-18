const express = require('express');
const router = express.Router();
const { verifyJWT, isHRorAdmin, isCandidate } = require('../middleware/auth');
const resumeAnalysisController = require('../controllers/resumeAnalysisController');

const hrOrCandidate = (req, res, next) => {
  if (['hr', 'admin', 'candidate'].includes(req.user?.role)) return next();
  return res.status(403).json({ message: 'Access denied' });
};

router.post(
  '/analyze',
  verifyJWT,
  hrOrCandidate,
  ...resumeAnalysisController.analyzeResume
);

router.post(
  '/application/:applicationId/analyze',
  verifyJWT,
  hrOrCandidate,
  resumeAnalysisController.analyzeApplication
);

router.get(
  '/application/:applicationId',
  verifyJWT,
  hrOrCandidate,
  resumeAnalysisController.getApplicationAnalysis
);

router.get(
  '/history/:applicationId',
  verifyJWT,
  hrOrCandidate,
  resumeAnalysisController.getHistory
);

router.post(
  '/application/:applicationId/rewrite',
  verifyJWT,
  hrOrCandidate,
  resumeAnalysisController.rewriteResume
);

router.post(
  '/application/:applicationId/cover-letter',
  verifyJWT,
  hrOrCandidate,
  resumeAnalysisController.generateCoverLetter
);

module.exports = router;
