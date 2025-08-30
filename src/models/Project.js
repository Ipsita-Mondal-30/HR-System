const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Project Details
  status: {
    type: String,
    enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Timeline
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    default: 0
  },
  actualHours: {
    type: Number,
    default: 0
  },
  
  // Team & Assignment
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  teamMembers: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    role: {
      type: String,
      default: 'team-member'
    },
    contributionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    hoursWorked: {
      type: Number,
      default: 0
    }
  }],
  
  // Progress Tracking
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Client/Department
  client: {
    type: String
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  
  // Budget
  budget: {
    type: Number,
    default: 0
  },
  actualCost: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);