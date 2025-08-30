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
router.get('/salary-data', async (req, res) => {
  try {
    const { role, location, experience, company } = req.query;
    console.log('🔍 Salary data search:', { role, location, experience, company });
    
    // Build filter for jobs
    let filter = { 
      status: { $in: ['active', 'open'] },
      isApproved: true,
      $or: [
        { minSalary: { $exists: true, $ne: null } },
        { maxSalary: { $exists: true, $ne: null } }
      ]
    };
    
    if (role) {
      filter.title = { $regex: role, $options: 'i' };
    }
    
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }
    
    if (company) {
      filter.companyName = { $regex: company, $options: 'i' };
    }
    
    const jobs = await Job.find(filter)
      .select('title companyName location minSalary maxSalary experienceRequired')
      .lean();
    
    console.log(`📊 Found ${jobs.length} jobs with salary data`);
    
    if (jobs.length === 0) {
      return res.json([]);
    }
    
    // Group jobs by role and location to calculate salary ranges
    const salaryGroups = {};
    
    jobs.forEach(job => {
      const key = `${job.title.toLowerCase()}-${job.location?.toLowerCase() || 'remote'}`;
      
      if (!salaryGroups[key]) {
        salaryGroups[key] = {
          role: job.title,
          location: job.location || 'Remote',
          salaries: [],
          companies: new Set()
        };
      }
      
      if (job.minSalary) salaryGroups[key].salaries.push(job.minSalary);
      if (job.maxSalary) salaryGroups[key].salaries.push(job.maxSalary);
      salaryGroups[key].companies.add(job.companyName);
    });
    
    // Calculate salary statistics for each group
    const salaryData = Object.values(salaryGroups).map(group => {
      const salaries = group.salaries.sort((a, b) => a - b);
      const minSalary = Math.min(...salaries);
      const maxSalary = Math.max(...salaries);
      const avgSalary = Math.round(salaries.reduce((sum, sal) => sum + sal, 0) / salaries.length);
      
      // Determine experience level based on salary range (rough estimation)
      let experienceLevel = '0-2 years';
      if (avgSalary > 120000) experienceLevel = '5-8 years';
      else if (avgSalary > 90000) experienceLevel = '3-5 years';
      else if (avgSalary > 60000) experienceLevel = '2-4 years';
      
      return {
        role: group.role,
        location: group.location,
        experience: experienceLevel,
        minSalary,
        maxSalary,
        avgSalary,
        companies: Array.from(group.companies).slice(0, 4) // Limit to 4 companies
      };
    });
    
    console.log(`📊 Returning ${salaryData.length} salary data points`);
    res.json(salaryData);
    
  } catch (error) {
    console.error('Error fetching salary data:', error);
    res.status(500).json({ error: 'Failed to fetch salary data' });
  }
});
router.get('/:id', getJobById);

console.log('📦 jobRoutes loaded');
module.exports = router;
