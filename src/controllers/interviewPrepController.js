const InterviewFeedback = require('../models/InterviewFeedback');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const { transcribeMultiple } = require('../services/assemblyAIService');
const { generateInterviewFeedback } = require('../services/cohereService');
const { sendEmail } = require('../services/emailService');

/**
 * Get jobs that candidate has applied to (for interview prep selection)
 */
exports.getAppliedJobs = async (req, res) => {
  try {
    const candidateId = req.user._id;
    
    const applications = await Application.find({ candidate: candidateId })
      .populate('job', 'title companyName location skills requirements')
      .sort({ createdAt: -1 });

    const jobs = applications
      .filter(app => app.job)
      .map(app => ({
        _id: app.job._id,
        title: app.job.title,
        companyName: app.job.companyName,
        location: app.job.location,
        skills: app.job.skills,
        requirements: app.job.requirements,
        appliedAt: app.createdAt,
        applicationStatus: app.status
      }));

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching applied jobs:', error);
    res.status(500).json({ error: 'Failed to fetch applied jobs' });
  }
};

/**
 * Generate interview questions for a specific job
 */
exports.generateQuestions = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Generate 5-7 relevant questions based on job details
    const questions = [
      `Tell me about your experience with ${job.skills?.[0] || 'the required technologies'} and how you've applied it in real projects.`,
      `Why are you interested in the ${job.title} position at ${job.companyName}?`,
      `Describe a challenging project you've worked on that relates to this role. What was your approach and what did you learn?`,
      `How do you stay updated with the latest trends and technologies in ${job.skills?.[0] || 'your field'}?`,
      `Tell me about a time when you had to work under pressure or meet a tight deadline. How did you handle it?`
    ];

    // Add technical question if skills are specified
    if (job.skills && job.skills.length > 1) {
      questions.push(`How would you approach a problem that requires ${job.skills[1]}? Walk me through your thought process.`);
    }

    // Add behavioral question
    questions.push(`Where do you see yourself in the next 2-3 years, and how does this role fit into your career goals?`);

    res.json({
      jobId: job._id,
      jobTitle: job.title,
      companyName: job.companyName,
      questions: questions.slice(0, 7)
    });
  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
};

/**
 * Submit interview practice session with video recordings
 */
exports.submitPracticeSession = async (req, res) => {
  try {
    const candidateId = req.user._id;
    const { jobId, recordings } = req.body;

    // Validate input
    if (!jobId || !recordings || recordings.length === 0) {
      return res.status(400).json({ error: 'Job ID and recordings are required' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const user = await User.findById(candidateId);

    // Create feedback record
    const feedback = new InterviewFeedback({
      candidate: candidateId,
      job: jobId,
      questions: recordings.map(r => ({
        question: r.question,
        videoUrl: r.videoUrl,
        duration: r.duration
      })),
      status: 'processing'
    });

    await feedback.save();

    // Process in background (don't wait for completion)
    processInterviewFeedback(feedback._id, recordings, job, user).catch(err => {
      console.error('Background processing error:', err);
    });

    res.json({
      message: 'Interview practice submitted successfully! You will receive feedback via email shortly.',
      feedbackId: feedback._id
    });
  } catch (error) {
    console.error('Error submitting practice session:', error);
    res.status(500).json({ error: 'Failed to submit practice session' });
  }
};

/**
 * Background processing of interview feedback
 */
async function processInterviewFeedback(feedbackId, recordings, job, user) {
  try {
    console.log(`🎬 Processing interview feedback ${feedbackId}`);

    // Step 1: Transcribe all video recordings
    console.log('🎙️ Transcribing recordings...');
    const videoUrls = recordings.map(r => r.videoUrl);
    
    let transcriptions;
    try {
      transcriptions = await transcribeMultiple(videoUrls);
    } catch (transcribeError) {
      console.error('Transcription failed, using fallback:', transcribeError);
      // Use fallback: empty transcriptions
      transcriptions = recordings.map(() => 'Audio transcription unavailable');
    }

    // Update feedback with transcriptions
    const questionsWithTranscriptions = recordings.map((r, i) => ({
      question: r.question,
      videoUrl: r.videoUrl,
      transcription: transcriptions[i],
      duration: r.duration
    }));

    // Step 2: Generate AI feedback
    console.log('🤖 Generating AI feedback...');
    const questionsAndAnswers = recordings.map((r, i) => ({
      question: r.question,
      answer: transcriptions[i]
    }));

    const aiFeedback = await generateInterviewFeedback(questionsAndAnswers, {
      title: job.title,
      requirements: job.requirements || job.description
    });

    // Step 3: Update feedback record
    await InterviewFeedback.findByIdAndUpdate(feedbackId, {
      questions: questionsWithTranscriptions,
      feedback: aiFeedback,
      status: 'completed',
      completedAt: new Date()
    });

    // Step 4: Send email with feedback
    console.log('📧 Sending feedback email...');
    await sendFeedbackEmail(user, job, aiFeedback);

    await InterviewFeedback.findByIdAndUpdate(feedbackId, {
      emailSent: true
    });

    console.log('✅ Interview feedback processing completed');
  } catch (error) {
    console.error('❌ Error processing interview feedback:', error);
    
    // Update status to failed
    await InterviewFeedback.findByIdAndUpdate(feedbackId, {
      status: 'failed'
    });
  }
}

/**
 * Send feedback email to candidate
 */
async function sendFeedbackEmail(user, job, feedback) {
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Your Interview Practice Feedback 🎯</h2>
      
      <p>Hi ${user.name},</p>
      
      <p>Thank you for completing the interview practice session for <strong>${job.title}</strong> at <strong>${job.companyName}</strong>.</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #374151;">Overall Score: ${feedback.overallScore}/10</h3>
        <p style="font-size: 16px; color: #6b7280;">${feedback.summary}</p>
      </div>

      <div style="margin: 30px 0;">
        <h3 style="color: #059669;">✅ Your Strengths:</h3>
        <ul style="color: #374151;">
          ${feedback.strengths.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>

      <div style="margin: 30px 0;">
        <h3 style="color: #dc2626;">📈 Areas for Improvement:</h3>
        <ul style="color: #374151;">
          ${feedback.improvements.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>

      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #92400e;">Detailed Feedback:</h3>
        
        <p><strong>Communication Clarity:</strong> ${feedback.communicationClarity.score}/10</p>
        <p style="color: #6b7280; margin-left: 20px;">${feedback.communicationClarity.comments}</p>
        
        <p><strong>Confidence:</strong> ${feedback.confidence.score}/10</p>
        <p style="color: #6b7280; margin-left: 20px;">${feedback.confidence.comments}</p>
        
        <p><strong>Relevance:</strong> ${feedback.relevance.score}/10</p>
        <p style="color: #6b7280; margin-left: 20px;">${feedback.relevance.comments}</p>
        
        <p><strong>Technical Accuracy:</strong> ${feedback.technicalAccuracy.score}/10</p>
        <p style="color: #6b7280; margin-left: 20px;">${feedback.technicalAccuracy.comments}</p>
      </div>

      <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>💡 Next Steps:</strong></p>
        <ul style="color: #374151;">
          <li>Review the feedback and work on the improvement areas</li>
          <li>Practice more with different questions</li>
          <li>Record yourself and watch for body language and tone</li>
          <li>Research the company and role thoroughly</li>
        </ul>
      </div>

      <p>Keep practicing and you'll continue to improve! Good luck with your job search.</p>
      
      <p>Best regards,<br>The Talora Team</p>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: `Your Interview Prep Feedback - ${job.title}`,
    html: emailHtml
  });
}

/**
 * Get candidate's interview feedback history
 */
exports.getFeedbackHistory = async (req, res) => {
  try {
    const candidateId = req.user._id;
    
    const feedbackHistory = await InterviewFeedback.find({ candidate: candidateId })
      .populate('job', 'title companyName')
      .sort({ createdAt: -1 });

    res.json(feedbackHistory);
  } catch (error) {
    console.error('Error fetching feedback history:', error);
    res.status(500).json({ error: 'Failed to fetch feedback history' });
  }
};

/**
 * Get specific feedback details
 */
exports.getFeedbackDetails = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const candidateId = req.user._id;
    
    const feedback = await InterviewFeedback.findOne({
      _id: feedbackId,
      candidate: candidateId
    }).populate('job', 'title companyName location');

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback details:', error);
    res.status(500).json({ error: 'Failed to fetch feedback details' });
  }
};

module.exports = exports;
