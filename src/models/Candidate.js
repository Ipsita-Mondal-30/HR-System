const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resume: String, // URL or file path
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  status: { type: String, enum: ['applied', 'screening', 'interviewing', 'hired', 'rejected'], default: 'applied' }
});

module.exports = mongoose.model('Candidate', candidateSchema);
