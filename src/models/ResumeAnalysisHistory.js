const mongoose = require('mongoose');

const scoreSchema = {
  overallScore: { type: Number, default: 0 },
  atsScore: { type: Number, default: 0 },
  skillMatchScore: { type: Number, default: 0 },
  experienceScore: { type: Number, default: 0 },
  keywordCoverage: { type: Number, default: 0 },
};

const resumeAnalysisHistorySchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resumeUrl: String,
  resumeFileName: String,
  resumeSizeBytes: Number,
  jobDescriptionText: String,
  jobDescriptionSource: { type: String, enum: ['paste', 'pdf', 'job'], default: 'job' },
  jobTitle: String,
  companyName: String,
  parsedResume: {
    name: String,
    email: String,
    phone: String,
    skills: [String],
    education: [String],
    projects: [String],
    experience: [String],
  },
  scores: scoreSchema,
  missingSkills: [String],
  strengths: [String],
  weaknesses: [String],
  recommendations: [String],
  bulletImprovements: [String],
  wordingSuggestions: [String],
  projectEnhancements: [String],
  improvedBullets: String,
  coverLetter: String,
  source: { type: String, default: 'groq' },
  createdAt: { type: Date, default: Date.now },
});

resumeAnalysisHistorySchema.index({ application: 1, createdAt: -1 });
resumeAnalysisHistorySchema.index({ candidate: 1, createdAt: -1 });

module.exports = mongoose.model('ResumeAnalysisHistory', resumeAnalysisHistorySchema);
