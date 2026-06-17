const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  category: {
    type: String,
    enum: ['payroll', 'benefits', 'leave', 'it', 'hr-policy', 'workplace', 'other'],
    default: 'other'
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
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

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
