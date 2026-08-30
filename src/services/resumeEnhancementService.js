function safeSlice(value, n) {
  return String(value || '').slice(0, n);
}

async function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) return null;

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return genAI.getGenerativeModel({ model: modelName });
}

async function tryGeminiText(prompt) {
  try {
    const model = await getGeminiModel();
    if (!model) return null;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text || null;
  } catch (err) {
    console.warn('Gemini text generation failed:', err.message);
    return null;
  }
}

async function tryGroqText(prompt) {
  try {
    const { callGroqText } = require('./groqAtsService');
    const text = await callGroqText(prompt);
    return text?.trim() || null;
  } catch (err) {
    console.warn('Groq text generation failed:', err.message);
    return null;
  }
}

function templateCoverLetter({ candidateName, resumeText, jobTitle, companyName }) {
  const company = companyName || 'your company';
  const role = jobTitle || 'this role';
  const name = candidateName || 'Candidate';
  const highlight = String(resumeText || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const body = highlight
    ? `My background includes ${highlight}${highlight.length >= 280 ? '…' : ''}`
    : 'I would welcome the opportunity to contribute my skills and experience to your team.';

  return `Dear Hiring Manager,

I am writing to express my interest in the ${role} position at ${company}. ${body}

I am eager to bring this experience to ${company} and would welcome the chance to discuss how I can contribute to your team.

Thank you for your time and consideration.

Sincerely,
${name}`;
}

async function rewriteResumeBullets({ resumeText, jobDescription, analysis }) {
  const prompt = `You are an expert resume writer.

Rewrite the resume experience/project bullets to better match the job description.
Return ONLY a plain-text list of improved bullet points (one per line, starting with •).

Job Description:
${safeSlice(jobDescription, 4000)}

Current Resume:
${safeSlice(resumeText, 8000)}

Missing skills to address where honest: ${(analysis?.missingSkills || []).join(', ')}

Recommendations: ${(analysis?.recommendations || []).join('; ')}`;

  const text = (await tryGeminiText(prompt)) || (await tryGroqText(prompt));
  if (text) return text;
  throw new Error('Resume rewrite is unavailable right now. Please try again shortly.');
}

async function generateCoverLetter({ candidateName, resumeText, jobDescription, jobTitle, companyName }) {
  const prompt = `Write a professional cover letter for this job application.

Candidate: ${candidateName || 'Candidate'}
Job Title: ${jobTitle || 'Role'}
Company: ${companyName || 'Company'}

Job Description:
${safeSlice(jobDescription, 4000)}

Resume Summary:
${safeSlice(resumeText, 4000)}

Return only the cover letter text. Keep it concise (3-4 paragraphs).`;

  return (
    (await tryGeminiText(prompt)) ||
    (await tryGroqText(prompt)) ||
    templateCoverLetter({ candidateName, resumeText, jobTitle, companyName })
  );
}

module.exports = {
  rewriteResumeBullets,
  generateCoverLetter,
};
