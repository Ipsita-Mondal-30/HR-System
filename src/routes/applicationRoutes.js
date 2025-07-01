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

module.exports = router;