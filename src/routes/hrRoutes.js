const express = require('express');
const router = express.Router();
const { verifyJWT, isHRorAdmin } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const Application = require('../models/Application');
const User = require('../models/User');
const Job = require('../models/Job');
const {
  getAllPayrolls,
  getPayrollById,
  createPayroll,
  updatePayroll,
  approvePayroll,
  markAsPaid,
  getPayrollStats
} = require('../controllers/payrollController');
const {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  getEmployeeStats
} = require('../controllers/employeeController');

// HR Debug endpoint
router.get('/debug', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    res.json({
      message: 'HR routes are working',
      user: req.user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HR Dashboard endpoint
router.get('/dashboard', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    console.log('📊 Fetching HR dashboard data...');

    const [
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      recentApplications
    ] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'open' }),
      Job.countDocuments({ status: 'closed' }),
      Application.countDocuments(),
      Application.find()
        .populate('job', 'title')
        .populate('candidate', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    // Calculate average match score (mock for now)
    const avgMatchScore = totalApplications > 0 ? 75 : 0;

    const dashboardData = {
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      avgMatchScore,
      recentApplications: recentApplications.map(app => ({
        _id: app._id,
        name: app.candidate?.name || 'Unknown',
        email: app.candidate?.email || 'Unknown',
        job: { title: app.job?.title || 'Unknown Job' },
        matchScore: Math.floor(Math.random() * 40) + 60 // Mock score 60-100
      }))
    };

    console.log('✅ HR dashboard data prepared:', dashboardData);
    res.json(dashboardData);

  } catch (error) {
    console.error('❌ Error fetching HR dashboard data:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
});

// Send message to candidate
router.post('/send-message', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { applicationId, subject, message, recipientEmail } = req.body;
    const hrUser = await User.findById(req.user._id);

    if (!subject || !message || !recipientEmail) {
      return res.status(400).json({ error: 'Subject, message, and recipient email are required' });
    }

    // Get application details for context
    const application = await Application.findById(applicationId)
      .populate('job', 'title companyName')
      .populate('candidate', 'name email');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Send email
    await sendEmail({
      to: recipientEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0;">Message from ${application.job.companyName}</h2>
            <p style="color: #6b7280; margin: 5px 0 0 0;">Regarding your application for ${application.job.title}</p>
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h3 style="color: #374151; margin-top: 0;">${subject}</h3>
            <div style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${message}</div>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              This message was sent by ${hrUser.name} from ${application.job.companyName} HR Team.
              <br>Please do not reply to this email directly. Contact us through our official channels.
            </p>
          </div>
        </div>
      `
    });

    // Log the message (you could store this in a messages collection)
    console.log(`Message sent from ${hrUser.name} to ${recipientEmail} regarding application ${applicationId}`);

    res.json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get HR analytics/reports
router.get('/analytics', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get basic stats
    const [
      totalApplications,
      pendingApplications,
      reviewedApplications,
      shortlistedApplications,
      rejectedApplications,
      applicationsByJob,
      applicationsByMonth,
      averageMatchScore
    ] = await Promise.all([
      Application.countDocuments(dateFilter),
      Application.countDocuments({ ...dateFilter, status: 'pending' }),
      Application.countDocuments({ ...dateFilter, status: 'reviewed' }),
      Application.countDocuments({ ...dateFilter, status: 'shortlisted' }),
      Application.countDocuments({ ...dateFilter, status: 'rejected' }),

      // Applications by job
      Application.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$job',
            count: { $sum: 1 },
            avgScore: { $avg: '$matchScore' }
          }
        },
        {
          $lookup: {
            from: 'jobs',
            localField: '_id',
            foreignField: '_id',
            as: 'jobDetails'
          }
        },
        {
          $project: {
            jobTitle: { $arrayElemAt: ['$jobDetails.title', 0] },
            companyName: { $arrayElemAt: ['$jobDetails.companyName', 0] },
            count: 1,
            avgScore: { $round: ['$avgScore', 1] }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Applications by month
      Application.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Average match score
      Application.aggregate([
        { $match: { ...dateFilter, matchScore: { $exists: true } } },
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$matchScore' },
            minScore: { $min: '$matchScore' },
            maxScore: { $max: '$matchScore' }
          }
        }
      ])
    ]);

    // Calculate conversion rates
    const conversionRate = totalApplications > 0
      ? Math.round((shortlistedApplications / totalApplications) * 100)
      : 0;

    const responseRate = totalApplications > 0
      ? Math.round(((reviewedApplications + shortlistedApplications + rejectedApplications) / totalApplications) * 100)
      : 0;

    res.json({
      summary: {
        totalApplications,
        pendingApplications,
        reviewedApplications,
        shortlistedApplications,
        rejectedApplications,
        conversionRate,
        responseRate
      },
      matchScoreStats: averageMatchScore[0] || { avgScore: 0, minScore: 0, maxScore: 0 },
      applicationsByJob,
      applicationsByMonth: applicationsByMonth.map(item => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        count: item.count
      })),
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Bulk operations
router.post('/bulk-update-status', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { applicationIds, status } = req.body;

    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ error: 'Application IDs are required' });
    }

    if (!['pending', 'reviewed', 'shortlisted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await Application.updateMany(
      { _id: { $in: applicationIds } },
      { status: status }
    );

    res.json({
      message: `${result.modifiedCount} applications updated to ${status}`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error('Error in bulk update:', err);
    res.status(500).json({ error: 'Failed to update applications' });
  }
});

// Export applications data
router.get('/export-applications', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { format = 'csv', jobId, status } = req.query;

    // Build filter
    let filter = {};
    if (jobId) filter.job = jobId;
    if (status) filter.status = status;

    const applications = await Application.find(filter)
      .populate('job', 'title companyName department')
      .populate('candidate', 'name email skills experience')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const csvHeaders = [
        'Name', 'Email', 'Phone', 'Job Title', 'Company', 'Status',
        'Match Score', 'Skills', 'Experience', 'Applied Date'
      ];

      const csvRows = applications.map(app => [
        app.name || '',
        app.email || '',
        app.phone || '',
        app.job?.title || '',
        app.job?.companyName || '',
        app.status || '',
        app.matchScore || '',
        app.candidate?.skills?.join('; ') || '',
        app.candidate?.experience || '',
        new Date(app.createdAt).toLocaleDateString()
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=applications.csv');
      res.send(csvContent);
    } else {
      res.json(applications);
    }
  } catch (err) {
    console.error('Error exporting applications:', err);
    res.status(500).json({ error: 'Failed to export applications' });
  }
});

// Employee Management Routes for HR
router.get('/employees', verifyJWT, isHRorAdmin, getAllEmployees);
router.get('/employees/:id', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const Employee = require('../models/Employee');
    const employee = await Employee.findById(req.params.id)
      .populate('user', 'name email')
      .populate('department', 'name');
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});
router.post('/employees', verifyJWT, isHRorAdmin, createEmployee);
router.put('/employees/:id', verifyJWT, isHRorAdmin, updateEmployee);
router.get('/employees/stats', verifyJWT, isHRorAdmin, getEmployeeStats);

// Projects endpoint for HR
router.get('/projects', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const Project = require('../models/Project');
    const projects = await Project.find().limit(100);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Feedback endpoint for HR
router.get('/feedback', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const Feedback = require('../models/Feedback');
    const feedback = await Feedback.find()
      .populate('employee', 'user position')
      .populate('reviewer', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Payroll Management Routes for HR
router.get('/payroll', verifyJWT, isHRorAdmin, getAllPayrolls);
router.get('/payroll/:id', verifyJWT, isHRorAdmin, getPayrollById);
router.post('/payroll', verifyJWT, isHRorAdmin, createPayroll);
router.put('/payroll/:id', verifyJWT, isHRorAdmin, updatePayroll);
router.put('/payroll/:id/approve', verifyJWT, isHRorAdmin, approvePayroll);
router.put('/payroll/:id/mark-paid', verifyJWT, isHRorAdmin, markAsPaid);
router.get('/payroll/stats', verifyJWT, isHRorAdmin, getPayrollStats);

module.exports = router;