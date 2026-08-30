const Application = require('../models/Application');
const User = require('../models/User');
const ResumeAnalysisHistory = require('../models/ResumeAnalysisHistory');
const {
  analyzeApplicationById,
  analyzeUploadedResume,
  getAnalysisHistory,
  extractJobDescriptionFromPdf,
} = require('../services/applicationAnalysisService');
const { rewriteResumeBullets, generateCoverLetter } = require('../services/resumeEnhancementService');
const { extractTextFromPdf } = require('../services/resumeParseService');
const { validateResumeFile } = require('../utils/resumeValidation');
const { uploadPdfBuffer } = require('../utils/cloudinaryUpload');
const resumeUpload = require('../middleware/resumeAnalysisUpload');

function requestUserId(req) {
  return String(req.user?._id || req.user?.id || '');
}

function idString(value) {
  if (!value) return '';
  if (value._id) return String(value._id);
  return String(value);
}

function looksLikeProfileStub(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (t.length < 80) return true;
  return /Why interested:/i.test(t) && /^(Name:|Skills:)/i.test(t);
}

function parsedResumeToText(parsed) {
  if (!parsed) return '';
  return [
    parsed.name && `Name: ${parsed.name}`,
    parsed.email && `Email: ${parsed.email}`,
    parsed.skills?.length && `Skills: ${parsed.skills.join(', ')}`,
    parsed.experience?.length && `Experience:\n${parsed.experience.join('\n')}`,
    parsed.projects?.length && `Projects:\n${parsed.projects.join('\n')}`,
    parsed.education?.length && `Education:\n${parsed.education.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function profileToText(user) {
  if (!user) return '';
  return [
    user.name && `Name: ${user.name}`,
    user.email && `Email: ${user.email}`,
    user.phone && `Phone: ${user.phone}`,
    user.location && `Location: ${user.location}`,
    user.experience && `Experience: ${user.experience}`,
    user.skills?.length && `Skills: ${user.skills.join(', ')}`,
    user.bio && `Bio: ${user.bio}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function tryExtractResume(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return '';
  try {
    const text = await extractTextFromPdf(url);
    return String(text || '').trim();
  } catch (err) {
    console.warn('Cover letter resume PDF parse failed:', err.message);
    return '';
  }
}

async function resolveCoverLetterResume(application) {
  const pdfUrl = application.resumeUrl || application.resumeFile?.url;
  const fromPdf = await tryExtractResume(pdfUrl);
  if (fromPdf.length > 50) {
    if (!application.resumeText || looksLikeProfileStub(application.resumeText)) {
      application.resumeText = fromPdf.slice(0, 15000);
    }
    return fromPdf;
  }

  const parsed = parsedResumeToText(application.parsedResume);
  if (parsed.length > 40) return parsed;

  if (application.resumeText && !looksLikeProfileStub(application.resumeText)) {
    return application.resumeText;
  }

  const ownerId = idString(application.candidate) || idString(application.user);
  const user = ownerId ? await User.findById(ownerId) : null;
  const fromProfilePdf = await tryExtractResume(user?.resumeUrl);
  if (fromProfilePdf.length > 50) return fromProfilePdf;

  return [application.resumeText, profileToText(user)].filter(Boolean).join('\n').trim();
}

function handleUpload(req, res, next) {
  resumeUpload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'jobDescriptionPdf', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File must be 10 MB or smaller' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    next();
  });
}

exports.analyzeResume = [
  handleUpload,
  async (req, res) => {
    try {
      const resumeFile = req.files?.resume?.[0];
      const jdPdfFile = req.files?.jobDescriptionPdf?.[0];
      const {
        jobDescriptionText: pastedJd,
        jobTitle,
        companyName,
        applicationId,
      } = req.body;

      if (!resumeFile?.buffer) {
        return res.status(400).json({ error: 'Resume PDF is required' });
      }

      const validation = validateResumeFile(resumeFile);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      let jobDescriptionText = pastedJd || '';
      let jobDescriptionSource = 'paste';

      if (jdPdfFile?.buffer) {
        jobDescriptionText = await extractJobDescriptionFromPdf(jdPdfFile.buffer);
        jobDescriptionSource = 'pdf';
      }

      if (!jobDescriptionText?.trim()) {
        return res.status(400).json({ error: 'Job description is required (paste text or upload PDF)' });
      }

      let resumeUrl = '';
      try {
        resumeUrl = await uploadPdfBuffer(resumeFile.buffer, 'resumes', resumeFile.originalname);
      } catch (uploadErr) {
        console.warn('Resume Cloudinary upload skipped:', uploadErr.message);
      }

      const result = await analyzeUploadedResume({
        resumeSource: resumeFile.buffer,
        resumeUrl,
        resumeFileName: resumeFile.originalname,
        resumeSizeBytes: resumeFile.size,
        jobDescriptionText,
        jobDescriptionSource,
        jobTitle,
        companyName,
        applicationId: applicationId || undefined,
        candidateId: req.user?.role === 'candidate' ? req.user._id : undefined,
        createdBy: req.user?._id,
        sendEmails: Boolean(applicationId),
      });

      res.json({
        message: 'Resume analyzed successfully',
        ...result,
      });
    } catch (error) {
      console.error('Resume analysis failed:', error);
      const message = error.message || 'Resume analysis failed';
      const status =
        /GROQ_API_KEY|not configured|invalid or missing/i.test(message) ? 503 :
        /model not available|GROQ_MODEL/i.test(message) ? 503 :
        500;
      res.status(status).json({ error: message });
    }
  },
];

exports.analyzeApplication = async (req, res) => {
  try {
    const result = await analyzeApplicationById(req.params.applicationId, {
      createdBy: req.user?._id,
      sendEmails: true,
    });
    res.json({ message: 'Application analyzed successfully', ...result });
  } catch (error) {
    console.error('Application analysis failed:', error);
    const message = error.message || 'Application analysis failed';
    const status =
      /not found/i.test(message) ? 404 :
      /No resume found/i.test(message) ? 400 :
      /GROQ_API_KEY|not configured|invalid or missing/i.test(message) ? 503 :
      500;
    res.status(status).json({ error: message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const history = await getAnalysisHistory(applicationId);
    res.json(history);
  } catch (error) {
    console.error('Failed to fetch analysis history:', error);
    res.status(500).json({ error: 'Failed to fetch analysis history' });
  }
};

exports.getApplicationAnalysis = async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId)
      .populate('job', 'title companyName description')
      .select('name email matchScore atsAnalysis parsedResume matchInsights resumeUrl jobDescriptionText jobDescriptionSource resumeFile');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const history = await getAnalysisHistory(req.params.applicationId);
    res.json({ application, history });
  } catch (error) {
    console.error('Failed to fetch application analysis:', error);
    res.status(500).json({ error: 'Failed to fetch application analysis' });
  }
};

exports.rewriteResume = async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId).populate('job', 'title companyName description');
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const resumeText = application.resumeText || '';
    const jobDescription =
      application.jobDescriptionText || application.job?.description || application.job?.title || '';
    const improvedBullets = await rewriteResumeBullets({
      resumeText,
      jobDescription,
      analysis: application.atsAnalysis,
    });

    application.atsAnalysis = application.atsAnalysis || {};
    application.atsAnalysis.improvedBullets = improvedBullets;
    await application.save();

    const latestHistory = await ResumeAnalysisHistory.findOne({ application: application._id }).sort({ createdAt: -1 });
    if (latestHistory) {
      latestHistory.improvedBullets = improvedBullets;
      await latestHistory.save();
    }

    res.json({ improvedBullets });
  } catch (error) {
    console.error('Resume rewrite failed:', error);
    res.status(500).json({ error: error.message || 'Resume rewrite failed' });
  }
};

exports.generateCoverLetter = async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId).populate('job', 'title companyName description');
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (req.user?.role === 'candidate') {
      const candidateId = requestUserId(req);
      const ownerIds = [application.candidate, application.user].map(idString).filter(Boolean);
      const emailMatch =
        req.user.email &&
        application.email &&
        String(req.user.email).toLowerCase() === String(application.email).toLowerCase();
      if (ownerIds.length && candidateId && !ownerIds.includes(candidateId) && !emailMatch) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const resumeText = await resolveCoverLetterResume(application);
    const jobDescription =
      application.jobDescriptionText || application.job?.description || application.job?.title || '';

    if (!resumeText) {
      return res.status(400).json({
        error:
          'No resume found for this application. Upload a PDF resume on your profile or when applying, then try again.',
      });
    }

    const coverLetter = await generateCoverLetter({
      candidateName: application.name,
      resumeText,
      jobDescription,
      jobTitle: application.job?.title,
      companyName: application.job?.companyName,
    });

    application.generatedCoverLetter = coverLetter;
    await application.save();

    const latestHistory = await ResumeAnalysisHistory.findOne({ application: application._id }).sort({ createdAt: -1 });
    if (latestHistory) {
      latestHistory.coverLetter = coverLetter;
      await latestHistory.save();
    }

    res.json({ generatedCoverLetter: coverLetter, coverLetter });
  } catch (error) {
    console.error('Cover letter generation failed:', error);
    res.status(500).json({ error: error.message || 'Cover letter generation failed' });
  }
};
