const Job = require('../models/Job');
const Application = require('../models/Application');

const getOverviewStats = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const openJobs = await Job.countDocuments({ status: 'open' });
    const closedJobs = await Job.countDocuments({ status: 'closed' });

    const totalApplications = await Application.countDocuments();

    const appsWithScores = await Application.find({ 'matchInsights.matchScore': { $exists: true } });
    const avgMatchScore =
      appsWithScores.reduce((acc, app) => acc + app.matchInsights.matchScore, 0) /
      (appsWithScores.length || 1);

    res.json({
      totalJobs,
      totalApplications,
      avgMatchScore: avgMatchScore.toFixed(2),
      openJobs,
      closedJobs,
    });
  } catch (err) {
    console.error('📉 Analytics Error:', err);
    res.status(500).json({ error: 'Failed to fetch overview stats' });
  }
};
const getMatchDistribution = async (req, res) => {
    try {
      const applications = await Application.find({
        'matchInsights.matchScore': { $exists: true }
      });
  
      let low = 0, medium = 0, high = 0;
  
      applications.forEach(app => {
        const score = app.matchInsights?.matchScore || 0;
        if (score < 50) low++;
        else if (score < 80) medium++;
        else high++;
      });
  
      res.json({ low, medium, high });
    } catch (err) {
      console.error("🔥 Analytics Error:", err.message);
      res.status(500).json({ error: "Failed to calculate match distribution" });
    }
  };
  const getSummary = async (req, res) => {
    try {
      const jobs = await Job.find().select('title status createdAt');
      const applications = await Application.find().select('name email matchInsights job');
  
      res.json({
        jobs,
        applications,
      });
    } catch (err) {
      console.error("📉 Summary Error:", err.message);
      res.status(500).json({ error: "Failed to fetch summary" });
    }
  };
  
  
// ... existing code ...
module.exports = { getOverviewStats, getSummary, getMatchDistribution };

