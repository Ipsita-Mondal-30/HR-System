const express = require('express');
const router = express.Router();
const { verifyJWT, isCandidate } = require('../middleware/auth');
const interviewPrepController = require('../controllers/interviewPrepController');
const multer = require('multer');
const path = require('path');

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/interview-videos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'interview-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit per video
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|webm|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'));
    }
  }
});

// Get jobs that candidate has applied to
router.get('/applied-jobs', verifyJWT, isCandidate, interviewPrepController.getAppliedJobs);

// Generate interview questions for a specific job
router.get('/questions/:jobId', verifyJWT, isCandidate, interviewPrepController.generateQuestions);

// Submit practice session with recordings
router.post('/submit', verifyJWT, isCandidate, interviewPrepController.submitPracticeSession);

// Upload video recording
router.post('/upload-video', verifyJWT, isCandidate, upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    res.json({
      message: 'Video uploaded successfully',
      videoUrl: `/uploads/interview-videos/${req.file.filename}`,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Get feedback history
router.get('/feedback-history', verifyJWT, isCandidate, interviewPrepController.getFeedbackHistory);

// Get specific feedback details
router.get('/feedback/:feedbackId', verifyJWT, isCandidate, interviewPrepController.getFeedbackDetails);

module.exports = router;
