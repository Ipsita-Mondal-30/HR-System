const express = require('express');
const router = express.Router();
const { verifyJWT, isCandidate } = require('../middleware/auth');
const ApplicationDraft = require('../models/ApplicationDraft');
const upload = require('../middleware/upload');

// Save application draft
router.post('/save', verifyJWT, isCandidate, upload.single('resume'), async (req, res) => {
  try {
    const { jobId, ...formData } = req.body;
    const userId = req.user._id;

    // Delete existing draft for this job
    await ApplicationDraft.findOneAndDelete({ candidate: userId, job: jobId });

    // Save resume file info if uploaded
    let resumeFile = null;
    if (req.file) {
      resumeFile = {
        filename: req.file.filename,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size
      };
    }

    // Create new draft
    const draft = new ApplicationDraft({
      candidate: userId,
      job: jobId,
      formData: {
        coverLetter: formData.coverLetter || '',
        portfolio: formData.portfolio || '',
        linkedIn: formData.linkedIn || '',
        github: formData.github || '',
        expectedSalary: formData.expectedSalary || '',
        availableStartDate: formData.availableStartDate || '',
        whyInterested: formData.whyInterested || '',
        phone: formData.phone || '',
        location: formData.location || '',
        experience: formData.experience || ''
      },
      resumeFile: resumeFile
    });

    await draft.save();

    res.json({
      message: 'Draft saved successfully',
      draft: {
        _id: draft._id,
        jobId: draft.job,
        formData: draft.formData,
        expiresAt: draft.expiresAt
      }
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Get draft for a specific job
router.get('/job/:jobId', verifyJWT, isCandidate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { jobId } = req.params;

    const draft = await ApplicationDraft.findOne({
      candidate: userId,
      job: jobId
    }).populate('job', 'title companyName');

    if (!draft) {
      return res.json({ draft: null });
    }

    res.json({ draft });
  } catch (error) {
    console.error('Error fetching draft:', error);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
});

// Get all drafts for user
router.get('/', verifyJWT, isCandidate, async (req, res) => {
  try {
    const userId = req.user._id;

    const drafts = await ApplicationDraft.find({
      candidate: userId
    }).populate('job', 'title companyName location').sort({ updatedAt: -1 });

    res.json({ drafts });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Delete draft
router.delete('/:draftId', verifyJWT, isCandidate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { draftId } = req.params;

    const draft = await ApplicationDraft.findOneAndDelete({
      _id: draftId,
      candidate: userId
    });

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    res.json({ message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

module.exports = router;

