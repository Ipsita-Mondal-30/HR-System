function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function pending(value) {
  return hasValue(value) ? String(value).trim() : 'Pending';
}

function transformInterviewForAdmin(interview) {
  const app = interview.application || {};
  const job = app.job || {};
  const candidateUser = app.candidate && typeof app.candidate === 'object' ? app.candidate : {};
  const interviewerRef =
    interview.interviewer && typeof interview.interviewer === 'object' ? interview.interviewer : {};
  const jobCreator =
    job.createdBy && typeof job.createdBy === 'object' ? job.createdBy : {};
  const hrUser = interviewerRef._id ? interviewerRef : jobCreator;

  return {
    _id: interview._id,
    candidateId: candidateUser._id || app.candidate || null,
    candidateName: pending(app.name || candidateUser.name),
    candidateEmail: pending(app.email || candidateUser.email),
    candidatePhone: pending(app.phone || candidateUser.phone),
    candidatePicture: candidateUser.profilePicture || null,
    hrId: hrUser._id || interview.interviewer || job.createdBy || null,
    hrName: pending(hrUser.name),
    hrEmail: pending(hrUser.email),
    hrCompany: pending(hrUser.company || job.companyName),
    hrPicture: hrUser.profilePicture || null,
    jobId: job._id || app.job || null,
    jobTitle: pending(job.title),
    jobCompany: pending(job.companyName),
    scheduledAt: interview.scheduledAt,
    completedAt: interview.completedAt || null,
    duration: interview.duration || 60,
    status: interview.status,
    type: interview.type || 'video',
    meetingLink: interview.meetingLink || null,
    location: interview.location || null,
    notes: hasValue(interview.notes) ? interview.notes : null,
    feedback: interview.scorecard?.feedback || interview.feedback || null,
    rating: interview.scorecard?.overall ?? interview.rating ?? null,
    outcome: interview.scorecard?.recommendation || interview.outcome || null,
    scorecard: interview.scorecard || null,
    recording: interview.recording || null,
    hireApproval: interview.hireApproval || null,
    applicationId: app._id || null,
    applicationStatus: app.status || null,
    matchScore: app.matchScore ?? null,
    resumeUrl: app.resumeUrl || app.resumeFile?.url || null,
    createdAt: interview.createdAt,
  };
}

const INTERVIEW_POPULATE = [
  {
    path: 'application',
    populate: [
      { path: 'candidate', select: 'name email phone profilePicture' },
      { path: 'job', select: 'title companyName description minSalary maxSalary employmentType department', populate: { path: 'createdBy', select: 'name email company profilePicture' } },
    ],
  },
  { path: 'interviewer', select: 'name email company profilePicture' },
];

module.exports = {
  pending,
  hasValue,
  transformInterviewForAdmin,
  INTERVIEW_POPULATE,
};
