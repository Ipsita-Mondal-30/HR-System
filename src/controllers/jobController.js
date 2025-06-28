const Job = require('../models/Job');
require('../models/Department');
require('../models/Role');
const mongoose = require('mongoose');


const createJob = async (req, res) => {
    try {
      const { title, department, role, description } = req.body;
  
      const job = await Job.create({
        title,
        department,
role,

        description,
        createdBy: req.user._id,
      });
  
      console.log("Creating Job:", { department, role });
      res.status(201).json(job);
      
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Job creation failed" });
    }
    

  }
const getJobs = async (req, res) => {
    const jobs = await Job.find()
      .populate('department', 'name')
      .populate('role', 'title')
      .populate('createdBy', 'name email');
  
    res.json(jobs);
  };

module.exports = { createJob, getJobs };
