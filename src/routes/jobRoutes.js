const express = require('express');
const {
  createJob,
  getJobs,
  getJobById // 👈 Add this import
} = require('../controllers/jobController');
const { isHR } = require('../middleware/auth');

const router = express.Router();

router.post('/', isHR, createJob);
router.get('/', getJobs);
router.get('/:id', getJobById); // 👈 Add this route

console.log('📦 jobRoutes loaded');

module.exports = router;
