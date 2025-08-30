const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // Payroll Period
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  
  // Salary Components
  baseSalary: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Allowances
  allowances: {
    housing: {
      type: Number,
      default: 0,
      min: 0
    },
    transport: {
      type: Number,
      default: 0,
      min: 0
    },
    medical: {
      type: Number,
      default: 0,
      min: 0
    },
    other: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Deductions
  deductions: {
    tax: {
      type: Number,
      default: 0,
      min: 0
    },
    insurance: {
      type: Number,
      default: 0,
      min: 0
    },
    providentFund: {
      type: Number,
      default: 0,
      min: 0
    },
    other: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Overtime
  overtime: {
    hours: {
      type: Number,
      default: 0,
      min: 0
    },
    rate: {
      type: Number,
      default: 0,
      min: 0
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Bonus
  bonus: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Calculated Fields
  grossSalary: {
    type: Number,
    required: true,
    min: 0
  },
  netSalary: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Status and Approval
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid'],
    default: 'pending'
  },
  
  // Approval Information
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  
  // Payment Information
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'check', 'cash'],
    default: 'bank_transfer'
  },
  
  // Notes
  notes: {
    type: String,
    maxlength: 1000
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ status: 1 });
payrollSchema.index({ month: 1, year: 1 });
payrollSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate gross and net salary
payrollSchema.pre('save', function(next) {
  // Calculate total allowances
  const totalAllowances = Object.values(this.allowances).reduce((sum, val) => sum + (val || 0), 0);
  
  // Calculate total deductions
  const totalDeductions = Object.values(this.deductions).reduce((sum, val) => sum + (val || 0), 0);
  
  // Calculate overtime amount if not set
  if (this.overtime.hours > 0 && this.overtime.rate > 0 && !this.overtime.amount) {
    this.overtime.amount = this.overtime.hours * this.overtime.rate;
  }
  
  // Calculate gross salary
  this.grossSalary = this.baseSalary + totalAllowances + (this.overtime.amount || 0) + (this.bonus || 0);
  
  // Calculate net salary
  this.netSalary = this.grossSalary - totalDeductions;
  
  next();
});

// Virtual for payroll period display
payrollSchema.virtual('periodDisplay').get(function() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[this.month - 1]} ${this.year}`;
});

// Static method to get payroll statistics
payrollSchema.statics.getStats = async function(filters = {}) {
  const matchStage = {};
  
  if (filters.month) matchStage.month = filters.month;
  if (filters.year) matchStage.year = filters.year;
  if (filters.status) matchStage.status = filters.status;
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayrolls: { $sum: 1 },
        totalPayrollAmount: { $sum: '$netSalary' },
        avgSalary: { $avg: '$netSalary' },
        pendingCount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        approvedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        paidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalPayrolls: 0,
    totalPayrollAmount: 0,
    avgSalary: 0,
    pendingCount: 0,
    approvedCount: 0,
    paidCount: 0
  };
};

// Instance method to approve payroll
payrollSchema.methods.approve = function(approvedBy) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  return this.save();
};

// Instance method to mark as paid
payrollSchema.methods.markAsPaid = function(paymentDate = new Date()) {
  this.status = 'paid';
  this.paymentDate = paymentDate;
  return this.save();
};

module.exports = mongoose.model('Payroll', payrollSchema);