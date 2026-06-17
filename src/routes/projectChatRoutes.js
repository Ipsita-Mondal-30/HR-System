const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth');
const Milestone = require('../models/Milestone');
const Project = require('../models/Project');
const ProjectWorkSubmission = require('../models/ProjectWorkSubmission');
const Employee = require('../models/Employee');
const projectWorkUpload = require('../middleware/projectWorkUpload');
const {
  syncEmployeeStatsFromSubmissions,
  buildTeamPerformanceOverview,
  ensureProjectCompletionSynced,
  DEFAULT_HOURS_PER_APPROVAL,
} = require('../services/projectPerformanceService');
const { isProjectCompleted } = require('../utils/projectCompletion');
const { checkAndNotifyMilestoneDeadlines } = require('../services/milestoneDeadlineService');
const {
  listMessages,
  createMessage,
  assertProjectAccess,
  assertMilestoneRespondAccess,
} = require('../services/projectChatService');

function getIo(req) {
  return req.app.get('io');
}

// Employee: respond to milestone (static path first)
router.patch('/milestones/:milestoneId/respond', verifyJWT, async (req, res) => {
  try {
    const { completionPercentage, message, status } = req.body;
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const access = await assertMilestoneRespondAccess(milestone, req.user);
    const employeeId = access.employee?._id?.toString();
    const isAssigned = milestone.assignedTo.some((id) => {
      const assigneeId = id?._id ? id._id.toString() : id?.toString();
      return assigneeId === employeeId;
    });
    const isPm = access.projectRole === 'project-manager';
    const isAdmin = req.user.role === 'admin' || req.user.role === 'hr';

    if (!isAssigned && !isPm && !isAdmin) {
      return res.status(403).json({ error: 'Not assigned to this milestone' });
    }

    if (completionPercentage !== undefined) {
      milestone.completionPercentage = Math.max(0, Math.min(100, Number(completionPercentage)));
    }
    if (status) milestone.status = status;

    if (message?.trim() && access.employee?._id) {
      if (!milestone.responses) milestone.responses = [];
      milestone.responses.push({
        employee: access.employee._id,
        message: message.trim(),
        completionPercentage: milestone.completionPercentage,
      });
    }

    await milestone.save();

    let chatResult = null;
    if (message?.trim()) {
      try {
        chatResult = await createMessage({
          projectId: milestone.project.toString(),
          user: req.user,
          message: `Milestone "${milestone.title}": ${message.trim()}`,
          messageType: 'milestone_response',
          milestoneId: milestone._id,
        });
      } catch (chatErr) {
        console.warn('Milestone saved but chat message failed:', chatErr.message);
      }
    }

    const io = getIo(req);
    const projectId = milestone.project.toString();
    if (io) {
      io.to(`project:${projectId}`).emit('milestone:updated', milestone);
      if (chatResult?.message) {
        io.to(`project:${projectId}`).emit('chat:message', chatResult.message);
        if (chatResult.botReply) {
          io.to(`project:${projectId}`).emit('chat:message', chatResult.botReply);
        }
      }
    }

    res.json({ milestone, chat: chatResult });
  } catch (error) {
    console.error('Milestone respond error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to update milestone' });
  }
});

// Chat history
router.get('/:projectId/chat/messages', verifyJWT, async (req, res) => {
  try {
    await assertProjectAccess(req.params.projectId, req.user);
    const messages = await listMessages(req.params.projectId);
    res.json({ messages });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load messages' });
  }
});

// Send message (REST fallback)
router.post('/:projectId/chat/messages', verifyJWT, async (req, res) => {
  try {
    const { message, messageType, milestoneId } = req.body;
    const result = await createMessage({
      projectId: req.params.projectId,
      user: req.user,
      message,
      messageType,
      milestoneId,
    });

    const io = getIo(req);
    if (io) {
      io.to(`project:${req.params.projectId}`).emit('chat:message', result.message);
      if (result.botReply) {
        io.to(`project:${req.params.projectId}`).emit('chat:message', result.botReply);
      }
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to send message' });
  }
});

// Admin / PM: create milestone
router.post('/:projectId/milestones', verifyJWT, async (req, res) => {
  try {
    const { title, description, dueDate, assignedTo = [] } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ error: 'Title and due date are required' });
    }

    const access = await assertProjectAccess(req.params.projectId, req.user);
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'hr' &&
      access.projectRole !== 'project-manager'
    ) {
      return res.status(403).json({ error: 'Only admin or project manager can create milestones' });
    }

    const milestone = await Milestone.create({
      project: req.params.projectId,
      title,
      description,
      dueDate,
      assignedTo,
    });

    await milestone.populate('assignedTo', 'user position');

    const io = getIo(req);
    if (io) {
      io.to(`project:${req.params.projectId}`).emit('milestone:created', milestone);
    }

    res.status(201).json({ milestone });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to create milestone' });
  }
});

// List milestones for project
router.get('/:projectId/milestones', verifyJWT, async (req, res) => {
  try {
    await assertProjectAccess(req.params.projectId, req.user);
    const milestones = await Milestone.find({ project: req.params.projectId })
      .populate({
        path: 'assignedTo',
        select: 'position',
        populate: { path: 'user', select: 'name' },
      })
      .sort({ dueDate: 1 });
    res.json({ milestones });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load milestones' });
  }
});

// PM: update project progress
router.patch('/:projectId/progress', verifyJWT, async (req, res) => {
  try {
    const { completionPercentage, status, message } = req.body;
    const access = await assertProjectAccess(req.params.projectId, req.user);

    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'hr' &&
      access.projectRole !== 'project-manager'
    ) {
      return res.status(403).json({ error: 'Only project manager can update project progress' });
    }

    const updates = {};
    if (completionPercentage !== undefined) {
      updates.completionPercentage = Math.max(0, Math.min(100, Number(completionPercentage)));
    }
    if (status) updates.status = status;

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    Object.assign(project, updates);
    await ensureProjectCompletionSynced(project);

    await project.populate([
      {
        path: 'projectManager',
        select: 'position',
        populate: { path: 'user', select: 'name email' },
      },
      {
        path: 'teamMembers.employee',
        select: 'position',
        populate: { path: 'user', select: 'name email' },
      },
    ]);

    let chatResult = null;
    if (message?.trim()) {
      chatResult = await createMessage({
        projectId: req.params.projectId,
        user: req.user,
        message: message.trim(),
        messageType: 'pm_broadcast',
      });
    }

    const io = getIo(req);
    if (io) {
      io.to(`project:${req.params.projectId}`).emit('project:updated', project);
      if (chatResult?.message) {
        io.to(`project:${req.params.projectId}`).emit('chat:message', chatResult.message);
      }
    }

    res.json({ project, chat: chatResult });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to update project' });
  }
});

// Employee: submit work file for review
router.post(
  '/:projectId/work-submissions',
  verifyJWT,
  projectWorkUpload.single('file'),
  async (req, res) => {
    try {
      const { title, description, milestoneId } = req.body;
      if (!req.file) {
        return res.status(400).json({ error: 'Work file is required' });
      }
      if (!title?.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }
      if (!milestoneId) {
        return res.status(400).json({ error: 'Select an active milestone to submit work against' });
      }

      const access = await assertProjectAccess(req.params.projectId, req.user);
      if (!access.employee) {
        return res.status(403).json({ error: 'Only assigned employees can submit work' });
      }

      const project = await Project.findById(req.params.projectId);
      if (!project || isProjectCompleted(project)) {
        return res.status(400).json({ error: 'Project is complete — work submission is closed' });
      }

      const milestone = await Milestone.findById(milestoneId);
      if (!milestone || milestone.project.toString() !== req.params.projectId) {
        return res.status(400).json({ error: 'Invalid milestone' });
      }
      if (milestone.status === 'completed') {
        return res.status(400).json({ error: 'This milestone is already completed' });
      }

      const isAssigned = milestone.assignedTo.some(
        (id) => id.toString() === access.employee._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ error: 'You are not assigned to this milestone' });
      }

      const fileUrl = req.file.path || req.file.url;
      const submission = await ProjectWorkSubmission.create({
        project: req.params.projectId,
        milestone: milestoneId,
        employee: access.employee._id,
        title: title.trim(),
        description: description?.trim(),
        fileUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        submittedPercentage: 0,
        status: 'pending',
      });

      await submission.populate({
        path: 'employee',
        select: 'position',
        populate: { path: 'user', select: 'name' },
      });

      if (milestone) {
          if (!milestone.responses) milestone.responses = [];
          milestone.responses.push({
            employee: access.employee._id,
            message: `Work submitted: ${title.trim()} (pending admin review)`,
            completionPercentage: milestone.completionPercentage,
          });
          if (milestone.status === 'pending') milestone.status = 'in-progress';
          await milestone.save();
        }

      try {
        await createMessage({
          projectId: req.params.projectId,
          user: req.user,
          message: `📎 Submitted work "${title.trim()}" for admin review`,
          messageType: 'update',
        });
      } catch (chatErr) {
        console.warn('Work submission chat notify failed:', chatErr.message);
      }

      const io = getIo(req);
      if (io) {
        io.to(`project:${req.params.projectId}`).emit('work:submitted', submission);
      }

      res.status(201).json({ submission });
    } catch (error) {
      console.error('Work submission error:', error);
      res.status(error.status || 500).json({ error: error.message || 'Failed to submit work' });
    }
  }
);

// List work submissions for a project
router.get('/:projectId/work-submissions', verifyJWT, async (req, res) => {
  try {
    const access = await assertProjectAccess(req.params.projectId, req.user);
    const isReviewer =
      req.user.role === 'admin' ||
      req.user.role === 'hr' ||
      access.projectRole === 'project-manager';

    const query = { project: req.params.projectId };
    if (!isReviewer && access.employee) {
      query.employee = access.employee._id;
    }

    const submissions = await ProjectWorkSubmission.find(query)
      .populate({
        path: 'employee',
        select: 'position',
        populate: { path: 'user', select: 'name email' },
      })
      .populate('milestone', 'title')
      .sort({ createdAt: -1 });

    res.json({ submissions });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load submissions' });
  }
});

// Admin/PM: review work submission
router.patch('/work-submissions/:submissionId/review', verifyJWT, async (req, res) => {
  try {
    const { status, approvedPercentage, contributionPercentage, hoursLogged, adminNote } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const submission = await ProjectWorkSubmission.findById(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const access = await assertProjectAccess(submission.project.toString(), req.user);
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'hr' &&
      access.projectRole !== 'project-manager'
    ) {
      return res.status(403).json({ error: 'Only admin or project manager can review work' });
    }

    submission.status = status;
    submission.adminNote = adminNote?.trim();
    submission.reviewedBy = req.user._id;
    submission.reviewedAt = new Date();

    const project = await Project.findById(submission.project);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (status === 'approved') {
      const projectPct = Math.max(0, Math.min(100, Number(approvedPercentage) || 0));
      submission.approvedPercentage = projectPct;
      submission.hoursLogged = Math.max(0, Number(hoursLogged) || DEFAULT_HOURS_PER_APPROVAL);
      project.completionPercentage = projectPct;

      const memberIdx = project.teamMembers.findIndex(
        (m) => m.employee.toString() === submission.employee.toString()
      );
      const contribution = contributionPercentage !== undefined
        ? Math.max(0, Math.min(100, Number(contributionPercentage)))
        : projectPct;

      if (memberIdx >= 0) {
        project.teamMembers[memberIdx].contributionPercentage = contribution;
      }

      if (submission.milestone) {
        const milestone = await Milestone.findById(submission.milestone);
        if (milestone) {
          milestone.completionPercentage = projectPct;
          if (!milestone.responses) milestone.responses = [];
          milestone.responses.push({
            employee: submission.employee,
            message: `Approved by admin: ${adminNote?.trim() || 'Work approved'}`,
            completionPercentage: projectPct,
          });
          await milestone.save();
        }
      }

      await ensureProjectCompletionSynced(project);
    }

    await submission.save();
    await project.save();
    await syncEmployeeStatsFromSubmissions(submission.project, submission.employee);

    await project.populate([
      { path: 'projectManager', select: 'position', populate: { path: 'user', select: 'name email' } },
      { path: 'teamMembers.employee', select: 'position', populate: { path: 'user', select: 'name email' } },
    ]);

    await submission.populate({
      path: 'employee',
      select: 'position',
      populate: { path: 'user', select: 'name' },
    });

    try {
      const justCompleted = status === 'approved' && (submission.approvedPercentage ?? 0) >= 100;
      await createMessage({
        projectId: submission.project.toString(),
        user: req.user,
        message:
          status === 'approved'
            ? justCompleted
              ? `🎉 Work "${submission.title}" approved — project is now 100% complete and marked as completed!`
              : `✅ Work "${submission.title}" approved — project completion updated to ${submission.approvedPercentage}%`
            : `❌ Work "${submission.title}" was rejected${adminNote ? `: ${adminNote}` : ''}`,
        messageType: 'pm_broadcast',
      });
    } catch (chatErr) {
      console.warn('Review chat notify failed:', chatErr.message);
    }

    const io = getIo(req);
    if (io) {
      io.to(`project:${submission.project}`).emit('project:updated', project);
      io.to(`project:${submission.project}`).emit('work:reviewed', submission);
    }

    res.json({ submission, project });
  } catch (error) {
    console.error('Work review error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to review submission' });
  }
});

// Performance overview for admin / employee
router.get('/:projectId/performance-overview', verifyJWT, async (req, res) => {
  try {
    await assertProjectAccess(req.params.projectId, req.user);
    checkAndNotifyMilestoneDeadlines().catch((err) =>
      console.warn('Deadline check failed:', err.message)
    );
    const overview = await buildTeamPerformanceOverview(req.params.projectId);
    if (!overview) return res.status(404).json({ error: 'Project not found' });
    res.json(overview);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load performance overview' });
  }
});

module.exports = router;
