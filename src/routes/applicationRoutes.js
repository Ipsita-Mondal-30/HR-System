const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const applicationController = require('../controllers/applicationController');

// Public route
router.post('/', upload.single('resume'), applicationController.submitApplication);

module.exports = router;
