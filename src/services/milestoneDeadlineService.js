const Milestone = require('../models/Milestone');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const emailService = require('./emailService');

const NEAR_DEADLINE_DAYS = 2;

async function sendMilestoneReminderEmail(employee, milestone, project, type) {
  const user = employee.user;
  if (!user?.email) return false;

  const dueDate = new Date(milestone.dueDate).toLocaleDateString('en-GB');
  const subject =
    type === 'overdue'
      ? `Overdue milestone: ${milestone.title} — ${project.name}`
      : `Milestone due soon: ${milestone.title} — ${project.name}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: ${type === 'overdue' ? '#dc2626' : '#f59e0b'};">
        ${type === 'overdue' ? '⚠️ Milestone Overdue' : '⏰ Milestone Deadline Approaching'}
      </h2>
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>
        Your milestone <strong>${milestone.title}</strong> on project
        <strong>${project.name}</strong> is ${type === 'overdue' ? 'past its deadline' : `due within ${NEAR_DEADLINE_DAYS} days`}.
      </p>
      <p><strong>Due date:</strong> ${dueDate}</p>
      ${milestone.description ? `<p>${milestone.description}</p>` : ''}
      <p>Please submit your work through the employee project portal as soon as possible.</p>
      <p style="color: #6b7280; font-size: 13px;">— Talora HR Project Management</p>
    </div>
  `;

  try {
    if (!emailService.transporter) return false;
    await emailService.transporter.sendMail({
      from: `"Talora Projects" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.warn('Milestone reminder email failed:', err.message);
    return false;
  }
}

async function checkAndNotifyMilestoneDeadlines() {
  const now = new Date();
  const nearDeadline = new Date(now);
  nearDeadline.setDate(nearDeadline.getDate() + NEAR_DEADLINE_DAYS);

  const milestones = await Milestone.find({
    status: { $in: ['pending', 'in-progress', 'overdue'] },
    completionPercentage: { $lt: 100 },
  }).populate('project', 'name status');

  let sent = 0;

  for (const milestone of milestones) {
    if (!milestone.project || milestone.project.status === 'completed') continue;

    const due = new Date(milestone.dueDate);
    const isOverdue = due < now;
    const isNear = !isOverdue && due <= nearDeadline;

    if (!isOverdue && !isNear) continue;

    const reminderField = isOverdue ? 'overdueReminderSent' : 'deadlineReminderSent';
    if (milestone[reminderField]) continue;

    for (const assigneeId of milestone.assignedTo || []) {
      const employee = await Employee.findById(assigneeId).populate('user', 'name email');
      if (!employee) continue;

      const ok = await sendMilestoneReminderEmail(
        employee,
        milestone,
        milestone.project,
        isOverdue ? 'overdue' : 'near'
      );
      if (ok) sent++;
    }

    milestone[reminderField] = new Date();
    if (isOverdue && milestone.status !== 'overdue') milestone.status = 'overdue';
    await milestone.save();
  }

  if (sent > 0) console.log(`📧 Sent ${sent} milestone deadline reminder(s)`);
  return sent;
}

module.exports = { checkAndNotifyMilestoneDeadlines, NEAR_DEADLINE_DAYS };
