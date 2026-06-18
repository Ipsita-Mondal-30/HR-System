const mongoose = require('mongoose');

const skillStatSchema = new mongoose.Schema(
  {
    skill: String,
    count: Number,
    growthPct: { type: Number, default: 0 },
  },
  { _id: false }
);

const hiringSnapshotSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true, index: true },
  totalJobs: { type: Number, default: 0 },
  totalCompanies: { type: Number, default: 0 },
  remoteCount: { type: Number, default: 0 },
  onsiteCount: { type: Number, default: 0 },
  avgSalary: { type: Number, default: 0 },
  skillStats: [skillStatSchema],
  topCompanies: [{ company: String, count: Number, _id: false }],
  locationStats: [{ location: String, count: Number, _id: false }],
  salaryByRole: [{ role: String, avgSalary: Number, count: Number, _id: false }],
  salaryByCity: [{ city: String, avgSalary: Number, count: Number, _id: false }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('HiringSnapshot', hiringSnapshotSchema);
