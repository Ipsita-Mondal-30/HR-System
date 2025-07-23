const express = require('express');
const {
  createJob,
  getJobs,
  getJobById,
  updateJob,
} = require('../controllers/jobController');
const { verifyJWT, isHR } = require('../middleware/auth');

const router = express.Router();

// Protected routes
router.post('/', verifyJWT, isHR, createJob);
router.put('/:id', verifyJWT, isHR, updateJob);

// Public routes
router.get('/', getJobs);
router.get('/:id', getJobById);

console.log('📦 jobRoutes loaded');
module.exports = router;
