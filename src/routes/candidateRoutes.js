const express = require('express');
const router = express.Router();
const { verifyJWT, isCandidate } = require('../middleware/auth');
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Interview = require('../models/Interview');

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
    const userWithCompleteness = {
      ...user.toObject(),
      profileCompleteness: calculateProfileCompleteness(user)
    };
    res.json(userWithCompleteness);
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

    const userWithCompleteness = {
      ...user.toObject(),
      profileCompleteness: calculateProfileCompleteness(user)
    };

    res.json(userWithCompleteness);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get candidate dashboard stats
router.get('/dashboard-stats', verifyJWT, isCandidate, async (req, res) => {
  try {
    const userId = req.user._id;

    const [applications, user, interviews] = await Promise.all([
      Application.find({ candidate: userId }),
      User.findById(userId).populate('savedJobs'),
      Interview.find({
        application: { $in: await Application.find({ candidate: userId }).distinct('_id') }
      })
    ]);

    const stats = {
      totalApplications: applications.length,
      pendingApplications: applications.filter(app => app.status === 'pending').length,
      shortlistedApplications: applications.filter(app => app.status === 'shortlisted').length,
      rejectedApplications: applications.filter(app => app.status === 'rejected').length,
      savedJobs: user.savedJobs ? user.savedJobs.length : 0,
      profileCompleteness: calculateProfileCompleteness(user),
      scheduledInterviews: interviews.filter(interview =>
        interview.status === 'scheduled' && new Date(interview.scheduledAt) > new Date()
      ).length
    };

    console.log(`📊 Dashboard stats for candidate ${user.email}:`, stats);
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
      let message = 'File upload failed. Please use a PDF, DOC, or DOCX under 5MB.';
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'Resume must be 5MB or smaller.';
      } else if (err.message?.includes('Only PDF, DOC, and DOCX')) {
        message = err.message;
      } else if (err.message?.includes('file format') || err.message?.includes('not allowed')) {
        message = 'Resume must be a PDF, DOC, or DOCX file (max 5MB).';
      }
      return res.status(400).json({ error: message });
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

      // Get resume URL from uploaded file (Cloudinary sets path to secure_url)
      const resumeUrl = req.file
        ? req.file.path || req.file.secure_url || req.file.url || ''
        : user.resumeUrl || '';

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

      // Store resume file metadata
      if (req.file) {
        application.resumeFile = {
          originalName: req.file.originalname,
          url: resumeUrl,
          mimeType: req.file.mimetype || 'application/pdf',
          sizeBytes: req.file.size,
          uploadedAt: new Date(),
        };
      }

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

      // Run Groq ATS analysis in background
      (async () => {
      try {
        const { analyzeApplicationById } = require('../services/applicationAnalysisService');
        console.log('🤖 Starting Groq ATS analysis for application:', application._id);
        await analyzeApplicationById(application._id.toString(), {
          createdBy: user._id,
          sendEmails: true,
        });
        console.log('✅ Groq ATS analysis completed for application:', application._id);
      } catch (agentError) {
          console.error('❌ Groq ATS analysis failed:', agentError.message);
      }
      })();

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

      // Create notification for job applied
      try {
        const notificationService = require('../services/notificationService');
        await notificationService.notifyJobApplied(
          user._id,
          job._id,
          job.title,
          job.companyName
        );
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
        // Don't fail the application if notification fails
      }

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

    // Run AI scoring in background (don't await - let it run async)
    (async () => {
    try {
      const agent = require('../controllers/agentController');
        console.log('🤖 Starting AI analysis for application:', application._id);

        const mockRes = {
          json: (data) => {
            console.log('✅ AI analysis completed:', data);
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

        // Call agent controller - this will send emails to HR and candidate
        await agent.getMatchScore(
          { params: { applicationId: application._id.toString() } },
          mockRes
      );
    } catch (agentError) {
        console.error('❌ AI scoring failed:', agentError);
      // Don't fail the application if AI scoring fails
    }
    })();

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

    // Create notification for job applied
    try {
      const notificationService = require('../services/notificationService');
      await notificationService.notifyJobApplied(
        user._id,
        job._id,
        job.title,
        job.companyName
      );
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail the application if notification fails
    }

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
  if (!user) return 0;

  // Comprehensive profile fields with weights
  const profileFields = [
    // Basic Information (30% weight)
    { field: 'name', weight: 5, required: true },
    { field: 'email', weight: 5, required: true },
    { field: 'phone', weight: 5, required: false },
    { field: 'location', weight: 5, required: false },
    { field: 'bio', weight: 10, required: false },

    // Professional Information (40% weight)
    { field: 'resumeUrl', weight: 15, required: true },
    { field: 'experience', weight: 10, required: false },
    { field: 'skills', weight: 10, required: true },
    { field: 'education', weight: 5, required: false },

    // Portfolio & Links (20% weight)
    { field: 'portfolio', weight: 5, required: false },
    { field: 'linkedIn', weight: 5, required: false },
    { field: 'github', weight: 5, required: false },
    { field: 'website', weight: 5, required: false },

    // Additional Information (10% weight)
    { field: 'projects', weight: 5, required: false },
    { field: 'certifications', weight: 3, required: false },
    { field: 'languages', weight: 2, required: false }
  ];

  let totalWeight = 0;
  let completedWeight = 0;

  profileFields.forEach(({ field, weight, required }) => {
    totalWeight += weight;
    const value = user[field];

    if (value) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          completedWeight += weight;
        }
      } else if (typeof value === 'string') {
        if (value.trim().length > 0) {
          completedWeight += weight;
        }
      } else if (typeof value === 'object' && value !== null) {
        // For nested objects like education, projects
        if (Object.keys(value).length > 0) {
          completedWeight += weight;
        }
      } else {
        completedWeight += weight;
      }
    } else if (required) {
      // Penalize missing required fields
      completedWeight -= weight * 0.1;
    }
  });

  const percentage = Math.max(0, Math.round((completedWeight / totalWeight) * 100));
  console.log(`📊 Profile completeness for ${user.email}: ${percentage}% (${completedWeight}/${totalWeight})`);

  return percentage;
}

// Get candidate's interviews
router.get('/interviews', verifyJWT, isCandidate, async (req, res) => {
  try {
    const candidateId = req.user._id;
    console.log('🔍 Fetching interviews for candidate:', candidateId);

    const Interview = require('../models/Interview');

    // Find interviews for this candidate
    const interviews = await Interview.find()
      .populate({
        path: 'application',
        match: { candidate: candidateId },
        populate: [
          { path: 'candidate', select: 'name email' },
          { path: 'job', select: 'title companyName' }
        ]
      })
      .populate('interviewer', 'name email')
      .sort({ scheduledAt: -1 });

    // Filter out interviews where application is null (not for this candidate)
    const candidateInterviews = interviews.filter(interview => interview.application);

    console.log(`📅 Found ${candidateInterviews.length} interviews for candidate`);
    res.json(candidateInterviews);
  } catch (error) {
    console.error('Error fetching candidate interviews:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Get AI-powered interview preparation (recent voice interview + Gemini insights)
router.get('/interview-prep', verifyJWT, isCandidate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const applications = await Application.find({ candidate: req.user._id })
      .populate('job', 'title skills requirements description companyName')
      .sort({ createdAt: -1 })
      .limit(5);

    const dashboardAIService = require('../services/dashboardAIService');
    const data = await dashboardAIService.generateInterviewPrepDashboard(user, applications);
    res.json(data);
  } catch (error) {
    console.error('Error generating interview prep:', error);
    res.status(500).json({ error: 'Failed to generate interview preparation' });
  }
});

// Get AI-powered profile analysis (resume + job market + Gemini/Cohere)
router.get('/profile-analysis', verifyJWT, isCandidate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const applications = await Application.find({ candidate: req.user._id })
      .populate('job', 'title skills requirements companyName')
      .sort({ createdAt: -1 })
      .limit(5);

    const dashboardAIService = require('../services/dashboardAIService');
    const profileAnalysis = await dashboardAIService.generateProfileAnalysis(
      user,
      applications,
      calculateProfileCompleteness
    );
    res.json(profileAnalysis);
  } catch (error) {
    console.error('Error generating profile analysis:', error);
    res.status(500).json({ error: 'Failed to generate profile analysis' });
  }
});


// Get candidate's applications
router.get('/applications', verifyJWT, isCandidate, async (req, res) => {
  try {
    const candidateId = req.user._id;
    console.log('📋 Fetching applications for candidate:', candidateId);

    const applications = await Application.find({ candidate: candidateId })
      .populate({
        path: 'job',
        select: 'title companyName location employmentType minSalary maxSalary status skills description',
        populate: { path: 'department', select: 'name' },
      })
      .sort({ createdAt: -1 });

    console.log(`📋 Found ${applications.length} applications for candidate`);
    res.json(applications);
  } catch (error) {
    console.error('Error fetching candidate applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Gemini AI analysis for a single application (candidate)
router.post('/applications/:id/analyze', verifyJWT, isCandidate, async (req, res) => {
  try {
    const candidateId = req.user._id;
    const application = await Application.findOne({
      _id: req.params.id,
      candidate: candidateId,
    }).populate({
      path: 'job',
      populate: { path: 'department', select: 'name' },
    });

    if (!application || !application.job) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const user = await User.findById(candidateId);
    const geminiService = require('../services/geminiService');
    const axios = require('axios');
    const pdfParse = require('pdf-parse');

    let resumeText = application.resumeText || '';
    if (!resumeText && application.resumeUrl?.startsWith('http')) {
      try {
        const pdfRes = await axios.get(application.resumeUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
        });
        const parsed = await pdfParse(pdfRes.data);
        resumeText = parsed.text || '';
      } catch (e) {
        console.warn('Resume parse skipped:', e.message);
      }
    }
    if (!resumeText && user) {
      resumeText = [
        `Name: ${user.name}`,
        `Skills: ${(user.skills || []).join(', ')}`,
        `Experience: ${user.experience || 'N/A'}`,
        `Bio: ${user.bio || ''}`,
        application.coverLetter ? `Cover: ${application.coverLetter}` : '',
      ]
        .filter(Boolean)
        .join('. ');
    }

    const { matchScore, matchInsights } = await geminiService.analyzeApplication({
      jobTitle: application.job.title,
      companyName: application.job.companyName,
      jobDescription: application.job.description || '',
      jobSkills: application.job.skills || [],
      resumeText,
      coverLetter: application.coverLetter || application.applicationData?.whyInterested || '',
      candidateSkills: user?.skills || [],
      candidateExperience: user?.experience || '',
      applicationStatus: application.status,
    });

    application.matchScore = matchScore;
    application.matchInsights = matchInsights;
    if (resumeText && !application.resumeText) {
      application.resumeText = resumeText.slice(0, 15000);
    }
    await application.save();

    res.json({
      matchScore: application.matchScore,
      matchInsights: application.matchInsights,
    });
  } catch (error) {
    console.error('Error analyzing application:', error);
    res.status(500).json({ error: 'Failed to generate AI analysis' });
  }
});

module.exports = router;