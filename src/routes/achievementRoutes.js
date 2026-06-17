const express = require('express');
const router = express.Router();
const Achievement = require('../models/Achievement');
const Employee = require('../models/Employee');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

// Get achievement statistics (must be before /:id routes)
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

// Get current employee's achievements
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const achievements = await Achievement.find({
      employee: employee._id,
      isActive: true
    })
      .populate('awardedBy', 'name email')
      .sort({ dateAwarded: -1 });

    res.json(achievements);
  } catch (error) {
    console.error('Error fetching my achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get all achievements (admin/hr only)
router.get('/', authenticateToken, requireRole(['admin', 'hr']), async (req, res) => {
  try {
    const { employeeId, type, limit = 50 } = req.query;

    const filter = {};
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
    const isAdminOrHr = ['admin', 'hr'].includes(req.user.role);

    if (!isAdminOrHr) {
      const employee = await Employee.findOne({ user: req.user._id });
      if (!employee || employee._id.toString() !== employeeId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

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

    const employee = await Employee.findById(employeeId).populate('user', 'name email');
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

    if (employee.user) {
      await createNotification(
        employee.user._id,
        'achievement_awarded',
        'New Achievement Awarded',
        `You received "${title}" from ${req.user.name || 'HR/Admin'}.`,
        { type: 'employee', id: employee._id },
        '/employee/achievements'
      );
    }

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

// Delete achievement (admin/hr only)
router.delete('/:id', authenticateToken, requireRole(['admin', 'hr']), async (req, res) => {
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

module.exports = router;
