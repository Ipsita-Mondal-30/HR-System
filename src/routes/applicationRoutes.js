const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const applicationController = require('../controllers/applicationController');

router.post('/', upload.single('resume'), applicationController.submitApplication);
router.get('/', applicationController.getApplications); // 🟢 this must be a valid function

module.exports = router;
