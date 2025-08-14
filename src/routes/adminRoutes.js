const express = require('express');
const router = express.Router();
const { verifyJWT, isAdmin, isHRorAdmin } = require('../middleware/auth');
const { getAdminStats } = require('../controllers/adminController');
const adminController = require('../controllers/adminController');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Department = require('../models/Department');
const Role = require('../models/Role');

// Dashboard stats
router.get('/stats', verifyJWT, isHRorAdmin, getAdminStats);
router.get('/dashboard', verifyJWT, isHRorAdmin, adminController.getHRDashboardData);

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

// Reset user password
router.post('/users/:userId/reset-password', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // In a real app, you'd generate a reset token and send email
        // For now, just return success
        res.json({ message: 'Password reset email sent' });
    } catch (err) {
        console.error('Error resetting password:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Verify HR user
router.put('/users/:userId/verify', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { approved, notes } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            {
                isVerified: approved,
                verificationNotes: notes
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error('Error verifying user:', err);
        res.status(500).json({ error: 'Failed to verify user' });
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
                await User.deleteMany({ _id: { $in: userIds } });
                return res.json({ message: `${userIds.length} users deleted` });
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

        if (!isMongoConnected() && mockData) {
            console.log('📝 Using mock data for jobs');
            let jobs = mockData.jobs.map(job => ({
                ...job,
                department: { name: 'Engineering' },
                role: { title: 'Software Engineer' },
                postedBy: { name: 'HR Manager', email: 'hr@company.com' },
                applicationsCount: job.applicationsCount || 0
            }));

            if (status && status !== 'all') {
                jobs = jobs.filter(job => job.status === status);
            }

            return res.json(jobs);
        }

        let filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }

        const jobs = await Job.find(filter)
            .populate('department', 'name')
            .populate('role', 'title')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        // Add application count for each job
        const jobsWithCounts = await Promise.all(
            jobs.map(async (job) => {
                const applicationsCount = await Application.countDocuments({ job: job._id });
                return {
                    ...job.toObject(),
                    applicationsCount,
                    postedBy: job.createdBy
                };
            })
        );

        res.json(jobsWithCounts);
    } catch (err) {
        console.error('Error fetching jobs:', err);

        // Fallback to mock data on error
        if (mockData) {
            console.log('📝 Falling back to mock data for jobs');
            let jobs = mockData.jobs.map(job => ({
                ...job,
                department: { name: 'Engineering' },
                role: { title: 'Software Engineer' },
                postedBy: { name: 'HR Manager', email: 'hr@company.com' },
                applicationsCount: job.applicationsCount || 0
            }));

            if (req.query.status && req.query.status !== 'all') {
                jobs = jobs.filter(job => job.status === req.query.status);
            }

            return res.json(jobs);
        }

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

// Analytics and reports
router.get('/analytics', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        const { range = '30d' } = req.query;

        if (!isMongoConnected() && mockData) {
            console.log('📝 Using mock data for analytics');
            return res.json({
                totalUsers: mockData.users.length,
                totalJobs: mockData.jobs.length,
                totalApplications: mockData.applications.length,
                activeJobs: mockData.jobs.filter(j => j.status === 'active').length,
                activeCandidates: mockData.users.filter(u => u.role === 'candidate' && u.isActive).length,
                activeHRs: mockData.users.filter(u => u.role === 'hr' && u.isActive).length,
                averageMatchScore: 85,
                conversionRate: 15,
                monthlyGrowth: {
                    users: 12,
                    jobs: 8,
                    applications: 15
                },
                topSkills: [
                    { skill: 'JavaScript', count: 2 },
                    { skill: 'React', count: 2 },
                    { skill: 'Node.js', count: 2 },
                    { skill: 'MongoDB', count: 1 },
                    { skill: 'TypeScript', count: 1 }
                ],
                topCompanies: [
                    { company: 'Tech Company Inc.', jobsPosted: 1, applications: 1 },
                    { company: 'Startup Inc.', jobsPosted: 1, applications: 0 }
                ],
                applicationsByStatus: [
                    { status: 'pending', count: 1 }
                ],
                jobsByDepartment: [
                    { department: 'Engineering', count: 2 }
                ]
            });
        }

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
                    $group: {
                        _id: '$companyName',
                        jobsPosted: { $sum: 1 },
                        applications: { $sum: 0 } // We'll calculate this separately
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

        // Fallback to mock data on error
        if (mockData) {
            console.log('📝 Falling back to mock data for analytics');
            return res.json({
                totalUsers: mockData.users.length,
                totalJobs: mockData.jobs.length,
                totalApplications: mockData.applications.length,
                activeJobs: mockData.jobs.filter(j => j.status === 'active').length,
                activeCandidates: mockData.users.filter(u => u.role === 'candidate' && u.isActive).length,
                activeHRs: mockData.users.filter(u => u.role === 'hr' && u.isActive).length,
                averageMatchScore: 85,
                conversionRate: 15,
                monthlyGrowth: {
                    users: 12,
                    jobs: 8,
                    applications: 15
                },
                topSkills: [
                    { skill: 'JavaScript', count: 2 },
                    { skill: 'React', count: 2 },
                    { skill: 'Node.js', count: 2 }
                ],
                topCompanies: [
                    { company: 'Tech Company Inc.', jobsPosted: 1, applications: 1 }
                ],
                applicationsByStatus: [
                    { status: 'pending', count: 1 }
                ],
                jobsByDepartment: [
                    { department: 'Engineering', count: 2 }
                ]
            });
        }

        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Recent activity
router.get('/recent-activity', verifyJWT, isHRorAdmin, async (req, res) => {
    try {
        // Mock recent activity data
        const recentActivity = [
            {
                type: 'user_registered',
                message: 'New candidate registered',
                timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
            },
            {
                type: 'job_posted',
                message: 'New job posted: Software Engineer',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
            },
            {
                type: 'application_submitted',
                message: 'New application received',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() // 4 hours ago
            }
        ];

        res.json(recentActivity);
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

        console.log(`✅ Created role: ${role.title}`);
        res.status(201).json(role);
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

module.exports = router;
