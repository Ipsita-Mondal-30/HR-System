const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  interviewer: {
    type: String, // ✅ Changed from ObjectId to String
    required: true,
  },
  candidateEmail: {
    type: String,
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  scorecard: {
    strengths: String,
    weaknesses: String,
    overallScore: Number,
    notes: String,
    generatedQuestions: [String],
  },
}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);
