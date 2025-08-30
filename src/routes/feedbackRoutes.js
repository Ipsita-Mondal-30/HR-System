const express = require('express');
const router = express.Router();
const { verifyJWT, isHR, isAdmin } = require('../middleware/auth');
const Feedback = require('../models/Feedback');
const Employee = require('../models/Employee');
const { CohereClient } = require('cohere-ai');

// Initialize Cohere client
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Helper function to generate AI summary and sentiment analysis
async function processFeedbackWithAI(feedbackContent, ratings) {
  try {
    const prompt = `
    Analyze this employee feedback and provide:
    1. A professional summary (2-3 sentences)
    2. Sentiment analysis (positive/neutral/negative)
    3. Key themes/keywords (max 5)
    
    Feedback: "${feedbackContent}"
    
    Ratings:
    - Technical: ${ratings.technical || 'N/A'}/5
    - Communication: ${ratings.communication || 'N/A'}/5
    - Teamwork: ${ratings.teamwork || 'N/A'}/5
    - Leadership: ${ratings.leadership || 'N/A'}/5
    - Problem Solving: ${ratings.problemSolving || 'N/A'}/5
    - Time Management: ${ratings.timeManagement || 'N/A'}/5
    
    Format as JSON with keys: summary, sentiment, keywords
    `;

    const response = await cohere.generate({
      model: 'command',
      prompt: prompt,
      maxTokens: 300,
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.generations[0].text);
    } catch (parseError) {
      // Fallback analysis
      const avgRating = Object.values(ratings).reduce((sum, rating) => sum + (rating || 0), 0) / Object.keys(ratings).length;
      return {
        summary: `Performance feedback with average rating of ${avgRating.toFixed(1)}/5. ${feedbackContent.substring(0, 100)}...`,
        sentiment: avgRating >= 4 ? 'positive' : avgRating >= 3 ? 'neutral' : 'negative',
        keywords: ['performance', 'feedback', 'evaluation']
      };
    }
  } catch (error) {
    console.error('AI processing error:', error);
    return {
      summary: feedbackContent.substring(0, 150) + '...',
      sentiment: 'neutral',
      keywords: ['feedback']
    };
  }
}

// Get all feedback (HR/Admin view)
router.get('/', verifyJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, type, status } = req.query;
    
    const query = {};
    if (employeeId) query.employee = employeeId;
    if (type) query.type = type;
    if (status) query.status = status;
    
    const feedback = await Feedback.find(query)
      .populate('reviewer', 'name email')
      .populate('employee', 'user position')
      .populate('project', 'name')
      .populate('milestone', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Feedback.countDocuments(query);
    
    res.json({
      feedback,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Create new feedback
router.post('/', verifyJWT, async (req, res) => {
  try {
    const feedbackData = {
      ...req.body,
      reviewer: req.user._id
    };
    
    // Validate employee exists
    const employee = await Employee.findById(feedbackData.employee);
    if (!employee) {
      return res.status(400).json({ error: 'Employee not found' });
    }
    
    // Calculate overall rating from individual ratings
    if (feedbackData.ratings) {
      const ratings = Object.values(feedbackData.ratings).filter(r => r > 0);
      if (ratings.length > 0) {
        feedbackData.overallRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      }
    }
    
    const feedback = new Feedback(feedbackData);
    
    // Process with AI if content exists
    if (feedback.content && feedback.content.trim()) {
      const aiAnalysis = await processFeedbackWithAI(feedback.content, feedback.ratings || {});
      feedback.aiSummary = aiAnalysis.summary;
      feedback.aiSentiment = aiAnalysis.sentiment;
      feedback.aiKeywords = aiAnalysis.keywords;
    }
    
    await feedback.save();
    
    await feedback.populate([
      { path: 'reviewer', select: 'name email' },
      { path: 'employee', select: 'user position' },
      { path: 'project', select: 'name' },
      { path: 'milestone', select: 'title' }
    ]);
    
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

// Get feedback for specific employee
router.get('/employee/:employeeId', verifyJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    
    const query = { 
      employee: req.params.employeeId,
      isVisible: true,
      status: { $in: ['submitted', 'reviewed', 'acknowledged'] }
    };
    if (type) query.type = type;
    
    const feedback = await Feedback.find(query)
      .populate('reviewer', 'name email')
      .populate('project', 'name')
      .populate('milestone', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Feedback.countDocuments(query);
    
    // Calculate feedback analytics
    const analytics = {
      totalFeedback: total,
      averageRating: 0,
      sentimentBreakdown: {
        positive: 0,
        neutral: 0,
        negative: 0
      },
      ratingsByCategory: {
        technical: 0,
        communication: 0,
        teamwork: 0,
        leadership: 0,
        problemSolving: 0,
        timeManagement: 0
      }
    };
    
    if (feedback.length > 0) {
      // Calculate averages
      const validRatings = feedback.filter(f => f.overallRating > 0);
      if (validRatings.length > 0) {
        analytics.averageRating = validRatings.reduce((sum, f) => sum + f.overallRating, 0) / validRatings.length;
      }
      
      // Sentiment breakdown
      feedback.forEach(f => {
        if (f.aiSentiment) {
          analytics.sentimentBreakdown[f.aiSentiment]++;
        }
      });
      
      // Category ratings
      const categoryTotals = { technical: 0, communication: 0, teamwork: 0, leadership: 0, problemSolving: 0, timeManagement: 0 };
      const categoryCounts = { technical: 0, communication: 0, teamwork: 0, leadership: 0, problemSolving: 0, timeManagement: 0 };
      
      feedback.forEach(f => {
        if (f.ratings) {
          Object.keys(categoryTotals).forEach(category => {
            if (f.ratings[category] > 0) {
              categoryTotals[category] += f.ratings[category];
              categoryCounts[category]++;
            }
          });
        }
      });
      
      Object.keys(categoryTotals).forEach(category => {
        analytics.ratingsByCategory[category] = categoryCounts[category] > 0 
          ? categoryTotals[category] / categoryCounts[category] 
          : 0;
      });
    }
    
    res.json({
      feedback,
      analytics,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching employee feedback:', error);
    res.status(500).json({ error: 'Failed to fetch employee feedback' });
  }
});

// Update feedback
router.put('/:id', verifyJWT, async (req, res) => {
  try {
    const updates = req.body;
    
    // Recalculate overall rating if ratings are updated
    if (updates.ratings) {
      const ratings = Object.values(updates.ratings).filter(r => r > 0);
      if (ratings.length > 0) {
        updates.overallRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      }
    }
    
    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('reviewer', 'name email')
      .populate('employee', 'user position')
      .populate('project', 'name')
      .populate('milestone', 'title');
    
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    // Reprocess with AI if content was updated
    if (updates.content && updates.content.trim()) {
      const aiAnalysis = await processFeedbackWithAI(feedback.content, feedback.ratings || {});
      feedback.aiSummary = aiAnalysis.summary;
      feedback.aiSentiment = aiAnalysis.sentiment;
      feedback.aiKeywords = aiAnalysis.keywords;
      await feedback.save();
    }
    
    res.json(feedback);
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// Submit feedback (change status from draft to submitted)
router.post('/:id/submit', verifyJWT, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    if (feedback.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to submit this feedback' });
    }
    
    feedback.status = 'submitted';
    await feedback.save();
    
    await feedback.populate([
      { path: 'reviewer', select: 'name email' },
      { path: 'employee', select: 'user position' },
      { path: 'project', select: 'name' }
    ]);
    
    res.json(feedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Employee response to feedback
router.post('/:id/respond', verifyJWT, async (req, res) => {
  try {
    const { content } = req.body;
    
    const feedback = await Feedback.findById(req.params.id)
      .populate('employee', 'user');
    
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    // Check if user is the employee receiving feedback
    if (feedback.employee.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to respond to this feedback' });
    }
    
    feedback.employeeResponse = {
      content,
      respondedAt: new Date()
    };
    feedback.status = 'acknowledged';
    
    await feedback.save();
    
    await feedback.populate([
      { path: 'reviewer', select: 'name email' },
      { path: 'employee', select: 'user position' },
      { path: 'project', select: 'name' }
    ]);
    
    res.json(feedback);
  } catch (error) {
    console.error('Error responding to feedback:', error);
    res.status(500).json({ error: 'Failed to respond to feedback' });
  }
});

// Generate AI feedback summary for employee
router.get('/employee/:employeeId/ai-summary', verifyJWT, async (req, res) => {
  try {
    const { period = '6months' } = req.query;
    
    let dateFilter = new Date();
    if (period === '3months') {
      dateFilter.setMonth(dateFilter.getMonth() - 3);
    } else if (period === '6months') {
      dateFilter.setMonth(dateFilter.getMonth() - 6);
    } else if (period === '1year') {
      dateFilter.setFullYear(dateFilter.getFullYear() - 1);
    }
    
    const feedback = await Feedback.find({
      employee: req.params.employeeId,
      status: { $in: ['submitted', 'reviewed', 'acknowledged'] },
      createdAt: { $gte: dateFilter }
    })
      .populate('reviewer', 'name')
      .populate('project', 'name');
    
    if (feedback.length === 0) {
      return res.json({
        summary: 'No feedback available for the selected period.',
        insights: [],
        recommendations: []
      });
    }
    
    // Prepare data for AI analysis
    const feedbackSummary = feedback.map(f => ({
      type: f.type,
      rating: f.overallRating,
      sentiment: f.aiSentiment,
      summary: f.aiSummary || f.content.substring(0, 100)
    }));
    
    const prompt = `
    Analyze this employee's feedback over the past ${period} and provide:
    1. Overall performance summary (3-4 sentences)
    2. Key insights and patterns (3-5 points)
    3. Recommendations for improvement (3-5 points)
    
    Feedback Data:
    ${feedbackSummary.map((f, i) => `${i+1}. ${f.type} - Rating: ${f.rating}/5 - ${f.summary}`).join('\n')}
    
    Average Rating: ${(feedback.reduce((sum, f) => sum + (f.overallRating || 0), 0) / feedback.length).toFixed(1)}/5
    Sentiment Distribution: 
    - Positive: ${feedback.filter(f => f.aiSentiment === 'positive').length}
    - Neutral: ${feedback.filter(f => f.aiSentiment === 'neutral').length}
    - Negative: ${feedback.filter(f => f.aiSentiment === 'negative').length}
    
    Format as JSON with keys: summary, insights, recommendations
    `;
    
    try {
      const response = await cohere.generate({
        model: 'command',
        prompt: prompt,
        maxTokens: 500,
        temperature: 0.3,
      });
      
      const aiAnalysis = JSON.parse(response.generations[0].text);
      
      res.json({
        period,
        feedbackCount: feedback.length,
        averageRating: feedback.reduce((sum, f) => sum + (f.overallRating || 0), 0) / feedback.length,
        ...aiAnalysis
      });
    } catch (parseError) {
      // Fallback analysis
      const avgRating = feedback.reduce((sum, f) => sum + (f.overallRating || 0), 0) / feedback.length;
      res.json({
        period,
        feedbackCount: feedback.length,
        averageRating: avgRating,
        summary: `Employee has received ${feedback.length} feedback entries with an average rating of ${avgRating.toFixed(1)}/5 over the past ${period}.`,
        insights: [
          'Regular feedback received from team members',
          'Performance tracking shows consistent engagement',
          'Multiple project contributions noted'
        ],
        recommendations: [
          'Continue current performance trajectory',
          'Focus on areas with lower ratings',
          'Seek additional feedback for continuous improvement'
        ]
      });
    }
  } catch (error) {
    console.error('Error generating AI feedback summary:', error);
    res.status(500).json({ error: 'Failed to generate AI summary' });
  }
});

module.exports = router;