const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: String,
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  description: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
