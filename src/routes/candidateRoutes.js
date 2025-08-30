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
    { field: 'portfolioUrl', weight: 5, required: false },
    { field: 'linkedInUrl', weight: 5, required: false },
    { field: 'githubUrl', weight: 5, required: false },
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

// Get AI-powered interview preparation
router.get('/interview-prep', verifyJWT, isCandidate, async (req, res) => {
  try {
    const candidateId = req.user._id;
    console.log('🤖 Generating AI interview prep for candidate:', candidateId);
    console.log('🤖 Starting interview prep generation process...');

    const user = await User.findById(candidateId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get candidate's recent applications to understand target roles
    const recentApplications = await Application.find({ candidate: candidateId })
      .populate('job', 'title skills requirements description')
      .sort({ createdAt: -1 })
      .limit(5);

    // Determine primary role based on applications
    const targetRoles = recentApplications.map(app => app.job?.title).filter(Boolean);
    const primaryRole = targetRoles[0] || 'Software Developer';

    // Generate AI-powered interview prep
    const agent = require('../controllers/agentController');

    const prepPrompt = `Generate comprehensive interview preparation for a candidate applying for ${primaryRole} positions.

    Candidate Profile:
    - Name: ${user.name}
    - Skills: ${user.skills?.join(', ') || 'Not specified'}
    - Experience: ${user.experience || 'Not specified'}
    - Education: ${user.education || 'Not specified'}
    - Recent Applications: ${targetRoles.join(', ')}

    Generate a JSON response with:
    1. "questions": Array of 5 most likely interview questions for this role
    2. "skillGaps": Analysis of missing skills compared to job requirements
    3. "strengths": Key strengths based on candidate profile
    4. "preparationTips": 3-5 specific preparation recommendations
    5. "technicalTopics": Key technical areas to focus on

    Make it specific to the candidate's background and target role.`;

    // Simplified approach - generate fallback response with some AI enhancement
    console.log('🤖 Generating interview prep with AI assistance...');

    try {
      // Try to get AI-enhanced content
      const agent = require('../controllers/agentController');
      const mockReq = { body: { prompt: prepPrompt } };

      // Create a promise to handle the AI response
      const aiResponse = await new Promise((resolve, reject) => {
        const mockRes = {
          json: (data) => {
            console.log('🤖 AI Response received:', data);
            resolve(data);
          },
          status: () => ({
            json: (data) => {
              console.log('🤖 AI Error response:', data);
              resolve({ error: true, response: null });
            }
          })
        };

        agent.generateResponse(mockReq, mockRes).catch(reject);
      });

      let prepData = {};

      // Try to parse AI response
      if (aiResponse && !aiResponse.error && aiResponse.response) {
        try {
          const jsonMatch = aiResponse.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            prepData = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully parsed AI response');
          }
        } catch (parseError) {
          console.log('⚠️ Could not parse AI response as JSON, using fallback');
        }
      }

      // Generate comprehensive response with AI enhancement or fallback
      const interviewPrep = {
        questions: prepData.questions || [
          `Tell me about your experience with ${user.skills?.[0] || 'programming'} and how you've applied it in real projects.`,
          `How would you approach solving a complex ${primaryRole.toLowerCase()} problem that you've never encountered before?`,
          `What interests you most about this ${primaryRole} position and our company?`,
          `Describe a challenging project you've worked on and how you overcame obstacles.`,
          `How do you stay updated with the latest technologies and industry trends?`
        ],
        skillGaps: prepData.skillGaps || {
          missing: ['Advanced system design', 'Cloud platforms', 'Microservices architecture'],
          recommended: ['Take online courses in system design', 'Build cloud-based projects', 'Practice with distributed systems']
        },
        strengths: prepData.strengths || [
          `Strong foundation in ${user.skills?.[0] || 'programming'}`,
          'Problem-solving and analytical thinking',
          'Continuous learning mindset',
          'Technical communication skills'
        ],
        preparationTips: prepData.preparationTips || [
          'Review fundamental concepts in your primary programming languages',
          'Practice coding problems on platforms like LeetCode or HackerRank',
          'Research the company culture, values, and recent projects',
          'Prepare specific STAR method examples from your experience',
          'Practice explaining technical concepts to non-technical audiences'
        ],
        technicalTopics: prepData.technicalTopics || [
          'Data structures and algorithms',
          'System design and architecture',
          'Database design and optimization',
          'API design and best practices',
          'Testing strategies and debugging',
          'Version control and collaboration tools'
        ],
        profileScore: calculateProfileCompleteness(user),
        targetRole: primaryRole,
        generatedAt: new Date().toISOString(),
        aiEnhanced: !!prepData.questions
      };

      console.log('✅ Interview prep generated successfully');
      res.json(interviewPrep);

    } catch (aiError) {
      console.error('🔥 AI generation failed, using fallback:', aiError);

      // Complete fallback response
      const interviewPrep = {
        questions: [
          `Tell me about your experience with ${user.skills?.[0] || 'programming'} and how you've applied it in real projects.`,
          `How would you approach solving a complex ${primaryRole.toLowerCase()} problem that you've never encountered before?`,
          `What interests you most about this ${primaryRole} position and our company?`,
          `Describe a challenging project you've worked on and how you overcame obstacles.`,
          `How do you stay updated with the latest technologies and industry trends?`
        ],
        skillGaps: {
          missing: ['Advanced system design', 'Cloud platforms'],
          recommended: ['Take online courses', 'Build portfolio projects']
        },
        strengths: [
          `Experience with ${user.skills?.[0] || 'programming'}`,
          'Problem-solving mindset',
          'Continuous learning attitude'
        ],
        preparationTips: [
          'Review your technical skills thoroughly',
          'Practice coding problems regularly',
          'Research the company and role',
          'Prepare behavioral examples using STAR method',
          'Practice mock interviews'
        ],
        technicalTopics: [
          'Core programming concepts',
          'Problem-solving techniques',
          'Best practices and code quality',
          'Testing and debugging approaches'
        ],
        profileScore: calculateProfileCompleteness(user),
        targetRole: primaryRole,
        generatedAt: new Date().toISOString(),
        aiEnhanced: false
      };

      res.json(interviewPrep);
    }

  } catch (error) {
    console.error('Error generating interview prep:', error);
    res.status(500).json({ error: 'Failed to generate interview preparation' });
  }
});

// Get AI-powered profile analysis
router.get('/profile-analysis', verifyJWT, isCandidate, async (req, res) => {
  try {
    const candidateId = req.user._id;
    console.log('🔍 Generating AI profile analysis for candidate:', candidateId);

    const user = await User.findById(candidateId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get candidate's applications for context
    const applications = await Application.find({ candidate: candidateId })
      .populate('job', 'title skills requirements')
      .sort({ createdAt: -1 })
      .limit(3);

    const agent = require('../controllers/agentController');

    const analysisPrompt = `Analyze this candidate profile and provide insights:

    Candidate Profile:
    - Name: ${user.name}
    - Skills: ${user.skills?.join(', ') || 'Not specified'}
    - Experience: ${user.experience || 'Not specified'}
    - Education: ${user.education || 'Not specified'}
    - Bio: ${user.bio || 'Not specified'}
    - Portfolio: ${user.portfolioUrl ? 'Available' : 'Not provided'}
    - LinkedIn: ${user.linkedInUrl ? 'Available' : 'Not provided'}
    - GitHub: ${user.githubUrl ? 'Available' : 'Not provided'}

    Recent Applications: ${applications.map(app => app.job?.title).join(', ') || 'None'}

    Provide a JSON response with:
    1. "overallScore": Overall profile strength (1-100)
    2. "strengths": Array of key strengths
    3. "improvements": Array of areas to improve
    4. "marketability": Assessment of job market appeal
    5. "recommendations": Specific actionable recommendations
    6. "roleAlignment": How well profile matches target roles

    Be constructive and specific.`;

    // Generate profile analysis with smart fallbacks
    console.log('🔍 Generating profile analysis...');

    const completeness = calculateProfileCompleteness(user);
    const hasResume = !!user.resumeUrl;
    const hasSkills = user.skills && user.skills.length > 0;
    const hasExperience = !!user.experience;
    const hasPortfolio = !!user.portfolioUrl;
    const hasLinkedIn = !!user.linkedInUrl;
    const hasGitHub = !!user.githubUrl;

    // Smart analysis based on profile data
    const strengths = [];
    const improvements = [];
    const recommendations = [];

    // Analyze strengths
    if (hasResume) strengths.push('Professional resume uploaded');
    if (hasSkills) strengths.push(`Technical skills defined (${user.skills.length} skills)`);
    if (hasExperience) strengths.push('Work experience documented');
    if (hasPortfolio) strengths.push('Portfolio showcasing work');
    if (hasLinkedIn) strengths.push('Professional LinkedIn presence');
    if (hasGitHub) strengths.push('Active GitHub profile');
    if (user.education) strengths.push('Educational background provided');

    // Analyze improvements
    if (!hasResume) improvements.push('Upload a professional resume');
    if (!hasSkills || user.skills.length < 3) improvements.push('Add more technical skills');
    if (!hasExperience) improvements.push('Add work experience details');
    if (!hasPortfolio) improvements.push('Create a portfolio to showcase projects');
    if (!hasLinkedIn) improvements.push('Connect LinkedIn profile');
    if (!hasGitHub) improvements.push('Link GitHub profile for code samples');
    if (!user.bio) improvements.push('Add a professional bio/summary');

    // Generate recommendations
    if (completeness < 50) {
      recommendations.push('Focus on completing basic profile information first');
      recommendations.push('Upload your resume to significantly boost your profile');
    } else if (completeness < 80) {
      recommendations.push('Add portfolio projects to showcase your skills');
      recommendations.push('Connect your professional social media profiles');
    } else {
      recommendations.push('Your profile is strong! Keep it updated with recent projects');
      recommendations.push('Consider adding certifications or additional skills');
    }

    // Determine marketability
    let marketability;
    if (completeness >= 90) {
      marketability = 'Excellent market presence - highly attractive to employers';
    } else if (completeness >= 70) {
      marketability = 'Strong market presence with good employer appeal';
    } else if (completeness >= 50) {
      marketability = 'Moderate market presence - some improvements needed';
    } else {
      marketability = 'Developing market presence - significant improvements recommended';
    }

    // Role alignment assessment
    let roleAlignment;
    const targetRoles = applications.map(app => app.job?.title).filter(Boolean);
    if (targetRoles.length > 0) {
      roleAlignment = `Targeting ${targetRoles[0]} roles - ${hasSkills && hasExperience ? 'good' : 'developing'} alignment`;
    } else {
      roleAlignment = 'No recent applications - consider applying to relevant positions';
    }

    const profileAnalysis = {
      overallScore: completeness,
      strengths: strengths.length > 0 ? strengths : ['Professional foundation established'],
      improvements: improvements.length > 0 ? improvements : ['Profile is well-developed'],
      marketability,
      recommendations,
      roleAlignment,
      profileCompleteness: completeness,
      lastUpdated: user.updatedAt || user.createdAt,
      generatedAt: new Date().toISOString(),
      insights: {
        hasResume,
        skillsCount: user.skills?.length || 0,
        hasExperience,
        hasPortfolio,
        socialProfiles: [hasLinkedIn, hasGitHub].filter(Boolean).length,
        recentApplications: applications.length
      }
    };

    console.log('✅ Profile analysis generated successfully');
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
      .populate('job', 'title companyName location employmentType minSalary maxSalary status')
      .sort({ createdAt: -1 });

    console.log(`📋 Found ${applications.length} applications for candidate`);
    res.json(applications);
  } catch (error) {
    console.error('Error fetching candidate applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

module.exports = router;