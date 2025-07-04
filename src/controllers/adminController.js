const Job = require('../models/Job');
const Application = require('../models/Application');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const totalApplications = await Application.countDocuments();

    const matchScores = await Application.aggregate([
      { $match: { matchScore: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: "$matchScore" } } }
    ]);

    const openJobs = await Job.countDocuments({ status: 'open' });
    const closedJobs = await Job.countDocuments({ status: 'closed' });

    res.json({
      totalJobs,
      totalApplications,
      avgMatchScore: parseFloat((matchScores[0]?.avg || 0).toFixed(2)),

      openJobs,
      closedJobs
    });
  } catch (err) {
    console.error("❌ Dashboard Error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};
