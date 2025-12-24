const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth');
const Job = require('../models/Job');
const VoiceInterview = require('../models/VoiceInterview');
const geminiService = require('../services/geminiService');
const emailService = require('../services/emailService');
const User = require('../models/User');

// Get ALL HR-posted jobs (not just applied ones)
router.get('/all-jobs', verifyJWT, async (req, res) => {
  try {
    const jobs = await Job.find({ 
      status: 'active',
      isApproved: true 
    })
    .select('title companyName location skills experienceRequired')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Start voice interview session
router.post('/start', verifyJWT, async (req, res) => {
  try {
    const { jobId, jobRole, skills = [] } = req.body;
    
    console.log('🎙️ Starting voice interview for:', jobRole);

    // Create session
    const session = new VoiceInterview({
      candidate: req.user._id,
      job: jobId,
      jobRole,
      skills,
      questions: [],
      askedCount: 0,
      maxQuestions: 6,
      status: 'in-progress'
    });

    await session.save();

    // Generate first question (easy) - pass sessionId for tracking
    const sessionId = session._id.toString();
    const firstQuestion = await geminiService.generateFirstQuestion(jobRole, skills, sessionId);

    session.questions.push({
      question: firstQuestion,
      difficulty: 'easy',
      timestamp: new Date()
    });
    session.askedCount = 1;
    await session.save();

    console.log('✅ Session created:', session._id);

    res.json({
      sessionId: session._id,
      firstQuestion
    });
  } catch (error) {
    console.error('❌ Error starting interview:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

// Process spoken answer and get next question
router.post('/answer/:sessionId', verifyJWT, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { transcript, bodyLanguage } = req.body; // bodyLanguage: { eye_contact, movement, posture }

    console.log('🎤 Processing answer for session:', sessionId);

    const session = await VoiceInterview.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Store transcript for current question
    const currentIdx = session.askedCount - 1;
    session.questions[currentIdx].transcript = transcript;
    session.questions[currentIdx].answer = transcript;

    // Evaluate answer - pass sessionId for tracking (use string version)
    const sessionIdStr = session._id.toString();
    const evalResult = await geminiService.evaluateAnswer(
      session.jobRole,
      session.questions[currentIdx].question,
      transcript,
      sessionIdStr
    );

    // Store evaluation and penalty
    session.questions[currentIdx].evaluation = evalResult.evaluation;
    session.questions[currentIdx].penalty = evalResult.penalty || 10;
    await session.save();

    // Check if interview should end
    const shouldEnd = session.askedCount >= session.maxQuestions;

    if (shouldEnd) {
      // Complete interview and send email
      console.log('🏁 Completing interview...');
      
      const fullTranscript = session.questions
        .map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.transcript || ''}`)
        .join('\n\n');

      // Collect body language data for optional feedback
      const bodyLanguageData = session.questions
        .filter(q => q.bodyLanguage)
        .map(q => q.bodyLanguage);
      
      const analysis = await geminiService.analyzeInterviewForEmail(
        session.jobRole,
        session.questions,
        fullTranscript,
        sessionIdStr,
        bodyLanguageData // Pass body language data for optional gentle feedback
      );

      session.fullTranscript = fullTranscript;
      session.aiAnalysis = analysis;
      session.status = 'completed';
      session.completedAt = new Date();
      await session.save();

      // Calculate score and status
      const score = Math.max(0, Math.min(100, analysis.overallScore || 0));
      const status = score >= 80 ? 'READY' : score >= 60 ? 'NEEDS PRACTICE' : 'NOT READY';

      // Send email
      const user = await User.findById(req.user._id);
      await emailService.sendVoiceInterviewFeedback(
        user.email,
        user.name,
        session.jobRole,
        score,
        status,
        analysis.strengths || [],
        analysis.improvements || [],
        analysis.recommendations || []
      );

      console.log('✅ Interview completed and email sent');

      return res.json({
        endInterview: true,
        closingMessage: 'Thank you for completing the interview. Your detailed feedback has been sent to your email.',
        finalResults: {
          prepScore: score,
          status,
          strengths: analysis.strengths || [],
          weaknesses: analysis.improvements || [],
          improvementTips: analysis.recommendations || []
        }
      });
    } else {
      // Generate next question based on evaluation
      // Adjust difficulty based on confidence/hesitation AND body language (silently, don't tell candidate)
      let adjustedEvaluation = evalResult.evaluation;
      
      // Body language adaptation (secondary signal, never mentioned to candidate)
      if (bodyLanguage) {
        const { eye_contact, movement, posture } = bodyLanguage;
        
        // If eye contact is low OR movement is high -> slow down, ask simpler questions
        if (eye_contact === 'low' || movement === 'high') {
          adjustedEvaluation = 'incorrect'; // This will trigger easier question
          console.log(`📹 [${sessionId}] Body language: eye_contact=${eye_contact}, movement=${movement} -> adjusting to easier question`);
        }
        // If posture is stable AND eye contact is high -> proceed normally or slightly increase difficulty
        else if (posture === 'stable' && eye_contact === 'high' && evalResult.evaluation === 'correct') {
          adjustedEvaluation = 'correct'; // Keep or increase difficulty
        }
      }
      
      // Also consider confidence level
      if (evalResult.confidenceLevel === 'low') {
        // If hesitation detected, make next question easier
        adjustedEvaluation = 'incorrect'; // This will trigger easier question
      } else if (evalResult.confidenceLevel === 'high' && evalResult.evaluation === 'correct' && (!bodyLanguage || bodyLanguage.eye_contact !== 'low')) {
        // If confident and no body language concerns, can increase difficulty slightly
        adjustedEvaluation = 'correct'; // Keep harder path
      }
      
      // Pass sessionId and previousQuestions to prevent duplicates
      const previousQuestions = session.questions.map(q => q.question);
      const nextQuestion = await geminiService.decideNextQuestion(
        session.jobRole,
        session.skills || [],
        adjustedEvaluation, // Use adjusted evaluation based on confidence and body language
        session.askedCount,
        sessionIdStr,
        previousQuestions
      );

      session.questions.push({
        question: nextQuestion.question,
        difficulty: nextQuestion.difficulty,
        timestamp: new Date(),
        bodyLanguage: bodyLanguage || undefined // Store body language (optional, for post-interview feedback)
      });
      session.askedCount += 1;
      await session.save();

      console.log('➡️ Next question generated');

      return res.json({
        endInterview: false,
        nextQuestion: nextQuestion.question
      });
    }
  } catch (error) {
    console.error('❌ Error processing answer:', error);
    res.status(500).json({ error: 'Failed to process answer' });
  }
});

// Get interview history
router.get('/history', verifyJWT, async (req, res) => {
  try {
    const sessions = await VoiceInterview.find({ 
      candidate: req.user._id 
    })
    .populate('job', 'title companyName')
    .sort({ createdAt: -1 })
    .limit(20);

    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
