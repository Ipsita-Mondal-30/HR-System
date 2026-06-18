async function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return genAI.getGenerativeModel({ model: modelName });
}

async function rewriteResumeBullets({ resumeText, jobDescription, analysis }) {
  const model = await getGeminiModel();
  const prompt = `You are an expert resume writer.

Rewrite the resume experience/project bullets to better match the job description.
Return ONLY a plain-text list of improved bullet points (one per line, starting with •).

Job Description:
${jobDescription.slice(0, 4000)}

Current Resume:
${resumeText.slice(0, 8000)}

Missing skills to address where honest: ${(analysis?.missingSkills || []).join(', ')}

Recommendations: ${(analysis?.recommendations || []).join('; ')}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateCoverLetter({ candidateName, resumeText, jobDescription, jobTitle, companyName }) {
  const model = await getGeminiModel();
  const prompt = `Write a professional cover letter for this job application.

Candidate: ${candidateName || 'Candidate'}
Job Title: ${jobTitle || 'Role'}
Company: ${companyName || 'Company'}

Job Description:
${jobDescription.slice(0, 4000)}

Resume Summary:
${resumeText.slice(0, 4000)}

Return only the cover letter text. Keep it concise (3-4 paragraphs).`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = {
  rewriteResumeBullets,
  generateCoverLetter,
};
