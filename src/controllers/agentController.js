const axios = require('axios');
const pdfParse = require('pdf-parse');
const Application = require('../models/Application');

// Helper to extract skills
function extractSkills(text) {
  const skillList = [
    'Java', 'Spring Boot', 'MongoDB', 'React', 'Node.js',
    'JavaScript', 'Python', 'TypeScript', 'Docker', 'Kubernetes',
    'AWS', 'CI/CD', 'Git', 'PostgreSQL', 'MySQL'
  ];

  return skillList.filter(skill =>
    new RegExp(`\\b${skill}\\b`, 'i').test(text)
  );
}

const getMatchScore = async (req, res) => {
  try {
    const { applicationId } = req.params;
    console.log("🛰️ Incoming Request:", JSON.stringify(req.body, null, 2));
    console.log("🔍 Application ID received:", applicationId);

    const application = await Application.findById(applicationId).populate('job');
    if (!application) return res.status(404).json({ error: "Application not found" });
    if (!application.job) return res.status(404).json({ error: "Job not found for this application" });

    const { resumeUrl } = application;
    const { description } = application.job;

    console.log("📄 Resume URL:", resumeUrl);

    // Fetch PDF
    const response = await axios.get(resumeUrl, { responseType: 'arraybuffer' });
    const resumeBuffer = response.data;

    // Extract text
    const resumeData = await pdfParse(resumeBuffer);
    const resumeText = resumeData.text;

    // Match logic
    const resumeSkills = extractSkills(resumeText);
    const jdSkills = extractSkills(description);

    const matchingSkills = resumeSkills.filter(skill => jdSkills.includes(skill));
    const missingSkills = jdSkills.filter(skill => !resumeSkills.includes(skill));

    const score = Math.round((matchingSkills.length / jdSkills.length) * 100) || 0;

    res.json({
      matchScore: score,
      matchingSkills,
      missingSkills,
      resumePreview: resumeText.slice(0, 300),
      jobDescription: description.slice(0, 300),
      reason: score > 80
        ? "Strong match – candidate has most required skills."
        : "Weaker match – missing some key job requirements."
    });

  } catch (err) {
    console.error("🔥 Agent Error:", err.message);
    res.status(500).json({ error: "Agent failed" });
  }
};

module.exports = { getMatchScore };
