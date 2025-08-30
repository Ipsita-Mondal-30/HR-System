const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  // Who is giving feedback
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Who is receiving feedback
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // Context
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  milestone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Milestone'
  },
  
  // Feedback Type
  type: {
    type: String,
    enum: ['project-feedback', 'performance-review', 'peer-feedback', 'milestone-feedback', 'general'],
    required: true
  },
  
  // Feedback Content
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  
  // Structured Ratings
  ratings: {
    technical: {
      type: Number,
      min: 1,
      max: 5
    },
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    teamwork: {
      type: Number,
      min: 1,
      max: 5
    },
    leadership: {
      type: Number,
      min: 1,
      max: 5
    },
    problemSolving: {
      type: Number,
      min: 1,
      max: 5
    },
    timeManagement: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Overall Rating
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  // AI Processing
  aiSummary: {
    type: String
  },
  aiSentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative']
  },
  aiKeywords: [String],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'submitted', 'reviewed', 'acknowledged'],
    default: 'draft'
  },
  
  // Visibility
  isVisible: {
    type: Boolean,
    default: true
  },
  
  // Employee Response
  employeeResponse: {
    content: String,
    respondedAt: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Feedback', feedbackSchema);