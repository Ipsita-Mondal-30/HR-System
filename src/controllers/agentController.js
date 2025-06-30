const axios = require('axios');
const pdfParse = require('pdf-parse');
const Application = require('../models/Application');

const getMatchScore = async (req, res) => {
  try {
    const { applicationId } = req.params;
    console.log("🛰️ Incoming Request:", JSON.stringify(req.body, null, 2));

    console.log("🔍 Application ID received:", applicationId);

    const application = await Application.findById(applicationId).populate('job');
    if (!application) {
      console.log("🚫 No application found in DB");
      return res.status(404).json({ error: "Application not found" });
    }

    const { resumeUrl } = application;
    const { description } = application.job;

    console.log("📄 Resume URL:", resumeUrl);

    // Step 1: Download PDF from Cloudinary
    const response = await axios.get(resumeUrl, { responseType: 'arraybuffer' });
    const resumeBuffer = response.data;

    // Step 2: Extract text from PDF
    const resumeData = await pdfParse(resumeBuffer);
    const resumeText = resumeData.text;

    console.log("📄 Resume Text Extracted:");
    console.log(resumeText.slice(0, 500)); // Log first 500 characters

    // Step 3: (Still dummy scoring for now)
    const score = Math.floor(Math.random() * 30 + 70);

    res.json({
      matchScore: score,
      resumePreview: resumeText.slice(0, 300),
      jobDescription: description.slice(0, 300),
    });

  } catch (err) {
    console.error("🔥 Agent Error:", err.message);
    res.status(500).json({ error: "Agent failed" });
  }
};


module.exports = { getMatchScore };
