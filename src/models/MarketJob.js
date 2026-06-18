const mongoose = require('mongoose');

const marketJobSchema = new mongoose.Schema({
  adzunaId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, index: true },
  company: { type: String, index: true },
  description: { type: String },
  location: { type: String, index: true },
  city: { type: String, index: true },
  region: { type: String },
  country: { type: String, default: 'in' },
  salaryMin: { type: Number, default: null },
  salaryMax: { type: Number, default: null },
  salaryCurrency: { type: String, default: 'INR' },
  isRemote: { type: Boolean, default: false, index: true },
  category: { type: String },
  skills: [{ type: String }],
  sourceUrl: { type: String },
  postedAt: { type: Date, index: true },
  fetchedAt: { type: Date, default: Date.now },
  searchKeyword: { type: String },
});

marketJobSchema.index({ skills: 1 });
marketJobSchema.index({ postedAt: -1 });

module.exports = mongoose.model('MarketJob', marketJobSchema);
