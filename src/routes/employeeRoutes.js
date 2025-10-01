const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Feedback = require('../models/Feedback');
const OKR = require('../models/OKR');
const Payroll = require('../models/Payroll');

// Get current user's employee profile
router.get('/profile', verifyJWT, async (req, res) => {
  try {
    console.log('🔍 Fetching employee profile for user:', req.user._id);
    
    const employee = await Employee.findOne({ user: req.user._id })
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate('manager', 'user position');

    if (!employee) {
      console.log('❌ Employee not found for user:', req.user._id);
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    console.log('✅ Employee profile found:', employee.user.name);
    res.json(employee);
  } catch (error) {
    console.error('❌ Error fetching employee profile:', error);
    res.status(500).json({ error: 'Failed to fetch employee profile' });
  }
});

// Get dashboard stats for current employee
router.get('/dashboard/stats', verifyJWT, async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats for user:', req.user._id);
    
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    // Get project stats
    const totalProjects = await Project.countDocuments({
      'teamMembers.employee': employee._id
    });
    
    const activeProjects = await Project.countDocuments({
      'teamMembers.employee': employee._id,
      status: { $in: ['active', 'in-progress'] }
    });

    // Get feedback count
    const feedbackCount = await Feedback.countDocuments({
      employee: employee._id
    });

    // Get OKR count
    const okrCount = await OKR.countDocuments({
      employee: employee._id,
      year: new Date().getFullYear()
    });

    const stats = {
      totalProjects,
      activeProjects,
      completedTasks: 0, // You can implement task tracking later
      upcomingDeadlines: 0, // You can implement deadline tracking later
      performanceScore: employee.performanceScore || 0,
      achievements: feedbackCount + okrCount // Simple achievement count
    };

    console.log('✅ Dashboard stats:', stats);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get employee's projects
router.get('/projects', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const projects = await Project.find({
      'teamMembers.employee': employee._id
    }).populate('createdBy', 'name email');

    res.json(projects);
  } catch (error) {
    console.error('❌ Error fetching employee projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get employee's payroll records
router.get('/payroll', verifyJWT, async (req, res) => {
  try {
    const { year } = req.query;
    
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    let filter = { employee: employee._id };
    if (year) {
      filter.year = parseInt(year);
    }

    const payrolls = await Payroll.find(filter)
      .sort({ year: -1, month: -1 });

    res.json(payrolls);
  } catch (error) {
    console.error('❌ Error fetching employee payroll:', error);
    res.status(500).json({ error: 'Failed to fetch payroll records' });
  }
});

// Get employee's performance data
router.get('/performance', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id })
      .populate('user', 'name email');
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    // Get feedback
    const feedback = await Feedback.find({ employee: employee._id })
      .populate('reviewer', 'name')
      .sort({ createdAt: -1 });

    // Get OKRs
    const okrs = await OKR.find({ 
      employee: employee._id,
      year: new Date().getFullYear()
    });

    res.json({
      employee,
      feedback,
      okrs,
      performanceScore: employee.performanceScore || 0
    });
  } catch (error) {
    console.error('❌ Error fetching employee performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

module.exports = router;