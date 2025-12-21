const mongoose = require('mongoose');

const interviewFeedbackSchema = new mongoose.Schema({
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
  questions: [{
    question: String,
    videoUrl: String,
    transcription: String,
    duration: Number
  }],
  feedback: {
    communicationClarity: {
      score: Number,
      comments: String
    },
    confidence: {
      score: Number,
      comments: String
    },
    relevance: {
      score: Number,
      comments: String
    },
    technicalAccuracy: {
      score: Number,
      comments: String
    },
    overallScore: Number,
    strengths: [String],
    improvements: [String],
    summary: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

module.exports = mongoose.model('InterviewFeedback', interviewFeedbackSchema);
