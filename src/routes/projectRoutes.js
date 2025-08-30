const express = require('express');
const router = express.Router();
const { verifyJWT, isHR, isAdmin } = require('../middleware/auth');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const Employee = require('../models/Employee');

// Get all projects
router.get('/', verifyJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, department } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    
    const projects = await Project.find(query)
      .populate('projectManager', 'user position')
      .populate('teamMembers.employee', 'user position')
      .populate('department', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Project.countDocuments(query);
    
    res.json({
      projects,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create new project
router.post('/', verifyJWT, async (req, res) => {
  try {
    const projectData = req.body;
    
    // Validate project manager exists
    const projectManager = await Employee.findById(projectData.projectManager);
    if (!projectManager) {
      return res.status(400).json({ error: 'Project manager not found' });
    }
    
    const project = new Project(projectData);
    await project.save();
    
    await project.populate([
      { path: 'projectManager', select: 'user position' },
      { path: 'teamMembers.employee', select: 'user position' },
      { path: 'department', select: 'name' }
    ]);
    
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get project details with timeline
router.get('/:id', verifyJWT, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('projectManager', 'user position')
      .populate('teamMembers.employee', 'user position')
      .populate('department', 'name');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get milestones
    const milestones = await Milestone.find({ project: project._id })
      .populate('assignedTo', 'user position')
      .sort({ dueDate: 1 });
    
    // Calculate project analytics
    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    const overdueMilestones = milestones.filter(m => m.status === 'overdue').length;
    
    const analytics = {
      totalMilestones,
      completedMilestones,
      overdueMilestones,
      completionRate: totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0,
      onTimeRate: totalMilestones > 0 ? ((totalMilestones - overdueMilestones) / totalMilestones) * 100 : 0
    };
    
    res.json({
      project,
      milestones,
      analytics
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update project
router.put('/:id', verifyJWT, async (req, res) => {
  try {
    const updates = req.body;
    
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('projectManager', 'user position')
      .populate('teamMembers.employee', 'user position')
      .populate('department', 'name');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Add team member to project
router.post('/:id/team-members', verifyJWT, async (req, res) => {
  try {
    const { employeeId, role = 'team-member' } = req.body;
    
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(400).json({ error: 'Employee not found' });
    }
    
    // Check if employee is already in the project
    const existingMember = project.teamMembers.find(
      member => member.employee.toString() === employeeId
    );
    
    if (existingMember) {
      return res.status(400).json({ error: 'Employee is already a team member' });
    }
    
    project.teamMembers.push({
      employee: employeeId,
      role,
      contributionPercentage: 0,
      hoursWorked: 0
    });
    
    await project.save();
    await project.populate('teamMembers.employee', 'user position');
    
    res.json(project);
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Update team member contribution
router.put('/:id/team-members/:memberId', verifyJWT, async (req, res) => {
  try {
    const { contributionPercentage, hoursWorked } = req.body;
    
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const memberIndex = project.teamMembers.findIndex(
      member => member._id.toString() === req.params.memberId
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    if (contributionPercentage !== undefined) {
      project.teamMembers[memberIndex].contributionPercentage = contributionPercentage;
    }
    if (hoursWorked !== undefined) {
      project.teamMembers[memberIndex].hoursWorked = hoursWorked;
    }
    
    await project.save();
    
    // Update employee's project contribution score
    const employee = await Employee.findById(project.teamMembers[memberIndex].employee);
    if (employee) {
      const employeeProjects = await Project.find({
        'teamMembers.employee': employee._id,
        status: { $in: ['active', 'completed'] }
      });
      
      const avgContribution = employeeProjects.reduce((sum, proj) => {
        const member = proj.teamMembers.find(m => m.employee.toString() === employee._id.toString());
        return sum + (member ? member.contributionPercentage : 0);
      }, 0) / employeeProjects.length;
      
      employee.projectContribution = avgContribution || 0;
      await employee.save();
    }
    
    await project.populate('teamMembers.employee', 'user position');
    res.json(project);
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// Get project analytics
router.get('/:id/analytics', verifyJWT, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('teamMembers.employee', 'user');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const milestones = await Milestone.find({ project: project._id });
    
    // Team performance analytics
    const teamAnalytics = project.teamMembers.map(member => ({
      employee: member.employee,
      contributionPercentage: member.contributionPercentage,
      hoursWorked: member.hoursWorked,
      milestonesAssigned: milestones.filter(m => 
        m.assignedTo.some(assignee => assignee.toString() === member.employee._id.toString())
      ).length,
      milestonesCompleted: milestones.filter(m => 
        m.status === 'completed' && 
        m.assignedTo.some(assignee => assignee.toString() === member.employee._id.toString())
      ).length
    }));
    
    // Project timeline analytics
    const timelineAnalytics = {
      totalDuration: project.endDate && project.startDate 
        ? Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24))
        : null,
      daysElapsed: Math.ceil((new Date() - new Date(project.startDate)) / (1000 * 60 * 60 * 24)),
      estimatedVsActual: {
        estimatedHours: project.estimatedHours,
        actualHours: project.actualHours,
        variance: project.estimatedHours > 0 
          ? ((project.actualHours - project.estimatedHours) / project.estimatedHours) * 100
          : 0
      }
    };
    
    res.json({
      project: {
        id: project._id,
        name: project.name,
        status: project.status,
        completionPercentage: project.completionPercentage
      },
      teamAnalytics,
      timelineAnalytics,
      milestonesSummary: {
        total: milestones.length,
        completed: milestones.filter(m => m.status === 'completed').length,
        inProgress: milestones.filter(m => m.status === 'in-progress').length,
        overdue: milestones.filter(m => m.status === 'overdue').length
      }
    });
  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({ error: 'Failed to fetch project analytics' });
  }
});

module.exports = router;