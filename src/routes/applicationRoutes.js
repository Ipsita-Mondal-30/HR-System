// hr-backend/src/routes/applicationRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const applicationController = require('../controllers/applicationController');
const { verifyJWT, isHRorAdmin, isCandidate } = require('../middleware/auth');

router.post(
  '/',
  upload.single('resume'),
  applicationController.submitApplication
);

router.get('/', applicationController.getApplications);
router.get('/my', verifyJWT, isCandidate, applicationController.getMyApplications);
router.get('/job/:jobId', applicationController.getApplicationsByJob);
router.get('/:id', applicationController.getApplicationById);

router.put('/:id/status', verifyJWT, isHRorAdmin, applicationController.updateApplicationStatus);
router.put('/:id/notes', verifyJWT, isHRorAdmin, applicationController.updateNotes);

module.exports = router;
