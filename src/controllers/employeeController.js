const Employee = require('../models/Employee');
const User = require('../models/User');
const Project = require('../models/Project');
const OKR = require('../models/OKR');
const Feedback = require('../models/Feedback');

// Get all employees with stats
const getAllEmployees = async (req, res) => {
  try {
    console.log('📊 Fetching all employees...');
    
    const employees = await Employee.find({ status: 'active' })
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate('manager', 'user position')
      .sort({ createdAt: -1 });

    const employeesWithStats = await Promise.all(
      employees.map(async (employee) => {
        const [projects, okrs, feedback] = await Promise.all([
          Project.find({ 'teamMembers.employee': employee._id }),
          OKR.find({ employee: employee._id, year: new Date().getFullYear() }),
          Feedback.find({ employee: employee._id, status: 'submitted' })
        ]);

        return {
          ...employee.toObject(),
          stats: {
            projectsCount: projects.length,
            okrsCount: okrs.length,
            feedbackCount: feedback.length,
            avgRating: feedback.length > 0 
              ? feedback.reduce((sum, f) => sum + (f.overallRating || 0), 0) / feedback.length 
              : 0
          }
        };
      })
    );

    res.json({ employees: employeesWithStats });
  } catch (error) {
    console.error('❌ Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

// Create new employee
const createEmployee = async (req, res) => {
  try {
    const { 
      name, email, phone, position, department, 
      hireDate, salary, employmentType, managerId 
    } = req.body;

    console.log('👤 Creating new employee:', { name, email, position });

    // Create user first
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name,
        email,
        phone,
        role: 'employee',
        isActive: true,
        isVerified: true
      });
      await user.save();
    } else if (user.role !== 'employee') {
      user.role = 'employee';
      await user.save();
    }

    // Find department by name if provided
    let departmentId = null;
    if (department) {
      const Department = require('../models/Department');
      const dept = await Department.findOne({ name: department });
      if (dept) {
        departmentId = dept._id;
      }
    }

    // Create employee profile
    const employee = new Employee({
      user: user._id,
      position,
      department: departmentId,
      manager: managerId || null,
      hireDate: hireDate || new Date(),
      salary: salary || 0,
      employmentType: employmentType || 'full-time',
      status: 'active'
    });

    await employee.save();
    
    const populatedEmployee = await Employee.findById(employee._id)
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate('manager', 'user position');

    console.log('✅ Employee created successfully:', populatedEmployee.user.name);
    res.status(201).json(populatedEmployee);
  } catch (error) {
    console.error('❌ Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('📝 Updating employee:', id);

    const employee = await Employee.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    )
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate('manager', 'user position');

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('❌ Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

// Get employee stats for dashboard
const getEmployeeStats = async (req, res) => {
  try {
    console.log('📊 Fetching employee statistics...');
    
    const [
      totalEmployees,
      activeEmployees,
      newHiresThisMonth,
      avgPerformanceScore,
      topPerformers,
      departmentStats
    ] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: 'active' }),
      Employee.countDocuments({ 
        hireDate: { 
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
        } 
      }),
      Employee.aggregate([
        { $group: { _id: null, avg: { $avg: '$performanceScore' } } }
      ]),
      Employee.find({ status: 'active' })
        .sort({ performanceScore: -1 })
        .limit(5)
        .populate('user', 'name')
        .select('user position performanceScore'),
      Employee.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $project: { departmentName: { $arrayElemAt: ['$dept.name', 0] }, count: 1 } }
      ])
    ]);

    const stats = {
      totalEmployees,
      activeEmployees,
      newHiresThisMonth,
      avgPerformanceScore: avgPerformanceScore[0]?.avg || 0,
      topPerformers,
      departmentStats
    };

    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching employee stats:', error);
    res.status(500).json({ error: 'Failed to fetch employee statistics' });
  }
};

// Get current employee profile
const getCurrentEmployee = async (req, res) => {
  try {
    console.log('🔍 Fetching current employee profile for user:', req.user.id);
    
    const employee = await Employee.findOne({ user: req.user.id })
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .populate('manager', 'user position');

    if (!employee) {
      console.log('❌ Employee not found for user:', req.user.id);
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    console.log('✅ Employee profile found:', employee.user.name);
    res.json(employee);
  } catch (error) {
    console.error('❌ Error fetching current employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee profile' });
  }
};

module.exports = {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  getEmployeeStats,
  getCurrentEmployee
};