const Application = require('../models/Application');
const fs = require('fs');
const { sendEmail } = require('../utils/email');
const agent = require('../controllers/agentController'); // or correct path
exports.submitApplication = async (req, res) => {
    try {
      const { name, email, phone, portfolio, jobId } = req.body;
  
      console.log("📩 Incoming Application:", req.body);
      console.log("📎 Uploaded File:", req.file);
  
      if (!req.file) return res.status(400).json({ error: 'Resume is required' });
  
      const resumeUrl = req.file.path;
  
      const application = new Application({
        name,
        email,
        phone,
        portfolio,
        job: jobId,
        resumeUrl,
        user: req.user?._id || null,
      });
      
  
      await application.save();
  
      // ✅ Run the agentic evaluation
    
      await agent.getMatchScore({ params: { applicationId: application._id } }, { json: () => {}, status: () => ({ json: () => {} }) });
  
      res.status(201).json(application);
    } catch (err) {
      console.error('❌ Application submission failed:', err);
      res.status(500).json({ error: 'Server error while submitting application' });
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
// Get all applications for a specific job
exports.getApplicationsByJob = async (req, res) => {
    try {
      const jobId = req.params.jobId;
  
      const applications = await Application.find({ job: jobId })
        .populate('candidate', 'name email')
        .populate('job', 'title')
        .sort({ matchScore: -1 }); // optional: sort by matchScore
  
      res.json(applications);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch applications for this job' });
    }
  };
    
exports.updateApplicationStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const allowedStatuses = ['pending', 'reviewed', 'shortlisted', 'hire_recommended', 'hired', 'rejected'];
      if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
  
      const application = await Application.findById(id).populate('job', 'title companyName');
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
  
      application.status = status;
      await application.save();
  
      if (application.email) {
        try {
          const jobTitle = application.job?.title || 'the position';
          await sendEmail({
            to: application.email,
            subject: `Your application for ${jobTitle} is now ${status}`,
            html: `<p>Hello ${application.name || 'Candidate'},</p>
                   <p>Your application status for <strong>${jobTitle}</strong> has been updated to <b>${status}</b>.</p>
                   <p>Thanks for applying!</p>`
          });
        } catch (emailError) {
          console.error('Failed to send status notification email:', emailError.message);
        }
      }
  
      res.json({ message: 'Status updated successfully', application });
    } catch (error) {
      console.error('Error updating status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Get applications for the logged-in candidate
exports.getMyApplications = async (req, res) => {
    try {
      const userId = req.user._id;
      const userEmail = req.user.email;
      
      console.log('🔍 Fetching applications for user:', { userId, userEmail });
      
      // Find applications by both candidate ID and email to cover all cases
      const applications = await Application.find({
        $or: [
          { candidate: userId },
          { email: userEmail }
        ]
      })
      .populate('job', 'title companyName department location')
      .populate('candidate', 'name email')
      .sort({ createdAt: -1 });
      
      console.log('📋 Found applications:', applications.length);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching candidate's applications:", error);
      res.status(500).json({ error: 'Failed to fetch your applications' });
    }
  };
  
  
  
// Update HR notes for an application
exports.updateNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const application = await Application.findByIdAndUpdate(
      id,
      { hrNotes: notes },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ message: 'Notes updated successfully', application });
  } catch (err) {
    console.error('Error updating notes:', err);
    res.status(500).json({ error: 'Failed to update notes' });
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
    .populate('job', 'title companyName department')
    .populate('candidate', 'name email skills experience')
    .sort({ matchScore: -1, createdAt: -1 }); // NEW: sort by score first
  

    res.status(200).json(applications);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};
