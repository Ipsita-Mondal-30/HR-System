// hr-backend/src/routes/applicationRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload'); // Use your cloudinary multer middleware
const applicationController = require('../controllers/applicationController');

router.post(
  '/',
  upload.single('resume'), // This should use Cloudinary storage
  applicationController.submitApplication
);

router.get('/', applicationController.getApplications);
router.get('/:id', applicationController.getApplicationById);
// Get applications for a specific job
router.get('/job/:jobId', applicationController.getApplicationsByJob);
// PUT route to update application status
router.put('/:id/status', applicationController.updateApplicationStatus);


module.exports = router;