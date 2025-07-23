const Job = require('../models/Job');
require('../models/Department');
require('../models/Role');

const mongoose = require('mongoose');

// ✅ CREATE JOB
const createJob = async (req, res) => {
  try {
    if (!req.user) {
      console.error("❌ req.user is undefined");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      title,
      department,
      role,
      description,
      companyName,
      companyLogo,
      companySize,
      location,
      remote,
      employmentType,
      experienceRequired,
      minSalary,
      maxSalary,
      skills,
      tags,
      rating
    } = req.body;

    if (!title || !department || !role || !description) {
      console.error("❌ Missing required fields", req.body);
      return res.status(400).json({ error: "Title, department, role, and description are required" });
    }

    const job = await Job.create({
      title,
      department,
      role,
      description,
      companyName,
      companyLogo,
      companySize,
      location,
      remote,
      employmentType,
      experienceRequired,
      minSalary,
      maxSalary,
      skills,
      tags,
      rating,
      createdBy: req.user._id,
    });

    console.log("✅ Job Created:", job._id);
    res.status(201).json(job);
  } catch (err) {
    console.error("🔥 Job creation failed:", err.message, err);
    res.status(500).json({ error: "Job creation failed", details: err.message });
  }
};

// ✅ GET ALL JOBS
const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate('department', 'name')
      .populate('role', 'title')
      .populate('createdBy', 'name email');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// ✅ GET JOB BY ID
const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('department', 'name')
      .populate('role', 'title')
      .populate('createdBy', 'name email');

    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching job' });
  }
};

// ✅ UPDATE JOB
const updateJob = async (req, res) => {
  try {
    const updatedFields = req.body;
    const job = await Job.findByIdAndUpdate(req.params.id, updatedFields, { new: true });

    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.json(job);
  } catch (err) {
    console.error('❌ Failed to update job:', err);
    res.status(500).json({ error: 'Error updating job' });
  }
};

module.exports = { createJob, getJobs, getJobById, updateJob };
