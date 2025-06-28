const Application = require('../models/Application');

// Submit a new application
exports.submitApplication = async (req, res) => {
  try {
    const { name, email, phone, portfolio, jobId } = req.body;
    const resumeUrl = req.file.path;

    const application = await Application.create({
      name,
      email,
      phone,
      portfolio,
      resumeUrl,
      job: jobId,
    });

    res.status(201).json({ message: 'Application submitted', application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
};

// 🔍 View applications (optional filter by job)
exports.getApplications = async (req, res) => {
  try {
    const filter = {};
    if (req.query.job) {
      filter.job = req.query.job;
    }

    const applications = await Application.find(filter)
      .populate('job', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json(applications);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};
