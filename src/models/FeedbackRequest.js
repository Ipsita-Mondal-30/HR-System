const mongoose = require('mongoose');

const feedbackRequestSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  requestType: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  hrResponse: {
    type: String,
    trim: true,
    maxlength: 3000
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  respondedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('FeedbackRequest', feedbackRequestSchema);
