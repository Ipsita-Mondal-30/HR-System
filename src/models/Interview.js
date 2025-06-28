const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  scheduledAt: Date,
  interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Interview', interviewSchema);
