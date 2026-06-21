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

    const User = require('../models/User');
    if (req.user.role === 'hr') {
      const hrUser = await User.findById(req.user._id).select('isVerified company companySize');
      if (!hrUser?.isVerified) {
        return res.status(403).json({
          error: 'Your HR account must be verified by an admin before you can post jobs.',
          code: 'HR_NOT_VERIFIED',
        });
      }
      req.hrProfile = hrUser;
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

    // Validate required fields - treat empty strings as missing
    if (!title || !title.trim()) {
      console.error("❌ Missing required field: title", { title });
      return res.status(400).json({ error: "Title is required" });
    }

    if (!description || !description.trim()) {
      console.error("❌ Missing required field: description", { description: description ? 'provided' : 'missing' });
      return res.status(400).json({ error: "Description is required" });
    }

    // Department and role are optional (can be null/undefined, but not empty strings)
    const departmentId = department && department.trim() ? department : null;
    const roleId = role && role.trim() ? role : null;

    const isAdminUser = req.user.role === 'admin';
    const isVerifiedHR = req.user.role === 'hr' && req.hrProfile?.isVerified;
    const publishImmediately = isAdminUser || isVerifiedHR;

    const job = await Job.create({
      title: title.trim(),
      department: departmentId,
      role: roleId,
      description: description.trim(),
      companyName: companyName?.trim() || req.hrProfile?.company || req.user.company || 'Company',
      companyLogo,
      companySize: companySize || req.hrProfile?.companySize,
      location: location?.trim(),
      remote: remote || false,
      employmentType,
      experienceRequired: experienceRequired ? Number(experienceRequired) : undefined,
      minSalary: minSalary ? Number(minSalary) : undefined,
      maxSalary: maxSalary ? Number(maxSalary) : undefined,
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : []),
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      rating,
      createdBy: req.user._id,
      status: publishImmediately ? 'active' : 'pending',
      isApproved: publishImmediately,
    });

    // Verify the job was created with correct status
    const verifiedJob = await Job.findById(job._id);
    console.log("✅ Job Created and Verified:", {
      id: verifiedJob._id,
      title: verifiedJob.title,
      status: verifiedJob.status,
      isApproved: verifiedJob.isApproved,
      companyName: verifiedJob.companyName
    });

    // Notify candidates when job is published live
    if (publishImmediately) {
      try {
        const User = require('../models/User');
        const notificationService = require('../services/notificationService');
        
        const candidates = await User.find({ 
          role: 'candidate',
          emailNotifications: { $ne: false }
        }).select('_id');

        candidates.forEach(async (candidate) => {
          await notificationService.notifyNewJobPosted(
            candidate._id,
            job._id,
            job.title,
            job.companyName || 'Company'
          );
        });

        console.log(`📢 Created job notifications for ${candidates.length} candidates`);
      } catch (notifError) {
        console.error('Failed to create job notifications:', notifError);
      }
    }

    res.status(201).json({
      ...job.toObject(),
      message: publishImmediately
        ? 'Job published successfully'
        : 'Job submitted for admin approval. It will be visible to candidates once approved.',
    });
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
      status
    } = req.query;

    // Build filter object - show approved jobs to candidates
    // Show active/open jobs by default, but also include closed jobs if they're approved
    let filter = {
      status: { $in: ['active', 'open', 'closed'] },
      isApproved: true
    };
    
    // If status is explicitly provided, use it
    if (status) {
      if (status === 'open' || status === 'active') {
        // Show active/open jobs
        filter.status = { $in: ['active', 'open'] };
      } else {
        // Show specific status
        filter.status = status;
      }
      filter.isApproved = true;
    }

    console.log('🔍 getJobs filter:', JSON.stringify(filter, null, 2));

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

    console.log(`📊 Found ${jobs.length} jobs matching filter`);

    // Convert Mongoose documents to plain objects for JSON response
    const jobsArray = jobs.map(job => job.toObject ? job.toObject() : job);

    // If role filter is specified, filter by populated role title
    let filteredJobs = jobsArray;
    if (role) {
      filteredJobs = jobsArray.filter(job => 
        job.role && job.role.title && job.role.title.toLowerCase().includes(role.toLowerCase())
      );
      console.log(`📊 Filtered to ${filteredJobs.length} jobs matching role: ${role}`);
    }

    // Log sample job for debugging
    if (filteredJobs.length > 0) {
      console.log('📋 Sample job:', {
        id: filteredJobs[0]._id,
        title: filteredJobs[0].title,
        status: filteredJobs[0].status,
        isApproved: filteredJobs[0].isApproved,
        companyName: filteredJobs[0].companyName
      });
    } else {
      console.log('⚠️ No jobs found with filter:', JSON.stringify(filter, null, 2));
      // Debug: Check what jobs exist
      const allJobs = await Job.find({}).select('title status isApproved').limit(5).lean();
      console.log('📋 Sample of all jobs in DB:', allJobs);
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
