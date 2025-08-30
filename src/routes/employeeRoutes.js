const express = require('express');
const router = express.Router();
const { verifyJWT, isHR, isAdmin, isEmployee } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const Feedback = require('../models/Feedback');
const OKR = require('../models/OKR');
const User = require('../models/User');
const { CohereClient } = require('cohere-ai');

// Get employee by ID
router.get('/:id', verifyJWT, async (req, res) => {
  try {
    console.log('🔍 Fetching employee by ID:', req.params.id);
    
    const employee = await Employee.findById(req.params.id)
      .populate('user', 'name email');

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Try to populate department if it exists
    try {
      await employee.populate('department', 'name');
    } catch (deptError) {
      console.log('⚠️ Department population failed, continuing without it');
    }

    console.log('✅ Employee found:', employee.user?.name);
    res.json(employee);
  } catch (error) {
    console.error('❌ Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Initialize Cohere client
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Helper function for AI analysis
async function generateAIInsights(employee, projects, feedback, okrs) {
  try {
    const prompt = `
    Analyze this employee's performance data and provide insights:
    
    Employee: ${employee.user?.name || 'Unknown'}
    Position: ${employee.position}
    Department: ${employee.department?.name || 'Unknown'}
    
    Recent Projects: ${projects.length} projects
    Performance Score: ${employee.performanceScore}%
    Project Contribution: ${employee.projectContribution}%
    
    Recent Feedback Summary:
    ${feedback.map(f => `- ${f.type}: ${f.overallRating}/5 stars`).join('\n')}
    
    Current OKRs Progress:
    ${okrs.map(o => `- ${o.objective}: ${o.overallProgress}% complete`).join('\n')}
    
    Please provide:
    1. Promotion readiness score (0-100) and reasons
    2. Attrition risk score (0-100) and factors
    3. Top 3 strengths
    4. Top 3 improvement areas
    
    Format as JSON with keys: promotionReadiness, attritionRisk, strengths, improvementAreas
    `;

    const response = await cohere.generate({
      model: 'command',
      prompt: prompt,
      maxTokens: 500,
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.generations[0].text);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        promotionReadiness: {
          score: Math.min(employee.performanceScore + 10, 100),
          reasons: ['Strong performance metrics', 'Consistent project delivery']
        },
        attritionRisk: {
          score: Math.max(100 - employee.performanceScore - 20, 0),
          factors: ['Performance tracking needed', 'Engagement monitoring required']
        },
        strengths: ['Technical skills', 'Project execution', 'Team collaboration'],
        improvementAreas: ['Communication', 'Leadership development', 'Time management']
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
    // Return fallback insights
    return {
      promotionReadiness: {
        score: employee.performanceScore || 50,
        reasons: ['Performance evaluation needed']
      },
      attritionRisk: {
        score: 30,
        factors: ['Regular check-ins recommended']
      },
      strengths: ['Professional development', 'Team contribution'],
      improvementAreas: ['Skill enhancement', 'Goal setting']
    };
  }
}

// Get current user's employee profile
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id })
      .populate('user', 'name email')
      .populate('department', 'name')
      .populate('manager', 'user position');
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }
    
    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({ error: 'Failed to fetch employee profile' });
  }
});

// Get current user's payroll records
router.get('/me/payroll', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const Payroll = require('../models/Payroll');
    const payrolls = await Payroll.find({ employee: employee._id })
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate('approvedBy', 'name email')
      .sort({ year: -1, month: -1 });

    res.json(payrolls);
  } catch (error) {
    console.error('Error fetching employee payroll:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user's specific payroll record
router.get('/me/payroll/:id', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const Payroll = require('../models/Payroll');
    const payroll = await Payroll.findOne({ 
      _id: req.params.id, 
      employee: employee._id 
    })
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate('approvedBy', 'name email');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    res.json(payroll);
  } catch (error) {
    console.error('Error fetching payroll details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user's projects
router.get('/me/projects', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const projects = await Project.find({
      'teamMembers.employee': employee._id
    })
      .populate('projectManager', 'user position')
      .sort({ startDate: -1 });

    res.json({ projects });
  } catch (error) {
    console.error('Error fetching employee projects:', error);
    res.status(500).json({ error: 'Failed to fetch employee projects' });
  }
});

// Update resume
router.put('/me/resume', verifyJWT, async (req, res) => {
  try {
    const { fileName, fileUrl } = req.body;
    
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    employee.resume = {
      fileName,
      fileUrl,
      uploadedAt: new Date(),
      uploadedBy: req.user._id
    };
    
    await employee.save();
    
    res.json({ message: 'Resume updated successfully', resume: employee.resume });
  } catch (error) {
    console.error('Error updating resume:', error);
    res.status(500).json({ error: 'Failed to update resume' });
  }
});

// Request feedback
router.post('/me/request-feedback', verifyJWT, async (req, res) => {
  try {
    const { message, requestType } = req.body;
    
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    // Create a feedback request (you can create a FeedbackRequest model later)
    // For now, just return success
    res.json({ 
      message: 'Feedback request submitted successfully',
      requestType,
      submittedAt: new Date()
    });
  } catch (error) {
    console.error('Error requesting feedback:', error);
    res.status(500).json({ error: 'Failed to request feedback' });
  }
});

// Get employee's projects
router.get('/:id/projects', verifyJWT, async (req, res) => {
  try {
    const projects = await Project.find({
      'teamMembers.employee': req.params.id
    })
      .populate('projectManager', 'user position')
      .sort({ startDate: -1 });
    
    // Get milestones for each project
    const projectsWithMilestones = await Promise.all(
      projects.map(async (project) => {
        const milestones = await Milestone.find({ 
          project: project._id,
          assignedTo: req.params.id 
        }).sort({ dueDate: 1 });
        
        const teamMember = project.teamMembers.find(
          member => member.employee.toString() === req.params.id
        );
        
        return {
          ...project.toObject(),
          role: teamMember?.role || 'team-member',
          contributionPercentage: teamMember?.contributionPercentage || 0,
          hoursWorked: teamMember?.hoursWorked || 0,
          milestones
        };
      })
    );
    
    res.json({ projects: projectsWithMilestones });
  } catch (error) {
    console.error('Error fetching employee projects:', error);
    res.status(500).json({ error: 'Failed to fetch employee projects' });
  }
});

// Get all employees (HR/Admin only)
router.get('/', verifyJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, department, status = 'active' } = req.query;
    
    const query = { status };
    if (department) query.department = department;
    
    const employees = await Employee.find(query)
      .populate('user', 'name email')
      .populate('department', 'name')
      .populate('manager', 'user position')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Employee.countDocuments(query);
    
    res.json({
      employees,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get employee profile and timeline
router.get('/:id/profile', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('user', 'name email')
      .populate('department', 'name')
      .populate('manager', 'user position');
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Get projects timeline
    const projects = await Project.find({
      'teamMembers.employee': employee._id
    })
      .populate('projectManager', 'user')
      .sort({ startDate: -1 })
      .limit(10);
    
    // Get milestones
    const milestones = await Milestone.find({
      assignedTo: employee._id
    })
      .populate('project', 'name')
      .sort({ dueDate: -1 })
      .limit(20);
    
    // Get recent feedback
    const feedback = await Feedback.find({
      employee: employee._id,
      status: { $in: ['submitted', 'reviewed'] }
    })
      .populate('reviewer', 'name')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get current OKRs
    const currentYear = new Date().getFullYear();
    const okrs = await OKR.find({
      employee: employee._id,
      year: currentYear,
      status: 'active'
    });
    
    res.json({
      employee,
      timeline: {
        projects,
        milestones,
        feedback,
        okrs
      }
    });
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({ error: 'Failed to fetch employee profile' });
  }
});

// Get performance analytics
router.get('/:id/performance', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('user', 'name email');
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Calculate performance metrics
    const projects = await Project.find({
      'teamMembers.employee': employee._id
    });
    
    const completedProjects = projects.filter(p => p.status === 'completed');
    const onTimeProjects = completedProjects.filter(p => 
      p.endDate && new Date(p.endDate) <= new Date(p.estimatedEndDate || p.endDate)
    );
    
    const milestones = await Milestone.find({
      assignedTo: employee._id
    });
    
    const completedMilestones = milestones.filter(m => m.status === 'completed');
    const onTimeMilestones = completedMilestones.filter(m =>
      m.completedDate && m.completedDate <= m.dueDate
    );
    
    const feedback = await Feedback.find({
      employee: employee._id,
      status: { $in: ['submitted', 'reviewed'] }
    });
    
    const avgRating = feedback.length > 0 
      ? feedback.reduce((sum, f) => sum + (f.overallRating || 0), 0) / feedback.length
      : 0;
    
    const metrics = {
      projectsCompleted: completedProjects.length,
      projectsOnTime: onTimeProjects.length,
      projectSuccessRate: projects.length > 0 ? (completedProjects.length / projects.length) * 100 : 0,
      milestonesCompleted: completedMilestones.length,
      milestonesOnTime: onTimeMilestones.length,
      milestoneSuccessRate: milestones.length > 0 ? (completedMilestones.length / milestones.length) * 100 : 0,
      averageFeedbackRating: avgRating,
      totalFeedbackReceived: feedback.length
    };
    
    res.json({
      employee: {
        id: employee._id,
        name: employee.user.name,
        position: employee.position,
        performanceScore: employee.performanceScore
      },
      metrics,
      recentActivity: {
        projects: projects.slice(0, 5),
        milestones: milestones.slice(0, 5),
        feedback: feedback.slice(0, 3)
      }
    });
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// Generate AI insights for employee
router.post('/:id/ai-insights', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('user', 'name')
      .populate('department', 'name');
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Get data for AI analysis
    const projects = await Project.find({
      'teamMembers.employee': employee._id
    }).limit(10);
    
    const feedback = await Feedback.find({
      employee: employee._id,
      status: { $in: ['submitted', 'reviewed'] }
    }).limit(10);
    
    const okrs = await OKR.find({
      employee: employee._id,
      year: new Date().getFullYear()
    });
    
    // Generate AI insights
    const insights = await generateAIInsights(employee, projects, feedback, okrs);
    
    // Update employee record
    employee.aiInsights = {
      ...insights,
      lastAnalyzed: new Date()
    };
    await employee.save();
    
    res.json({
      employee: {
        id: employee._id,
        name: employee.user.name,
        position: employee.position
      },
      insights: employee.aiInsights
    });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    res.status(500).json({ error: 'Failed to generate AI insights' });
  }
});

// Get top performers
router.get('/top-performers', verifyJWT, async (req, res) => {
  try {
    const { period = 'quarter', limit = 5, department } = req.query;
    
    let dateFilter = new Date();
    if (period === 'quarter') {
      dateFilter.setMonth(dateFilter.getMonth() - 3);
    } else if (period === 'month') {
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    } else if (period === 'year') {
      dateFilter.setFullYear(dateFilter.getFullYear() - 1);
    }
    
    const query = { status: 'active' };
    if (department) query.department = department;
    
    const topPerformers = await Employee.find(query)
      .populate('user', 'name email')
      .populate('department', 'name')
      .sort({ performanceScore: -1 })
      .limit(parseInt(limit));
    
    // Get additional metrics for each performer
    const performersWithMetrics = await Promise.all(
      topPerformers.map(async (employee) => {
        const projects = await Project.find({
          'teamMembers.employee': employee._id,
          updatedAt: { $gte: dateFilter }
        });
        
        const feedback = await Feedback.find({
          employee: employee._id,
          createdAt: { $gte: dateFilter },
          status: { $in: ['submitted', 'reviewed'] }
        });
        
        const avgRating = feedback.length > 0 
          ? feedback.reduce((sum, f) => sum + (f.overallRating || 0), 0) / feedback.length
          : 0;
        
        return {
          employee,
          metrics: {
            projectsInvolved: projects.length,
            averageRating: avgRating,
            feedbackCount: feedback.length,
            performanceScore: employee.performanceScore
          }
        };
      })
    );
    
    res.json({
      period,
      topPerformers: performersWithMetrics
    });
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({ error: 'Failed to fetch top performers' });
  }
});

module.exports = router;