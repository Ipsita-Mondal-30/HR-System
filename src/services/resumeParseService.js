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

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return [item.degree, item.school, item.title, item.company, item.name, item.description]
          .filter(Boolean)
          .join(' — ')
          .trim();
      }
      return String(item || '').trim();
    })
    .filter(Boolean);
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
      name: typeof data.name === 'string' ? data.name : '',
      email: typeof data.email === 'string' ? data.email : '',
      phone: typeof data.phone === 'string' ? data.phone : '',
      skills: asStringArray(data.skills),
      education: asStringArray(data.education),
      projects: Array.isArray(data.projects) ? asStringArray(data.projects) : [],
      experience: asStringArray(data.experience),
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
  if (!resumeText) {
    throw new Error('Could not extract text from the resume PDF');
  }
  const parsedResume = await parseResumeFields(resumeText);
  return { resumeText, parsedResume };
}

module.exports = {
  extractTextFromPdf,
  parseResumeFields,
  parseResumeFromSource,
};
