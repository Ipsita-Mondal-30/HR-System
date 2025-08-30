const express = require('express');
const router = express.Router();
const { verifyJWT, isHR, isAdmin, isEmployee } = require('../middleware/auth');
const OKR = require('../models/OKR');
const Employee = require('../models/Employee');
const { CohereClient } = require('cohere-ai');

// Initialize Cohere client
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Helper function for AI OKR analysis
async function analyzeOKRWithAI(okr, employee) {
  try {
    const prompt = `
    Analyze this employee's OKR and provide insights:
    
    Employee: ${employee.user?.name || 'Unknown'}
    Position: ${employee.position}
    
    OKR Details:
    Objective: ${okr.objective}
    Period: ${okr.period} ${okr.year}
    Overall Progress: ${okr.overallProgress}%
    
    Key Results:
    ${okr.keyResults.map((kr, i) => 
      `${i+1}. ${kr.title} - Progress: ${kr.currentValue}/${kr.targetValue} ${kr.unit} (${Math.min((kr.currentValue/kr.targetValue)*100, 100).toFixed(1)}%)`
    ).join('\n')}
    
    Please provide:
    1. Achievability score (0-100) - how realistic are the targets
    2. Risk factors (3-5 points)
    3. Recommendations for improvement (3-5 points)
    
    Format as JSON with keys: achievabilityScore, riskFactors, recommendations
    `;

    const response = await cohere.generate({
      model: 'command',
      prompt: prompt,
      maxTokens: 400,
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.generations[0].text);
    } catch (parseError) {
      // Fallback analysis
      const avgProgress = okr.keyResults.reduce((sum, kr) => 
        sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100), 0
      ) / okr.keyResults.length;
      
      return {
        achievabilityScore: Math.max(60, Math.min(90, avgProgress + 20)),
        riskFactors: [
          avgProgress < 50 ? 'Behind schedule on multiple key results' : 'Progress tracking needed',
          'Regular check-ins recommended',
          'Resource allocation review suggested'
        ],
        recommendations: [
          'Break down large targets into smaller milestones',
          'Increase frequency of progress updates',
          'Align with team priorities and resources'
        ]
      };
    }
  } catch (error) {
    console.error('AI OKR analysis error:', error);
    return {
      achievabilityScore: 70,
      riskFactors: ['Regular monitoring needed'],
      recommendations: ['Continue current approach', 'Seek feedback from manager']
    };
  }
}

// Get all OKRs (HR/Admin view)
router.get('/', verifyJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, period, year, status } = req.query;
    
    const query = {};
    if (employeeId) query.employee = employeeId;
    if (period) query.period = period;
    if (year) query.year = parseInt(year);
    if (status) query.status = status;
    
    const okrs = await OKR.find(query)
      .populate('employee', 'user position')
      .populate('managerReview.reviewer', 'name')
      .sort({ year: -1, period: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await OKR.countDocuments(query);
    
    res.json({
      okrs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching OKRs:', error);
    res.status(500).json({ error: 'Failed to fetch OKRs' });
  }
});

// Create new OKR
router.post('/', verifyJWT, async (req, res) => {
  try {
    const okrData = req.body;
    
    // Validate employee exists
    const employee = await Employee.findById(okrData.employee);
    if (!employee) {
      return res.status(400).json({ error: 'Employee not found' });
    }
    
    const okr = new OKR(okrData);
    okr.calculateProgress();
    await okr.save();
    
    await okr.populate([
      { path: 'employee', select: 'user position' },
      { path: 'managerReview.reviewer', select: 'name' }
    ]);
    
    res.status(201).json(okr);
  } catch (error) {
    console.error('Error creating OKR:', error);
    res.status(500).json({ error: 'Failed to create OKR' });
  }
});

// Get OKR details
router.get('/:id', verifyJWT, async (req, res) => {
  try {
    const okr = await OKR.findById(req.params.id)
      .populate('employee', 'user position')
      .populate('managerReview.reviewer', 'name');
    
    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }
    
    res.json(okr);
  } catch (error) {
    console.error('Error fetching OKR:', error);
    res.status(500).json({ error: 'Failed to fetch OKR' });
  }
});

// Update OKR
router.put('/:id', verifyJWT, async (req, res) => {
  try {
    const updates = req.body;
    
    const okr = await OKR.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('employee', 'user position')
      .populate('managerReview.reviewer', 'name');
    
    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }
    
    // Recalculate progress
    okr.calculateProgress();
    await okr.save();
    
    res.json(okr);
  } catch (error) {
    console.error('Error updating OKR:', error);
    res.status(500).json({ error: 'Failed to update OKR' });
  }
});

// Update key result progress
router.put('/:id/key-results/:krIndex', verifyJWT, async (req, res) => {
  try {
    const { currentValue, status } = req.body;
    const krIndex = parseInt(req.params.krIndex);
    
    const okr = await OKR.findById(req.params.id);
    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }
    
    if (krIndex < 0 || krIndex >= okr.keyResults.length) {
      return res.status(400).json({ error: 'Invalid key result index' });
    }
    
    if (currentValue !== undefined) {
      okr.keyResults[krIndex].currentValue = currentValue;
    }
    if (status) {
      okr.keyResults[krIndex].status = status;
    }
    
    // Auto-update status based on progress
    const progress = (okr.keyResults[krIndex].currentValue / okr.keyResults[krIndex].targetValue) * 100;
    if (progress >= 100) {
      okr.keyResults[krIndex].status = 'completed';
    } else if (progress > 0) {
      okr.keyResults[krIndex].status = 'in-progress';
    }
    
    okr.calculateProgress();
    await okr.save();
    
    await okr.populate([
      { path: 'employee', select: 'user position' },
      { path: 'managerReview.reviewer', select: 'name' }
    ]);
    
    res.json(okr);
  } catch (error) {
    console.error('Error updating key result:', error);
    res.status(500).json({ error: 'Failed to update key result' });
  }
});

// Manager review OKR
router.post('/:id/review', verifyJWT, async (req, res) => {
  try {
    const { rating, comments } = req.body;
    
    const okr = await OKR.findById(req.params.id);
    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }
    
    okr.managerReview = {
      reviewer: req.user._id,
      rating,
      comments,
      reviewedAt: new Date()
    };
    
    await okr.save();
    
    await okr.populate([
      { path: 'employee', select: 'user position' },
      { path: 'managerReview.reviewer', select: 'name' }
    ]);
    
    res.json(okr);
  } catch (error) {
    console.error('Error reviewing OKR:', error);
    res.status(500).json({ error: 'Failed to review OKR' });
  }
});

// Generate AI insights for OKR
router.post('/:id/ai-insights', verifyJWT, async (req, res) => {
  try {
    const okr = await OKR.findById(req.params.id)
      .populate('employee', 'user position');
    
    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }
    
    const insights = await analyzeOKRWithAI(okr, okr.employee);
    
    okr.aiInsights = {
      ...insights,
      lastAnalyzed: new Date()
    };
    await okr.save();
    
    res.json({
      okr: {
        id: okr._id,
        objective: okr.objective,
        period: okr.period,
        year: okr.year,
        overallProgress: okr.overallProgress
      },
      insights: okr.aiInsights
    });
  } catch (error) {
    console.error('Error generating OKR insights:', error);
    res.status(500).json({ error: 'Failed to generate OKR insights' });
  }
});

// Get employee's OKRs
router.get('/employee/:employeeId', verifyJWT, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), period } = req.query;
    
    const query = {
      employee: req.params.employeeId,
      year: parseInt(year)
    };
    if (period) query.period = period;
    
    const okrs = await OKR.find(query)
      .populate('managerReview.reviewer', 'name')
      .sort({ period: -1, createdAt: -1 });
    
    // Calculate employee OKR analytics
    const analytics = {
      totalOKRs: okrs.length,
      completedOKRs: okrs.filter(o => o.status === 'completed').length,
      averageProgress: okrs.length > 0 
        ? okrs.reduce((sum, o) => sum + o.overallProgress, 0) / okrs.length 
        : 0,
      averageManagerRating: 0,
      onTrackOKRs: okrs.filter(o => o.overallProgress >= 70).length,
      atRiskOKRs: okrs.filter(o => o.overallProgress < 50 && o.status === 'active').length
    };
    
    const reviewedOKRs = okrs.filter(o => o.managerReview?.rating);
    if (reviewedOKRs.length > 0) {
      analytics.averageManagerRating = reviewedOKRs.reduce((sum, o) => sum + o.managerReview.rating, 0) / reviewedOKRs.length;
    }
    
    res.json({
      okrs,
      analytics,
      year: parseInt(year)
    });
  } catch (error) {
    console.error('Error fetching employee OKRs:', error);
    res.status(500).json({ error: 'Failed to fetch employee OKRs' });
  }
});

// Get OKR analytics for team/department
router.get('/analytics/team', verifyJWT, async (req, res) => {
  try {
    const { department, year = new Date().getFullYear(), period } = req.query;
    
    let employeeQuery = { status: 'active' };
    if (department) employeeQuery.department = department;
    
    const employees = await Employee.find(employeeQuery).select('_id');
    const employeeIds = employees.map(e => e._id);
    
    const okrQuery = {
      employee: { $in: employeeIds },
      year: parseInt(year)
    };
    if (period) okrQuery.period = period;
    
    const okrs = await OKR.find(okrQuery)
      .populate('employee', 'user position');
    
    // Team analytics
    const analytics = {
      totalEmployees: employeeIds.length,
      employeesWithOKRs: [...new Set(okrs.map(o => o.employee._id.toString()))].length,
      totalOKRs: okrs.length,
      averageProgress: okrs.length > 0 
        ? okrs.reduce((sum, o) => sum + o.overallProgress, 0) / okrs.length 
        : 0,
      completionRate: okrs.length > 0 
        ? (okrs.filter(o => o.status === 'completed').length / okrs.length) * 100 
        : 0,
      onTrackRate: okrs.length > 0 
        ? (okrs.filter(o => o.overallProgress >= 70).length / okrs.length) * 100 
        : 0,
      atRiskRate: okrs.length > 0 
        ? (okrs.filter(o => o.overallProgress < 50 && o.status === 'active').length / okrs.length) * 100 
        : 0
    };
    
    // Top performers
    const employeeProgress = {};
    okrs.forEach(okr => {
      const empId = okr.employee._id.toString();
      if (!employeeProgress[empId]) {
        employeeProgress[empId] = {
          employee: okr.employee,
          totalProgress: 0,
          okrCount: 0
        };
      }
      employeeProgress[empId].totalProgress += okr.overallProgress;
      employeeProgress[empId].okrCount++;
    });
    
    const topPerformers = Object.values(employeeProgress)
      .map(ep => ({
        employee: ep.employee,
        averageProgress: ep.totalProgress / ep.okrCount,
        okrCount: ep.okrCount
      }))
      .sort((a, b) => b.averageProgress - a.averageProgress)
      .slice(0, 5);
    
    res.json({
      analytics,
      topPerformers,
      period: period || 'All',
      year: parseInt(year)
    });
  } catch (error) {
    console.error('Error fetching team OKR analytics:', error);
    res.status(500).json({ error: 'Failed to fetch team OKR analytics' });
  }
});

module.exports = router;