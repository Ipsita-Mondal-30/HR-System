const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  interviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    default: 60 // minutes
  },
  type: {
    type: String,
    enum: ['phone', 'video', 'in-person'],
    default: 'video'
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  meetingLink: String,
  location: String,
  notes: String,
  completedAt: Date,
  recording: {
    url: String,
    type: { type: String, enum: ['upload', 'link'], default: 'link' },
    fileName: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  hireApproval: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    recommendedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    adminNotes: String,
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  },
  scorecard: {
    technicalSkills: {
      type: Number,
      min: 0,
      max: 5
    },
    communication: {
      type: Number,
      min: 0,
      max: 5
    },
    problemSolving: {
      type: Number,
      min: 0,
      max: 5
    },
    culturalFit: {
      type: Number,
      min: 0,
      max: 5
    },
    overall: {
      type: Number,
      min: 0,
      max: 5
    },
    feedback: String,
    recommendation: {
      type: String,
      enum: ['hire', 'no-hire', 'maybe'],
      default: 'maybe'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
interviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Interview', interviewSchema);