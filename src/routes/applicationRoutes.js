// hr-backend/src/routes/applicationRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload'); // Use your cloudinary multer middleware
const applicationController = require('../controllers/applicationController');
const { isHRorAdmin } = require('../middleware/auth'); // Middleware to check HR or Admin permissions
const { isCandidate } = require('../middleware/auth');

router.post(
  '/',
  upload.single('resume'), // This should use Cloudinary storage
  applicationController.submitApplication
);

router.get('/', applicationController.getApplications);
router.get('/my', applicationController.getMyApplications);
router.get('/:id', applicationController.getApplicationById);

// Get applications for a specific job
router.get('/job/:jobId', applicationController.getApplicationsByJob);
// PUT route to update application status
router.put('/:id/status', applicationController.updateApplicationStatus);
router.put('/:id/status', isHRorAdmin, applicationController.updateStatus);

// PUT route to update HR notes
router.put('/:id/notes', isHRorAdmin, applicationController.updateNotes);



router.get('/my', isCandidate, applicationController.getMyApplications);


module.exports = router;