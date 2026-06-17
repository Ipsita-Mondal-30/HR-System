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
    summary: String,
    matchingSkills: [String],
    missingSkills: [String],
    tags: [String],
    strengths: [String],
    improvements: [String],
    actionPlan: [String],
    resumeTips: [String],
    interviewTips: [String],
    analyzedAt: Date,
    source: String,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // ✅ Make sure 'User' is the model name for candidates
    required: false,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },  
  
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected'],
    default: 'pending',
  },
  resumeText: String,
  coverLetter: String,
  applicationData: {
    linkedIn: String,
    github: String,
    expectedSalary: String,
    availableStartDate: String,
    whyInterested: String
  },
  hrNotes: String,
  createdAt: { type: Date, default: Date.now }
});





module.exports = mongoose.model('Application', applicationSchema);
