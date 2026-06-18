const Application = require('../models/Application');
const ResumeAnalysisHistory = require('../models/ResumeAnalysisHistory');
const { parseResumeFromSource, extractTextFromPdf } = require('./resumeParseService');
const { analyzeResumeWithGroq } = require('./groqAtsService');
const { sendEmail } = require('../utils/email');

function buildAnalysisEmailHtml({ candidateName, jobTitle, companyName, scores, missingSkills, strengths }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Resume ATS Analysis</h2>
      <p>Hello ${candidateName || 'there'},</p>
      <p>Your resume was analyzed for <strong>${jobTitle || 'the role'}</strong>${companyName ? ` at <strong>${companyName}</strong>` : ''}.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Overall Score</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${scores.overallScore}%</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>ATS Score</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${scores.atsScore}%</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Skill Match</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${scores.skillMatchScore}%</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Experience Score</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${scores.experienceScore}%</td></tr>
      </table>
      ${missingSkills?.length ? `<p><strong>Missing skills:</strong> ${missingSkills.join(', ')}</p>` : ''}
      ${strengths?.length ? `<p><strong>Strengths:</strong> ${strengths.join(', ')}</p>` : ''}
      <p>Log in to your dashboard to view full recommendations and history.</p>
    </div>
  `;
}

async function sendAnalysisEmails({ application, job, scores, analysis }) {
  const candidateEmail = application.email;
  const hrEmail = job?.createdBy?.email;
  const candidateName = application.name || application.parsedResume?.name || 'Candidate';
  const jobTitle = job?.title || 'Position';
  const companyName = job?.companyName || '';

  const html = buildAnalysisEmailHtml({
    candidateName,
    jobTitle,
    companyName,
    scores,
    missingSkills: analysis.missingSkills,
    strengths: analysis.strengths,
  });

  const sends = [];
  if (candidateEmail) {
    sends.push(
      sendEmail({
        to: candidateEmail,
        subject: `Resume Analysis: ${jobTitle}${companyName ? ` @ ${companyName}` : ''}`,
        html,
      }).catch((err) => console.error('Candidate analysis email failed:', err.message))
    );
  }
  if (hrEmail && hrEmail !== candidateEmail) {
    sends.push(
      sendEmail({
        to: hrEmail,
        subject: `Candidate Resume Analysis: ${candidateName} — ${jobTitle}`,
        html: html.replace('Your resume was analyzed', `${candidateName}'s resume was analyzed`),
      }).catch((err) => console.error('HR analysis email failed:', err.message))
    );
  }
  await Promise.all(sends);
}

async function persistAnalysis({
  application,
  job,
  resumeUrl,
  resumeFileName,
  resumeSizeBytes,
  jobDescriptionText,
  jobDescriptionSource,
  resumeText,
  parsedResume,
  analysis,
  createdBy,
  sendEmails = true,
}) {
  const scores = {
    overallScore: analysis.overallScore,
    atsScore: analysis.atsScore,
    skillMatchScore: analysis.skillMatchScore,
    experienceScore: analysis.experienceScore,
    keywordCoverage: analysis.keywordCoverage,
  };

  application.matchScore = analysis.overallScore;
  application.resumeText = resumeText.slice(0, 15000);
  application.jobDescriptionText = jobDescriptionText;
  application.jobDescriptionSource = jobDescriptionSource;
  application.parsedResume = parsedResume;
  application.atsAnalysis = analysis;
  if (resumeUrl) {
    application.resumeFile = {
      originalName: resumeFileName || 'resume.pdf',
      url: resumeUrl,
      mimeType: 'application/pdf',
      sizeBytes: resumeSizeBytes || null,
      uploadedAt: new Date(),
    };
    if (!application.resumeUrl) application.resumeUrl = resumeUrl;
  }
  application.matchInsights = {
    matchScore: analysis.overallScore,
    explanation: analysis.strengths?.[0] || 'Groq ATS analysis completed.',
    summary: analysis.recommendations?.join(' ') || '',
    matchingSkills: parsedResume.skills || [],
    missingSkills: analysis.missingSkills || [],
    strengths: analysis.strengths || [],
    improvements: analysis.weaknesses || [],
    actionPlan: analysis.recommendations || [],
    resumeTips: analysis.bulletImprovements || [],
    interviewTips: analysis.wordingSuggestions || [],
    projectEnhancements: analysis.projectEnhancements || [],
    analyzedAt: analysis.analyzedAt,
    source: 'groq',
  };
  await application.save();

  const history = await ResumeAnalysisHistory.create({
    application: application._id,
    candidate: application.candidate,
    createdBy,
    resumeUrl: resumeUrl || application.resumeUrl,
    resumeFileName: resumeFileName || application.resumeFile?.originalName,
    resumeSizeBytes: resumeSizeBytes || application.resumeFile?.sizeBytes,
    jobDescriptionText,
    jobDescriptionSource,
    jobTitle: job?.title,
    companyName: job?.companyName,
    parsedResume,
    scores,
    missingSkills: analysis.missingSkills,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    recommendations: analysis.recommendations,
    bulletImprovements: analysis.bulletImprovements,
    wordingSuggestions: analysis.wordingSuggestions,
    projectEnhancements: analysis.projectEnhancements,
    source: 'groq',
  });

  if (sendEmails && job) {
    await sendAnalysisEmails({ application, job, scores, analysis });
  }

  return { application, history, scores, analysis };
}

async function analyzeApplicationById(applicationId, { createdBy, sendEmails = true } = {}) {
  const application = await Application.findById(applicationId).populate({
    path: 'job',
    populate: { path: 'createdBy', select: 'email name' },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  const job = application.job;
  const jobDescriptionText =
    application.jobDescriptionText || job?.description || job?.title || 'General role';

  if (!application.resumeUrl) {
    throw new Error('No resume found for this application');
  }

  const { resumeText, parsedResume } = await parseResumeFromSource(application.resumeUrl);
  const analysis = await analyzeResumeWithGroq({ resumeText, jobDescription: jobDescriptionText });

  return persistAnalysis({
    application,
    job,
    resumeUrl: application.resumeUrl,
    resumeFileName: application.resumeFile?.originalName,
    resumeSizeBytes: application.resumeFile?.sizeBytes,
    jobDescriptionText,
    jobDescriptionSource: application.jobDescriptionSource || 'job',
    resumeText,
    parsedResume,
    analysis,
    createdBy,
    sendEmails,
  });
}

async function analyzeUploadedResume({
  resumeSource,
  resumeUrl,
  resumeFileName,
  resumeSizeBytes,
  jobDescriptionText,
  jobDescriptionSource = 'paste',
  jobTitle,
  companyName,
  applicationId,
  candidateId,
  createdBy,
  sendEmails = false,
}) {
  if (!jobDescriptionText?.trim()) {
    throw new Error('Job description is required');
  }

  const { resumeText, parsedResume } = await parseResumeFromSource(resumeSource);
  const analysis = await analyzeResumeWithGroq({
    resumeText,
    jobDescription: jobDescriptionText,
  });

  let application = null;
  let job = null;

  if (applicationId) {
    application = await Application.findById(applicationId).populate({
      path: 'job',
      populate: { path: 'createdBy', select: 'email name' },
    });
    if (!application) throw new Error('Application not found');
    job = application.job;

    return persistAnalysis({
      application,
      job,
      resumeUrl,
      resumeFileName,
      resumeSizeBytes,
      jobDescriptionText,
      jobDescriptionSource,
      resumeText,
      parsedResume,
      analysis,
      createdBy,
      sendEmails,
    });
  }

  const history = await ResumeAnalysisHistory.create({
    application: application?._id,
    candidate: candidateId || application?.candidate,
    createdBy,
    resumeUrl,
    resumeFileName,
    resumeSizeBytes,
    jobDescriptionText,
    jobDescriptionSource,
    jobTitle: jobTitle || job?.title,
    companyName: companyName || job?.companyName,
    parsedResume,
    scores: {
      overallScore: analysis.overallScore,
      atsScore: analysis.atsScore,
      skillMatchScore: analysis.skillMatchScore,
      experienceScore: analysis.experienceScore,
      keywordCoverage: analysis.keywordCoverage,
    },
    missingSkills: analysis.missingSkills,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    recommendations: analysis.recommendations,
    bulletImprovements: analysis.bulletImprovements,
    wordingSuggestions: analysis.wordingSuggestions,
    projectEnhancements: analysis.projectEnhancements,
    source: 'groq',
  });

  return { history, scores: history.scores, analysis, parsedResume, resumeText };
}

async function getAnalysisHistory(applicationId) {
  return ResumeAnalysisHistory.find({ application: applicationId }).sort({ createdAt: -1 });
}

async function extractJobDescriptionFromPdf(buffer) {
  return extractTextFromPdf(buffer);
}

module.exports = {
  analyzeApplicationById,
  analyzeUploadedResume,
  getAnalysisHistory,
  extractJobDescriptionFromPdf,
  persistAnalysis,
};
