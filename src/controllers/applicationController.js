const Application = require('../models/Application');

exports.submitApplication = async (req, res) => {
    try {
      const { name, email, phone, portfolio, jobId } = req.body;
      const resumeUrl = req.file.path; // this is now Cloudinary URL
  
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
  