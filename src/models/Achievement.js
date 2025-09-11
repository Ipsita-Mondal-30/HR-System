const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['performance', 'skill', 'recognition', 'certification', 'milestone'],
    required: true
  },
  category: {
    type: String,
    trim: true
  },
  dateAwarded: {
    type: Date,
    default: Date.now
  },
  awardedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  level: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
achievementSchema.index({ employee: 1, dateAwarded: -1 });
achievementSchema.index({ type: 1 });

module.exports = mongoose.model('Achievement', achievementSchema);