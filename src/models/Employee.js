const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  // Link to User model
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Employee Details
  employeeId: {
    type: String,
    unique: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  position: {
    type: String,
    required: true
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Employment Details
  hireDate: {
    type: Date,
    required: true
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'intern'],
    default: 'full-time'
  },
  salary: {
    type: Number
  },
  
  // Performance Metrics
  performanceScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  projectContribution: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Skills & Competencies
  skills: [{
    name: String,
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    },
    verified: {
      type: Boolean,
      default: false
    }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'terminated', 'on-leave'],
    default: 'active'
  },
  
  // Resume & Documents
  resume: {
    fileName: String,
    fileUrl: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // AI Insights
  aiInsights: {
    promotionReadiness: {
      score: Number,
      reasons: [String],
      lastUpdated: Date
    },
    attritionRisk: {
      score: Number,
      factors: [String],
      lastUpdated: Date
    },
    strengths: [String],
    improvementAreas: [String],
    lastAnalyzed: Date
  }
}, {
  timestamps: true
});

// Generate employee ID
employeeSchema.pre('save', async function(next) {
  if (!this.employeeId) {
    const count = await mongoose.model('Employee').countDocuments();
    this.employeeId = `EMP${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);