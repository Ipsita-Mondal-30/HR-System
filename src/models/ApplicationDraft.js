const mongoose = require('mongoose');

const applicationDraftSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },
  formData: {
    coverLetter: String,
    portfolio: String,
    linkedIn: String,
    github: String,
    expectedSalary: String,
    availableStartDate: String,
    whyInterested: String,
    phone: String,
    location: String,
    experience: String
  },
  resumeFile: {
    filename: String,
    path: String,
    mimetype: String,
    size: Number
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for finding drafts
applicationDraftSchema.index({ candidate: 1, job: 1 });

// Update updatedAt before saving
applicationDraftSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ApplicationDraft', applicationDraftSchema);

