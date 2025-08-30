const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  
  // Timeline
  dueDate: {
    type: Date,
    required: true
  },
  completedDate: {
    type: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'overdue'],
    default: 'pending'
  },
  
  // Assignment
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  
  // Progress
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Deliverables
  deliverables: [{
    name: String,
    description: String,
    completed: {
      type: Boolean,
      default: false
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    completedDate: Date
  }],
  
  // Dependencies
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Milestone'
  }]
}, {
  timestamps: true
});

// Auto-update status based on completion
milestoneSchema.pre('save', function(next) {
  if (this.completionPercentage === 100 && !this.completedDate) {
    this.completedDate = new Date();
    this.status = 'completed';
  } else if (this.completionPercentage > 0 && this.completionPercentage < 100) {
    this.status = 'in-progress';
  } else if (new Date() > this.dueDate && this.completionPercentage < 100) {
    this.status = 'overdue';
  }
  next();
});

module.exports = mongoose.model('Milestone', milestoneSchema);