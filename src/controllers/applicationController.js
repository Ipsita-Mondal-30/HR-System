const Application = require('../models/Application');
const { uploadResume } = require('../config/cloudinary');
const fs = require('fs');

exports.submitApplication = async (req, res) => {
    try {
      console.log("🛰️ Incoming Request: POST /api/applications");
      console.log("📦 Body:", JSON.stringify(req.body, null, 2));
      if (req.file) {
        console.log("📎 File Info:", req.file);
      } else {
        console.log("⚠️ No file attached!");
      }
  
      const { name, email, phone, portfolio, jobId } = req.body;
      const file = req.file;
  
      if (!file) {
        return res.status(400).json({ error: 'Resume file is required' });
      }
  
      const resumeUrl = await uploadResume(file.path);
  
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
