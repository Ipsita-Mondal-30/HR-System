const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function clampScore(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

async function callGroqJson(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const response = await axios.post(
    GROQ_API_URL,
    {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty Groq response');
  }

  const cleaned = content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

async function analyzeResumeWithGroq({ resumeText, jobDescription }) {
  const prompt = `You are an expert ATS and technical recruiter.

Analyze the resume against the job description.

Return ONLY valid JSON:

{
  "overallScore": number,
  "atsScore": number,
  "skillMatchScore": number,
  "experienceScore": number,
  "missingSkills": [],
  "strengths": [],
  "weaknesses": [],
  "recommendations": [],
  "keywordCoverage": number,
  "bulletImprovements": [],
  "wordingSuggestions": [],
  "projectEnhancements": []
}

Do not return markdown.
Do not return explanations outside JSON.
All scores must be numbers from 0 to 100.

Job Description:
${jobDescription.slice(0, 8000)}

Resume:
${resumeText.slice(0, 12000)}`;

  const raw = await callGroqJson(prompt);

  return {
    overallScore: clampScore(raw.overallScore),
    atsScore: clampScore(raw.atsScore),
    skillMatchScore: clampScore(raw.skillMatchScore),
    experienceScore: clampScore(raw.experienceScore),
    keywordCoverage: clampScore(raw.keywordCoverage),
    missingSkills: normalizeStringArray(raw.missingSkills),
    strengths: normalizeStringArray(raw.strengths),
    weaknesses: normalizeStringArray(raw.weaknesses),
    recommendations: normalizeStringArray(raw.recommendations),
    bulletImprovements: normalizeStringArray(raw.bulletImprovements),
    wordingSuggestions: normalizeStringArray(raw.wordingSuggestions),
    projectEnhancements: normalizeStringArray(raw.projectEnhancements),
    source: 'groq',
    analyzedAt: new Date(),
  };
}

module.exports = {
  callGroqJson,
  analyzeResumeWithGroq,
  clampScore,
};
