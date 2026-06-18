const axios = require('axios');
const pdfParse = require('pdf-parse');
const { callGroqJson } = require('./groqAtsService');

async function fetchPdfBuffer(source) {
  if (Buffer.isBuffer(source)) return source;
  if (typeof source === 'string' && source.startsWith('http')) {
    const response = await axios.get(source, {
      responseType: 'arraybuffer',
      timeout: 20000,
    });
    return Buffer.from(response.data);
  }
  throw new Error('Invalid resume source');
}

async function extractTextFromPdf(source) {
  const buffer = await fetchPdfBuffer(source);
  const parsed = await pdfParse(buffer);
  return (parsed.text || '').trim();
}

async function parseResumeFields(resumeText) {
  if (!resumeText || resumeText.length < 20) {
    return {
      name: '',
      email: '',
      phone: '',
      skills: [],
      education: [],
      projects: [],
      experience: [],
    };
  }

  const prompt = `Extract structured resume data from the text below.

Return ONLY valid JSON with this exact shape:
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "skills": ["string"],
  "education": ["string"],
  "projects": ["string"],
  "experience": ["string"]
}

Rules:
- Use empty string or empty arrays when data is missing.
- Do not include markdown or explanations.

Resume text:
${resumeText.slice(0, 12000)}`;

  try {
    const data = await callGroqJson(prompt);
    return {
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      skills: Array.isArray(data.skills) ? data.skills : [],
      education: Array.isArray(data.education) ? data.education : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
      experience: Array.isArray(data.experience) ? data.experience : [],
    };
  } catch (error) {
    console.warn('Groq resume parsing failed, using regex fallback:', error.message);
    return regexParseResume(resumeText);
  }
}

function regexParseResume(text) {
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    name: lines[0] || '',
    email: emailMatch ? emailMatch[0] : '',
    phone: phoneMatch ? phoneMatch[0] : '',
    skills: [],
    education: [],
    projects: [],
    experience: lines.slice(1, 8),
  };
}

async function parseResumeFromSource(source) {
  const resumeText = await extractTextFromPdf(source);
  const parsedResume = await parseResumeFields(resumeText);
  return { resumeText, parsedResume };
}

module.exports = {
  extractTextFromPdf,
  parseResumeFields,
  parseResumeFromSource,
};
