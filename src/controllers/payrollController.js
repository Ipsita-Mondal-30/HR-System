const Employee = require('../models/Employee');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const mongoose = require('mongoose');

// Get all payroll records
const getAllPayrolls = async (req, res) => {
  try {
    console.log('🔍 getAllPayrolls called with query:', req.query);
    console.log('🔍 User:', req.user?.name, req.user?.role);
    
    const { month, year, status, employeeId } = req.query;
    
    let filter = {};
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (status && status !== 'all') filter.status = status;
    if (employeeId) filter.employee = employeeId;

    console.log('📊 Fetching payroll records with filter:', filter);

    const payrolls = await Payroll.find(filter)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate('approvedBy', 'name email')
      .sort({ year: -1, month: -1, createdAt: -1 });

    console.log(`✅ Found ${payrolls.length} payroll records`);
    res.json(payrolls);
  } catch (error) {
    console.error('❌ Error fetching payroll records:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single payroll record
const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate('approvedBy', 'name email');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    res.json(payroll);
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new payroll record
const createPayroll = async (req, res) => {
  try {
    const {
      employeeId,
      month,
      year,
      baseSalary,
      allowances = {},
      deductions = {},
      overtime = {},
      bonus = 0,
      notes
    } = req.body;

    console.log('📝 Creating payroll for employee:', employeeId);

    // Validate employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if payroll already exists for this employee/month/year
    const existingPayroll = await Payroll.findOne({
      employee: employeeId,
      month: parseInt(month),
      year: parseInt(year)
    });

    if (existingPayroll) {
      return res.status(400).json({ 
        message: 'Payroll already exists for this employee in this period' 
      });
    }

    // Create payroll record
    const payrollData = {
      employee: employeeId,
      month: parseInt(month),
      year: parseInt(year),
      baseSalary: parseFloat(baseSalary),
      allowances: {
        housing: parseFloat(allowances.housing || 0),
        transport: parseFloat(allowances.transport || 0),
        medical: parseFloat(allowances.medical || 0),
        other: parseFloat(allowances.other || 0)
      },
      deductions: {
        tax: parseFloat(deductions.tax || 0),
        insurance: parseFloat(deductions.insurance || 0),
        providentFund: parseFloat(deductions.providentFund || 0),
        other: parseFloat(deductions.other || 0)
      },
      overtime: {
        hours: parseFloat(overtime.hours || 0),
        rate: parseFloat(overtime.rate || 0),
        amount: parseFloat(overtime.amount || 0)
      },
      bonus: parseFloat(bonus),
      notes,
      createdBy: req.user._id
    };

    const payroll = new Payroll(payrollData);
    await payroll.save();

    // Populate the response
    await payroll.populate([
      {
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      },
      {
        path: 'createdBy',
        select: 'name email'
      }
    ]);

    console.log('✅ Payroll created successfully:', payroll._id);
    res.status(201).json(payroll);
  } catch (error) {
    console.error('❌ Error creating payroll:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Payroll already exists for this employee in this period' 
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update payroll record
const updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    // Don't allow updates to paid payrolls
    if (payroll.status === 'paid') {
      return res.status(400).json({ message: 'Cannot update paid payroll' });
    }

    const updates = req.body;
    
    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'employee' && key !== 'createdAt' && key !== 'updatedAt') {
        payroll[key] = updates[key];
      }
    });

    await payroll.save();

    // Populate the response
    await payroll.populate([
      {
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      },
      {
        path: 'approvedBy',
        select: 'name email'
      }
    ]);

    console.log('✅ Payroll updated successfully:', payroll._id);
    res.json(payroll);
  } catch (error) {
    console.error('❌ Error updating payroll:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Approve payroll
const approvePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    if (payroll.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending payrolls can be approved' });
    }

    await payroll.approve(req.user._id);

    // Populate the response
    await payroll.populate([
      {
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      },
      {
        path: 'approvedBy',
        select: 'name email'
      }
    ]);

    console.log('✅ Payroll approved successfully:', payroll._id);
    res.json(payroll);
  } catch (error) {
    console.error('❌ Error approving payroll:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Mark payroll as paid
const markAsPaid = async (req, res) => {
  try {
    console.log(`🔍 Marking payroll ${req.params.id} as paid`);
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      console.error(`❌ Payroll record not found: ${req.params.id}`);
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    if (payroll.status !== 'approved') {
      console.error(`❌ Cannot mark as paid - payroll status is ${payroll.status}`);
      return res.status(400).json({ message: 'Only approved payrolls can be marked as paid' });
    }

    const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    
    // Update status to 'paid' and set payment date
    payroll.status = 'paid';
    payroll.paymentDate = paymentDate;
    
    // Use the model's markAsPaid method if it exists, otherwise save directly
    if (typeof payroll.markAsPaid === 'function') {
      await payroll.markAsPaid(paymentDate);
    } else {
      await payroll.save();
    }

    // Populate the response
    await payroll.populate([
      {
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      },
      {
        path: 'approvedBy',
        select: 'name email'
      }
    ]);

    console.log('✅ Payroll marked as paid successfully:', payroll._id);
    res.json(payroll);
  } catch (error) {
    console.error('❌ Error marking payroll as paid:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get payroll statistics
const getPayrollStats = async (req, res) => {
  try {
    console.log('🔍 getPayrollStats called');
    console.log('🔍 User:', req.user?.name, req.user?.role);
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const stats = await Payroll.getStats();
    
    // Get current month stats
    const currentMonthStats = await Payroll.getStats({
      month: currentMonth,
      year: currentYear
    });

    const response = {
      totalPayrolls: stats.totalPayrolls,
      currentMonthPayrolls: currentMonthStats.totalPayrolls,
      approvedPayrolls: stats.approvedCount,
      paidPayrolls: stats.paidCount,
      pendingPayrolls: stats.pendingCount,
      totalPayrollAmount: stats.totalPayrollAmount,
      avgSalary: stats.avgSalary
    };

    console.log('📊 Payroll statistics:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching payroll statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllPayrolls,
  getPayrollById,
  createPayroll,
  updatePayroll,
  approvePayroll,
  markAsPaid,
  getPayrollStats
};