const Notification = require('../models/Notification');

/**
 * Create a notification for a user
 */
async function createNotification(userId, type, title, message, relatedEntity = null, link = null) {
  try {
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      relatedEntity: relatedEntity ? {
        type: relatedEntity.type,
        id: relatedEntity.id
      } : null,
      link
    });

    await notification.save();
    console.log(`✅ Notification created for user ${userId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw - notifications are non-critical
    return null;
  }
}

/**
 * Create notification for job application
 */
async function notifyJobApplied(userId, jobId, jobTitle, companyName) {
  return createNotification(
    userId,
    'job_applied',
    'Application Submitted',
    `You have successfully applied for ${jobTitle} at ${companyName}`,
    { type: 'application', id: jobId },
    `/candidate/applications`
  );
}

/**
 * Create notification for interview scheduled
 */
async function notifyInterviewScheduled(userId, interviewId, jobTitle, scheduledAt) {
  return createNotification(
    userId,
    'interview_scheduled',
    'Interview Scheduled',
    `Your interview for ${jobTitle} is scheduled for ${new Date(scheduledAt).toLocaleDateString()}`,
    { type: 'interview', id: interviewId },
    `/candidate/applications`
  );
}

/**
 * Create notification for application status change
 */
async function notifyApplicationStatusChanged(userId, applicationId, jobTitle, status) {
  const statusMessages = {
    shortlisted: 'You have been shortlisted!',
    rejected: 'Application status updated',
    reviewed: 'Your application is being reviewed'
  };

  return createNotification(
    userId,
    'application_status_changed',
    'Application Status Updated',
    `${jobTitle}: ${statusMessages[status] || 'Status updated'}`,
    { type: 'application', id: applicationId },
    `/candidate/applications`
  );
}

/**
 * Create notification for new job alert
 */
async function notifyNewJobPosted(userId, jobId, jobTitle, companyName) {
  return createNotification(
    userId,
    'job_alert',
    'New Job Posted',
    `New job posted: ${jobTitle} at ${companyName}`,
    { type: 'job', id: jobId },
    `/candidate/jobs/${jobId}`
  );
}

/**
 * Create notification for interview completed
 */
async function notifyInterviewCompleted(userId, interviewId, jobTitle) {
  return createNotification(
    userId,
    'interview_completed',
    'Interview Completed',
    `You have completed the interview for ${jobTitle}. Feedback will be sent via email.`,
    { type: 'interview', id: interviewId },
    `/candidate/interview-prep`
  );
}

module.exports = {
  createNotification,
  notifyJobApplied,
  notifyInterviewScheduled,
  notifyApplicationStatusChanged,
  notifyNewJobPosted,
  notifyInterviewCompleted
};

