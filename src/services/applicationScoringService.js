const agentController = require('../controllers/agentController');
const { analyzeApplicationById } = require('./applicationAnalysisService');

const mockRes = {
  json: (data) => {
    if (data?.matchScore != null) {
      console.log(`✅ Match score emails processed — score: ${data.matchScore}/100`);
    }
  },
  status: (code) => ({
    json: (data) => {
      if (code !== 200) {
        console.error('Match score handler returned non-200:', code, data);
      }
    },
  }),
};

/**
 * After a candidate applies: persist ATS analysis when possible, then always
 * send HR + candidate match-score emails via getMatchScore (robust fallbacks).
 */
async function runPostApplicationScoring(applicationId, createdBy) {
  const id = String(applicationId);

  if (process.env.GROQ_API_KEY) {
    try {
      await analyzeApplicationById(id, { createdBy, sendEmails: false });
      console.log('✅ Groq ATS analysis saved for application:', id);
    } catch (groqErr) {
      console.warn('⚠️ Groq ATS analysis skipped:', groqErr.message);
    }
  }

  await agentController.getMatchScore({ params: { applicationId: id } }, mockRes);
}

module.exports = { runPostApplicationScoring };
