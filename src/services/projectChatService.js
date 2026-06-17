const Project = require('../models/Project');
const Employee = require('../models/Employee');
const ProjectMessage = require('../models/ProjectMessage');
const User = require('../models/User');

async function getEmployeeForUser(userId) {
  if (!userId) return null;
  return Employee.findOne({ user: userId }).populate('user', 'name email role');
}

function resolveUserId(user) {
  return user?._id || user?.id;
}

async function getProjectRole(project, employeeId) {
  if (!employeeId) return null;
  const id = employeeId.toString();
  if (project.projectManager?.toString() === id) return 'project-manager';
  const member = project.teamMembers?.find((m) => m.employee?.toString() === id);
  return member ? member.role || 'employee' : null;
}

async function assertProjectAccess(projectId, user) {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }

  if (user.role === 'admin' || user.role === 'hr') {
    return { project, employee: null, projectRole: 'admin' };
  }

  const employee = await getEmployeeForUser(resolveUserId(user));
  if (!employee) {
    const err = new Error('Employee profile not found');
    err.status = 403;
    throw err;
  }

  const projectRole = await getProjectRole(project, employee._id);
  if (!projectRole) {
    const err = new Error('You are not assigned to this project');
    err.status = 403;
    throw err;
  }

  const senderRole =
    projectRole === 'project-manager' ? 'project-manager' : 'employee';

  return { project, employee, projectRole, senderRole };
}

async function listMessages(projectId, limit = 100) {
  return ProjectMessage.find({ project: projectId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
}

async function createMessage({
  projectId,
  user,
  message,
  messageType = 'update',
  milestoneId = null,
}) {
  const trimmed = (message || '').trim();
  if (!trimmed) {
    const err = new Error('Message is required');
    err.status = 400;
    throw err;
  }

  const { project, employee, senderRole } = await assertProjectAccess(projectId, user);
  const userId = resolveUserId(user);
  const dbUser = await User.findById(userId).select('name role');

  const doc = await ProjectMessage.create({
    project: project._id,
    sender: userId,
    senderEmployee: employee?._id,
    senderName: dbUser?.name || 'User',
    senderRole: user.role === 'admin' ? 'admin' : senderRole,
    message: trimmed,
    messageType,
    milestone: milestoneId || undefined,
  });

  const payload = {
    _id: doc._id.toString(),
    project: doc.project.toString(),
    sender: doc.sender.toString(),
    senderEmployee: doc.senderEmployee?.toString(),
    senderName: doc.senderName,
    senderRole: doc.senderRole,
    message: doc.message,
    messageType: doc.messageType,
    milestone: doc.milestone?.toString(),
    createdAt: doc.createdAt,
  };

  let botReply = null;
  if (senderRole === 'employee') {
    const pm = await Employee.findById(project.projectManager).populate('user', 'name');
    botReply = await ProjectMessage.create({
      project: project._id,
      sender: userId,
      senderName: 'Project Assistant',
      senderRole: 'system',
      message: `Update received. ${pm?.user?.name || 'Your project manager'} has been notified.`,
      messageType: 'system',
    });
  }

  return {
    message: payload,
    botReply: botReply
      ? {
          _id: botReply._id.toString(),
          project: botReply.project.toString(),
          senderName: botReply.senderName,
          senderRole: botReply.senderRole,
          message: botReply.message,
          messageType: botReply.messageType,
          createdAt: botReply.createdAt,
        }
      : null,
  };
}

async function assertMilestoneRespondAccess(milestone, user) {
  const projectId = milestone.project.toString();

  try {
    return await assertProjectAccess(projectId, user);
  } catch (err) {
    if (err.status !== 403 || user.role === 'admin' || user.role === 'hr') {
      throw err;
    }

    const employee = await getEmployeeForUser(resolveUserId(user));
    if (!employee) throw err;

    const isAssigned = milestone.assignedTo.some((id) => {
      const assigneeId = id?._id ? id._id.toString() : id?.toString();
      return assigneeId === employee._id.toString();
    });

    if (!isAssigned) throw err;

    const project = await Project.findById(projectId);
    if (!project) {
      const notFound = new Error('Project not found');
      notFound.status = 404;
      throw notFound;
    }

    return {
      project,
      employee,
      projectRole: 'employee',
      senderRole: 'employee',
    };
  }
}

module.exports = {
  assertProjectAccess,
  assertMilestoneRespondAccess,
  listMessages,
  createMessage,
  getEmployeeForUser,
  getProjectRole,
  resolveUserId,
};
