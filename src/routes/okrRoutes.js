const express = require('express');
const router = express.Router();
const { verifyJWT, isHRorAdmin } = require('../middleware/auth');
const OKR = require('../models/OKR');
const Employee = require('../models/Employee');
const { createNotification } = require('../services/notificationService');
const { generateOKRInsights } = require('../services/okrAIService');

async function assertOkrUpdateAccess(okr, user) {
  if (['hr', 'admin'].includes(user.role)) return true;
  const employee = await Employee.findOne({ user: user._id });
  if (!employee) return false;
  return okr.employee.toString() === employee._id.toString();
}

router.get('/', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { year, status } = req.query;
    const query = {};
    if (year) query.year = parseInt(year, 10);
    if (status) query.status = status;

    const okrs = await OKR.find(query)
      .populate({ path: 'employee', select: 'user position', populate: { path: 'user', select: 'name email' } })
      .populate('assignedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(okrs);
  } catch (error) {
    console.error('Error fetching OKRs:', error);
    res.status(500).json({ error: 'Failed to fetch OKRs' });
  }
});

router.post('/', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { employee, objective, description, period, year, keyResults } = req.body;

    if (!employee || !objective || !period || !year) {
      return res.status(400).json({ error: 'Employee, objective, period, and year are required' });
    }

    const employeeDoc = await Employee.findById(employee).populate('user', 'name email');
    if (!employeeDoc) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const okr = new OKR({
      employee,
      assignedBy: req.user._id,
      objective,
      description,
      period,
      year: parseInt(year, 10),
      keyResults: (keyResults || []).map((kr) => ({
        title: kr.title,
        description: kr.description,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue || 0,
        unit: kr.unit || '%',
        weight: kr.weight || 1
      }))
    });

    if (!okr.keyResults.length) {
      return res.status(400).json({ error: 'At least one key result is required' });
    }

    await okr.save();

    if (employeeDoc.user) {
      await createNotification(
        employeeDoc.user._id,
        'performance_review',
        'New OKR Assigned',
        `A new objective "${objective}" has been assigned to you for ${period} ${year}.`,
        { type: 'feedback', id: okr._id },
        '/employee/performance'
      );
    }

    await okr.populate([
      { path: 'employee', select: 'user position', populate: { path: 'user', select: 'name email' } },
      { path: 'assignedBy', select: 'name email' }
    ]);

    res.status(201).json(okr);
  } catch (error) {
    console.error('Error creating OKR:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Failed to create OKR' });
  }
});

router.get('/employee/:employeeId', verifyJWT, async (req, res) => {
  try {
    const { year } = req.query;
    const query = { employee: req.params.employeeId };
    if (year) query.year = parseInt(year, 10);

    const okrs = await OKR.find(query)
      .populate({ path: 'assignedBy', select: 'name' })
      .populate({ path: 'managerReview.reviewer', select: 'name' })
      .sort({ createdAt: -1 });

    res.json({ okrs });
  } catch (error) {
    console.error('Error fetching employee OKRs:', error);
    res.status(500).json({ error: 'Failed to fetch employee OKRs' });
  }
});

router.get('/:id', verifyJWT, async (req, res) => {
  try {
    const okr = await OKR.findById(req.params.id)
      .populate({ path: 'employee', select: 'user position', populate: { path: 'user', select: 'name email' } })
      .populate('assignedBy', 'name email')
      .populate({ path: 'managerReview.reviewer', select: 'name' });

    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }

    res.json(okr);
  } catch (error) {
    console.error('Error fetching OKR:', error);
    res.status(500).json({ error: 'Failed to fetch OKR' });
  }
});

router.put('/:id', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const updates = req.body;
    const okr = await OKR.findById(req.params.id);
    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }

    Object.assign(okr, updates);
    await okr.save();

    await okr.populate([
      { path: 'employee', select: 'user position', populate: { path: 'user', select: 'name email' } },
      { path: 'assignedBy', select: 'name email' }
    ]);

    res.json(okr);
  } catch (error) {
    console.error('Error updating OKR:', error);
    res.status(500).json({ error: 'Failed to update OKR' });
  }
});

router.put('/:id/key-results/:index', verifyJWT, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const { currentValue } = req.body;

    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ error: 'Invalid key result index' });
    }

    const numericValue = Math.max(0, Number(currentValue));
    if (Number.isNaN(numericValue)) {
      return res.status(400).json({ error: 'currentValue must be a number' });
    }

    const okr = await OKR.findById(req.params.id);
    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }

    const canUpdate = await assertOkrUpdateAccess(okr, req.user);
    if (!canUpdate) {
      return res.status(403).json({ error: 'Not authorized to update this OKR' });
    }

    if (!okr.keyResults[index]) {
      return res.status(404).json({ error: 'Key result not found' });
    }

    okr.keyResults[index].currentValue = numericValue;
    okr.markModified('keyResults');
    await okr.save();

    res.json(okr);
  } catch (error) {
    console.error('Error updating key result:', error);
    res.status(500).json({ error: error.message || 'Failed to update key result progress' });
  }
});

router.post('/:id/ai-insights', verifyJWT, async (req, res) => {
  try {
    const okr = await OKR.findById(req.params.id).populate({
      path: 'employee',
      select: 'position user',
      populate: { path: 'user', select: 'name' },
    });

    if (!okr) {
      return res.status(404).json({ error: 'OKR not found' });
    }

    const canView = await assertOkrUpdateAccess(okr, req.user);
    if (!canView) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const employeeContext = {
      name: okr.employee?.user?.name,
      position: okr.employee?.position,
    };

    okr.aiInsights = await generateOKRInsights(okr, employeeContext);
    await okr.save();

    res.json(okr);
  } catch (error) {
    console.error('Error generating OKR AI insights:', error);
    res.status(500).json({ error: 'Failed to generate AI insights' });
  }
});

module.exports = router;
