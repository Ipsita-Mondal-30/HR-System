const express = require('express');
const router = express.Router();
const { verifyJWT, isCandidate } = require('../middleware/auth');
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');

// Get saved jobs for candidate
router.get('/saved-jobs', verifyJWT, isCandidate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('savedJobs');
    res.json(user.savedJobs || []);
  } catch (err) {
    console.error('Error fetching saved jobs:', err);
    res.status(500).json({ error: 'Failed to fetch saved jobs' });
  }
});

// Save a job
router.post('/save-job', verifyJWT, isCandidate, async (req, res) => {
  try {
    const { jobId } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user.savedJobs) {
      user.savedJobs = [];
    }
    
    if (!user.savedJobs.includes(jobId)) {
      user.savedJobs.push(jobId);
      await user.save();
    }
    
    res.json({ message: 'Job saved successfully' });
  } catch (err) {
    console.error('Error saving job:', err);
    res.status(500).json({ error: 'Failed to save job' });
  }
});

// Remove saved job
router.delete('/saved-jobs/:jobId', verifyJWT, isCandidate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (user.savedJobs) {
      user.savedJobs = user.savedJobs.filter(id => id.toString() !== jobId);
      await user.save();
    }
    
    res.json({ message: 'Job removed from saved list' });
  } catch (err) {
    console.error('Error removing saved job:', err);
    res.status(500).json({ error: 'Failed to remove saved job' });
  }
});

// Get candidate profile
router.get('/profile', verifyJWT, isCandidate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update candidate profile
router.put('/profile', verifyJWT, isCandidate, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get candidate dashboard stats
router.get('/dashboard-stats', verifyJWT, isCandidate, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const [applications, user] = await Promise.all([
      Application.find({ candidate: userId }),
      User.findById(userId).populate('savedJobs')
    ]);
    
    const stats = {
      totalApplications: applications.length,
      pendingApplications: applications.filter(app => app.status === 'pending').length,
      shortlistedApplications: applications.filter(app => app.status === 'shortlisted').length,
      rejectedApplications: applications.filter(app => app.status === 'rejected').length,
      savedJobs: user.savedJobs ? user.savedJobs.length : 0,
      profileCompleteness: calculateProfileCompleteness(user)
    };
    
    res.json(stats);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Apply to a job with resume upload, AI scoring and email notifications
router.post('/apply-with-resume', verifyJWT, isCandidate, async (req, res) => {
  const upload = require('../middleware/upload');
  
  // Use multer middleware for file upload
  upload.single('resume')(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ error: 'File upload failed' });
    }

    try {
      const { 
        jobId, 
        coverLetter, 
        portfolio, 
        linkedIn, 
        github, 
        expectedSalary, 
        availableStartDate, 
        whyInterested,
        phone,
        location,
        experience
      } = req.body;
      
      const user = await User.findById(req.user._id);
      const Job = require('../models/Job');
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already applied
      const existingApplication = await Application.findOne({
        candidate: user._id,
        job: jobId
      });

      if (existingApplication) {
        return res.status(400).json({ error: 'You have already applied to this job' });
      }

      // Get job details
      const job = await Job.findById(jobId).populate('department', 'name');
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Get resume URL from uploaded file
      const resumeUrl = req.file ? req.file.path : user.resumeUrl || '';

      // Create application with comprehensive data
      const application = new Application({
        name: user.name,
        email: user.email,
        phone: phone || user.phone || '',
        portfolio: portfolio || user.portfolio || '',
        job: jobId,
        candidate: user._id,
        resumeUrl: resumeUrl,
        status: 'pending',
        coverLetter: coverLetter || '',
        resumeText: `Name: ${user.name}. Email: ${user.email}. Phone: ${phone || user.phone || 'Not provided'}. Location: ${location || user.location || 'Not provided'}. Experience: ${experience || user.experience || 'Not specified'}. Skills: ${user.skills?.join(', ') || 'Not specified'}. Bio: ${user.bio || 'Not specified'}. Why interested: ${whyInterested || 'Not specified'}.`,
        // Additional application fields
        applicationData: {
          linkedIn: linkedIn || user.linkedIn || '',
          github: github || user.github || '',
          expectedSalary: expectedSalary || user.expectedSalary || '',
          availableStartDate: availableStartDate || '',
          whyInterested: whyInterested || ''
        }
      });

      await application.save();

      // Update user profile with new information if provided
      const updateData = {};
      if (phone && !user.phone) updateData.phone = phone;
      if (location && !user.location) updateData.location = location;
      if (experience && !user.experience) updateData.experience = experience;
      if (expectedSalary && !user.expectedSalary) updateData.expectedSalary = expectedSalary;
      if (resumeUrl && !user.resumeUrl) updateData.resumeUrl = resumeUrl;

      if (Object.keys(updateData).length > 0) {
        await User.findByIdAndUpdate(user._id, updateData);
      }

      // Run AI scoring in background
      try {
        const agent = require('../controllers/agentController');
        console.log('🤖 Starting AI analysis for application:', application._id);
        
        // Create a mock response object for the agent controller
        const mockRes = {
          json: (data) => {
            console.log('✅ AI analysis completed:', data);
            // Update the application with AI insights
            Application.findByIdAndUpdate(application._id, {
              matchScore: data.matchScore,
              matchInsights: {
                explanation: data.explanation,
                matchingSkills: data.matchingSkills || [],
                missingSkills: data.missingSkills || [],
                tags: data.tags || []
              }
            }).catch(err => console.error('Error updating AI insights:', err));
          },
          status: (code) => ({
            json: (data) => {
              console.log('AI analysis status:', code, data);
              if (code !== 200) {
                console.error('AI analysis failed:', data);
              }
            }
          })
        };

        await agent.getMatchScore(
          { params: { applicationId: application._id } }, 
          mockRes
        );
      } catch (agentError) {
        console.error('AI scoring failed:', agentError);
        // Don't fail the application if AI scoring fails
      }

      // Send confirmation email to candidate
      try {
        const { sendEmail } = require('../utils/email');
        await sendEmail({
          to: user.email,
          subject: `Application Submitted: ${job.title} at ${job.companyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Application Submitted Successfully! 🎉</h2>
              
              <p>Dear ${user.name},</p>
              
              <p>Thank you for applying to <strong>${job.title}</strong> at <strong>${job.companyName}</strong>.</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #374151;">Job Details:</h3>
                <p><strong>Position:</strong> ${job.title}</p>
                <p><strong>Company:</strong> ${job.companyName}</p>
                <p><strong>Location:</strong> ${job.location || 'Not specified'}</p>
                <p><strong>Department:</strong> ${job.department?.name || 'Not specified'}</p>
              </div>
              
              <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0;"><strong>⚠️ Important Note:</strong> Our AI system will analyze your application and provide an initial match score. Please note that this score is for preliminary screening only and is not the final decision. The HR team will review all applications thoroughly.</p>
              </div>
              
              <p>What happens next:</p>
              <ul>
                <li>Our AI system will analyze your profile and provide a match score</li>
                <li>HR team will review your application</li>
                <li>You'll receive updates on your application status</li>
                <li>If selected, we'll contact you for the next steps</li>
              </ul>
              
              <p>You can track your application status in your candidate dashboard.</p>
              
              <p>Best of luck!</p>
              <p>The ${job.companyName} Hiring Team</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the application if email fails
      }

      // Populate the job details for response
      await application.populate('job', 'title companyName location');

      res.status(201).json({
        message: 'Application submitted successfully! You will receive a confirmation email shortly.',
        application
      });
    } catch (err) {
      console.error('Error applying to job:', err);
      res.status(500).json({ error: 'Failed to submit application' });
    }
  });
});

// Apply to a job with AI scoring and email notifications (fallback without resume)
router.post('/apply', verifyJWT, isCandidate, async (req, res) => {
  try {
    const { 
      jobId, 
      coverLetter, 
      portfolio, 
      linkedIn, 
      github, 
      expectedSalary, 
      availableStartDate, 
      whyInterested 
    } = req.body;
    const user = await User.findById(req.user._id);
    const Job = require('../models/Job');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      candidate: user._id,
      job: jobId
    });

    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied to this job' });
    }

    // Get job details
    const job = await Job.findById(jobId).populate('department', 'name');
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Create application using user's profile data and form data
    const application = new Application({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      portfolio: portfolio || user.portfolio || '',
      job: jobId,
      candidate: user._id,
      resumeUrl: user.resumeUrl || '',
      status: 'pending',
      coverLetter: coverLetter || '',
      resumeText: `Skills: ${user.skills?.join(', ') || 'Not specified'}. Experience: ${user.experience || 'Not specified'}. Bio: ${user.bio || 'Not specified'}. Why interested: ${whyInterested || 'Not specified'}.`,
      // Additional application fields
      applicationData: {
        linkedIn: linkedIn || user.linkedIn || '',
        github: github || user.github || '',
        expectedSalary: expectedSalary || user.expectedSalary || '',
        availableStartDate: availableStartDate || '',
        whyInterested: whyInterested || ''
      }
    });

    await application.save();

    // Run AI scoring in background
    try {
      const agent = require('../controllers/agentController');
      await agent.getMatchScore(
        { params: { applicationId: application._id } }, 
        { 
          json: (data) => console.log('AI scoring completed:', data),
          status: (code) => ({ json: (data) => console.log('AI scoring status:', code, data) })
        }
      );
    } catch (agentError) {
      console.error('AI scoring failed:', agentError);
      // Don't fail the application if AI scoring fails
    }

    // Send confirmation email to candidate
    try {
      const { sendEmail } = require('../utils/email');
      await sendEmail({
        to: user.email,
        subject: `Application Submitted: ${job.title} at ${job.companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Application Submitted Successfully! 🎉</h2>
            
            <p>Dear ${user.name},</p>
            
            <p>Thank you for applying to <strong>${job.title}</strong> at <strong>${job.companyName}</strong>.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Job Details:</h3>
              <p><strong>Position:</strong> ${job.title}</p>
              <p><strong>Company:</strong> ${job.companyName}</p>
              <p><strong>Location:</strong> ${job.location || 'Not specified'}</p>
              <p><strong>Department:</strong> ${job.department?.name || 'Not specified'}</p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0;"><strong>⚠️ Important Note:</strong> Our AI system will analyze your application and provide an initial match score. Please note that this score is for preliminary screening only and is not the final decision. The HR team will review all applications thoroughly.</p>
            </div>
            
            <p>What happens next:</p>
            <ul>
              <li>Our AI system will analyze your profile and provide a match score</li>
              <li>HR team will review your application</li>
              <li>You'll receive updates on your application status</li>
              <li>If selected, we'll contact you for the next steps</li>
            </ul>
            
            <p>You can track your application status in your candidate dashboard.</p>
            
            <p>Best of luck!</p>
            <p>The ${job.companyName} Hiring Team</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the application if email fails
    }

    // Populate the job details for response
    await application.populate('job', 'title companyName location');

    res.status(201).json({
      message: 'Application submitted successfully! You will receive a confirmation email shortly.',
      application
    });
  } catch (err) {
    console.error('Error applying to job:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Helper function to calculate profile completeness
function calculateProfileCompleteness(user) {
  const fields = [
    user.name,
    user.email,
    user.phone,
    user.location,
    user.expectedSalary,
    user.experience,
    user.bio,
    user.resumeUrl,
    user.skills && user.skills.length > 0 ? 'skills' : null
  ];
  
  const completedFields = fields.filter(field => field && field.toString().trim()).length;
  return Math.round((completedFields / fields.length) * 100);
}

module.exports = router;