const express = require('express');
const router = express.Router();
const { verifyJWT, isAdmin, isHRorAdmin } = require('../middleware/auth');
const { getAdminStats } = require('../controllers/adminController');
const adminController = require('../controllers/adminController');
const {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  getEmployeeStats,
  getEmployeeById,
  getEmployeeProjects,
} = require('../controllers/employeeController');
const {
  getAllPayrolls,
  getPayrollById,
  createPayroll,
  updatePayroll,
  updatePayrollNotes,
  approvePayroll,
  markAsPaid,
  getPayrollStats
} = require('../controllers/payrollController');
const {
  listSupportTickets,
  respondSupportTicket,
  listFeedbackRequests,
  respondFeedbackRequest
} = require('../controllers/supportController');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Department = require('../models/Department');
const Role = require('../models/Role');
const Interview = require('../models/Interview');
const { sendEmail } = require('../utils/email');
const { hashPassword, generateTemporaryPassword } = require('../utils/password');
const { createNotification } = require('../services/notificationService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Dashboard stats
router.get('/stats', verifyJWT, isHRorAdmin, getAdminStats);
router.get('/dashboard', verifyJWT, isHRorAdmin, adminController.getHRDashboardData);

// New admin endpoints
router.get('/candidates', verifyJWT, isHRorAdmin, adminController.getCandidates);
router.get('/hr-users', verifyJWT, isHRorAdmin, adminController.getHRUsers);
router.get('/interviews', verifyJWT, isHRorAdmin, adminController.getInterviews);
router.put('/users/:userId/verify-hr', verifyJWT, isHRorAdmin, adminController.verifyHR);

const {
  getHireRecommendations,
  approveHireAndCreateEmployee,
  rejectHireRecommendation,
} = require('../services/hireApprovalService');

router.get('/hire-approvals', verifyJWT, isAdmin, async (req, res) => {
  try {
    const recommendations = await getHireRecommendations();
    res.json(recommendations);
  } catch (err) {
    console.error('Error fetching hire approvals:', err);
    res.status(500).json({ error: 'Failed to fetch hire recommendations' });
  }
});

router.post('/hire-approvals/:interviewId/approve', verifyJWT, isAdmin, async (req, res) => {
  try {
    const { position, salary, departmentId, adminNotes } = req.body;
    const result = await approveHireAndCreateEmployee({
      interviewId: req.params.interviewId,
      adminUserId: req.user._id,
      adminNotes,
      position,
      salary,
      departmentId,
    });
    res.json({
      message: 'Hire approved. Employee account created and credentials emailed.',
      ...result,
    });
  } catch (err) {
    console.error('Hire approval failed:', err);
    res.status(400).json({ error: err.message || 'Failed to approve hire' });
  }
});

router.post('/hire-approvals/:interviewId/reject', verifyJWT, isAdmin, async (req, res) => {
  try {
    const interview = await rejectHireRecommendation({
      interviewId: req.params.interviewId,
      adminUserId: req.user._id,
      adminNotes: req.body.adminNotes,
    });
    res.json({ message: 'Hire recommendation rejected', interview });
  } catch (err) {
    console.error('Hire rejection failed:', err);
    res.status(400).json({ error: err.message || 'Failed to reject hire' });
  }
});

// Job approval endpoints
router.put('/jobs/:jobId/approve', verifyJWT, isAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { action, reason } = req.body; // 'approve' or 'reject'

    console.log(`📊 ${action === 'approve' ? 'Approving' : 'Rejecting'} job:`, jobId);

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (action === 'approve') {
      job.status = 'active';
      job.isApproved = true;

      try {
        const User = require('../models/User');
        const notificationService = require('../services/notificationService');
        const candidates = await User.find({
          role: 'candidate',
          emailNotifications: { $ne: false },
        }).select('_id');

        for (const candidate of candidates) {
          await notificationService.notifyNewJobPosted(
            candidate._id,
            job._id,
            job.title,
            job.companyName || 'Company'
          );
        }
        console.log(`📢 Notified ${candidates.length} candidates about approved job`);
      } catch (notifError) {
        console.error('Failed to notify candidates about approved job:', notifError);
      }
    } else if (action === 'reject') {
      job.status = 'rejected';
      job.isApproved = false;
      job.rejectionReason = reason;
    }

    await job.save();

    console.log(`✅ Job ${action}d successfully:`, job.title);
    res.json({ 
      message: `Job ${action}d successfully`, 
      job: {
        _id: job._id,
        title: job.title,
        status: job.status,
        isApproved: job.isApproved,
        rejectionReason: job.rejectionReason
      }
    });
  } catch (err) {
    console.error('❌ Error updating job approval:', err);
    res.status(500).json({ error: 'Error updating job approval' });
  }
});

router.get('/jobs/pending', verifyJWT, isAdmin, async (req, res) => {
  try {
    const pendingJobs = await Job.find({ status: 'pending' })
      .populate('createdBy', 'name email companyName')
      .populate('department', 'name')
      .populate('role', 'title')
      .sort({ createdAt: -1 });

    console.log(`📊 Found ${pendingJobs.length} pending job approvals`);
    res.json(pendingJobs);
  } catch (err) {
    console.error('❌ Error fetching pending jobs:', err);
    res.status(500).json({ error: 'Error fetching pending jobs' });
  }
});

// User management routes - Get all users
router.get('/users', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { role } = req.query;
        let filter = {};

        if (role && role !== 'all') {
            filter.role = role;
        }

        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 });

        console.log(`📊 Fetched ${users.length} users from database`);
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get pending HR verifications
router.get('/users/pending-verification', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const pendingHRs = await User.find({
            role: 'hr',
            isVerified: false
        }).select('-password').sort({ createdAt: -1 });

        console.log(`📊 Found ${pendingHRs.length} pending HR verifications`);
        res.json(pendingHRs);
    } catch (err) {
        console.error('Error fetching pending HR verifications:', err);
        res.status(500).json({ error: 'Failed to fetch pending verifications' });
    }
});

// Update user status
router.put('/users/:userId/status', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            { isActive },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error('Error updating user status:', err);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Reset user password — generates a temporary password and emails the user
router.post('/users/:userId/reset-password', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('+password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const temporaryPassword = generateTemporaryPassword();
        user.password = hashPassword(temporaryPassword);
        await user.save();

        const loginUrl = `${FRONTEND_URL}/login`;
        let emailSent = false;
        try {
            await sendEmail({
                to: user.email,
                subject: 'Your password has been reset — Talora HR',
                html: `
                  <p>Hi ${user.name},</p>
                  <p>An administrator reset your account password.</p>
                  <p><strong>Temporary password:</strong> ${temporaryPassword}</p>
                  <p>Sign in at <a href="${loginUrl}">${loginUrl}</a> using your email and this password.</p>
                  <p>You can also continue using Google sign-in if your account is linked.</p>
                  <p>Please change your password after logging in.</p>
                `,
            });
            emailSent = true;
        } catch (emailErr) {
            console.error('Password reset email failed:', emailErr.message);
        }

        try {
            await createNotification(
                user._id,
                'password_reset',
                'Password Reset',
                'Your account password was reset by an administrator.',
                { type: 'user', id: user._id },
                '/login'
            );
        } catch (_) { /* non-critical */ }

        res.json({
            message: emailSent
                ? 'Password reset email sent successfully'
                : 'Password reset. Email could not be sent — share the temporary password with the user manually.',
            emailSent,
            ...(emailSent ? {} : { temporaryPassword }),
        });
    } catch (err) {
        console.error('Error resetting password:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Verify HR user (quick approve from user management table)
router.put('/users/:userId/verify', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const approved = req.body?.approved !== false;
        const notes = req.body?.notes;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.role !== 'hr') {
            return res.status(400).json({ error: 'Only HR accounts can be verified' });
        }

        user.isVerified = approved;
        if (notes) user.verificationNotes = notes;
        await user.save();

        if (approved) {
            try {
                await createNotification(
                    user._id,
                    'hr_verified',
                    'HR Account Verified',
                    'Your HR account has been verified. You now have full access to HR features.',
                    { type: 'user', id: user._id },
                    '/hr/dashboard'
                );
                await sendEmail({
                    to: user.email,
                    subject: 'Your HR account has been verified — Talora HR',
                    html: `
                      <p>Hi ${user.name},</p>
                      <p>Your HR account on Talora has been verified by an administrator.</p>
                      <p>You can now access all HR features at <a href="${FRONTEND_URL}/hr/dashboard">${FRONTEND_URL}/hr/dashboard</a>.</p>
                    `,
                });
            } catch (notifyErr) {
                console.error('HR verify notification/email failed:', notifyErr.message);
            }
        }

        const safeUser = await User.findById(userId).select('-password');
        res.json(safeUser);
    } catch (err) {
        console.error('Error verifying user:', err);
        res.status(500).json({ error: 'Failed to verify user' });
    }
});

// Send HR verification reminder email
router.post('/users/:userId/send-verification-email', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user || user.role !== 'hr') {
            return res.status(404).json({ error: 'HR user not found' });
        }

        await sendEmail({
            to: user.email,
            subject: 'HR account verification — Talora HR',
            html: `
              <p>Hi ${user.name},</p>
              <p>Your HR account is pending administrator verification.</p>
              <p>An admin will review your account shortly. No action is required from you right now.</p>
            `,
        });

        res.json({ message: 'Verification email sent successfully' });
    } catch (err) {
        console.error('Error sending verification email:', err);
        res.status(500).json({ error: err.message || 'Failed to send verification email' });
    }
});

// Delete single user with cascade deletion
router.delete('/users/:userId', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log(`🗑️ Admin deleting user: ${userId}`);
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log(`🗑️ Deleting user: ${user.name} (${user.email}) - Role: ${user.role}`);
        
        // Cascade deletion based on user role
        if (user.role === 'candidate') {
            // Delete candidate's applications and related interviews
            const applications = await Application.find({ candidate: userId });
            const applicationIds = applications.map(app => app._id);
            
            // Delete interviews related to candidate's applications
            const deletedInterviews = await Interview.deleteMany({ 
                application: { $in: applicationIds } 
            });
            
            // Delete applications
            const deletedApplications = await Application.deleteMany({ candidate: userId });
            
            console.log(`🗑️ Cascade deleted: ${deletedApplications.deletedCount} applications, ${deletedInterviews.deletedCount} interviews`);
            
        } else if (user.role === 'hr') {
            // Delete HR user's jobs and related data
            const jobs = await Job.find({ createdBy: userId });
            const jobIds = jobs.map(job => job._id);
            
            // Delete applications for HR's jobs
            const deletedApplications = await Application.deleteMany({ 
                job: { $in: jobIds } 
            });
            
            // Delete interviews for HR's jobs
            const deletedInterviews = await Interview.deleteMany({ 
                interviewer: userId 
            });
            
            // Delete jobs
            const deletedJobs = await Job.deleteMany({ createdBy: userId });
            
            console.log(`🗑️ Cascade deleted: ${deletedJobs.deletedCount} jobs, ${deletedApplications.deletedCount} applications, ${deletedInterviews.deletedCount} interviews`);
        }
        
        // Delete the user
        await User.findByIdAndDelete(userId);
        
        console.log(`✅ Successfully deleted user: ${user.name}`);
        res.json({ 
            message: `User ${user.name} deleted successfully`,
            deletedUser: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
        
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Bulk user operations
router.post('/users/bulk-action', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { userIds, action } = req.body;

        let updateData = {};
        switch (action) {
            case 'activate':
                updateData = { isActive: true };
                break;
            case 'deactivate':
                updateData = { isActive: false };
                break;
            case 'delete':
                console.log(`🗑️ Bulk deleting ${userIds.length} users`);
                
                // Perform cascade deletion for each user
                for (const userId of userIds) {
                    const user = await User.findById(userId);
                    if (!user) continue;
                    
                    if (user.role === 'candidate') {
                        const applications = await Application.find({ candidate: userId });
                        const applicationIds = applications.map(app => app._id);
                        
                        await Interview.deleteMany({ application: { $in: applicationIds } });
                        await Application.deleteMany({ candidate: userId });
                        
                    } else if (user.role === 'hr') {
                        const jobs = await Job.find({ createdBy: userId });
                        const jobIds = jobs.map(job => job._id);
                        
                        await Application.deleteMany({ job: { $in: jobIds } });
                        await Interview.deleteMany({ interviewer: userId });
                        await Job.deleteMany({ createdBy: userId });
                    }
                }
                
                const result = await User.deleteMany({ _id: { $in: userIds } });
                console.log(`✅ Bulk deleted ${result.deletedCount} users`);
                return res.json({ message: `${result.deletedCount} users deleted successfully` });
                
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        const result = await User.updateMany(
            { _id: { $in: userIds } },
            updateData
        );

        res.json({ message: `${result.modifiedCount} users updated` });
    } catch (err) {
        console.error('Error in bulk user action:', err);
        res.status(500).json({ error: 'Failed to perform bulk action' });
    }
});

// Job management routes
router.get('/jobs', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { status } = req.query;



        let filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }

        console.log('📊 Fetching jobs from database...');
        const jobs = await Job.find(filter)
            .populate('department', 'name')
            .populate('role', 'title')
            .populate('createdBy', 'name email companyName')
            .sort({ createdAt: -1 });

        console.log(`📊 Found ${jobs.length} jobs in database`);

        // Add application count for each job
        const jobsWithCounts = await Promise.all(
            jobs.map(async (job) => {
                const applicationsCount = await Application.countDocuments({ job: job._id });
                const jobObj = job.toObject();
                
                return {
                    ...jobObj,
                    applicationsCount,
                    postedBy: {
                        name: job.createdBy?.name || 'Unknown',
                        email: job.createdBy?.email || 'Unknown',
                        companyName: job.createdBy?.companyName || job.companyName
                    },
                    // Ensure salary object exists for frontend
                    salary: jobObj.salary || (jobObj.minSalary || jobObj.maxSalary ? {
                        min: jobObj.minSalary,
                        max: jobObj.maxSalary,
                        currency: 'USD'
                    } : null)
                };
            })
        );

        console.log(`📊 Returning ${jobsWithCounts.length} jobs with application counts`);

        res.json(jobsWithCounts);
    } catch (err) {
        console.error('Error fetching jobs:', err);

        console.error('📝 Database error, returning empty array');

        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Update job status
router.put('/jobs/:jobId/status', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status, reason } = req.body;

        const updateData = { status };
        if (reason) {
            updateData.rejectionReason = reason;
        }

        const job = await Job.findByIdAndUpdate(
            jobId,
            updateData,
            { new: true }
        );

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(job);
    } catch (err) {
        console.error('Error updating job status:', err);
        res.status(500).json({ error: 'Failed to update job status' });
    }
});

// Delete job
router.delete('/jobs/:jobId', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { jobId } = req.params;

        // Also delete related applications
        await Application.deleteMany({ job: jobId });
        await Job.findByIdAndDelete(jobId);

        res.json({ message: 'Job deleted successfully' });
    } catch (err) {
        console.error('Error deleting job:', err);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

// Bulk job operations
router.post('/jobs/bulk-action', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { jobIds, action, reason } = req.body;

        switch (action) {
            case 'approve':
                await Job.updateMany(
                    { _id: { $in: jobIds } },
                    { status: 'active' }
                );
                break;
            case 'reject':
                await Job.updateMany(
                    { _id: { $in: jobIds } },
                    { status: 'rejected', rejectionReason: reason }
                );
                break;
            case 'delete':
                await Application.deleteMany({ job: { $in: jobIds } });
                await Job.deleteMany({ _id: { $in: jobIds } });
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        res.json({ message: `Bulk ${action} completed successfully` });
    } catch (err) {
        console.error('Error in bulk job action:', err);
        res.status(500).json({ error: 'Failed to perform bulk action' });
    }
});

// New Analytics and Export routes
router.get('/analytics/comprehensive', verifyJWT, isHRorAdmin, adminController.getAnalytics);
router.get('/export', verifyJWT, isHRorAdmin, adminController.exportData);

// Analytics and reports
router.get('/analytics', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { range = '30d' } = req.query;

        // Skip mock data check, use database directly

        // Calculate date range
        const now = new Date();
        let startDate = new Date();
        switch (range) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
        }

        const [
            totalUsers,
            totalJobs,
            totalApplications,
            activeJobs,
            activeCandidates,
            activeHRs,
            averageMatchScore,
            topSkills,
            topCompanies,
            applicationsByStatus,
            jobsByDepartment
        ] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: startDate } }),
            Job.countDocuments({ createdAt: { $gte: startDate } }),
            Application.countDocuments({ createdAt: { $gte: startDate } }),
            Job.countDocuments({ status: 'active' }),
            User.countDocuments({ role: 'candidate', isActive: { $ne: false } }),
            User.countDocuments({ role: 'hr', isActive: { $ne: false } }),

            // Average match score
            Application.aggregate([
                { $match: { matchScore: { $exists: true, $ne: null } } },
                { $group: { _id: null, avg: { $avg: '$matchScore' } } }
            ]),

            // Top skills
            Job.aggregate([
                { $unwind: '$skills' },
                { $group: { _id: '$skills', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                { $project: { skill: '$_id', count: 1, _id: 0 } }
            ]),

            // Top companies
            Job.aggregate([
                {
                    $lookup: {
                        from: 'applications',
                        localField: '_id',
                        foreignField: 'job',
                        as: 'jobApplications'
                    }
                },
                {
                    $group: {
                        _id: '$companyName',
                        jobsPosted: { $sum: 1 },
                        applications: { $sum: { $size: '$jobApplications' } }
                    }
                },
                { $sort: { jobsPosted: -1 } },
                { $limit: 10 },
                { $project: { company: '$_id', jobsPosted: 1, applications: 1, _id: 0 } }
            ]),

            // Applications by status
            Application.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $project: { status: '$_id', count: 1, _id: 0 } }
            ]),

            // Jobs by department
            Job.aggregate([
                { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
                { $unwind: '$dept' },
                { $group: { _id: '$dept.name', count: { $sum: 1 } } },
                { $project: { department: '$_id', count: 1, _id: 0 } },
                { $sort: { count: -1 } }
            ])
        ]);

        res.json({
            totalUsers,
            totalJobs,
            totalApplications,
            activeJobs,
            activeCandidates,
            activeHRs,
            averageMatchScore: averageMatchScore[0]?.avg || 0,
            conversionRate: totalApplications > 0 ? Math.round((totalApplications * 0.1) / totalApplications * 100) : 0,
            monthlyGrowth: {
                users: 12,
                jobs: 8,
                applications: 15
            },
            topSkills,
            topCompanies,
            applicationsByStatus,
            jobsByDepartment
        });
    } catch (err) {
        console.error('Error fetching analytics:', err);

        console.error('📝 Analytics error, returning empty data');

        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Recent activity
router.get('/recent-activity', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);
        const recentJobs = await Job.find().sort({ createdAt: -1 }).limit(5);
        const recentApplications = await Application.find().sort({ createdAt: -1 }).limit(5);

        const activity = [
            ...recentUsers.map(u => ({ type: 'user_registered', message: `New ${u.role} registered: ${u.name}`, timestamp: u.createdAt })),
            ...recentJobs.map(j => ({ type: 'job_posted', message: `New job posted: ${j.title}`, timestamp: j.createdAt })),
            ...recentApplications.map(a => ({ type: 'application_submitted', message: 'New application received', timestamp: a.createdAt }))
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

        res.json(activity);
    } catch (err) {
        console.error('Error fetching recent activity:', err);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

// Department Management Routes
router.get('/departments', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const departments = await Department.find().sort({ createdAt: -1 });
        console.log(`📊 Fetched ${departments.length} departments`);
        res.json(departments);
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

router.post('/departments', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Department name is required' });
        }

        // Check if department already exists
        const existingDept = await Department.findOne({ name });
        if (existingDept) {
            return res.status(400).json({ error: 'Department already exists' });
        }

        const department = await Department.create({
            name,
            description: description || ''
        });

        console.log(`✅ Created department: ${department.name}`);
        res.status(201).json(department);
    } catch (err) {
        console.error('Error creating department:', err);
        res.status(500).json({ error: 'Failed to create department' });
    }
});

router.put('/departments/:id', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const department = await Department.findByIdAndUpdate(
            id,
            { name, description },
            { new: true, runValidators: true }
        );

        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }

        console.log(`✅ Updated department: ${department.name}`);
        res.json(department);
    } catch (err) {
        console.error('Error updating department:', err);
        res.status(500).json({ error: 'Failed to update department' });
    }
});

router.delete('/departments/:id', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if department is used in any jobs
        const jobsUsingDept = await Job.countDocuments({ department: id });
        if (jobsUsingDept > 0) {
            return res.status(400).json({
                error: `Cannot delete department. It is used in ${jobsUsingDept} job(s)`
            });
        }

        const department = await Department.findByIdAndDelete(id);
        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }

        console.log(`🗑️ Deleted department: ${department.name}`);
        res.json({ message: 'Department deleted successfully' });
    } catch (err) {
        console.error('Error deleting department:', err);
        res.status(500).json({ error: 'Failed to delete department' });
    }
});

// Role Management Routes
router.get('/roles', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const roles = await Role.find()
            .populate('departmentId', 'name')
            .sort({ createdAt: -1 });

        console.log(`📊 Fetched ${roles.length} roles`);
        res.json(roles);
    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

router.post('/roles', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { title, description, departmentId } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Role title is required' });
        }

        // Check if role already exists
        const existingRole = await Role.findOne({ title });
        if (existingRole) {
            return res.status(400).json({ error: 'Role already exists' });
        }

        const role = await Role.create({
            title,
            description: description || '',
            departmentId: departmentId || null
        });

        const populatedRole = await Role.findById(role._id).populate('departmentId', 'name');
        console.log(`✅ Created role: ${role.title}`);
        res.status(201).json(populatedRole);
    } catch (err) {
        console.error('Error creating role:', err);
        res.status(500).json({ error: 'Failed to create role' });
    }
});

router.put('/roles/:id', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, departmentId } = req.body;

        const role = await Role.findByIdAndUpdate(
            id,
            { title, description, departmentId },
            { new: true, runValidators: true }
        ).populate('departmentId', 'name');

        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        console.log(`✅ Updated role: ${role.title}`);
        res.json(role);
    } catch (err) {
        console.error('Error updating role:', err);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

router.delete('/roles/:id', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if role is used in any jobs
        const jobsUsingRole = await Job.countDocuments({ role: id });
        if (jobsUsingRole > 0) {
            return res.status(400).json({
                error: `Cannot delete role. It is used in ${jobsUsingRole} job(s)`
            });
        }

        const role = await Role.findByIdAndDelete(id);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        console.log(`🗑️ Deleted role: ${role.title}`);
        res.json({ message: 'Role deleted successfully' });
    } catch (err) {
        console.error('Error deleting role:', err);
        res.status(500).json({ error: 'Failed to delete role' });
    }
});

// Job Categories Management
router.get('/job-categories', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        // Get unique job categories from existing jobs
        const categories = await Job.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $match: { _id: { $ne: null } } },
            { $sort: { count: -1 } },
            { $project: { name: '$_id', jobCount: '$count', _id: 0 } }
        ]);

        res.json(categories);
    } catch (err) {
        console.error('Error fetching job categories:', err);
        res.status(500).json({ error: 'Failed to fetch job categories' });
    }
});

// Interview Management Routes — handled by adminController.getInterviews above

// Employee Management Routes
router.get('/employees', verifyJWT, isHRorAdmin, getAllEmployees);

// Get top performing employees
router.get('/employees/top-performers', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const Employee = require('../models/Employee');
    const Project = require('../models/Project');
    const Feedback = require('../models/Feedback');
    
    // Get employees with performance scores
    const employees = await Employee.find({ status: 'active' })
      .populate('user', 'name email')
      .populate('department', 'name')
      .sort({ performanceScore: -1 })
      .limit(parseInt(limit));
    
    // Calculate additional metrics for each employee
    const topPerformers = await Promise.all(
      employees.map(async (employee) => {
        const [projectsCount, feedbackData] = await Promise.all([
          Project.countDocuments({ 'teamMembers.employee': employee._id }),
          Feedback.find({ employee: employee._id })
        ]);
        
        const averageRating = feedbackData.length > 0 
          ? feedbackData.reduce((sum, f) => sum + (f.overallRating || 0), 0) / feedbackData.length 
          : 0;
        
        return {
          employee: {
            _id: employee._id,
            user: { name: employee.user.name },
            position: employee.position,
            performanceScore: employee.performanceScore || 0
          },
          metrics: {
            projectsInvolved: projectsCount,
            averageRating: Math.round(averageRating * 10) / 10,
            feedbackCount: feedbackData.length
          }
        };
      })
    );
    
    console.log(`📊 Found ${topPerformers.length} top performers`);
    res.json(topPerformers);
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({ error: 'Failed to fetch top performers' });
  }
});
router.get('/employees/stats', verifyJWT, isHRorAdmin, getEmployeeStats);
router.get('/employees/:id/projects', verifyJWT, isHRorAdmin, getEmployeeProjects);
router.get('/employees/:id', verifyJWT, isHRorAdmin, getEmployeeById);

// Test route (no auth required)
router.get('/test-employees', async (req, res) => {
  try {
    const Employee = require('../models/Employee');
    const employees = await Employee.find({ status: 'active' })
      .populate('user', 'name email')
      .populate('department', 'name');
    
    res.json({ 
      success: true,
      count: employees.length,
      employees: employees.map(emp => ({
        name: emp.user.name,
        email: emp.user.email,
        position: emp.position,
        department: emp.department?.name || 'No Department'
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/employees', verifyJWT, isHRorAdmin, createEmployee);
router.put('/employees/:id', verifyJWT, isHRorAdmin, updateEmployee);

router.post('/employees/:id/ai-insights', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { generateEmployeeAIInsights } = require('../services/employeeAIService');
    const result = await generateEmployeeAIInsights(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error generating AI insights:', error);
    res.status(error.message === 'Employee not found' ? 404 : 500).json({
      error: error.message === 'Employee not found' ? error.message : 'Failed to generate AI insights',
    });
  }
});

// Employee Feedback & Performance Management
router.post('/employees/:id/feedback', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const Feedback = require('../models/Feedback');
    const Employee = require('../models/Employee');
    
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const feedback = new Feedback({
      employee: req.params.id,
      reviewer: req.user._id,
      ...req.body,
      status: 'submitted',
      submittedAt: new Date()
    });

    await feedback.save();
    
    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate('reviewer', 'name')
      .populate('employee', 'user position');

    res.json(populatedFeedback);
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

router.post('/employees/:id/performance-review', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const Employee = require('../models/Employee');
    
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Update performance score
    employee.performanceScore = req.body.performanceScore || employee.performanceScore;
    await employee.save();

    res.json({ 
      message: 'Performance review updated successfully',
      employee: {
        id: employee._id,
        performanceScore: employee.performanceScore
      }
    });
  } catch (error) {
    console.error('Error updating performance review:', error);
    res.status(500).json({ error: 'Failed to update performance review' });
  }
});

// Payroll Management Routes (HR and Admin)
router.get('/payroll/stats', verifyJWT, isHRorAdmin, getPayrollStats);
router.get('/payroll', verifyJWT, isHRorAdmin, getAllPayrolls);
router.get('/payroll/:id', verifyJWT, isHRorAdmin, getPayrollById);
router.post('/payroll', verifyJWT, isHRorAdmin, createPayroll);
router.put('/payroll/:id/notes', verifyJWT, isHRorAdmin, updatePayrollNotes);
router.put('/payroll/:id/approve', verifyJWT, isHRorAdmin, approvePayroll);
router.put('/payroll/:id/mark-paid', verifyJWT, isHRorAdmin, markAsPaid);
router.put('/payroll/:id', verifyJWT, isHRorAdmin, updatePayroll);

// Employee support & feedback requests (Admin)
router.get('/support/tickets', verifyJWT, isHRorAdmin, listSupportTickets);
router.put('/support/tickets/:id/respond', verifyJWT, isHRorAdmin, respondSupportTicket);
router.get('/support/feedback-requests', verifyJWT, isHRorAdmin, listFeedbackRequests);
router.put('/support/feedback-requests/:id/respond', verifyJWT, isHRorAdmin, respondFeedbackRequest);

module.exports = router;
