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

module.exports = { getAdminStats };
