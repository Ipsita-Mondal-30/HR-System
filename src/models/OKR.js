const mongoose = require('mongoose');

const okrSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // OKR Period
  period: {
    type: String,
    enum: ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual'],
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  
  // Objective
  objective: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  
  // Key Results
  keyResults: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    targetValue: {
      type: Number,
      required: true
    },
    currentValue: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      default: 'number'
    },
    weight: {
      type: Number,
      default: 1,
      min: 0.1,
      max: 2
    },
    status: {
      type: String,
      enum: ['not-started', 'in-progress', 'at-risk', 'completed'],
      default: 'not-started'
    }
  }],
  
  // Progress Tracking
  overallProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  // Manager Review
  managerReview: {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    reviewedAt: Date
  },
  
  // AI Insights
  aiInsights: {
    achievabilityScore: Number,
    riskFactors: [String],
    recommendations: [String],
    lastAnalyzed: Date
  }
}, {
  timestamps: true
});

// Calculate overall progress
okrSchema.methods.calculateProgress = function() {
  if (this.keyResults.length === 0) return 0;
  
  let totalWeightedProgress = 0;
  let totalWeight = 0;
  
  this.keyResults.forEach(kr => {
    const progress = Math.min((kr.currentValue / kr.targetValue) * 100, 100);
    totalWeightedProgress += progress * kr.weight;
    totalWeight += kr.weight;
  });
  
  this.overallProgress = totalWeight > 0 ? totalWeightedProgress / totalWeight : 0;
  return this.overallProgress;
};

module.exports = mongoose.model('OKR', okrSchema);