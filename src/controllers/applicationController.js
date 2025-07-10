const Application = require('../models/Application');
const fs = require('fs');

exports.submitApplication = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    const { name, email, phone, portfolio, jobId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Resume file is required' });
    }

    const resumeUrl = file.path; // Cloudinary URL

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
    console.error('❌ Application Error:', err);
    res.status(500).json({ error: 'Failed to submit application', details: err.message });
  }
};
exports.getAllApplications = async (req, res) => {
    try {
      const apps = await Application.find()
        .populate('candidate', 'name email')
        .populate({
          path: 'job',
          select: 'title department',
          populate: { path: 'department', select: 'name' }
        });
      res.json(apps);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch applications' });
    }
  };
  

  exports.getApplicationById = async (req, res) => {
    try {
      const application = await Application.findById(req.params.id)
        .populate('job', 'title department')
        .populate('candidate', 'name email');
  
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
  
      res.json(application);
    } catch (err) {
      console.error('🔥 Error in getApplicationById:', err); // 👈 LOG THIS
      res.status(500).json({ error: 'Failed to fetch application' });
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
    .sort({ matchScore: -1, createdAt: -1 }); // NEW: sort by score first
  

    res.status(200).json(applications);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};
