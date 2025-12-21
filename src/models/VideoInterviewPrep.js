const mongoose = require('mongoose');

const videoInterviewPrepSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  jobRole: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  questions: [{
    question: String,
    answer: String,
    videoUrl: String,
    transcript: String,
    duration: Number,
    timestamp: Date
  }],
  fullTranscript: String,
  aiAnalysis: {
    overallScore: Number,
    communicationClarity: Number,
    confidence: Number,
    relevance: Number,
    technicalAccuracy: Number,
    strengths: [String],
    improvements: [String],
    detailedFeedback: String,
    recommendations: [String]
  },
  totalDuration: Number,
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'failed'],
    default: 'in-progress'
  },
  feedbackSent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

module.exports = mongoose.model('VideoInterviewPrep', videoInterviewPrepSchema);
