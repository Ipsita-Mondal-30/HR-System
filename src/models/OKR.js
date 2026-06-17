const mongoose = require('mongoose');

const keyResultSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  targetValue: { type: Number, required: true, min: 0 },
  currentValue: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: '%' },
  weight: { type: Number, default: 1, min: 0.1 },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'on-track', 'at-risk', 'completed'],
    default: 'not-started'
  }
});

const okrSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  objective: { type: String, required: true },
  description: String,
  period: {
    type: String,
    enum: ['Q1', 'Q2', 'Q3', 'Q4', 'Annual', 'H1', 'H2'],
    required: true
  },
  year: { type: Number, required: true },
  keyResults: [keyResultSchema],
  overallProgress: { type: Number, default: 0, min: 0, max: 100 },
  status: {
    type: String,
    enum: ['active', 'completed', 'at-risk', 'cancelled'],
    default: 'active'
  },
  managerReview: {
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comments: String,
    reviewedAt: Date
  },
  aiInsights: {
    achievabilityScore: Number,
    summary: String,
    riskFactors: [String],
    recommendations: [String],
    aiSource: String,
    lastAnalyzed: Date
  }
}, {
  timestamps: true
});

okrSchema.methods.recalculateProgress = function recalculateProgress() {
  if (!this.keyResults?.length) {
    this.overallProgress = 0;
    return;
  }

  let totalWeight = 0;
  let weightedProgress = 0;

  this.keyResults.forEach((kr) => {
    const progress = kr.targetValue > 0
      ? Math.min((kr.currentValue / kr.targetValue) * 100, 100)
      : 0;

    if (progress >= 100) kr.status = 'completed';
    else if (progress >= 75) kr.status = 'on-track';
    else if (progress >= 40) kr.status = 'in-progress';
    else if (progress > 0) kr.status = 'at-risk';
    else kr.status = 'not-started';

    const weight = kr.weight || 1;
    weightedProgress += progress * weight;
    totalWeight += weight;
  });

  this.overallProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;

  if (this.overallProgress >= 100) this.status = 'completed';
  else if (this.overallProgress < 25 && this.overallProgress > 0) this.status = 'at-risk';
  else if (this.status !== 'cancelled') this.status = 'active';
};

okrSchema.pre('save', function preSave(next) {
  this.recalculateProgress();
  next();
});

module.exports = mongoose.model('OKR', okrSchema);
