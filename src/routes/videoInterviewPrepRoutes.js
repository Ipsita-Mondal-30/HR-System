const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyJWT } = require('../middleware/auth');
const VideoInterviewPrep = require('../models/VideoInterviewPrep');
const Application = require('../models/Application');
const Job = require('../models/Job');
const geminiService = require('../services/geminiService');
const assemblyAIService = require('../services/assemblyAIService');
const emailService = require('../services/emailService');

// Configure multer for video uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Get jobs candidate applied for
router.get('/my-applications', verifyJWT, async (req, res) => {
  try {
    const applications = await Application.find({ 
      candidate: req.user._id 
    })
    .populate('job', 'title companyName department')
    .sort({ createdAt: -1 });

    res.json({ applications });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Start interview prep session
router.post('/start-session', verifyJWT, async (req, res) => {
  try {
    const { jobId, jobRole } = req.body;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('🎬 Starting interview prep session');
    console.log('Job Role:', jobRole);

    // Generate questions
    const questions = await geminiService.generateInterviewQuestions(jobRole, 'medium', 5);

    const session = new VideoInterviewPrep({
      candidate: req.user._id,
      job: jobId,
      jobRole,
      sessionId,
      questions: questions.map(q => ({ question: q }))
    });

    await session.save();

    console.log('✅ Session created:', session._id);

    res.json({ 
      sessionId: session._id,
      questions: session.questions,
      success: true 
    });
  } catch (error) {
    console.error('❌ Error starting session:', error);
    res.status(500).json({ 
      error: 'Failed to start session',
      details: error.message 
    });
  }
});

// Upload video answer
router.post('/upload-answer/:sessionId/:questionIndex', 
  verifyJWT, 
  upload.single('video'), 
  async (req, res) => {
    try {
      const { sessionId, questionIndex } = req.params;
      const videoFile = req.file;

      console.log('📹 Uploading answer for question', questionIndex);

      if (!videoFile) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const session = await VideoInterviewPrep.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // In production, upload to Cloudinary or S3
      // For now, we'll store as base64 or use a placeholder
      const videoUrl = `data:video/webm;base64,${videoFile.buffer.toString('base64')}`;

      // Transcribe video (this will take a few seconds)
      console.log('🎤 Transcribing video...');
      let transcript = '';
      try {
        // Note: AssemblyAI needs a public URL, so in production use Cloudinary/S3
        // For now, we'll use a mock transcript
        transcript = 'Transcription placeholder - integrate with Cloudinary/S3 for production';
      } catch (transcribeError) {
        console.warn('Transcription failed, using placeholder:', transcribeError.message);
        transcript = 'Answer recorded (transcription pending)';
      }

      // Update question with video and transcript
      session.questions[questionIndex].videoUrl = videoUrl.substring(0, 100) + '...'; // Store truncated for demo
      session.questions[questionIndex].transcript = transcript;
      session.questions[questionIndex].timestamp = new Date();
      session.questions[questionIndex].answer = transcript;

      await session.save();

      console.log('✅ Answer uploaded successfully');

      res.json({ success: true, transcript });
    } catch (error) {
      console.error('❌ Error uploading answer:', error);
      res.status(500).json({ 
        error: 'Failed to upload answer',
        details: error.message 
      });
    }
});

// Complete session and get AI feedback
router.post('/complete-session/:sessionId', verifyJWT, async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log('🏁 Completing session:', sessionId);

    const session = await VideoInterviewPrep.findById(sessionId)
      .populate('candidate', 'name email');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Combine all transcripts
    const fullTranscript = session.questions
      .map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.transcript || q.answer || 'No answer'}`)
      .join('\n\n');

    session.fullTranscript = fullTranscript;

    // Analyze with Gemini
    console.log('🤖 Analyzing interview with Gemini AI...');
    const analysis = await geminiService.analyzeInterview(
      session.jobRole,
      session.questions,
      fullTranscript
    );

    session.aiAnalysis = analysis;
    session.status = 'completed';
    session.completedAt = new Date();

    await session.save();

    console.log('✅ Analysis completed. Score:', analysis.overallScore);

    // Send email feedback
    console.log('📧 Sending feedback email...');
    try {
      await emailService.sendInterviewFeedback(
        session.candidate.email,
        session.candidate.name,
        analysis,
        session.jobRole
      );

      session.feedbackSent = true;
      await session.save();
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue even if email fails
    }

    res.json({ 
      success: true,
      analysis,
      message: 'Feedback sent to your email!'
    });
  } catch (error) {
    console.error('❌ Error completing session:', error);
    res.status(500).json({ 
      error: 'Failed to complete session',
      details: error.message 
    });
  }
});

// Get session history
router.get('/my-sessions', verifyJWT, async (req, res) => {
  try {
    const sessions = await VideoInterviewPrep.find({ 
      candidate: req.user._id 
    })
    .populate('job', 'title companyName')
    .sort({ createdAt: -1 })
    .limit(20);

    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get specific session details
router.get('/sessions/:sessionId', verifyJWT, async (req, res) => {
  try {
    const session = await VideoInterviewPrep.findOne({
      _id: req.params.sessionId,
      candidate: req.user._id
    }).populate('job', 'title companyName');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

router.post('/start-session-v2', verifyJWT, async (req, res) => {
  try {
    const { jobId, jobRole, skills = [], experienceLevel = 'mid' } = req.body;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = new VideoInterviewPrep({
      candidate: req.user._id,
      job: jobId,
      jobRole,
      experienceLevel,
      skills,
      sessionId,
      questions: [],
      askedCount: 0,
      maxQuestions: 6
    });
    await session.save();
    const first = await geminiService.decideNextQuestion(jobRole, skills, 'incorrect', 0);
    session.questions.push({ question: first.question, difficulty: 'easy', timestamp: new Date() });
    session.askedCount = 1;
    await session.save();
    res.json({ spoken_text: first.question, end_interview: false, session_id: session._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start session' });
  }
});

router.post('/answer-v2/:sessionId', verifyJWT, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { transcript } = req.body;
    const session = await VideoInterviewPrep.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const idx = session.askedCount - 1;
    const current = session.questions[idx];
    const evaluation = await geminiService.evaluateAnswer(session.jobRole, current.question, transcript || '');
    current.transcript = transcript || '';
    current.answer = transcript || '';
    current.evaluation = evaluation;
    await session.save();
    const shouldEnd = session.askedCount >= session.maxQuestions;
    if (shouldEnd) {
      const fullTranscript = session.questions.map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.transcript || q.answer || ''}`).join('\n\n');
      const analysis = await geminiService.analyzeInterview(session.jobRole, session.questions, fullTranscript);
      session.fullTranscript = fullTranscript;
      session.aiAnalysis = analysis;
      session.status = 'completed';
      session.completedAt = new Date();
      await session.save();
      const score = Math.max(0, Math.min(100, analysis.overallScore || 0));
      const status = score >= 80 ? 'READY' : score >= 60 ? 'NEEDS PRACTICE' : 'NOT READY';
      const strengths = analysis.strengths || [];
      const weaknesses = analysis.improvements || [];
      const improvement_tips = analysis.recommendations || [];
      const email_body = `Hi ${req.user.name},\n\nThank you for completing the ${session.jobRole} interview prep.\n\nPrep Score: ${score}/100\n\nStrengths:\n- ${strengths.join('\n- ')}\n\nWeak Areas:\n- ${weaknesses.join('\n- ')}\n\nSuggestions:\n- ${improvement_tips.join('\n- ')}\n\nKeep practicing and feel free to retry the mock interview.\n\nBest,\nTalora Team`;
      const closing = 'Thank you. This concludes the mock interview.';
      const { sendEmail } = require('../utils/email');
      try {
        await sendEmail({
          to: req.user.email,
          subject: `Interview Prep Feedback – ${session.jobRole}`,
          html: email_body.replace(/\n/g, '<br>')
        });
      } catch {}
      return res.json({
        spoken_text: closing,
        end_interview: true,
        final_output: {
          prep_score: score,
          status,
          strengths,
          weaknesses,
          improvement_tips,
          email_body
        }
      });
    } else {
      const next = await geminiService.decideNextQuestion(session.jobRole, session.skills || [], evaluation, session.askedCount);
      session.questions.push({ question: next.question, difficulty: next.difficulty, timestamp: new Date() });
      session.askedCount += 1;
      await session.save();
      return res.json({ spoken_text: next.question, end_interview: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to process answer' });
  }
});

module.exports = router;
