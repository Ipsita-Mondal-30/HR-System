const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'job_applied',
      'interview_scheduled',
      'interview_completed',
      'application_status_changed',
      'job_alert',
      'profile_viewed',
      'new_job_posted',
      'application_shortlisted',
      'application_rejected'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedEntity: {
    type: {
      type: String,
      enum: ['job', 'application', 'interview', 'user']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  link: String, // URL to navigate when clicked
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

