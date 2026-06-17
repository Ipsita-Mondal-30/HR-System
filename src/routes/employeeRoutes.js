const express = require('express');
const router = express.Router();
const { verifyJWT, isHR, isAdmin, isEmployee } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const ProjectWorkSubmission = require('../models/ProjectWorkSubmission');
const Feedback = require('../models/Feedback');
const { syncEmployeeStatsFromSubmissions, buildEmployeePerformanceOverview, canSubmitWork, isActiveMilestone, ensureProjectCompletionSynced, syncEmployeePerformanceFromProjects } = require('../services/projectPerformanceService');
const employeeResumeUpload = require('../middleware/employeeResumeUpload');
const { createNotification } = require('../services/notificationService');
const { checkAndNotifyMilestoneDeadlines } = require('../services/milestoneDeadlineService');
const OKR = require('../models/OKR');
const Achievement = require('../models/Achievement');
const User = require('../models/User');
const SupportTicket = require('../models/SupportTicket');
const FeedbackRequest = require('../models/FeedbackRequest');
const { CohereClient } = require('cohere-ai');
const { downloadEmployeePayslip } = require('../controllers/payrollController');



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
      status: 'active'
    });

    const achievementCount = await Achievement.countDocuments({
      employee: employee._id,
      isActive: true
    });

    const stats = {
      totalProjects,
      activeProjects,
      completedTasks: 0, // Placeholder - implement task tracking if needed
      upcomingDeadlines: 0, // Placeholder - implement deadline tracking if needed
      performanceScore: employee.performanceScore || 0,
      achievements: achievementCount
    };

    console.log('✅ Dashboard stats:', stats);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get current user's employee profile
router.get('/me', verifyJWT, async (req, res) => {
  try {
    console.log('🔍 Fetching current employee profile for user:', req.user._id);
    
    const employee = await Employee.findOne({ user: req.user._id })
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate({ path: 'manager', select: 'position', populate: { path: 'user', select: 'name email' } });

    if (!employee) {
      console.log('❌ Employee not found for user:', req.user._id);
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    await syncEmployeePerformanceFromProjects(employee._id);
    const refreshed = await Employee.findById(employee._id)
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate({ path: 'manager', select: 'position', populate: { path: 'user', select: 'name email' } });

    console.log('✅ Employee profile found:', refreshed.user.name);
    res.json(refreshed);
  } catch (error) {
    console.error('❌ Error fetching current employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee profile' });
  }
});

// Get current user's employee profile (alias for /me)
router.get('/profile', verifyJWT, async (req, res) => {
  console.log('🚀 EMPLOYEE PROFILE ROUTE HIT!');
  try {
    console.log('🔍 Full req.user object:', req.user);
    console.log('🔍 req.user._id:', req.user._id);
    console.log('🔍 req.user keys:', Object.keys(req.user));
    console.log('🔍 Fetching employee profile for user:', req.user._id);
    
    const employee = await Employee.findOne({ user: req.user._id })
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate({ path: 'manager', select: 'position', populate: { path: 'user', select: 'name email' } });

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
async function generateAIInsights(employee, projects = [], feedback = [], okrs = []) {
  // Default values for missing data
  const employeeName = employee?.user?.name || 'Unknown Employee';
  const position = employee?.position || 'Unspecified Position';
  const department = employee?.department?.name || 'Unassigned Department';
  const performanceScore = employee?.performanceScore || 0;
  const projectContribution = employee?.projectContribution || 0;
  
  try {
    console.log(`🤖 Generating AI insights for ${employeeName}`);
    
    // Prepare project data with fallbacks
    const projectSummary = projects.length > 0 
      ? projects.map(p => `- ${p.name || 'Unnamed Project'}: ${p.status || 'No status'}`).join('\n')
      : 'No recent projects';
    
    // Prepare feedback data with fallbacks
    const feedbackSummary = feedback.length > 0
      ? feedback.map(f => `- ${f.type || 'General'}: ${f.overallRating || 'N/A'}/5 - ${f.summary || 'No summary'}`).join('\n')
      : 'No recent feedback';
    
    // Prepare OKR data with fallbacks
    const okrSummary = okrs.length > 0
      ? okrs.map(o => `- ${o.objective || 'Unnamed Objective'}: ${o.overallProgress || 0}%`).join('\n')
      : 'No active OKRs';
    
    const prompt = `
    Analyze this employee's performance data and provide insights:
    
    Employee: ${employeeName}
    Position: ${position}
    Department: ${department}
    
    Recent Projects (${projects.length}):
    ${projectSummary}
    
    Performance Metrics:
    - Performance Score: ${performanceScore}%
    - Project Contribution: ${projectContribution}%
    
    Recent Feedback:
    ${feedbackSummary}
    
    Current OKRs:
    ${okrSummary}
    
    Please provide a JSON response with the following structure:
    {
      "promotionReadiness": {
        "score": 0-100,
        "reasons": ["reason1", "reason2"],
        "nextSteps": ["action1", "action2"]
      },
      "attritionRisk": {
        "score": 0-100,
        "factors": ["factor1", "factor2"],
        "mitigation": ["action1", "action2"]
      },
      "strengths": ["strength1", "strength2", "strength3"],
      "improvementAreas": ["area1", "area2", "area3"],
      "recommendations": ["recommendation1", "recommendation2"]
    }
    `;

    console.log('📝 Sending prompt to AI model...');
    const response = await cohere.generate({
      model: 'command',
      prompt: prompt,
      maxTokens: 1000,
      temperature: 0.5,
      k: 0,
      p: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      stopSequences: ['---'],
      returnLikelihoods: 'NONE'
    });

    console.log('✅ Received AI response, processing...');
    
    try {
      // Extract JSON from the response
      const jsonMatch = response.generations[0].text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response.generations[0].text;
      const insights = JSON.parse(jsonString);
      
      // Validate and format the response
      return {
        promotionReadiness: {
          score: Math.min(Math.max(insights.promotionReadiness?.score || 50, 0), 100),
          reasons: Array.isArray(insights.promotionReadiness?.reasons) 
            ? insights.promotionReadiness.reasons 
            : ['Not enough data for assessment'],
          nextSteps: Array.isArray(insights.promotionReadiness?.nextSteps)
            ? insights.promotionReadiness.nextSteps
            : []
        },
        attritionRisk: {
          score: Math.min(Math.max(insights.attritionRisk?.score || 30, 0), 100),
          factors: Array.isArray(insights.attritionRisk?.factors)
            ? insights.attritionRisk.factors
            : ['Insufficient data for assessment'],
          mitigation: Array.isArray(insights.attritionRisk?.mitigation)
            ? insights.attritionRisk.mitigation
            : []
        },
        strengths: Array.isArray(insights.strengths) && insights.strengths.length > 0
          ? insights.strengths.slice(0, 3)
          : ['Team collaboration', 'Adaptability', 'Willingness to learn'],
        improvementAreas: Array.isArray(insights.improvementAreas) && insights.improvementAreas.length > 0
          ? insights.improvementAreas.slice(0, 3)
          : ['Skill development', 'Time management', 'Communication'],
        recommendations: Array.isArray(insights.recommendations) && insights.recommendations.length > 0
          ? insights.recommendations
          : [
              'Schedule regular 1:1 meetings to discuss career development',
              'Consider additional training in key skill areas'
            ]
      };
      
    } catch (parseError) {
      console.error('⚠️ Error parsing AI response, using fallback insights:', parseError);
      return getFallbackInsights(employee);
    }
  } catch (error) {
    console.error('❌ AI analysis error, using fallback insights:', error);
    return getFallbackInsights(employee);
  }
}

// Helper function to generate fallback insights
function getFallbackInsights(employee) {
  const performanceScore = employee?.performanceScore || 50;
  const projectContribution = employee?.projectContribution || 0;
  
  return {
    promotionReadiness: {
      score: Math.min(performanceScore + 10, 100),
      reasons: performanceScore > 70 
        ? ['Consistently meets performance expectations']
        : ['Performance evaluation needed'],
      nextSteps: [
        'Review performance metrics with manager',
        'Set clear development goals'
      ]
    },
    attritionRisk: {
      score: Math.max(100 - performanceScore - 20, 0),
      factors: performanceScore < 50 
        ? ['Performance concerns identified'] 
        : ['Regular check-ins recommended'],
      mitigation: [
        'Schedule career development discussion',
        'Review workload and work-life balance'
      ]
    },
    strengths: [
      'Team collaboration',
      'Problem-solving skills',
      'Adaptability'
    ],
    improvementAreas: [
      'Technical skill development',
      'Time management',
      'Cross-functional communication'
    ],
    recommendations: [
      'Participate in skill development workshops',
      'Seek mentorship opportunities',
      'Set clear quarterly objectives'
    ]
  };
}

// Get current user's employee profile
// Duplicate route removed - using the first /me route instead

// Get current user's payroll records
router.get('/me/payroll', verifyJWT, async (req, res) => {
  try {
    console.log(`🔍 Fetching payroll records for user: ${req.user._id}`);
    
    // Find employee with basic validation
    const employee = await Employee.findOne({ user: req.user._id });
    
    if (!employee) {
      console.error(`❌ Employee profile not found for user: ${req.user._id}`);
      return res.status(404).json({ 
        message: 'Employee profile not found',
        code: 'EMPLOYEE_NOT_FOUND'
      });
    }

    const Payroll = require('../models/Payroll');
    const { year } = req.query;
    
    const payrollFilter = { 
      employee: employee._id,
      status: { $in: ['approved', 'paid'] }
    };
    if (year) payrollFilter.year = parseInt(year);

    let payrolls = [];
    try {
      payrolls = await Payroll.find(payrollFilter)
      .populate({
        path: 'employee',
        select: 'user position',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'approvedBy',
        select: 'name email'
      })
      .sort({ year: -1, month: -1 })
      .lean();
      
      // Ensure consistent data structure
      payrolls = payrolls.map(payroll => ({
        ...payroll,
        employee: payroll.employee ? {
          ...payroll.employee,
          user: payroll.employee.user || { name: 'Unknown', email: 'unknown@example.com' }
        } : null,
        approvedBy: payroll.approvedBy || null
      }));
      
      console.log(`✅ Found ${payrolls.length} payroll records for employee: ${employee._id}`);
      
    } catch (error) {
      console.error('⚠️ Error fetching payroll records:', error);
      // Continue with empty array to avoid breaking the UI
      payrolls = [];
    }

    res.json(payrolls);
  } catch (error) {
    console.error('❌ Error in payroll endpoint:', error);
    res.status(500).json({ 
      message: 'Failed to fetch payroll records',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: 'PAYROLL_FETCH_ERROR'
    });
  }
});

// Download payslip PDF (must be before /me/payroll/:id)
router.get('/me/payroll/:id/download', verifyJWT, downloadEmployeePayslip);

// Get current user's specific payroll record
router.get('/me/payroll/:id', verifyJWT, async (req, res) => {
  try {
    console.log(`🔍 Fetching payroll record ${req.params.id} for user: ${req.user._id}`);
    
    // Validate payroll ID format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: 'Invalid payroll ID format',
        code: 'INVALID_PAYROLL_ID'
      });
    }
    
    // Find employee with basic validation
    const employee = await Employee.findOne({ user: req.user._id });
    
    if (!employee) {
      console.error(`❌ Employee profile not found for user: ${req.user._id}`);
      return res.status(404).json({ 
        message: 'Employee profile not found',
        code: 'EMPLOYEE_NOT_FOUND'
      });
    }

    const Payroll = require('../models/Payroll');
    
    // Get payroll record with proper population and error handling
    try {
      const payroll = await Payroll.findOne({ 
        _id: req.params.id, 
        employee: employee._id,
        status: { $in: ['approved', 'paid'] }
      })
      .populate({
        path: 'employee',
        select: 'user position department',
        populate: [
          {
            path: 'user',
            select: 'name email'
          },
          {
            path: 'department',
            select: 'name'
          }
        ]
      })
      .populate({
        path: 'approvedBy',
        select: 'name email'
      })
      .lean();

      if (!payroll) {
        console.error(`❌ Payroll record not found or unauthorized: ${req.params.id}`);
        return res.status(404).json({ 
          message: 'Payroll record not found or access denied',
          code: 'PAYROLL_NOT_FOUND'
        });
      }
      
      // Ensure consistent data structure
      const formattedPayroll = {
        ...payroll,
        employee: payroll.employee ? {
          ...payroll.employee,
          user: payroll.employee.user || { name: 'Unknown', email: 'unknown@example.com' },
          department: payroll.employee.department || { name: 'Unassigned' }
        } : null,
        approvedBy: payroll.approvedBy || null,
        // Ensure all required fields have default values
        basicSalary: payroll.basicSalary || 0,
        allowances: payroll.allowances || [],
        deductions: payroll.deductions || [],
        netSalary: payroll.netSalary || 0,
        paymentDate: payroll.paymentDate || null,
        paymentMethod: payroll.paymentMethod || 'bank_transfer',
        status: payroll.status || 'draft',
        notes: payroll.notes || ''
      };
      
      console.log(`✅ Found payroll record: ${req.params.id} for employee: ${employee._id}`);
      res.json(formattedPayroll);
      
    } catch (dbError) {
      console.error('⚠️ Database error fetching payroll:', dbError);
      throw dbError; // Will be caught by the outer catch
    }
    
  } catch (error) {
    console.error('❌ Error in payroll details endpoint:', error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid payroll ID format',
        code: 'INVALID_PAYROLL_ID'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to fetch payroll details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: 'PAYROLL_DETAILS_ERROR'
    });
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

// Get current user's performance reviews and feedback
router.get('/me/feedback', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const { type } = req.query;
    const query = {
      employee: employee._id,
      isVisible: true,
      status: { $in: ['submitted', 'reviewed', 'acknowledged'] }
    };
    if (type) query.type = type;

    const feedback = await Feedback.find(query)
      .populate('reviewer', 'name email')
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.json({ feedback });
  } catch (error) {
    console.error('Error fetching employee feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Update employee skills (self-service)
router.put('/me/skills', verifyJWT, async (req, res) => {
  try {
    const { skills } = req.body;
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }
    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: 'Skills must be an array' });
    }
    employee.skills = skills;
    await employee.save();
    res.json({ message: 'Skills updated', skills: employee.skills });
  } catch (error) {
    console.error('Error updating skills:', error);
    res.status(500).json({ error: 'Failed to update skills' });
  }
});

// Upload resume (file)
router.post('/me/resume/upload', verifyJWT, employeeResumeUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Resume file is required' });
    }

    const employee = await Employee.findOne({ user: req.user._id }).populate('user', 'name');
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const fileUrl = req.file.path || req.file.secure_url || req.file.url;
    employee.resume = {
      fileName: req.file.originalname,
      fileUrl,
      uploadedAt: new Date(),
      uploadedBy: req.user._id,
    };
    await employee.save();

    const hrUsers = await User.find({ role: { $in: ['hr', 'admin'] }, isActive: true }).select('_id');
    await Promise.all(
      hrUsers.map((hr) =>
        createNotification(
          hr._id,
          'resume_updated',
          'Employee Resume Updated',
          `${employee.user?.name || 'An employee'} uploaded a new resume: ${req.file.originalname}`,
          { type: 'employee', id: employee._id },
          `/admin/employees/${employee._id}`
        )
      )
    );

    res.json({ message: 'Resume uploaded successfully', resume: employee.resume });
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ error: error.message || 'Failed to upload resume' });
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

// Request feedback — stored for HR/Admin review
router.get('/me/feedback-requests', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const requests = await FeedbackRequest.find({ employee: employee._id })
      .populate('respondedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching feedback requests:', error);
    res.status(500).json({ error: 'Failed to fetch feedback requests' });
  }
});

router.post('/me/request-feedback', verifyJWT, async (req, res) => {
  try {
    const { message, requestType } = req.body;
    
    const employee = await Employee.findOne({ user: req.user._id }).populate('user', 'name');
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const feedbackRequest = await FeedbackRequest.create({
      employee: employee._id,
      requestType: requestType || 'General Feedback',
      message: message?.trim() || ''
    });

    const hrUsers = await User.find({ role: { $in: ['hr', 'admin'] }, isActive: true }).select('_id');
    await Promise.all(
      hrUsers.map((hr) =>
        createNotification(
          hr._id,
          'feedback_request',
          'Feedback Requested',
          `${employee.user?.name || 'Employee'} requested ${requestType || 'general'} feedback${message ? `: ${message}` : ''}`,
          { type: 'employee', id: employee._id },
          '/hr/support'
        )
      )
    );

    res.status(201).json({ 
      message: 'Feedback request submitted successfully',
      requestType,
      submittedAt: feedbackRequest.createdAt,
      request: feedbackRequest
    });
  } catch (error) {
    console.error('Error requesting feedback:', error);
    res.status(500).json({ error: 'Failed to request feedback' });
  }
});

// Request training
router.post('/me/request-training', verifyJWT, async (req, res) => {
  try {
    const { topic, message } = req.body;

    const employee = await Employee.findOne({ user: req.user._id }).populate('user', 'name');
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const hrUsers = await User.find({ role: { $in: ['hr', 'admin'] }, isActive: true }).select('_id');
    await Promise.all(
      hrUsers.map((hr) =>
        createNotification(
          hr._id,
          'training_request',
          'Training Requested',
          `${employee.user?.name || 'Employee'} requested training${topic ? ` on ${topic}` : ''}${message ? `: ${message}` : ''}`,
          { type: 'employee', id: employee._id },
          `/admin/employees/${employee._id}`
        )
      )
    );

    res.json({
      message: 'Training request submitted successfully',
      topic,
      submittedAt: new Date(),
    });
  } catch (error) {
    console.error('Error requesting training:', error);
    res.status(500).json({ error: 'Failed to request training' });
  }
});

// Support tickets — employee help & HR support
router.get('/me/support-tickets', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const tickets = await SupportTicket.find({ employee: employee._id })
      .populate('respondedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

router.post('/me/support-tickets', verifyJWT, async (req, res) => {
  try {
    const { subject, message, category, priority } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const employee = await Employee.findOne({ user: req.user._id }).populate('user', 'name');
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const ticket = await SupportTicket.create({
      employee: employee._id,
      subject: subject.trim(),
      message: message.trim(),
      category: category || 'other',
      priority: priority || 'medium'
    });

    const hrUsers = await User.find({ role: { $in: ['hr', 'admin'] }, isActive: true }).select('_id');
    await Promise.all(
      hrUsers.map((hr) =>
        createNotification(
          hr._id,
          'support_request',
          'New Support Request',
          `${employee.user?.name || 'Employee'} submitted: ${subject.trim()}`,
          { type: 'employee', id: employee._id },
          '/hr/support'
        )
      )
    );

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ error: 'Failed to submit support request' });
  }
});

// Get employee's projects (team member OR project manager)
router.get('/:id/projects', verifyJWT, async (req, res) => {
  try {
    checkAndNotifyMilestoneDeadlines().catch((err) =>
      console.warn('Deadline check failed:', err.message)
    );

    const projects = await Project.find({
      $or: [
        { 'teamMembers.employee': req.params.id },
        { projectManager: req.params.id },
      ],
    })
      .populate({
        path: 'projectManager',
        select: 'position',
        populate: { path: 'user', select: 'name email' },
      })
      .sort({ startDate: -1 });

    const projectsWithMilestones = await Promise.all(
      projects.map(async (project) => {
        await ensureProjectCompletionSynced(project);

        const milestones = await Milestone.find({
          project: project._id,
          assignedTo: req.params.id,
        }).sort({ dueDate: 1 });

        const submissions = await ProjectWorkSubmission.find({
          project: project._id,
          employee: req.params.id,
        }).sort({ createdAt: -1 });

        const isPm = project.projectManager?.toString() === req.params.id;
        const teamMember = project.teamMembers.find(
          (member) => member.employee.toString() === req.params.id
        );

        await syncEmployeeStatsFromSubmissions(project._id, req.params.id);
        const refreshed = await Project.findById(project._id);
        const refreshedMember = refreshed?.teamMembers.find(
          (member) => member.employee.toString() === req.params.id
        );

        const performanceOverview = await buildEmployeePerformanceOverview(
          refreshed || project,
          req.params.id,
          milestones,
          submissions
        );

        const activeMilestones = milestones.filter(isActiveMilestone);

        return {
          ...project.toObject(),
          role: isPm ? 'project-manager' : teamMember?.role || 'team-member',
          isProjectManager: isPm,
          contributionPercentage: performanceOverview.contributionPercentage,
          hoursWorked: performanceOverview.hoursWorked,
          performanceOverview,
          canSubmitWork: canSubmitWork(refreshed || project, milestones),
          activeMilestones,
          milestones,
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
    console.log(`🔍 Fetching profile for employee ID: ${req.params.id}`);
    
    // Find employee with all necessary population
    const employee = await Employee.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email',
        match: { isActive: true } // Only include active users
      })
      .populate('department', 'name')
      .populate({
        path: 'manager',
        select: 'user position',
        populate: {
          path: 'user',
          select: 'name email',
          match: { isActive: true }
        }
      });
    
    if (!employee) {
      console.error(`❌ Employee not found with ID: ${req.params.id}`);
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Check if user is populated
    if (!employee.user) {
      console.error(`❌ User not found for employee ID: ${req.params.id}`);
      return res.status(404).json({ error: 'User account not found or inactive' });
    }
    
    console.log(`✅ Found employee: ${employee.user.name} (${employee.user.email})`);
    
    // Get projects timeline with error handling
    let projects = [];
    try {
      projects = await Project.find({
        'teamMembers.employee': employee._id,
        status: { $ne: 'archived' }
      })
      .populate({
        path: 'projectManager',
        select: 'user',
        populate: {
          path: 'user',
          select: 'name',
          match: { isActive: true }
        }
      })
      .sort({ startDate: -1 })
      .limit(10)
      .lean();
    } catch (projectError) {
      console.error('⚠️ Error fetching projects:', projectError);
      // Continue with empty projects array
    }
    
    // Get milestones with error handling
    let milestones = [];
    try {
      milestones = await Milestone.find({
        assignedTo: employee._id,
        status: { $ne: 'completed' }
      })
      .populate('project', 'name')
      .sort({ dueDate: -1 })
      .limit(20)
      .lean();
    } catch (milestoneError) {
      console.error('⚠️ Error fetching milestones:', milestoneError);
      // Continue with empty milestones array
    }
    
    // Get recent feedback with error handling
    let feedback = [];
    try {
      feedback = await Feedback.find({
        employee: employee._id,
        status: { $in: ['submitted', 'reviewed'] }
      })
      .populate({
        path: 'reviewer',
        select: 'name',
        match: { isActive: true }
      })
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    } catch (feedbackError) {
      console.error('⚠️ Error fetching feedback:', feedbackError);
      // Continue with empty feedback array
    }
    
    // Get current OKRs with error handling
    let okrs = [];
    try {
      const currentYear = new Date().getFullYear();
      okrs = await OKR.find({
        employee: employee._id,
        year: currentYear,
        status: 'active'
      }).lean();
    } catch (okrError) {
      console.error('⚠️ Error fetching OKRs:', okrError);
      // Continue with empty OKRs array
    }
    
    // Ensure all data is properly formatted
    const response = {
      employee: {
        ...employee.toObject(),
        // Ensure user data is always available
        user: employee.user || { name: 'Unknown', email: 'unknown@example.com' },
        // Ensure department is always an object with at least a name
        department: employee.department || { name: 'Unassigned' },
        // Ensure manager is properly formatted
        manager: employee.manager ? {
          ...employee.manager.toObject(),
          user: employee.manager.user || { name: 'Unassigned' }
        } : null
      },
      timeline: {
        projects: projects || [],
        milestones: milestones || [],
        feedback: feedback || [],
        okrs: okrs || []
      }
    };
    
    console.log(`✅ Successfully built profile response for employee: ${employee.user.name}`);
    res.json(response);
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({ error: 'Failed to fetch employee profile' });
  }
});

// Get performance analytics
router.get('/:id/performance', verifyJWT, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate({ path: 'manager', select: 'user position', populate: { path: 'user', select: 'name' } });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const projects = await Project.find({
      'teamMembers.employee': employee._id
    });

    await Promise.all(projects.map((p) => ensureProjectCompletionSynced(p)));
    
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
    
    const feedbackRecords = await Feedback.find({
      employee: employee._id,
      status: { $in: ['submitted', 'reviewed', 'acknowledged'] }
    })
      .populate('reviewer', 'name email')
      .sort({ createdAt: -1 });

    const avgRating = feedbackRecords.length > 0 
      ? feedbackRecords.reduce((sum, f) => sum + (f.overallRating || 0), 0) / feedbackRecords.length
      : 0;

    const currentYear = new Date().getFullYear();
    const okrs = await OKR.find({
      employee: employee._id,
      year: currentYear,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 });

    const completedOKRs = okrs.filter(o => o.status === 'completed' || o.overallProgress >= 100).length;
    
    const metrics = {
      projectsCompleted: completedProjects.length,
      projectsOnTime: onTimeProjects.length,
      projectSuccessRate: projects.length > 0 ? (completedProjects.length / projects.length) * 100 : 0,
      milestonesCompleted: completedMilestones.length,
      milestonesOnTime: onTimeMilestones.length,
      milestoneSuccessRate: milestones.length > 0 ? (completedMilestones.length / milestones.length) * 100 : 0,
      averageFeedbackRating: avgRating,
      averageRating: avgRating,
      totalFeedbackReceived: feedbackRecords.length,
      feedbackCount: feedbackRecords.length,
      performanceScore: employee.performanceScore || 0,
      projectContribution: employee.projectContribution || 0,
      okrsCount: okrs.length,
      completedOKRs
    };

    const recentFeedback = feedbackRecords.slice(0, 10).map((f) => ({
      _id: f._id,
      title: f.title,
      type: f.type,
      feedback: f.content,
      rating: f.overallRating || 0,
      createdAt: f.createdAt,
      reviewPeriod: f.reviewPeriod,
      status: f.status,
      aiSummary: f.aiSummary,
      ratings: f.ratings,
      givenBy: { name: f.reviewer?.name || 'Unknown', email: f.reviewer?.email }
    }));
    
    res.json({
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        user: employee.user,
        position: employee.position,
        department: employee.department,
        manager: employee.manager,
        performanceScore: employee.performanceScore || 0,
        hireDate: employee.hireDate,
        joinDate: employee.hireDate,
        employmentType: employee.employmentType,
        status: employee.status
      },
      metrics,
      recentFeedback,
      okrs: okrs.map((o) => ({
        _id: o._id,
        objective: o.objective,
        description: o.description,
        period: o.period,
        year: o.year,
        overallProgress: o.overallProgress,
        status: o.status,
        keyResults: o.keyResults
      })),
      recentActivity: {
        projects: projects.slice(0, 5),
        milestones: milestones.slice(0, 5),
        feedback: feedbackRecords.slice(0, 3)
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
    console.log('🏆 Fetching top performers...');
    const { period = 'quarter', limit = 5, department } = req.query;
    
    let dateFilter = new Date();
    if (period === 'quarter') {
      dateFilter.setMonth(dateFilter.getMonth() - 3);
    } else if (period === 'month') {
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    } else if (period === 'year') {
      dateFilter.setFullYear(dateFilter.getFullYear() - 1);
    }
    
    console.log('📅 Date filter:', dateFilter);
    
    const query = { status: 'active' };
    if (department) query.department = department;
    
    console.log('🔍 Query:', query);
    
    const topPerformers = await Employee.find(query)
      .populate('user', 'name email')
      .populate('department', 'name')
      .sort({ performanceScore: -1 })
      .limit(parseInt(limit));
    
    console.log(`👥 Found ${topPerformers.length} employees`);
    
    // Get additional metrics for each performer
    const performersWithMetrics = await Promise.all(
      topPerformers.map(async (employee) => {
        try {
          console.log(`📊 Processing metrics for employee: ${employee.user?.name || 'Unknown'}`);
          
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
        } catch (metricError) {
          console.error(`❌ Error processing metrics for employee ${employee._id}:`, metricError);
          return {
            employee,
            metrics: {
              projectsInvolved: 0,
              averageRating: 0,
              feedbackCount: 0,
              performanceScore: employee.performanceScore || 0
            }
          };
        }
      })
    );
    
    console.log('✅ Top performers processed successfully');
    
    res.json({
      period,
      topPerformers: performersWithMetrics
    });
  } catch (error) {
    console.error('❌ Error fetching top performers:', error);
    res.status(500).json({ error: 'Failed to fetch top performers', details: error.message });
  }
});

module.exports = router;