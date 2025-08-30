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
      status: 'pending', // Jobs need admin approval before becoming active
      isApproved: false, // Require admin approval for all jobs
    });

    console.log("✅ Job Created:", job._id);
    res.status(201).json(job);
  } catch (err) {
    console.error("🔥 Job creation failed:", err.message, err);
    res.status(500).json({ error: "Job creation failed", details: err.message });
  }
};

// ✅ GET ALL JOBS with filtering and search
const getJobs = async (req, res) => {
  try {
    const {
      keyword,
      role,
      employmentType,
      location,
      companyName,
      companySize,
      experience,
      minSalary,
      remote,
      status = 'open'
    } = req.query;

    // Build filter object - only show approved jobs to candidates
    let filter = {};
    
    // For public view, only show approved jobs with active status
    if (status) {
      if (status === 'open') {
        // Map 'open' to 'active' for compatibility, but only approved jobs
        filter.status = { $in: ['active', 'open'] };
        filter.isApproved = true;
      } else {
        filter.status = status;
        // For any specific status, still only show approved jobs
        filter.isApproved = true;
      }
    } else {
      // Default: show only approved active jobs
      filter.status = { $in: ['active', 'open'] };
      filter.isApproved = true;
    }

    // Keyword search (title, description, skills, tags)
    if (keyword) {
      filter.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { skills: { $in: [new RegExp(keyword, 'i')] } },
        { tags: { $in: [new RegExp(keyword, 'i')] } }
      ];
    }

    // Employment type filter
    if (employmentType) {
      filter.employmentType = employmentType;
    }

    // Location filter
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    // Company name filter
    if (companyName) {
      filter.companyName = { $regex: companyName, $options: 'i' };
    }

    // Company size filter
    if (companySize) {
      filter.companySize = companySize;
    }

    // Experience filter (less than or equal to specified years)
    if (experience) {
      filter.experienceRequired = { $lte: parseInt(experience) };
    }

    // Minimum salary filter
    if (minSalary) {
      filter.minSalary = { $gte: parseInt(minSalary) };
    }

    // Remote filter
    if (remote === 'true') {
      filter.remote = true;
    } else if (remote === 'false') {
      filter.remote = false;
    }

    console.log('🔍 Job search filter:', filter);

    const jobs = await Job.find(filter)
      .populate('department', 'name')
      .populate('role', 'title')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // If role filter is specified, filter by populated role title
    let filteredJobs = jobs;
    if (role) {
      filteredJobs = jobs.filter(job => 
        job.role && job.role.title.toLowerCase().includes(role.toLowerCase())
      );
    }

    res.json(filteredJobs);
  } catch (err) {
    console.error('Error fetching jobs:', err);
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
