const express = require('express');
const router = express.Router();
const Achievement = require('../models/Achievement');
const Employee = require('../models/Employee');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all achievements (admin/hr only)
router.get('/', authenticateToken, requireRole(['admin', 'hr']), async (req, res) => {
  try {
    const { employeeId, type, limit = 50 } = req.query;
    
    let filter = {};
    if (employeeId) filter.employee = employeeId;
    if (type) filter.type = type;
    
    const achievements = await Achievement.find(filter)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate('awardedBy', 'name email')
      .sort({ dateAwarded: -1 })
      .limit(parseInt(limit));
    
    res.json(achievements);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get achievements for specific employee
router.get('/employee/:employeeId', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const achievements = await Achievement.find({ 
      employee: employeeId,
      isActive: true 
    })
      .populate('awardedBy', 'name email')
      .sort({ dateAwarded: -1 });
    
    res.json(achievements);
  } catch (error) {
    console.error('Error fetching employee achievements:', error);
    res.status(500).json({ error: 'Failed to fetch employee achievements' });
  }
});

// Create new achievement (admin/hr only)
router.post('/', authenticateToken, requireRole(['admin', 'hr']), async (req, res) => {
  try {
    const {
      employeeId,
      title,
      description,
      type,
      category,
      points,
      level
    } = req.body;
    
    // Validate employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const achievement = new Achievement({
      employee: employeeId,
      title,
      description,
      type,
      category,
      points: points || 0,
      level,
      awardedBy: req.user._id
    });
    
    await achievement.save();
    
    // Populate the response
    await achievement.populate([
      {
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      },
      {
        path: 'awardedBy',
        select: 'name email'
      }
    ]);
    
    res.status(201).json(achievement);
  } catch (error) {
    console.error('Error creating achievement:', error);
    res.status(500).json({ error: 'Failed to create achievement' });
  }
});

// Update achievement (admin/hr only)
router.put('/:id', authenticateToken, requireRole(['admin', 'hr']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const achievement = await Achievement.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    )
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate('awardedBy', 'name email');
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    res.json(achievement);
  } catch (error) {
    console.error('Error updating achievement:', error);
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

// Delete achievement (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const achievement = await Achievement.findByIdAndDelete(id);
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    res.json({ message: 'Achievement deleted successfully' });
  } catch (error) {
    console.error('Error deleting achievement:', error);
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

// Get achievement statistics
router.get('/stats', authenticateToken, requireRole(['admin', 'hr']), async (req, res) => {
  try {
    const stats = await Achievement.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points' }
        }
      }
    ]);
    
    const totalAchievements = await Achievement.countDocuments();
    const thisMonthAchievements = await Achievement.countDocuments({
      dateAwarded: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });
    
    res.json({
      totalAchievements,
      thisMonthAchievements,
      byType: stats
    });
  } catch (error) {
    console.error('Error fetching achievement stats:', error);
    res.status(500).json({ error: 'Failed to fetch achievement statistics' });
  }
});

module.exports = router;