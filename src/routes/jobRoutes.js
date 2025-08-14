const express = require('express');
const {
  createJob,
  getJobs,
  getJobById,
  updateJob,
} = require('../controllers/jobController');
const { verifyJWT, isHR } = require('../middleware/auth');
const Job = require('../models/Job');

const router = express.Router();

// Protected routes
router.post('/', verifyJWT, isHR, createJob);
router.put('/:id', verifyJWT, isHR, updateJob);
router.delete('/:id', verifyJWT, isHR, async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ message: 'Job deleted successfully' });
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// HR management route - shows all jobs for HR users
router.get('/manage', verifyJWT, isHR, async (req, res) => {
  try {
    console.log('🔍 HR user fetching jobs:', req.user.email);
    
    const jobs = await Job.find()
      .populate('department', 'name')
      .populate('role', 'title')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    console.log(`📊 Found ${jobs.length} jobs for HR management`);
    
    // Log sample job for debugging
    if (jobs.length > 0) {
      console.log('Sample job:', {
        title: jobs[0].title,
        status: jobs[0].status,
        department: jobs[0].department?.name,
        role: jobs[0].role?.title,
        createdBy: jobs[0].createdBy?.name
      });
    }
    
    res.json(jobs);
  } catch (err) {
    console.error('❌ Error fetching jobs for HR:', err);
    console.error('Error details:', err.message);
    res.status(500).json({ 
      error: 'Failed to fetch jobs',
      details: err.message 
    });
  }
});

// Public routes
router.get('/', getJobs);
router.get('/:id', getJobById);

console.log('📦 jobRoutes loaded');
module.exports = router;
