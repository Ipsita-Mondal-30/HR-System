const express = require('express');
const router = express.Router();
const controller = require('../controllers/interviewController');

// Schedule
router.post('/', controller.scheduleInterview);

// View all
router.get('/', controller.getAllInterviews);

// Generate interview questions
router.get('/:interviewId/questions', controller.generateInterviewQuestions);

module.exports = router;
