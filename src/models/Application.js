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
    tags: [String]
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Application', applicationSchema);
