const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  portfolio: String,
  resumeUrl: String,
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  matchScore: { type: Number, default: null },
  matchInsights: {
    matchScore: Number,
    explanation: String,
    matchingSkills: [String],
    missingSkills: [String],
    tags: [String],
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // ✅ Make sure 'User' is the model name for candidates
    required: false,
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected'],
    default: 'pending',
  },
  resumeText: String,
  createdAt: { type: Date, default: Date.now }
});





module.exports = mongoose.model('Application', applicationSchema);
