const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const ProjectWorkSubmission = require('../models/ProjectWorkSubmission');
const Employee = require('../models/Employee');
const { applyProjectCompletionStatus, isProjectCompleted } = require('../utils/projectCompletion');

const DEFAULT_HOURS_PER_APPROVAL = 8;

function isActiveMilestone(milestone) {
  return milestone.status !== 'completed';
}

function canSubmitWork(project, milestones) {
  if (isProjectCompleted(project)) return false;
  return milestones.some(isActiveMilestone);
}

async function ensureProjectCompletionSynced(project) {
  if (!project) return null;
  const changed = applyProjectCompletionStatus(project);
  if (changed) {
    await project.save();
    for (const member of project.teamMembers || []) {
      if (member.employee) {
        await syncEmployeePerformanceFromProjects(member.employee);
      }
    }
    if (project.projectManager) {
      await syncEmployeePerformanceFromProjects(project.projectManager);
    }
  }
  return project;
}

async function syncEmployeePerformanceFromProjects(employeeId) {
  const projects = await Project.find({
    $or: [{ 'teamMembers.employee': employeeId }, { projectManager: employeeId }],
  });

  const employee = await Employee.findById(employeeId);
  if (!employee) return null;

  if (!projects.length) {
    return employee;
  }

  let weightedSum = 0;
  let totalWeight = 0;
  let completedCount = 0;

  for (const project of projects) {
    applyProjectCompletionStatus(project);
    const isComplete = isProjectCompleted(project);
    if (isComplete) completedCount++;

    const member = project.teamMembers.find(
      (m) => m.employee.toString() === employeeId.toString()
    );
    let contrib = member?.contributionPercentage ?? 0;

    const isPm = project.projectManager?.toString() === employeeId.toString();
    if (contrib === 0 && isPm) {
      contrib = project.completionPercentage ?? 0;
    }
    if (contrib === 0 && isComplete) {
      contrib = project.completionPercentage ?? 100;
    }

    const weight = isComplete ? 2 : 1;
    weightedSum += contrib * weight;
    totalWeight += weight;
  }

  const projectContribution = totalWeight > 0
    ? Math.min(100, Math.round(weightedSum / totalWeight))
    : 0;

  employee.projectContribution = projectContribution;

  if (completedCount > 0 && projectContribution > 0) {
    const blended = Math.round((employee.performanceScore * 0.5) + (projectContribution * 0.5));
    if (blended > employee.performanceScore) {
      employee.performanceScore = Math.min(100, blended);
    }
  }

  await employee.save();
  return employee;
}

async function syncEmployeeStatsFromSubmissions(projectId, employeeId) {
  const project = await Project.findById(projectId);
  if (!project) return null;

  const approved = await ProjectWorkSubmission.find({
    project: projectId,
    employee: employeeId,
    status: 'approved',
  }).sort({ reviewedAt: -1 });

  const totalHours = approved.reduce((sum, s) => sum + (s.hoursLogged || DEFAULT_HOURS_PER_APPROVAL), 0);
  const latestContribution = approved[0]?.approvedPercentage;

  const memberIdx = project.teamMembers.findIndex(
    (m) => m.employee.toString() === employeeId.toString()
  );

  if (memberIdx >= 0) {
    project.teamMembers[memberIdx].hoursWorked = totalHours;
    if (latestContribution !== undefined && latestContribution !== null) {
      project.teamMembers[memberIdx].contributionPercentage = latestContribution;
    } else if ((project.completionPercentage ?? 0) >= 100 && totalHours > 0) {
      project.teamMembers[memberIdx].contributionPercentage =
        project.teamMembers[memberIdx].contributionPercentage || project.completionPercentage;
    }
    await project.save();

    const employee = await Employee.findById(employeeId);
    if (employee) {
      employee.projectContribution = project.teamMembers[memberIdx].contributionPercentage;
      await employee.save();
      await syncEmployeePerformanceFromProjects(employeeId);
    }

    return project.teamMembers[memberIdx];
  }

  return null;
}

async function buildEmployeePerformanceOverview(project, employeeId, milestones, submissions) {
  const teamMember = project.teamMembers?.find(
    (m) => m.employee?.toString() === employeeId.toString() || m.employee === employeeId
  );

  const approved = submissions.filter((s) => s.status === 'approved');
  const pending = submissions.filter((s) => s.status === 'pending');
  const rejected = submissions.filter((s) => s.status === 'rejected');

  const hoursFromSubmissions = approved.reduce(
    (sum, s) => sum + (s.hoursLogged || DEFAULT_HOURS_PER_APPROVAL),
    0
  );
  const hoursWorked = hoursFromSubmissions || teamMember?.hoursWorked || 0;

  let contributionPercentage = teamMember?.contributionPercentage || 0;
  if (contributionPercentage === 0 && approved.length > 0) {
    contributionPercentage = approved[0].approvedPercentage ?? contributionPercentage;
  }
  if (contributionPercentage === 0 && milestones.length > 0) {
    const avgMilestone =
      milestones.reduce((sum, m) => sum + (m.completionPercentage || 0), 0) / milestones.length;
    contributionPercentage = Math.round(avgMilestone);
  }
  if (contributionPercentage === 0 && (project.completionPercentage ?? 0) >= 100) {
    contributionPercentage = project.completionPercentage ?? 100;
  }

  const milestonesCompleted = milestones.filter((m) => m.status === 'completed').length;
  const milestonesOverdue = milestones.filter((m) => m.status === 'overdue').length;
  const onTimeRate =
    milestones.length > 0
      ? Math.round(((milestones.length - milestonesOverdue) / milestones.length) * 100)
      : 100;

  let performanceRating = 'good';
  if (milestonesOverdue > 0 && approved.length === 0) performanceRating = 'at-risk';
  else if (contributionPercentage >= 80 && onTimeRate >= 80) performanceRating = 'excellent';
  else if (contributionPercentage < 40 || milestonesOverdue > 1) performanceRating = 'needs-improvement';

  const performanceSummary =
    performanceRating === 'excellent'
      ? 'Strong delivery — on track with milestones and approved work.'
      : performanceRating === 'good'
      ? 'Solid progress — keep submitting work against active milestones.'
      : performanceRating === 'needs-improvement'
      ? 'Improvement needed — focus on overdue milestones and submit deliverables.'
      : 'At risk — overdue milestones require immediate attention.';

  return {
    contributionPercentage,
    hoursWorked,
    milestonesTotal: milestones.length,
    milestonesCompleted,
    milestonesOverdue,
    submissionsApproved: approved.length,
    submissionsPending: pending.length,
    submissionsRejected: rejected.length,
    onTimeRate,
    performanceRating,
    performanceSummary,
    canSubmitWork: canSubmitWork(project, milestones),
  };
}

async function buildTeamPerformanceOverview(projectId) {
  const project = await Project.findById(projectId)
    .populate({
      path: 'teamMembers.employee',
      select: 'position',
      populate: { path: 'user', select: 'name email' },
    })
    .populate({
      path: 'projectManager',
      select: 'position',
      populate: { path: 'user', select: 'name email' },
    });

  if (!project) return null;

  const milestones = await Milestone.find({ project: projectId });
  const submissions = await ProjectWorkSubmission.find({ project: projectId });

  const members = [];

  if (project.projectManager) {
    const pmId = project.projectManager._id.toString();
    const pmMilestones = milestones.filter((m) =>
      m.assignedTo.some((id) => id.toString() === pmId)
    );
    const pmSubs = submissions.filter((s) => s.employee.toString() === pmId);
    const overview = await buildEmployeePerformanceOverview(
      project,
      pmId,
      pmMilestones,
      pmSubs
    );
    members.push({
      employee: project.projectManager,
      role: 'project-manager',
      ...overview,
    });
  }

  for (const member of project.teamMembers || []) {
    const empId = member.employee._id.toString();
    if (project.projectManager && empId === project.projectManager._id.toString()) continue;

    const empMilestones = milestones.filter((m) =>
      m.assignedTo.some((id) => id.toString() === empId)
    );
    const empSubs = submissions.filter((s) => s.employee.toString() === empId);
    const overview = await buildEmployeePerformanceOverview(
      project,
      empId,
      empMilestones,
      empSubs
    );
    members.push({
      employee: member.employee,
      role: member.role,
      ...overview,
    });
  }

  return {
    project: {
      _id: project._id,
      name: project.name,
      completionPercentage: project.completionPercentage,
      status: project.status,
    },
    teamPerformance: members,
    milestonesSummary: {
      total: milestones.length,
      completed: milestones.filter((m) => m.status === 'completed').length,
      inProgress: milestones.filter((m) => m.status === 'in-progress').length,
      overdue: milestones.filter((m) => m.status === 'overdue').length,
    },
    submissionsSummary: {
      total: submissions.length,
      pending: submissions.filter((s) => s.status === 'pending').length,
      approved: submissions.filter((s) => s.status === 'approved').length,
      rejected: submissions.filter((s) => s.status === 'rejected').length,
    },
  };
}

module.exports = {
  isActiveMilestone,
  canSubmitWork,
  syncEmployeeStatsFromSubmissions,
  buildEmployeePerformanceOverview,
  buildTeamPerformanceOverview,
  ensureProjectCompletionSynced,
  syncEmployeePerformanceFromProjects,
  DEFAULT_HOURS_PER_APPROVAL,
};
