// routes/jobRoutes.js
const express = require('express');
const { createJob, getJobs } = require('../controllers/jobController');
const { isHR } = require('../middleware/auth');

const router = express.Router();

router.post('/', isHR, createJob);
router.get('/', getJobs);

console.log('📦 jobRoutes loaded'); // <-- This MUST log on server start

module.exports = router;
