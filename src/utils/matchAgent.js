const fs = require('fs');
const pdfParse = require('pdf-parse');
const { getEmbedding, cosineSimilarity } = require('./vectorUtils');
const Job = require('../models/Job');

// Match JD with Resume PDF
async function matchResumeWithJD(jobId, resumePath) {
  try {
    // 1. Get JD from DB
    const job = await Job.findById(jobId);
    const jdText = job.description;

    // 2. Read resume file
    const resumeBuffer = fs.readFileSync(resumePath);
    const pdfData = await pdfParse(resumeBuffer);
    const resumeText = pdfData.text;

    // 3. Get embeddings (you'll add OpenAI/HF later)
    const jdEmbedding = await getEmbedding(jdText);
    const resumeEmbedding = await getEmbedding(resumeText);

    // 4. Cosine similarity score
    const score = cosineSimilarity(jdEmbedding, resumeEmbedding);

    return { score: (score * 100).toFixed(2) + '%' };
  } catch (err) {
    console.error('Matching agent failed:', err);
    return { error: 'Could not calculate match score' };
  }
}

module.exports = matchResumeWithJD;
