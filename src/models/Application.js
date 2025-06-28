const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  portfolio: String,
  resumeUrl: { type: String, required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Application', applicationSchema);
