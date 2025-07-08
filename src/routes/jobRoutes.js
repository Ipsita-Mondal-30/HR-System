const express = require('express');
const {
  createJob,
  getJobs,
  getJobById,
  updateJob // ✅ import this
} = require('../controllers/jobController');
const { isHR } = require('../middleware/auth');

const router = express.Router();


router.post('/', isHR, createJob);
router.get('/', getJobs);
router.get('/:id', getJobById);
router.put('/:id', isHR, updateJob); // ✅ add this route

console.log('📦 jobRoutes loaded');

module.exports = router;
