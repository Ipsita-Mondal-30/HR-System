const Application = require('../models/Application');
const ResumeAnalysisHistory = require('../models/ResumeAnalysisHistory');
const {
  analyzeApplicationById,
  analyzeUploadedResume,
  getAnalysisHistory,
  extractJobDescriptionFromPdf,
} = require('../services/applicationAnalysisService');
const { rewriteResumeBullets, generateCoverLetter } = require('../services/resumeEnhancementService');
const { validateResumeFile } = require('../utils/resumeValidation');
const { uploadPdfBuffer } = require('../utils/cloudinaryUpload');
const resumeUpload = require('../middleware/resumeAnalysisUpload');

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

      const resumeUrl = await uploadPdfBuffer(resumeFile.buffer, 'resumes', resumeFile.originalname);

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
      res.status(500).json({ error: error.message || 'Resume analysis failed' });
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
    res.status(500).json({ error: error.message || 'Application analysis failed' });
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
      const candidateId = req.user._id?.toString();
      const ownerId = application.candidate?.toString() || application.user?.toString();
      if (ownerId !== candidateId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const coverLetter = await generateCoverLetter({
      candidateName: application.name,
      resumeText: application.resumeText || '',
      jobDescription: application.jobDescriptionText || application.job?.description || '',
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
