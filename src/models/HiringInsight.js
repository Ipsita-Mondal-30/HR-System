const mongoose = require('mongoose');

const hiringInsightSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['weekly', 'skill', 'talent', 'market', 'recruiter'],
    default: 'weekly',
  },
  summary: String,
  bulletPoints: [String],
  skillHighlights: [{ skill: String, changePct: Number, _id: false }],
  locationHighlights: [String],
  recommendations: [String],
  source: { type: String, default: 'gemini' },
  generatedAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, index: true },
});

module.exports = mongoose.model('HiringInsight', hiringInsightSchema);
