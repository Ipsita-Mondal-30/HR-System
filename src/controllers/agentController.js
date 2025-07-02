const axios = require('axios');
const pdfParse = require('pdf-parse');
const Application = require('../models/Application');
const { sendEmail } = require('../utils/email');

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

    const application = await Application.findById(applicationId)
    .populate({
      path: 'job',
      populate: { path: 'createdBy', select: 'email' }
    });
    if (!application) return res.status(404).json({ error: "Application not found" });
    if (!application.job) return res.status(404).json({ error: "Job not found for this application" });

    const { resumeUrl } = application;
    const { description } = application.job;
    const hrEmail = application.job.createdBy?.email;
    const candidateEmail = application.email;
    const candidateName = application.name;
    const jobTitle = application.job.title;
    const resumeLink = application.resumeUrl;

    console.log("📄 Resume URL:", resumeUrl);

    // Step 1: Download PDF from Cloudinary
    const response = await axios.get(resumeUrl, { responseType: 'arraybuffer' });
    const resumeBuffer = response.data;

    // Step 2: Extract text
    const resumeData = await pdfParse(resumeBuffer);
    const resumeText = resumeData.text;

    // Step 3: Match logic
    const resumeSkills = extractSkills(resumeText);
    const jdSkills = extractSkills(description);

    const matchingSkills = resumeSkills.filter(skill => jdSkills.includes(skill));
    const missingSkills = jdSkills.filter(skill => !resumeSkills.includes(skill));
    const score = Math.round((matchingSkills.length / jdSkills.length) * 100) || 0;

    // Save score in DB
    application.matchScore = score;
    await application.save();

    // Email to HR
    if (hrEmail) {
      let subject, html;

      if (score >= 85) {
        subject = `🌟 Strong Candidate: ${candidateName}`;
        html = `
          <h3>Top Match Found!</h3>
          <p><b>${candidateName}</b> scored <b>${score}</b>/100 for <strong>${jobTitle}</strong>.</p>
          <p><a href="${resumeLink}">📄 View Resume</a></p>`;
      } else if (score >= 60) {
        subject = `🤔 Medium Match: ${candidateName}`;
        html = `
          <h3>Medium Fit Candidate</h3>
          <p><b>${candidateName}</b> scored <b>${score}</b> for <strong>${jobTitle}</strong>.</p>
          <p><a href="${resumeLink}">📄 View Resume</a></p>`;
      } else {
        subject = `⚠️ Low Match: ${candidateName}`;
        html = `
          <h3>Low Fit Detected</h3>
          <p><b>${candidateName}</b> scored <b>${score}</b> for <strong>${jobTitle}</strong>.</p>
          <p><a href="${resumeLink}">📄 View Resume</a></p>`;
      }

      await sendEmail({ to: hrEmail, subject, html });
      console.log("📬 Email sent to HR:", subject);
    }

    // Email to candidate
    if (candidateEmail) {
    await sendEmail({
      to: candidateEmail,
      subject: `Your Application Score for "${jobTitle}"`,
      html: `
        <h3>Thanks for Applying!</h3>
        <p>You scored <b>${score}</b>/100 for <strong>${jobTitle}</strong>.</p>
        ${
          score >= 85
            ? `<p>We're excited by your profile. Expect to hear from us soon!</p>`
            : score >= 60
            ? `<p>We'll evaluate and may reach out for next steps.</p>`
            : `<p>Currently, we're prioritizing stronger matches. We'll keep you in our system.</p>`
        }`
    });
    }

    // Final response
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
