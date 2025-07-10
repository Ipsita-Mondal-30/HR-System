// controllers/adminController.js
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Department = require('../models/Department');
const Role = require('../models/Role');

const getAdminStats = async (req, res) => {
  try {
    const [jobsCount, applicationsCount, hrCount, candidateCount, departmentsCount, rolesCount, matchStats] =
      await Promise.all([
        Job.countDocuments(),
        Application.countDocuments(),
        User.countDocuments({ role: 'hr' }),
        User.countDocuments({ role: 'candidate' }),
        Department.countDocuments(),
        Role.countDocuments(),
        Application.aggregate([
          { $group: { _id: null, avgScore: { $avg: "$matchScore" } } }
        ])
      ]);

    const avgMatchScore = matchStats[0]?.avgScore || 0;

    res.json({
      jobsCount,
      applicationsCount,
      hrCount,
      candidateCount,
      departmentsCount,
      rolesCount,
      avgMatchScore: avgMatchScore.toFixed(2)
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
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
  