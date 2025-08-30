// controllers/adminController.js
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Department = require('../models/Department');
const Role = require('../models/Role');
const Interview = require('../models/Interview');

const getAdminStats = async (req, res) => {
  try {
    console.log('📊 Fetching real admin statistics from MongoDB...');
    
    const [
      totalUsers,
      jobsCount, 
      applicationsCount, 
      hrCount, 
      candidateCount, 
      departmentsCount, 
      rolesCount,
      activeJobs,
      pendingApplications,
      pendingHRVerifications,
      matchStats,
      recentCandidates,
      recentHRs,
      recentJobs,
      recentApplications,
      totalInterviews,
      upcomingInterviews
    ] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Application.countDocuments(),
      User.countDocuments({ role: 'hr' }),
      User.countDocuments({ role: 'candidate' }),
      Department.countDocuments(),
      Role.countDocuments(),
      Job.countDocuments({ status: 'active' }),
      Application.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'hr', isVerified: false }),
      Application.aggregate([
        { $match: { matchScore: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgScore: { $avg: "$matchScore" } } }
      ]),
      User.countDocuments({ 
        role: 'candidate', 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      User.countDocuments({ 
        role: 'hr', 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      Job.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      Application.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      Interview.countDocuments(),
      Interview.countDocuments({ 
        status: 'scheduled', 
        scheduledAt: { $gte: new Date() } 
      })
    ]);

    const avgMatchScore = matchStats[0]?.avgScore || 0;

    const stats = {
      totalUsers,
      jobsCount,
      applicationsCount,
      hrCount,
      candidateCount,
      departmentsCount,
      rolesCount,
      activeJobs,
      pendingApplications,
      pendingHRVerifications,
      pendingJobApprovals: await Job.countDocuments({ status: 'pending' }),
      totalInterviews,
      upcomingInterviews,
      avgMatchScore: Number(avgMatchScore.toFixed(1)),
      recentActivity: {
        newCandidates: recentCandidates,
        newHRs: recentHRs,
        newJobs: recentJobs,
        newApplications: recentApplications
      }
    };

    console.log('📊 Real admin stats fetched:', stats);
    res.json(stats);
  } catch (err) {
    console.error("❌ Error fetching admin stats:", err);
    res.status(500).json({ error: "Error fetching admin statistics" });
  }
};

const getHRDashboardData = async (req, res) => {
  try {
    const [totalJobs, openJobs, closedJobs] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'open' }),
      Job.countDocuments({ status: 'closed' }),
    ]);

    const totalApplications = await Application.countDocuments();

    const avgScoreAgg = await Application.aggregate([
      { $match: { matchScore: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: "$matchScore" } } },
    ]);
    const avgMatchScore = avgScoreAgg[0]?.avg || 0;

    const recentApplications = await Application.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('job', 'title')
      .populate('candidate', 'name email');

    const formatted = recentApplications.map((app) => ({
      _id: app._id,
      name: app.candidate?.name || 'N/A',
      email: app.candidate?.email || 'N/A',
      job: { title: app.job?.title || 'N/A' },
      matchScore: app.matchScore,
    }));

    res.json({
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      avgMatchScore,
      recentApplications: formatted,
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

const getCandidates = async (req, res) => {
  try {
    console.log('📊 Fetching candidates with activity data...');
    
    // Add cache-busting headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const candidates = await User.find({ role: 'candidate' })
      .select('name email phone location skills experience createdAt lastActive')
      .sort({ createdAt: -1 });

    const candidatesWithActivity = await Promise.all(
      candidates.map(async (candidate) => {
        const [applications, savedJobs] = await Promise.all([
          Application.find({ candidate: candidate._id })
            .populate('job', 'title company')
            .select('status createdAt hrNotes'),
          // For now, we'll simulate saved jobs since we don't have a SavedJob model
          Promise.resolve([])
        ]);

        const profileCompletion = calculateProfileCompletion(candidate);

        return {
          _id: candidate._id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          location: candidate.location,
          skills: candidate.skills || [],
          experience: candidate.experience,
          createdAt: candidate.createdAt,
          lastActive: candidate.lastActive || candidate.createdAt,
          applications: applications.map(app => ({
            _id: app._id,
            jobTitle: app.job?.title || 'Unknown Job',
            companyName: app.job?.company || 'Unknown Company',
            status: app.status,
            appliedAt: app.createdAt,
            hrNotes: app.hrNotes
          })),
          savedJobs: [], // Will be populated when SavedJob model is implemented
          profileCompletion
        };
      })
    );

    res.json(candidatesWithActivity);
  } catch (err) {
    console.error('❌ Error fetching candidates:', err);
    res.status(500).json({ error: 'Error fetching candidates' });
  }
};

const getHRUsers = async (req, res) => {
  try {
    console.log('📊 Fetching HR users with activity data...');
    
    // Add cache-busting headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const hrUsers = await User.find({ role: 'hr' })
      .select('name email phone companyName department position isVerified createdAt lastActive')
      .sort({ createdAt: -1 });

    const hrUsersWithActivity = await Promise.all(
      hrUsers.map(async (hr) => {
        const [jobs, interviews, totalApplications] = await Promise.all([
          Job.find({ createdBy: hr._id })
            .select('title status createdAt')
            .sort({ createdAt: -1 }),
          // Fetch real interviews conducted by this HR user
          Interview.find({ interviewer: hr._id })
            .populate('application', 'candidate job')
            .populate({
              path: 'application',
              populate: [
                { path: 'candidate', select: 'name email' },
                { path: 'job', select: 'title' }
              ]
            })
            .select('scheduledAt status type scorecard')
            .sort({ scheduledAt: -1 }),
          Application.countDocuments({ 
            job: { $in: await Job.find({ createdBy: hr._id }).distinct('_id') }
          })
        ]);

        return {
          _id: hr._id,
          name: hr.name,
          email: hr.email,
          phone: hr.phone,
          companyName: hr.companyName,
          department: hr.department,
          position: hr.position,
          isVerified: hr.isVerified || false,
          createdAt: hr.createdAt,
          lastActive: hr.lastActive || hr.createdAt,
          jobs: jobs.map(job => ({
            _id: job._id,
            title: job.title,
            status: job.status,
            applicationsCount: 0, // Will be calculated separately if needed
            createdAt: job.createdAt
          })),
          interviews: interviews.map(interview => ({
            _id: interview._id,
            candidateName: interview.application?.candidate?.name || 'Unknown',
            jobTitle: interview.application?.job?.title || 'Unknown',
            scheduledAt: interview.scheduledAt,
            status: interview.status,
            type: interview.type,
            rating: interview.scorecard?.overall,
            outcome: interview.scorecard?.recommendation
          })),
          totalApplicationsReceived: totalApplications
        };
      })
    );

    res.json(hrUsersWithActivity);
  } catch (err) {
    console.error('❌ Error fetching HR users:', err);
    res.status(500).json({ error: 'Error fetching HR users' });
  }
};

const getInterviews = async (req, res) => {
  try {
    const { status } = req.query;
    console.log('📊 Admin fetching interviews with status:', status);
    
    const Interview = require('../models/Interview');
    const Application = require('../models/Application');
    const User = require('../models/User');
    const Job = require('../models/Job');
    
    // Build filter
    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Fetch real interviews from database
    let interviews = [];
    try {
      interviews = await Interview.find(filter)
        .populate({
          path: 'application',
          populate: [
            { path: 'candidate', select: 'name email' },
            { path: 'job', select: 'title companyName' }
          ]
        })
        .populate('interviewer', 'name email companyName')
        .sort({ scheduledAt: -1 });
      
      console.log(`📊 Found ${interviews.length} interviews in database`);
    } catch (dbError) {
      console.error('❌ Database error fetching interviews:', dbError);
      // Return empty array if database fails
      interviews = [];
    }
    
    // Transform data for admin interface
    const transformedInterviews = interviews.map(interview => ({
      _id: interview._id,
      candidateId: interview.application?.candidate?._id || 'unknown',
      candidateName: interview.application?.candidate?.name || 'Unknown Candidate',
      candidateEmail: interview.application?.candidate?.email || 'Unknown Email',
      hrId: interview.interviewer?._id || 'unknown',
      hrName: interview.interviewer?.name || 'Unknown HR',
      hrCompany: interview.interviewer?.companyName || 'Unknown Company',
      jobId: interview.application?.job?._id || 'unknown',
      jobTitle: interview.application?.job?.title || 'Unknown Job',
      scheduledAt: interview.scheduledAt,
      completedAt: interview.completedAt,
      duration: interview.duration,
      status: interview.status,
      type: interview.type,
      notes: interview.notes,
      feedback: interview.scorecard?.feedback,
      rating: interview.scorecard?.overall,
      outcome: interview.scorecard?.recommendation,
      createdAt: interview.createdAt
    }));

    console.log(`📊 Returning ${transformedInterviews.length} real interviews from database`);
    res.json(transformedInterviews);
  } catch (err) {
    console.error('❌ Error fetching interviews:', err);
    res.status(500).json({ error: 'Error fetching interviews' });
  }
};

const verifyHR = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    console.log(`📊 ${action === 'approve' ? 'Approving' : 'Rejecting'} HR verification for user:`, userId);

    const user = await User.findById(userId);
    if (!user || user.role !== 'hr') {
      return res.status(404).json({ error: 'HR user not found' });
    }

    if (action === 'approve') {
      user.isVerified = true;
      user.verificationStatus = 'approved';
      user.verifiedAt = new Date();
    } else if (action === 'reject') {
      user.isVerified = false;
      user.verificationStatus = 'rejected';
      user.rejectedAt = new Date();
    }

    await user.save();

    console.log(`✅ HR verification ${action}d successfully for:`, user.email);
    res.json({ 
      message: `HR ${action}d successfully`, 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (err) {
    console.error('❌ Error updating HR verification:', err);
    res.status(500).json({ error: 'Error updating HR verification' });
  }
};

// Analytics functions
const getAnalytics = async (req, res) => {
  try {
    console.log('📊 Fetching comprehensive platform analytics...');
    
    // Get date ranges for analytics
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    // Fetch all analytics data in parallel
    const [
      // Basic counts
      totalJobs,
      totalApplications,
      totalInterviews,
      totalCandidates,
      totalHRUsers,
      
      // Job analytics
      activeJobs,
      pendingJobs,
      closedJobs,
      jobsThisMonth,
      jobsThisWeek,
      
      // Application analytics
      pendingApplications,
      reviewedApplications,
      shortlistedApplications,
      rejectedApplications,
      applicationsThisMonth,
      applicationsThisWeek,
      
      // Interview analytics
      scheduledInterviews,
      completedInterviews,
      cancelledInterviews,
      interviewsThisMonth,
      interviewsThisWeek,
      
      // Hiring analytics
      hiredCandidates,
      rejectedCandidates,
      hiresThisMonth,
      hiresThisWeek,
      
      // User analytics
      candidatesThisMonth,
      candidatesThisWeek,
      hrUsersThisMonth,
      hrUsersThisWeek,
      verifiedHRUsers,
      unverifiedHRUsers,
      
      // Performance analytics
      avgInterviewRating,
      topPerformingJobs,
      topPerformingHRUsers,
      conversionRates
    ] = await Promise.all([
      // Basic counts
      Job.countDocuments(),
      Application.countDocuments(),
      Interview.countDocuments(),
      User.countDocuments({ role: 'candidate' }),
      User.countDocuments({ role: 'hr' }),
      
      // Job analytics
      Job.countDocuments({ status: 'active' }),
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ status: 'closed' }),
      Job.countDocuments({ createdAt: { $gte: lastMonth } }),
      Job.countDocuments({ createdAt: { $gte: lastWeek } }),
      
      // Application analytics
      Application.countDocuments({ status: 'pending' }),
      Application.countDocuments({ status: 'reviewed' }),
      Application.countDocuments({ status: 'shortlisted' }),
      Application.countDocuments({ status: 'rejected' }),
      Application.countDocuments({ createdAt: { $gte: lastMonth } }),
      Application.countDocuments({ createdAt: { $gte: lastWeek } }),
      
      // Interview analytics
      Interview.countDocuments({ status: 'scheduled' }),
      Interview.countDocuments({ status: 'completed' }),
      Interview.countDocuments({ status: 'cancelled' }),
      Interview.countDocuments({ createdAt: { $gte: lastMonth } }),
      Interview.countDocuments({ createdAt: { $gte: lastWeek } }),
      
      // Hiring analytics
      Interview.countDocuments({ 'scorecard.recommendation': 'hire' }),
      Interview.countDocuments({ 'scorecard.recommendation': { $in: ['no-hire', 'reject'] } }),
      Interview.countDocuments({ 
        'scorecard.recommendation': 'hire',
        completedAt: { $gte: lastMonth }
      }),
      Interview.countDocuments({ 
        'scorecard.recommendation': 'hire',
        completedAt: { $gte: lastWeek }
      }),
      
      // User analytics
      User.countDocuments({ role: 'candidate', createdAt: { $gte: lastMonth } }),
      User.countDocuments({ role: 'candidate', createdAt: { $gte: lastWeek } }),
      User.countDocuments({ role: 'hr', createdAt: { $gte: lastMonth } }),
      User.countDocuments({ role: 'hr', createdAt: { $gte: lastWeek } }),
      User.countDocuments({ role: 'hr', isVerified: true }),
      User.countDocuments({ role: 'hr', isVerified: false }),
      
      // Performance analytics
      Interview.aggregate([
        { $match: { 'scorecard.overall': { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$scorecard.overall' } } }
      ]),
      
      // Top performing jobs (most applications)
      Application.aggregate([
        { $group: { _id: '$job', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'jobInfo' } },
        { $unwind: '$jobInfo' },
        { $project: { jobTitle: '$jobInfo.title', companyName: '$jobInfo.companyName', applicationCount: '$count' } }
      ]),
      
      // Top performing HR users (most interviews conducted)
      Interview.aggregate([
        { $group: { _id: '$interviewer', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'hrInfo' } },
        { $unwind: '$hrInfo' },
        { $project: { hrName: '$hrInfo.name', companyName: '$hrInfo.companyName', interviewCount: '$count' } }
      ]),
      
      // Conversion rates - will be calculated after we have the values
      Promise.resolve({})
    ]);
    
    // Calculate growth rates
    const calculateGrowthRate = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous * 100);
    };
    
    const analytics = {
      overview: {
        totalJobs,
        totalApplications,
        totalInterviews,
        totalCandidates,
        totalHRUsers,
        activeJobs,
        pendingApplications,
        scheduledInterviews,
        hiredCandidates
      },
      
      jobs: {
        total: totalJobs,
        active: activeJobs,
        pending: pendingJobs,
        closed: closedJobs,
        thisMonth: jobsThisMonth,
        thisWeek: jobsThisWeek,
        growthRate: calculateGrowthRate(jobsThisMonth, totalJobs - jobsThisMonth)
      },
      
      applications: {
        total: totalApplications,
        pending: pendingApplications,
        reviewed: reviewedApplications,
        shortlisted: shortlistedApplications,
        rejected: rejectedApplications,
        thisMonth: applicationsThisMonth,
        thisWeek: applicationsThisWeek,
        growthRate: calculateGrowthRate(applicationsThisMonth, totalApplications - applicationsThisMonth)
      },
      
      interviews: {
        total: totalInterviews,
        scheduled: scheduledInterviews,
        completed: completedInterviews,
        cancelled: cancelledInterviews,
        thisMonth: interviewsThisMonth,
        thisWeek: interviewsThisWeek,
        avgRating: avgInterviewRating[0]?.avgRating || 0,
        growthRate: calculateGrowthRate(interviewsThisMonth, totalInterviews - interviewsThisMonth)
      },
      
      hiring: {
        totalHired: hiredCandidates,
        totalRejected: rejectedCandidates,
        hiresThisMonth,
        hiresThisWeek,
        hireRate: completedInterviews > 0 ? (hiredCandidates / completedInterviews * 100) : 0,
        growthRate: calculateGrowthRate(hiresThisMonth, hiredCandidates - hiresThisMonth)
      },
      
      users: {
        candidates: {
          total: totalCandidates,
          thisMonth: candidatesThisMonth,
          thisWeek: candidatesThisWeek,
          growthRate: calculateGrowthRate(candidatesThisMonth, totalCandidates - candidatesThisMonth)
        },
        hr: {
          total: totalHRUsers,
          verified: verifiedHRUsers,
          unverified: unverifiedHRUsers,
          thisMonth: hrUsersThisMonth,
          thisWeek: hrUsersThisWeek,
          verificationRate: totalHRUsers > 0 ? (verifiedHRUsers / totalHRUsers * 100) : 0,
          growthRate: calculateGrowthRate(hrUsersThisMonth, totalHRUsers - hrUsersThisMonth)
        }
      },
      
      performance: {
        topJobs: topPerformingJobs,
        topHRUsers: topPerformingHRUsers,
        conversionRates: {
          applicationToInterview: totalApplications > 0 ? (totalInterviews / totalApplications * 100) : 0,
          interviewToHire: completedInterviews > 0 ? (hiredCandidates / completedInterviews * 100) : 0
        }
      },
      
      trends: {
        jobsGrowth: jobsThisWeek > 0 ? 'up' : 'down',
        applicationsGrowth: applicationsThisWeek > 0 ? 'up' : 'down',
        interviewsGrowth: interviewsThisWeek > 0 ? 'up' : 'down',
        hiresGrowth: hiresThisWeek > 0 ? 'up' : 'down'
      }
    };
    
    console.log('📊 Analytics data compiled successfully');
    res.json(analytics);
    
  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    res.status(500).json({ error: 'Error fetching analytics data' });
  }
};

const exportData = async (req, res) => {
  try {
    const { type, format = 'csv' } = req.query;
    console.log(`📊 Exporting ${type} data in ${format} format...`);
    
    let data = [];
    let filename = '';
    let headers = [];
    
    switch (type) {
      case 'jobs':
        data = await Job.find()
          .populate('createdBy', 'name email companyName')
          .populate('department', 'name')
          .populate('role', 'title')
          .sort({ createdAt: -1 });
        
        headers = [
          'ID', 'Title', 'Company', 'Department', 'Role', 'Location', 'Employment Type',
          'Min Salary', 'Max Salary', 'Status', 'Created By', 'HR Email', 'Created At', 'Updated At'
        ];
        
        data = data.map(job => [
          job._id,
          job.title,
          job.companyName,
          job.department?.name || 'N/A',
          job.role?.title || 'N/A',
          job.location,
          job.employmentType,
          job.minSalary || 'N/A',
          job.maxSalary || 'N/A',
          job.status,
          job.createdBy?.name || 'N/A',
          job.createdBy?.email || 'N/A',
          job.createdAt?.toISOString(),
          job.updatedAt?.toISOString()
        ]);
        
        filename = `jobs_export_${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'applications':
        data = await Application.find()
          .populate('candidate', 'name email phone location')
          .populate('job', 'title companyName')
          .sort({ createdAt: -1 });
        
        headers = [
          'ID', 'Candidate Name', 'Candidate Email', 'Candidate Phone', 'Candidate Location',
          'Job Title', 'Company', 'Status', 'Match Score', 'HR Notes', 'Applied At', 'Updated At'
        ];
        
        data = data.map(app => [
          app._id,
          app.candidate?.name || 'N/A',
          app.candidate?.email || 'N/A',
          app.candidate?.phone || 'N/A',
          app.candidate?.location || 'N/A',
          app.job?.title || 'N/A',
          app.job?.companyName || 'N/A',
          app.status,
          app.matchScore || 'N/A',
          app.hrNotes || 'N/A',
          app.createdAt?.toISOString(),
          app.updatedAt?.toISOString()
        ]);
        
        filename = `applications_export_${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'interviews':
        data = await Interview.find()
          .populate({
            path: 'application',
            populate: [
              { path: 'candidate', select: 'name email' },
              { path: 'job', select: 'title companyName' }
            ]
          })
          .populate('interviewer', 'name email companyName')
          .sort({ scheduledAt: -1 });
        
        headers = [
          'ID', 'Candidate Name', 'Candidate Email', 'Job Title', 'Company',
          'HR Name', 'HR Email', 'HR Company', 'Scheduled At', 'Completed At',
          'Duration', 'Status', 'Type', 'Rating', 'Recommendation', 'Feedback', 'Notes'
        ];
        
        data = data.map(interview => [
          interview._id,
          interview.application?.candidate?.name || 'N/A',
          interview.application?.candidate?.email || 'N/A',
          interview.application?.job?.title || 'N/A',
          interview.application?.job?.companyName || 'N/A',
          interview.interviewer?.name || 'N/A',
          interview.interviewer?.email || 'N/A',
          interview.interviewer?.companyName || 'N/A',
          interview.scheduledAt?.toISOString(),
          interview.completedAt?.toISOString() || 'N/A',
          interview.duration || 'N/A',
          interview.status,
          interview.type,
          interview.scorecard?.overall || 'N/A',
          interview.scorecard?.recommendation || 'N/A',
          interview.scorecard?.feedback || 'N/A',
          interview.notes || 'N/A'
        ]);
        
        filename = `interviews_export_${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'candidates':
        data = await User.find({ role: 'candidate' })
          .sort({ createdAt: -1 });
        
        headers = [
          'ID', 'Name', 'Email', 'Phone', 'Location', 'Skills', 'Experience',
          'Education', 'Resume URL', 'LinkedIn', 'GitHub', 'Portfolio', 'Created At'
        ];
        
        data = data.map(candidate => [
          candidate._id,
          candidate.name,
          candidate.email,
          candidate.phone || 'N/A',
          candidate.location || 'N/A',
          Array.isArray(candidate.skills) ? candidate.skills.join('; ') : 'N/A',
          candidate.experience || 'N/A',
          candidate.education || 'N/A',
          candidate.resumeUrl || 'N/A',
          candidate.linkedinUrl || 'N/A',
          candidate.githubUrl || 'N/A',
          candidate.portfolioUrl || 'N/A',
          candidate.createdAt?.toISOString()
        ]);
        
        filename = `candidates_export_${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'hr-users':
        data = await User.find({ role: 'hr' })
          .sort({ createdAt: -1 });
        
        headers = [
          'ID', 'Name', 'Email', 'Phone', 'Company', 'Department', 'Position',
          'Is Verified', 'Verification Notes', 'Created At'
        ];
        
        data = data.map(hr => [
          hr._id,
          hr.name,
          hr.email,
          hr.phone || 'N/A',
          hr.companyName || 'N/A',
          hr.department || 'N/A',
          hr.position || 'N/A',
          hr.isVerified ? 'Yes' : 'No',
          hr.verificationNotes || 'N/A',
          hr.createdAt?.toISOString()
        ]);
        
        filename = `hr_users_export_${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }
    
    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        row.map(cell => 
          typeof cell === 'string' && cell.includes(',') 
            ? `"${cell.replace(/"/g, '""')}"` 
            : cell
        ).join(',')
      )
    ].join('\n');
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent));
    
    console.log(`✅ Exported ${data.length} ${type} records to ${filename}`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('❌ Error exporting data:', error);
    res.status(500).json({ error: 'Error exporting data' });
  }
};

// Helper function to calculate profile completion
const calculateProfileCompletion = (user) => {
  if (!user) return 0;
  
  const fields = [
    'name',
    'email', 
    'phone',
    'location',
    'skills',
    'experience',
    'education',
    'resumeUrl',
    'linkedinUrl',
    'portfolioUrl'
  ];
  
  let completedFields = 0;
  
  fields.forEach(field => {
    const value = user[field];
    if (value) {
      if (Array.isArray(value)) {
        if (value.length > 0) completedFields++;
      } else if (typeof value === 'string') {
        if (value.trim().length > 0) completedFields++;
      } else {
        completedFields++;
      }
    }
  });
  
  return Math.round((completedFields / fields.length) * 100);
};



module.exports = {
    getAdminStats,
    getHRDashboardData,
    getCandidates,
    getHRUsers,
    getInterviews,
    verifyHR,
    getAnalytics,
    exportData
  };
  