const { GoogleGenerativeAI } = require('@google/generative-ai');
const { CohereClient } = require('cohere-ai');

function parseJsonFromText(text) {
  if (!text) return null;
  let match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (fenced) match = [fenced[1]];
  }
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
}

async function callGemini(prompt) {
  const model = getGeminiModel();
  if (!model) return null;
  try {
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    return parseJsonFromText(text);
  } catch (err) {
    console.warn('OKR Gemini failed:', err.message);
    return null;
  }
}

async function callCohere(prompt) {
  if (!process.env.COHERE_API_KEY) return null;
  try {
    const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
    const response = await cohere.chat({
      message: prompt,
      model: 'command-r-plus',
      temperature: 0.4,
    });
    return parseJsonFromText(response.text);
  } catch (err) {
    console.warn('OKR Cohere failed:', err.message);
    return null;
  }
}

function buildFallbackInsights(okr) {
  const progress = okr.overallProgress ?? 0;
  return {
    achievabilityScore: Math.max(25, Math.min(95, 100 - Math.abs(70 - progress))),
    summary:
      progress >= 75
        ? 'You are on track to achieve this objective. Maintain momentum and document outcomes.'
        : progress >= 40
        ? 'Progress is moderate. Focus on the lowest-scoring key results to improve overall achievement.'
        : 'This OKR needs attention. Prioritize high-weight key results and align with your manager.',
    riskFactors:
      progress < 40
        ? ['Overall progress is below 40%', 'Key results may be too ambitious for the remaining period']
        : progress < 75
        ? ['Progress is moderate — some key results lag behind', 'Timeline pressure may increase without weekly check-ins']
        : ['Low risk — continue current execution pace'],
    recommendations:
      progress < 50
        ? ['Break large key results into weekly milestones', 'Schedule a manager check-in this week', 'Reallocate time to highest-weight key results']
        : ['Keep updating progress weekly', 'Capture evidence of completed key results', 'Prepare a summary for end-of-period review'],
    aiSource: 'rules',
  };
}

function normalizeInsights(raw, okr) {
  const fallback = buildFallbackInsights(okr);
  if (!raw || typeof raw !== 'object') return fallback;

  const toArray = (val) => {
    if (Array.isArray(val)) return val.filter(Boolean).map(String);
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [];
  };

  const achievabilityScore = Math.max(
    0,
    Math.min(100, Math.round(Number(raw.achievabilityScore ?? raw.achievability ?? fallback.achievabilityScore)))
  );

  const riskFactors = toArray(raw.riskFactors || raw.risks);
  const recommendations = toArray(raw.recommendations || raw.suggestions);

  return {
    achievabilityScore,
    summary: String(raw.summary || raw.analysis || fallback.summary),
    riskFactors: riskFactors.length ? riskFactors : fallback.riskFactors,
    recommendations: recommendations.length ? recommendations : fallback.recommendations,
    aiSource: raw.aiSource || 'ai',
  };
}

async function generateOKRInsights(okr, employeeContext = {}) {
  const krSummary = (okr.keyResults || [])
    .map(
      (kr, i) =>
        `${i + 1}. ${kr.title}: ${kr.currentValue}/${kr.targetValue} ${kr.unit} (${kr.status}, weight ${kr.weight})`
    )
    .join('\n');

  const prompt = `You are an HR performance coach. Analyze this employee OKR and respond with ONLY valid JSON.

Employee: ${employeeContext.name || 'Employee'}
Position: ${employeeContext.position || 'N/A'}
Objective: ${okr.objective}
Description: ${okr.description || 'N/A'}
Period: ${okr.period} ${okr.year}
Overall progress: ${okr.overallProgress}%
Status: ${okr.status}

Key Results:
${krSummary || 'None'}

Return JSON exactly in this shape:
{
  "achievabilityScore": <number 0-100>,
  "summary": "<2-3 sentence assessment>",
  "riskFactors": ["<risk 1>", "<risk 2>"],
  "recommendations": ["<action 1>", "<action 2>", "<action 3>"]
}`;

  let parsed = await callGemini(prompt);
  let aiSource = 'gemini';
  if (!parsed) {
    parsed = await callCohere(prompt);
    aiSource = 'cohere';
  }

  const normalized = normalizeInsights(parsed, okr);
  normalized.aiSource = parsed ? aiSource : 'rules';
  normalized.lastAnalyzed = new Date();
  return normalized;
}

module.exports = {
  generateOKRInsights,
  buildFallbackInsights,
};
