const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Prefer env model, then current Groq catalog fallbacks (llama-3.3-70b-versatile was removed). */
const DEFAULT_MODEL_CHAIN = [
  process.env.GROQ_MODEL,
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
  'groq/compound-mini',
].filter(Boolean);

function clampScore(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return [item.name, item.skill, item.title, item.text, item.description]
          .filter(Boolean)
          .join(' — ')
          .trim();
      }
      return String(item || '').trim();
    })
    .filter(Boolean);
}

function uniqueModels(models) {
  const seen = new Set();
  return models.filter((m) => {
    if (!m || seen.has(m)) return false;
    seen.add(m);
    return true;
  });
}

function formatGroqError(error) {
  const status = error.response?.status;
  const apiMessage = error.response?.data?.error?.message || error.message;
  if (status === 404 || /model.*not exist|model_not_found/i.test(apiMessage || '')) {
    return `Groq model not available (${apiMessage}). Set GROQ_MODEL to a model your key can access (e.g. openai/gpt-oss-20b).`;
  }
  if (status === 401 || status === 403) {
    return 'Groq API key is invalid or missing permissions. Check GROQ_API_KEY.';
  }
  if (status === 429) {
    return 'Groq rate limit reached. Please try again in a moment.';
  }
  return apiMessage || 'Groq request failed';
}

function isRetryableGroqError(error) {
  const status = error.response?.status;
  const message = error.response?.data?.error?.message || error.message || '';
  return (
    status === 400 ||
    status === 404 ||
    status === 429 ||
    status === 503 ||
    /model_not_found|does not exist|json_object|response_format|Empty Groq|Invalid JSON/i.test(message)
  );
}

function extractMessageText(message) {
  if (!message) return '';
  const parts = [message.content, message.reasoning].filter(Boolean);
  return parts.map((p) => String(p)).join('\n').trim();
}

function parseJsonContent(content) {
  const cleaned = String(content || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned) {
    throw new Error('Empty Groq response');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    if (start === -1) {
      throw new Error('Invalid JSON from Groq');
    }
    let depth = 0;
    for (let i = start; i < cleaned.length; i += 1) {
      const ch = cleaned[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(cleaned.slice(start, i + 1));
        }
      }
    }
    throw new Error('Invalid JSON from Groq');
  }
}

async function postGroq(model, prompt, { json } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: json ? 0.1 : 0.4,
  };
  if (json) {
    body.response_format = { type: 'json_object' };
  }

  const response = await axios.post(GROQ_API_URL, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  return response.data?.choices?.[0]?.message;
}

async function callGroqJson(prompt, { models } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const chain = uniqueModels(models || DEFAULT_MODEL_CHAIN);
  let lastError;

  for (const model of chain) {
    for (const jsonMode of [true, false]) {
      try {
        const message = await postGroq(model, prompt, { json: jsonMode });
        const content = extractMessageText(message);
        return parseJsonContent(content);
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Groq model ${model} (json=${jsonMode}) failed:`, formatGroqError(error));
        if (!isRetryableGroqError(error) && error.response?.status !== undefined) {
          break;
        }
      }
    }
  }

  throw new Error(formatGroqError(lastError || new Error('Groq request failed')));
}

async function callGroqText(prompt, { models } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const chain = uniqueModels(models || DEFAULT_MODEL_CHAIN);
  let lastError;

  for (const model of chain) {
    try {
      const message = await postGroq(model, prompt, { json: false });
      const content = extractMessageText(message);
      if (!content) {
        throw new Error('Empty Groq response');
      }
      return content;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Groq model ${model} failed:`, formatGroqError(error));
      if (!isRetryableGroqError(error) && error.response?.status !== undefined) {
        break;
      }
    }
  }

  throw new Error(formatGroqError(lastError || new Error('Groq request failed')));
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

function heuristicAtsAnalysis({ resumeText, jobDescription }) {
  const jdTokens = [...new Set(tokenize(jobDescription))];
  const resumeTokens = new Set(tokenize(resumeText));
  const matching = jdTokens.filter((t) => resumeTokens.has(t));
  const missing = jdTokens.filter((t) => !resumeTokens.has(t)).slice(0, 12);
  const coverage =
    jdTokens.length > 0 ? Math.round((matching.length / jdTokens.length) * 100) : 50;
  const overall = Math.max(20, Math.min(92, coverage));

  return {
    overallScore: overall,
    atsScore: Math.max(15, overall - 5),
    skillMatchScore: coverage,
    experienceScore: Math.max(25, overall - 10),
    keywordCoverage: coverage,
    missingSkills: missing.slice(0, 8),
    strengths: matching.length
      ? [`Resume covers ${matching.slice(0, 6).join(', ')}`]
      : ['Resume was parsed successfully'],
    weaknesses: missing.length
      ? [`Consider adding: ${missing.slice(0, 5).join(', ')}`]
      : ['Add more measurable outcomes'],
    recommendations: [
      'Mirror exact keywords from the job description in your skills section',
      'Quantify impact with metrics (%, $, time saved)',
      'Keep formatting ATS-simple (no tables/text boxes)',
    ],
    bulletImprovements: [],
    wordingSuggestions: [],
    projectEnhancements: [],
    source: 'heuristic',
    analyzedAt: new Date(),
  };
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
${String(jobDescription || '').slice(0, 8000)}

Resume:
${String(resumeText || '').slice(0, 12000)}`;

  try {
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
  } catch (error) {
    console.warn('⚠️ Groq ATS failed, using heuristic analysis:', error.message);
    const fallback = heuristicAtsAnalysis({ resumeText, jobDescription });
    fallback.recommendations = [
      `AI scoring unavailable (${error.message}). Showing keyword-based estimate.`,
      ...fallback.recommendations,
    ];
    return fallback;
  }
}

module.exports = {
  callGroqJson,
  callGroqText,
  analyzeResumeWithGroq,
  clampScore,
  heuristicAtsAnalysis,
};
