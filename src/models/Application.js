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
    projectEnhancements: [String],
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
    enum: ['pending', 'reviewed', 'shortlisted', 'hire_recommended', 'hired', 'rejected'],
    default: 'pending',
  },
  hireRecommendedAt: Date,
  hiredAt: Date,
  employeeProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  resumeText: String,
  coverLetter: String,
  generatedCoverLetter: String,
  applicationData: {
    linkedIn: String,
    github: String,
    expectedSalary: String,
    availableStartDate: String,
    whyInterested: String
  },
  hrNotes: String,
  resumeFile: {
    originalName: String,
    url: String,
    mimeType: String,
    sizeBytes: Number,
    uploadedAt: Date,
  },
  parsedResume: {
    name: String,
    email: String,
    phone: String,
    skills: [String],
    education: [String],
    projects: [String],
    experience: [String],
  },
  jobDescriptionText: String,
  jobDescriptionSource: { type: String, enum: ['paste', 'pdf', 'job'], default: 'job' },
  atsAnalysis: {
    overallScore: Number,
    atsScore: Number,
    skillMatchScore: Number,
    experienceScore: Number,
    missingSkills: [String],
    strengths: [String],
    weaknesses: [String],
    recommendations: [String],
    keywordCoverage: Number,
    bulletImprovements: [String],
    wordingSuggestions: [String],
    projectEnhancements: [String],
    improvedBullets: String,
    analyzedAt: Date,
    source: String,
  },
  createdAt: { type: Date, default: Date.now }
});





module.exports = mongoose.model('Application', applicationSchema);
