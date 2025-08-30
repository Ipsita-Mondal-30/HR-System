const express = require('express');
const router = express.Router();
const { verifyJWT, isHRorAdmin } = require('../middleware/auth');
const Interview = require('../models/Interview');
const Application = require('../models/Application');
const { sendEmail } = require('../utils/email');

// Get all interviews
router.get('/', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const interviews = await Interview.find()
      .populate({
        path: 'application',
        populate: [
          { path: 'job', select: 'title companyName' },
          { path: 'candidate', select: 'name email' }
        ]
      })
      .populate('interviewer', 'name email')
      .sort({ scheduledAt: -1 });

    res.json(interviews);
  } catch (err) {
    console.error('Error fetching interviews:', err);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Schedule a new interview
router.post('/', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const {
      applicationId,
      scheduledAt,
      duration = 60,
      type = 'video',
      meetingLink,
      location,
      notes
    } = req.body;

    // Validate application exists
    const application = await Application.findById(applicationId)
      .populate('job', 'title companyName')
      .populate('candidate', 'name email');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Create interview
    const interview = new Interview({
      application: applicationId,
      interviewer: req.user._id,
      scheduledAt: new Date(scheduledAt),
      duration,
      type,
      meetingLink,
      location,
      notes,
      status: 'scheduled'
    });

    await interview.save();

    // Send email notification to candidate
    try {
      const interviewDate = new Date(scheduledAt);
      const emailSubject = `Interview Scheduled: ${application.job.title}`;
      
      let meetingDetails = '';
      if (type === 'video' && meetingLink) {
        meetingDetails = `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>`;
      } else if (type === 'in-person' && location) {
        meetingDetails = `<p><strong>Location:</strong> ${location}</p>`;
      } else if (type === 'phone') {
        meetingDetails = `<p><strong>Type:</strong> Phone Interview - We will call you at the scheduled time</p>`;
      }

      await sendEmail({
        to: application.email,
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Interview Scheduled! 📅</h2>
            
            <p>Dear ${application.name},</p>
            
            <p>We're excited to inform you that an interview has been scheduled for the position of <strong>${application.job.title}</strong> at <strong>${application.job.companyName}</strong>.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Interview Details:</h3>
              <p><strong>Date:</strong> ${interviewDate.toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${interviewDate.toLocaleTimeString()}</p>
              <p><strong>Duration:</strong> ${duration} minutes</p>
              <p><strong>Type:</strong> ${type.charAt(0).toUpperCase() + type.slice(1)} Interview</p>
              ${meetingDetails}
              ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
            </div>
            
            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>💡 Interview Tips:</strong></p>
              <ul style="margin: 10px 0;">
                <li>Review the job description and company information</li>
                <li>Prepare examples of your relevant experience</li>
                <li>Have questions ready about the role and company</li>
                <li>Test your technology if it's a video interview</li>
                <li>Join the meeting 5 minutes early</li>
              </ul>
            </div>
            
            <p>If you need to reschedule or have any questions, please contact us as soon as possible.</p>
            
            <p>We look forward to speaking with you!</p>
            <p>Best regards,<br>The ${application.job.companyName} Hiring Team</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send interview notification email:', emailError);
      // Don't fail the interview creation if email fails
    }

    // Populate the created interview for response
    await interview.populate([
      {
        path: 'application',
        populate: [
          { path: 'job', select: 'title companyName' },
          { path: 'candidate', select: 'name email' }
        ]
      },
      { path: 'interviewer', select: 'name email' }
    ]);

    res.status(201).json({
      message: 'Interview scheduled successfully',
      interview
    });
  } catch (err) {
    console.error('Error scheduling interview:', err);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
});

// Update interview status
router.put('/:id/status', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['scheduled', 'completed', 'cancelled', 'no-show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const interview = await Interview.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate([
      {
        path: 'application',
        populate: [
          { path: 'job', select: 'title companyName' },
          { path: 'candidate', select: 'name email' }
        ]
      },
      { path: 'interviewer', select: 'name email' }
    ]);

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Send status update email to candidate
    try {
      let emailSubject = '';
      let emailContent = '';

      switch (status) {
        case 'completed':
          emailSubject = `Interview Completed: ${interview.application.job.title}`;
          emailContent = `
            <p>Thank you for taking the time to interview with us for the ${interview.application.job.title} position.</p>
            <p>We will review your interview and get back to you with next steps soon.</p>
          `;
          break;
        case 'cancelled':
          emailSubject = `Interview Cancelled: ${interview.application.job.title}`;
          emailContent = `
            <p>We regret to inform you that your scheduled interview for the ${interview.application.job.title} position has been cancelled.</p>
            <p>We will contact you soon to reschedule at a more convenient time.</p>
          `;
          break;
        case 'no-show':
          emailSubject = `Missed Interview: ${interview.application.job.title}`;
          emailContent = `
            <p>We noticed that you were unable to attend your scheduled interview for the ${interview.application.job.title} position.</p>
            <p>If you're still interested in this opportunity, please contact us to reschedule.</p>
          `;
          break;
      }

      if (emailSubject && emailContent) {
        await sendEmail({
          to: interview.application.email,
          subject: emailSubject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">${emailSubject}</h2>
              <p>Dear ${interview.application.name},</p>
              ${emailContent}
              <p>Best regards,<br>The ${interview.application.job.companyName} Hiring Team</p>
            </div>
          `
        });
      }
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.json({
      message: `Interview status updated to ${status}`,
      interview
    });
  } catch (err) {
    console.error('Error updating interview status:', err);
    res.status(500).json({ error: 'Failed to update interview status' });
  }
});

// Submit interview scorecard
router.put('/:id/scorecard', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { scorecard } = req.body;

    const interview = await Interview.findByIdAndUpdate(
      id,
      { 
        scorecard,
        status: 'completed' // Automatically mark as completed when scorecard is submitted
      },
      { new: true }
    ).populate([
      {
        path: 'application',
        populate: [
          { path: 'job', select: 'title companyName' },
          { path: 'candidate', select: 'name email' }
        ]
      },
      { path: 'interviewer', select: 'name email' }
    ]);

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Update application status based on recommendation
    if (scorecard.recommendation === 'hire') {
      await Application.findByIdAndUpdate(interview.application._id, {
        status: 'shortlisted'
      });
    } else if (scorecard.recommendation === 'no-hire') {
      await Application.findByIdAndUpdate(interview.application._id, {
        status: 'rejected'
      });
    }

    // Generate AI-powered email notifications
    try {
      const agent = require('../controllers/agentController');
      
      // Generate AI feedback for candidate email
      const candidateEmailPrompt = `Generate a professional and encouraging email for a candidate who just completed an interview. 
      
      Interview Details:
      - Position: ${interview.application.job.title}
      - Company: ${interview.application.job.companyName}
      - Candidate: ${interview.application.name}
      - Overall Score: ${scorecard.overall}/5
      - Recommendation: ${scorecard.recommendation}
      - Technical Skills: ${scorecard.technicalSkills}/5
      - Communication: ${scorecard.communication}/5
      - Problem Solving: ${scorecard.problemSolving}/5
      - Cultural Fit: ${scorecard.culturalFit}/5
      - Feedback: ${scorecard.feedback}
      
      Create a personalized, professional email that:
      1. Thanks them for their time
      2. Mentions specific strengths (based on high scores)
      3. Is encouraging regardless of outcome
      4. Indicates next steps will follow
      5. Maintains professionalism
      
      Return only the email body content, no subject line.`;

      // Generate AI feedback for HR notification
      const hrEmailPrompt = `Generate a professional summary email for HR about a completed interview scorecard.
      
      Interview Details:
      - Position: ${interview.application.job.title}
      - Company: ${interview.application.job.companyName}
      - Candidate: ${interview.application.name}
      - Interviewer: ${interview.interviewer.name}
      - Overall Score: ${scorecard.overall}/5
      - Recommendation: ${scorecard.recommendation}
      - Technical Skills: ${scorecard.technicalSkills}/5
      - Communication: ${scorecard.communication}/5
      - Problem Solving: ${scorecard.problemSolving}/5
      - Cultural Fit: ${scorecard.culturalFit}/5
      - Feedback: ${scorecard.feedback}
      
      Create a concise HR summary that:
      1. Summarizes the interview outcome
      2. Highlights key strengths and concerns
      3. Provides clear recommendation
      4. Suggests next steps
      5. Is actionable for HR team
      
      Return only the email body content, no subject line.`;

      // Generate both emails using AI
      const mockReq = { body: { prompt: candidateEmailPrompt } };
      const mockRes = {
        json: async (data) => {
          const candidateEmailContent = data.response || 'Thank you for taking the time to interview with us. We will be in touch with next steps soon.';
          
          // Send candidate email
          await sendEmail({
            to: interview.application.email,
            subject: `Interview Update: ${interview.application.job.title} at ${interview.application.job.companyName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Interview Update 📋</h2>
                <p>Dear ${interview.application.name},</p>
                ${candidateEmailContent}
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Interview Summary:</strong></p>
                  <p style="margin: 5px 0;">Position: ${interview.application.job.title}</p>
                  <p style="margin: 5px 0;">Date: ${new Date(interview.scheduledAt).toLocaleDateString()}</p>
                  <p style="margin: 5px 0;">Duration: ${interview.duration} minutes</p>
                </div>
                <p>Best regards,<br>The ${interview.application.job.companyName} Hiring Team</p>
              </div>
            `
          });

          // Generate HR email
          const hrMockReq = { body: { prompt: hrEmailPrompt } };
          const hrMockRes = {
            json: async (hrData) => {
              const hrEmailContent = hrData.response || `Interview completed for ${interview.application.name}. Overall score: ${scorecard.overall}/5. Recommendation: ${scorecard.recommendation}.`;
              
              // Send HR notification email
              await sendEmail({
                to: interview.interviewer.email,
                subject: `Interview Scorecard Submitted: ${interview.application.name} - ${interview.application.job.title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Interview Scorecard Summary 📊</h2>
                    <p>Dear ${interview.interviewer.name},</p>
                    ${hrEmailContent}
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #374151;">Scorecard Details:</h3>
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <p><strong>Technical Skills:</strong> ${scorecard.technicalSkills}/5</p>
                        <p><strong>Communication:</strong> ${scorecard.communication}/5</p>
                        <p><strong>Problem Solving:</strong> ${scorecard.problemSolving}/5</p>
                        <p><strong>Cultural Fit:</strong> ${scorecard.culturalFit}/5</p>
                      </div>
                      <p><strong>Overall Score:</strong> ${scorecard.overall}/5</p>
                      <p><strong>Recommendation:</strong> ${scorecard.recommendation.toUpperCase()}</p>
                    </div>
                    
                    ${scorecard.feedback ? `
                    <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <h4 style="margin-top: 0;">Detailed Feedback:</h4>
                      <p style="margin: 0;">${scorecard.feedback}</p>
                    </div>
                    ` : ''}
                    
                    <p>You can view the complete scorecard in the admin dashboard.</p>
                    <p>Best regards,<br>HR System</p>
                  </div>
                `
              });
            },
            status: () => ({ json: () => {} })
          };
          
          await agent.generateResponse(hrMockReq, hrMockRes);
        },
        status: () => ({ json: () => {} })
      };
      
      await agent.generateResponse(mockReq, mockRes);
      
    } catch (emailError) {
      console.error('Failed to send AI-powered emails:', emailError);
      // Don't fail the scorecard submission if emails fail
    }

    res.json({
      message: 'Scorecard submitted successfully',
      interview
    });
  } catch (err) {
    console.error('Error submitting scorecard:', err);
    res.status(500).json({ error: 'Failed to submit scorecard' });
  }
});

// Get interview by ID
router.get('/:id', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate([
        {
          path: 'application',
          populate: [
            { path: 'job', select: 'title companyName description' },
            { path: 'candidate', select: 'name email phone skills experience' }
          ]
        },
        { path: 'interviewer', select: 'name email' }
      ]);

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json(interview);
  } catch (err) {
    console.error('Error fetching interview:', err);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Delete interview
router.delete('/:id', verifyJWT, isHRorAdmin, async (req, res) => {
  try {
    const interview = await Interview.findByIdAndDelete(req.params.id);

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json({ message: 'Interview deleted successfully' });
  } catch (err) {
    console.error('Error deleting interview:', err);
    res.status(500).json({ error: 'Failed to delete interview' });
  }
});

module.exports = router;