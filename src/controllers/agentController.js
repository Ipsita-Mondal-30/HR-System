const axios = require('axios');
const pdfParse = require('pdf-parse');
const Application = require('../models/Application');
const { sendEmail } = require('../utils/email');
const { CohereClient } = require("cohere-ai"); // ✅ New import

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY, // ✅ No .init()
});


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

    const application = await Application.findById(applicationId)
      .populate({ path: 'job', populate: { path: 'createdBy', select: 'email' } });

    if (!application || !application.job) {
      return res.status(404).json({ error: "Application or job not found" });
    }

    const { resumeUrl } = application;
    const { description } = application.job;
    const hrEmail = application.job.createdBy?.email;
    const candidateEmail = application.email;
    const candidateName = application.name;
    const jobTitle = application.job.title;

    const response = await axios.get(resumeUrl, { responseType: 'arraybuffer' });
    const resumeData = await pdfParse(response.data);
    const resumeText = resumeData.text;

    // Step 1: Keyword Matching
    const resumeSkills = extractSkills(resumeText);
    const jdSkills = extractSkills(description);
    const matchingSkills = resumeSkills.filter(skill => jdSkills.includes(skill));
    const missingSkills = jdSkills.filter(skill => !resumeSkills.includes(skill));
    const keywordScore = Math.round((matchingSkills.length / jdSkills.length) * 100) || 0;

    // Step 2: Cohere Evaluation
    const prompt = `
You are an AI assistant helping to evaluate a job application. Based on the resume text and job description, give:
1. A match score between 0 and 100.
2. A one-line explanation.
3. Tags (skills or roles) in JSON array format.

Resume:
${resumeText}

Job Description:
${description}

Respond in the format:
{
  "matchScore": 82,
  "explanation": "Strong alignment with backend technologies.",
  "tags": ["Java", "Spring Boot", "MongoDB"]
}
    `.trim();

    const cohereResponse = await cohere.chat({
      model: "command-r",
      message: `You are a smart hiring assistant. A candidate has applied for a job. Give a match score between 0 to 100 based on how well the resume matches the job description.
      
    Resume:
    ${resumeText}
    
    Job Description:
    ${description}
    
    Respond in JSON format:
    {
      "matchScore": number (0-100),
      "explanation": string,
      "tags": string[]
    }
    `,
      temperature: 0.3,
    });

    // Parse Cohere response
    let parsed;
    try {
      // Remove code block markers if present
      let jsonText = cohereResponse.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      }
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing Cohere response:', parseError);
      // Fallback to default values
      parsed = {
        matchScore: keywordScore,
        explanation: "AI analysis completed based on keyword matching.",
        tags: matchingSkills.slice(0, 3)
      };
    }


    const finalScore = Math.round((keywordScore + parsed.matchScore) / 2);

    // Step 3: Save to DB
    application.matchScore = finalScore;
    application.matchInsights = {
      matchScore: parsed.matchScore, // <-- fix here
      explanation: parsed.explanation,
      tags: parsed.tags,
      matchingSkills,
      missingSkills,
    };
    await application.save();

    // Step 4: Notify HR
    if (hrEmail) {
      let subject, html;
      if (finalScore >= 85) {
        subject = `🌟 Strong Candidate: ${candidateName}`;
        html = `<h3>Top Match Found!</h3>
          <p><b>${candidateName}</b> scored <b>${finalScore}</b>/100 for <strong>${jobTitle}</strong>.</p>
          <p>AI Tags: ${parsed.tags.join(', ')}</p>
          <p><a href="${resumeUrl}">📄 View Resume</a></p>`;
      } else if (finalScore >= 60) {
        subject = `🤔 Medium Match: ${candidateName}`;
        html = `<h3>Medium Fit</h3>
          <p><b>${candidateName}</b> scored <b>${finalScore}</b> for <strong>${jobTitle}</strong>.</p>
          <p>AI Tags: ${parsed.tags.join(', ')}</p>
          <p><a href="${resumeUrl}">📄 View Resume</a></p>`;
      } else {
        subject = `⚠️ Low Match: ${candidateName}`;
        html = `<h3>Low Fit</h3>
          <p><b>${candidateName}</b> scored <b>${finalScore}</b> for <strong>${jobTitle}</strong>.</p>
          <p>AI Tags: ${parsed.tags.join(', ')}</p>
          <p><a href="${resumeUrl}">📄 View Resume</a></p>`;
      }
      await sendEmail({ to: hrEmail, subject, html });
    }

    // Step 5: Notify Candidate
    if (candidateEmail) {
      await sendEmail({
        to: candidateEmail,
        subject: `Your Application Score for "${jobTitle}"`,
        html: `
          <h3>Thanks for Applying!</h3>
          <p>You scored <b>${finalScore}</b>/100 for <strong>${jobTitle}</strong>.</p>
          <p>Feedback: ${parsed.explanation}</p>
        `
      });
    }
    let tags = parsed.tags;
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags.replace(/'/g, '"'));
      } catch (e) {
        tags = [];
      }
    }

    // Step 6: Final Response
    res.json({
      matchScore: finalScore,
      explanation: parsed.explanation,
      matchingSkills,
      missingSkills,
      tags,
      resumePreview: resumeText.slice(0, 300),
    });

  } catch (err) {
    console.error("🔥 Agent Error:", err.message);
    res.status(500).json({ error: "Agent failed" });
  }
};

// General AI text generation function
const generateResponse = async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('🤖 Generating AI response for prompt length:', prompt.length);

    // Use Cohere for text generation
    const cohereResponse = await cohere.chat({
      model: "command-r",
      message: prompt,
      temperature: 0.7,
      max_tokens: 1000
    });

    console.log('✅ AI response generated successfully');
    
    res.json({
      response: cohereResponse.text,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error("🔥 AI Generation Error:", err.message);
    
    // Provide a fallback response
    res.json({
      response: "AI service temporarily unavailable. Please try again later.",
      error: true,
      generatedAt: new Date().toISOString()
    });
  }
};

module.exports = { getMatchScore, generateResponse };
