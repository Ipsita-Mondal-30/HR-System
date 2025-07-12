const Interview = require('../models/Interview');
const Application = require('../models/Application');
const { CohereClient } = require('cohere-ai');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

const scheduleInterview = async (req, res) => {
    try {
      const { applicationId, interviewer, scheduledAt } = req.body;
  
      console.log('📩 Received interview schedule request for:', { applicationId, interviewer, scheduledAt });
  
      const application = await Application.findById(applicationId);
      if (!application) {
        console.error('❌ Application not found:', applicationId);
        return res.status(404).json({ error: 'Application not found' });
      }
  
      const newInterview = await Interview.create({
        application: applicationId,
        candidateEmail: application.email,
        interviewer,
        scheduledAt,
      });
  
      console.log('✅ Interview scheduled:', newInterview);
      res.status(201).json(newInterview);
    } catch (err) {
      console.error('🔥 Interview scheduling failed:', err.message);
      res.status(500).json({ error: 'Interview scheduling failed' });
    }
  };
  

// Get all interviews
const getAllInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find()
      .populate('application')
      .populate('interviewer', 'name email');
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
};

// Generate questions from resume + job desc
const generateInterviewQuestions = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const interview = await Interview.findById(interviewId).populate({
      path: 'application',
      populate: { path: 'job' }
    });

    if (!interview) return res.status(404).json({ error: 'Interview not found' });

    
// In generateInterviewQuestions()
const resumeUrl = interview.application.resumeUrl;
const response = await axios.get(resumeUrl, { responseType: 'arraybuffer' });
const resumeData = await pdfParse(response.data);
const resumeText = resumeData.text;
    const jobDesc = interview.application.job.description;

    const prompt = `
Resume:
${resumeText}

Job Description:
${jobDesc}

Generate 5 tailored interview questions assessing technical skills, problem-solving, and cultural fit. Output as a JSON array.
    `.trim();

    const result = await cohere.chat({
      model: 'command-r',
      message: prompt,
      temperature: 0.4,
    });

    let questions = result.text.trim();
    if (questions.startsWith('```')) {
      questions = questions.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(questions);
    interview.scorecard = {
      ...interview.scorecard,
      generatedQuestions: parsed
    };
    await interview.save();

    res.json({ questions: parsed });
  } catch (err) {
    res.status(500).json({ error: 'Question generation failed' });
  }
};

module.exports = {
  scheduleInterview,
  getAllInterviews,
  generateInterviewQuestions,
};
