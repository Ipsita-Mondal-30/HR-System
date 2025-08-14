// controllers/adminController.js
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Department = require('../models/Department');
const Role = require('../models/Role');

const getAdminStats = async (req, res) => {
  try {
    console.log('📊 Fetching real admin statistics from MongoDB...');
    
    const [
      totalUsers,
      jobsCount, 
      applicationsCount, 
      hrCount, 
      candidateCount, 
      departmentsCount, 
      rolesCount,
      activeJobs,
      pendingApplications,
      pendingHRVerifications,
      matchStats,
      recentCandidates,
      recentHRs,
      recentJobs,
      recentApplications
    ] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Application.countDocuments(),
      User.countDocuments({ role: 'hr' }),
      User.countDocuments({ role: 'candidate' }),
      Department.countDocuments(),
      Role.countDocuments(),
      Job.countDocuments({ status: 'active' }),
      Application.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'hr', isVerified: false }),
      Application.aggregate([
        { $match: { matchScore: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgScore: { $avg: "$matchScore" } } }
      ]),
      User.countDocuments({ 
        role: 'candidate', 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      User.countDocuments({ 
        role: 'hr', 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      Job.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      Application.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      })
    ]);

    const avgMatchScore = matchStats[0]?.avgScore || 0;

    const stats = {
      totalUsers,
      jobsCount,
      applicationsCount,
      hrCount,
      candidateCount,
      departmentsCount,
      rolesCount,
      activeJobs,
      pendingApplications,
      pendingHRVerifications,
      avgMatchScore: Number(avgMatchScore.toFixed(1)),
      recentActivity: {
        newCandidates: recentCandidates,
        newHRs: recentHRs,
        newJobs: recentJobs,
        newApplications: recentApplications
      }
    };

    console.log('📊 Real admin stats fetched:', stats);
    res.json(stats);
  } catch (err) {
    console.error("❌ Error fetching admin stats:", err);
    res.status(500).json({ error: "Error fetching admin statistics" });
  }
};

const getHRDashboardData = async (req, res) => {
  try {
    const [totalJobs, openJobs, closedJobs] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'open' }),
      Job.countDocuments({ status: 'closed' }),
    ]);

    const totalApplications = await Application.countDocuments();

    const avgScoreAgg = await Application.aggregate([
      { $match: { matchScore: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: "$matchScore" } } },
    ]);
    const avgMatchScore = avgScoreAgg[0]?.avg || 0;

    const recentApplications = await Application.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('job', 'title')
      .populate('candidate', 'name email');

    const formatted = recentApplications.map((app) => ({
      _id: app._id,
      name: app.candidate?.name || 'N/A',
      email: app.candidate?.email || 'N/A',
      job: { title: app.job?.title || 'N/A' },
      matchScore: app.matchScore,
    }));

    res.json({
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      avgMatchScore,
      recentApplications: formatted,
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};



module.exports = {
    getAdminStats,
    getHRDashboardData
  };
  