const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function evaluateMatchGemini({ resumeText, jobDescription }) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
You are an HR assistant AI. Analyze the following resume and job description.

1. Give a match score between 0 to 100.
2. Explain briefly why the score was given.
3. Suggest 2-3 relevant tags (skills, technologies, role keywords).

Job Description:
"""
${jobDescription}
"""

Resume:
"""
${resumeText}
"""

Format your response as JSON with keys: matchScore, explanation, tags.
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const json = JSON.parse(text);
    return json;
  } catch (err) {
    console.error("❌ Failed to parse Gemini response:", text);
    throw new Error("Gemini response could not be parsed");
  }
}

module.exports = { evaluateMatchGemini };
