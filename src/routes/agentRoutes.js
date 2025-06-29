const express = require('express');
const router = express.Router();
const matchResumeWithJD = require('../utils/matchAgent');
const Application = require('../models/Application');
const agentController = require('../controllers/agentController');

router.get('/test-apps', async (req, res) => {
    const apps = await Application.find();
    res.json(apps);
  });
  

  
  
  router.get('/match-score/:applicationId', agentController.getMatchScore);
  
  module.exports = router;
  
module.exports = router;
