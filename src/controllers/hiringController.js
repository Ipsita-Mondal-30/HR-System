const { syncJobsFromAdzuna } = require('../services/adzunaService');
const { getDashboardAnalytics, saveMonthlySnapshot } = require('../services/hiringAnalyticsService');
const { generateHiringInsights } = require('../services/hiringAIService');
const { matchResumeToJobs } = require('../services/marketJobMatchService');
const MarketJob = require('../models/MarketJob');

exports.syncMarketJobs = async (req, res) => {
  try {
    const result = await syncJobsFromAdzuna({
      country: req.body.country || process.env.ADZUNA_COUNTRY || 'in',
      maxPages: req.body.maxPages || 2,
    });
    const jobs = await MarketJob.find().lean();
    await saveMonthlySnapshot(jobs);
    res.json({ message: 'Market jobs synced successfully', ...result });
  } catch (error) {
    console.error('Adzuna sync failed:', error);
    res.status(500).json({ error: error.message || 'Failed to sync jobs from Adzuna' });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    let analytics = await getDashboardAnalytics();

    if (analytics.needsSync && req.query.autoSync === 'true') {
      try {
        await syncJobsFromAdzuna({ maxPages: 1 });
        analytics = await getDashboardAnalytics();
      } catch (syncErr) {
        console.warn('Auto-sync skipped:', syncErr.message);
      }
    }

    res.json(analytics);
  } catch (error) {
    console.error('Hiring dashboard failed:', error);
    res.status(500).json({ error: 'Failed to load hiring dashboard' });
  }
};

exports.getInsights = async (req, res) => {
  try {
    const insights = await generateHiringInsights(req.query.refresh === 'true');
    res.json(insights);
  } catch (error) {
    console.error('Hiring insights failed:', error);
    res.status(500).json({ error: 'Failed to generate hiring insights' });
  }
};

exports.matchResume = async (req, res) => {
  try {
    const resumeFile = req.file;
    if (!resumeFile?.buffer) {
      return res.status(400).json({ error: 'Resume PDF is required' });
    }

    const result = await matchResumeToJobs({
      resumeSource: resumeFile.buffer,
      limit: parseInt(req.body.limit, 10) || 10,
    });

    res.json(result);
  } catch (error) {
    console.error('Resume matching failed:', error);
    res.status(500).json({ error: error.message || 'Failed to match resume against market jobs' });
  }
};

exports.getJobCount = async (_req, res) => {
  try {
    const count = await MarketJob.countDocuments();
    res.json({ count, lastSynced: await MarketJob.findOne().sort({ fetchedAt: -1 }).select('fetchedAt') });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job count' });
  }
};
