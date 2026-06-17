const mongoose = require('mongoose');

const projectMessageSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
    senderName: String,
    senderRole: {
      type: String,
      enum: ['employee', 'project-manager', 'admin', 'system'],
      default: 'employee',
    },
    message: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    messageType: {
      type: String,
      enum: ['update', 'milestone_response', 'pm_broadcast', 'system'],
      default: 'update',
    },
    milestone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Milestone',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProjectMessage', projectMessageSchema);
