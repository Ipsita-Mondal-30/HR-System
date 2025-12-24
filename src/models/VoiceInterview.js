const mongoose = require('mongoose');

const voiceInterviewSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  jobRole: {
    type: String,
    required: true
  },
  skills: [String],
  questions: [{
    question: String,
    transcript: String,
    answer: String,
    evaluation: {
      type: String,
      enum: ['correct', 'partial', 'incorrect']
    },
    penalty: {
      type: Number,
      default: 10,
      min: 0,
      max: 20
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard']
    },
    bodyLanguage: {
      eye_contact: {
        type: String,
        enum: ['high', 'medium', 'low']
      },
      movement: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      posture: {
        type: String,
        enum: ['stable', 'unstable']
      }
    },
    timestamp: Date
  }],
  askedCount: {
    type: Number,
    default: 0
  },
  maxQuestions: {
    type: Number,
    default: 6
  },
  fullTranscript: String,
  aiAnalysis: {
    overallScore: Number,
    strengths: [String],
    improvements: [String],
    recommendations: [String],
    detailedFeedback: String
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress'
  },
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('VoiceInterview', voiceInterviewSchema);
