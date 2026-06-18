const Interview = require('../models/Interview');
const Application = require('../models/Application');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Job = require('../models/Job');
const { hashPassword, generateTemporaryPassword } = require('../utils/password');
const { sendEmail } = require('../utils/email');
const { createNotification } = require('./notificationService');
const { INTERVIEW_POPULATE } = require('../utils/interviewTransform');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function populateInterview(id) {
  return Interview.findById(id).populate(INTERVIEW_POPULATE).populate('interviewer', 'name email');
}

async function notifyAdminsHireRecommended(interview, application) {
  const admins = await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id email name');
  for (const admin of admins) {
    await createNotification(
      admin._id,
      'hire_recommended',
      'Hire recommendation pending review',
      `HR recommended hire for ${application.name || 'candidate'} — ${application.job?.title || 'role'}. Review the meeting recording and scorecard.`,
      { type: 'Interview', id: interview._id },
      '/admin/hire-approvals'
    );
  }

  for (const admin of admins) {
    if (!admin.email) continue;
    try {
      await sendEmail({
        to: admin.email,
        subject: `Hire Review Required: ${application.name} — ${application.job?.title || 'Position'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Hire Recommendation Pending Admin Approval</h2>
            <p><strong>Candidate:</strong> ${application.name} (${application.email})</p>
            <p><strong>Role:</strong> ${application.job?.title || 'N/A'} at ${application.job?.companyName || 'N/A'}</p>
            <p><strong>HR Recommendation:</strong> Hire</p>
            <p>Please review the interview recording and scorecard before approving employee onboarding.</p>
            <p><a href="${FRONTEND_URL}/admin/hire-approvals">Open Hire Approvals Dashboard</a></p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Failed to email admin about hire recommendation:', err.message);
    }
  }
}

async function approveHireAndCreateEmployee({ interviewId, adminUserId, adminNotes, position, salary, departmentId }) {
  const interview = await Interview.findById(interviewId).populate([
    {
      path: 'application',
      populate: [{ path: 'job' }, { path: 'candidate', select: 'name email phone' }],
    },
    { path: 'interviewer', select: 'name email' },
  ]);

  if (!interview) throw new Error('Interview not found');
  if (interview.hireApproval?.status !== 'pending') {
    throw new Error('This hire recommendation is not pending approval');
  }
  if (!interview.recording?.url) {
    throw new Error('Cannot approve without an interview recording on file');
  }
  if (interview.scorecard?.recommendation !== 'hire') {
    throw new Error('HR has not recommended hire for this interview');
  }

  const application = interview.application;
  const job = application.job;
  const candidateEmail = application.email;
  const candidateName = application.name || application.candidate?.name;
  const tempPassword = generateTemporaryPassword();

  let user = application.candidate
    ? await User.findById(application.candidate)
    : await User.findOne({ email: candidateEmail });

  if (!user) {
    user = new User({
      name: candidateName,
      email: candidateEmail,
      phone: application.phone,
      role: 'employee',
      isActive: true,
      isVerified: true,
      password: hashPassword(tempPassword),
    });
    await user.save();
  } else {
    user.role = 'employee';
    user.isActive = true;
    user.isVerified = true;
    user.password = hashPassword(tempPassword);
    if (candidateName) user.name = candidateName;
    await user.save();
  }

  let employee = await Employee.findOne({ user: user._id });
  if (!employee) {
    const employeeCount = await Employee.countDocuments();
    employee = new Employee({
      user: user._id,
      employeeId: `EMP${String(employeeCount + 1).padStart(4, '0')}`,
      position: position || job?.title || 'Employee',
      department: departmentId || job?.department || null,
      hireDate: new Date(),
      salary: salary || job?.minSalary || 0,
      employmentType: job?.employmentType || 'full-time',
      status: 'active',
    });
    await employee.save();
  } else {
    employee.status = 'active';
    if (position) employee.position = position;
    if (salary) employee.salary = salary;
    if (departmentId) employee.department = departmentId;
    await employee.save();
  }

  interview.hireApproval = {
    ...interview.hireApproval?.toObject?.() || interview.hireApproval,
    status: 'approved',
    reviewedBy: adminUserId,
    reviewedAt: new Date(),
    adminNotes: adminNotes || '',
    employeeId: employee._id,
  };
  interview.completedAt = interview.completedAt || new Date();
  await interview.save();

  await Application.findByIdAndUpdate(application._id, {
    status: 'hired',
    hiredAt: new Date(),
    employeeProfile: employee._id,
  });

  try {
    await sendEmail({
      to: candidateEmail,
      subject: `Welcome to the team — ${job?.companyName || 'Company'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Congratulations, ${candidateName}!</h2>
          <p>Your hire has been approved. You are now an employee at <strong>${job?.companyName || 'our company'}</strong>.</p>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
            <p><strong>Employee login email:</strong> ${candidateEmail}</p>
            <p><strong>Temporary password:</strong> ${tempPassword}</p>
            <p><strong>Position:</strong> ${employee.position}</p>
          </div>
          <p>Sign in at <a href="${FRONTEND_URL}">${FRONTEND_URL}</a> and change your password after first login.</p>
          <p>You can use the employee portal for payroll, projects, performance, and more.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send employee welcome email:', err.message);
  }

  await createNotification(
    user._id,
    'hire_approved',
    'Welcome aboard!',
    'Your hire was approved. Check your email for employee login credentials.',
    { type: 'Employee', id: employee._id },
    '/employee/dashboard'
  );

  return {
    interview: await populateInterview(interviewId),
    employee: await Employee.findById(employee._id).populate('user', 'name email'),
    credentials: { email: candidateEmail, temporaryPassword: tempPassword },
  };
}

async function rejectHireRecommendation({ interviewId, adminUserId, adminNotes }) {
  const interview = await Interview.findById(interviewId);
  if (!interview) throw new Error('Interview not found');
  if (interview.hireApproval?.status !== 'pending') {
    throw new Error('This hire recommendation is not pending');
  }

  interview.hireApproval.status = 'rejected';
  interview.hireApproval.reviewedBy = adminUserId;
  interview.hireApproval.reviewedAt = new Date();
  interview.hireApproval.adminNotes = adminNotes || '';
  await interview.save();

  await Application.findByIdAndUpdate(interview.application, { status: 'shortlisted' });

  return populateInterview(interviewId);
}

async function getHireRecommendations() {
  const interviews = await Interview.find({
    'hireApproval.status': 'pending',
    'scorecard.recommendation': 'hire',
  })
    .populate(INTERVIEW_POPULATE)
    .populate('interviewer', 'name email company')
    .populate('hireApproval.reviewedBy', 'name email')
    .sort({ 'hireApproval.recommendedAt': -1 });

  return interviews;
}

module.exports = {
  notifyAdminsHireRecommended,
  approveHireAndCreateEmployee,
  rejectHireRecommendation,
  getHireRecommendations,
};
