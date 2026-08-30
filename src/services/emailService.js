const { sendEmail, sendEmailSafe, isMailConfigured, getTransporter } = require('../utils/email');

class EmailService {
  get transporter() {
    return getTransporter();
  }

  async sendInterviewFeedback(candidateEmail, candidateName, analysis, jobRole) {
    try {
      if (!isMailConfigured()) {
        console.warn('⚠️ Email not configured, skipping interview feedback email');
        return false;
      }

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🎯 Your Interview Prep Feedback</h1>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #374151;">Hi <strong>${candidateName}</strong>,</p>
            <p style="color: #6b7280;">Thank you for completing the interview practice for <strong style="color: #4f46e5;">${jobRole}</strong>!</p>
            
            <div style="background: #f3f4f6; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <div style="text-align: center; margin-bottom: 20px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 50px; font-size: 24px; font-weight: bold;">
                  Overall Score: ${analysis.overallScore}/100
                </div>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                <h3 style="color: #059669; margin-top: 0;">✓ Your Strengths:</h3>
                <ul style="color: #374151; line-height: 1.8;">
                  ${(analysis.strengths || []).map((s) => `<li>${s}</li>`).join('')}
                </ul>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                <h3 style="color: #dc2626; margin-top: 0;">→ Areas for Improvement:</h3>
                <ul style="color: #374151; line-height: 1.8;">
                  ${(analysis.improvements || []).map((i) => `<li>${i}</li>`).join('')}
                </ul>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                <h3 style="color: #4f46e5; margin-top: 0;">💡 Recommendations:</h3>
                <ul style="color: #374151; line-height: 1.8;">
                  ${(analysis.recommendations || []).map((r) => `<li>${r}</li>`).join('')}
                </ul>
              </div>
            </div>
            
            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #1e40af;">Detailed Feedback:</strong></p>
              <p style="color: #374151; line-height: 1.6; margin: 0;">${analysis.detailedFeedback || ''}</p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="color: #6b7280; margin: 10px 0;">Keep practicing and good luck with your interviews!</p>
              <p style="color: #374151; font-weight: bold; margin: 10px 0;">Best regards,<br>The Talora Team</p>
            </div>
          </div>
        </div>
      `;

      return sendEmailSafe({
        to: candidateEmail,
        subject: `Your Interview Prep Feedback - ${jobRole}`,
        html: htmlContent,
        fromName: 'Talora Interview Prep',
      });
    } catch (error) {
      console.error('❌ Email sending error:', error);
      return false;
    }
  }

  async sendVoiceInterviewFeedback(
    candidateEmail,
    candidateName,
    jobRole,
    score,
    status,
    strengths,
    weaknesses,
    improvementTips,
    resources = [],
    courses = [],
    extra = {}
  ) {
    try {
      if (!isMailConfigured()) {
        console.warn('⚠️ Email not configured, skipping voice interview email');
        return false;
      }

      const statusColor = status === 'READY' ? '#059669' : status === 'NEEDS PRACTICE' ? '#f59e0b' : '#dc2626';
      const statusEmoji = status === 'READY' ? '✅' : status === 'NEEDS PRACTICE' ? '⚠️' : '📚';
      const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#f59e0b' : '#dc2626';
      const safeStrengths = Array.isArray(strengths) ? strengths : [];
      const safeWeaknesses = Array.isArray(weaknesses) ? weaknesses : [];
      const safeTips = Array.isArray(improvementTips) ? improvementTips : [];
      const safeResources = Array.isArray(resources) ? resources : [];
      const safeCourses = Array.isArray(courses) ? courses : [];
      const questionFeedback = Array.isArray(extra.questionFeedback) ? extra.questionFeedback : [];
      const actionPlan = Array.isArray(extra.actionPlan) ? extra.actionPlan : [];
      const skillsToPractice = Array.isArray(extra.skillsToPractice) ? extra.skillsToPractice : [];
      const summary = extra.summary || '';
      const companyBit = extra.companyName ? ` at ${extra.companyName}` : '';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 35px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎙️ Your Voice Interview Prep Results</h1>
          </div>
          
          <div style="background: white; padding: 35px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #374151; margin-bottom: 10px;">Hi <strong>${candidateName}</strong>,</p>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Thank you for completing the voice interview preparation for <strong style="color: #4f46e5;">${jobRole}</strong>${companyBit}. 
              Below is coaching based on the answers you actually gave.
            </p>
            ${summary ? `<div style="background: #eff6ff; padding: 18px; border-radius: 10px; margin-bottom: 24px; border-left: 4px solid #3b82f6;"><p style="margin: 0; color: #1e40af; line-height: 1.6;">${summary}</p></div>` : ''}
            
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center; border: 2px solid ${scoreColor};">
              <div style="margin-bottom: 20px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 50px; border-radius: 60px;">
                  <div style="font-size: 48px; font-weight: bold; line-height: 1;">${score}</div>
                  <div style="font-size: 16px; margin-top: 8px; opacity: 0.95;">out of 100</div>
                </div>
              </div>
              
              <div style="display: inline-block; background: ${statusColor}; color: white; padding: 14px 35px; border-radius: 50px; font-size: 18px; font-weight: bold; margin-top: 15px;">
                ${statusEmoji} ${status}
              </div>
            </div>
            
            <div style="background: #f0fdf4; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #10b981;">
              <h3 style="color: #059669; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">✓ What You Did Well</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
                ${safeStrengths.map((s) => `<li style="margin-bottom: 8px;">${s}</li>`).join('') || '<li>Thanks for completing the session.</li>'}
              </ul>
            </div>
            
            <div style="background: #fffbeb; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #f59e0b;">
              <h3 style="color: #d97706; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">→ Areas to Improve</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
                ${safeWeaknesses.map((w) => `<li style="margin-bottom: 8px;">${w}</li>`).join('') || '<li>Keep practicing with more detailed answers.</li>'}
              </ul>
            </div>
            
            <div style="background: #eff6ff; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #3b82f6;">
              <h3 style="color: #2563eb; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">💡 Actionable Tips to Improve</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
                ${safeTips.map((tip) => `<li style="margin-bottom: 8px;">${tip}</li>`).join('') || '<li>Retry this interview prep to improve your score.</li>'}
              </ul>
            </div>
            
            ${skillsToPractice.length ? `
            <div style="background: #fef3c7; padding: 22px; border-radius: 10px; margin: 25px 0;">
              <h3 style="color: #92400e; margin-top: 0;">Skills this job needs more evidence of</h3>
              <p style="color: #374151; margin: 0;">${skillsToPractice.join(', ')}</p>
            </div>` : ''}

            ${questionFeedback.length ? `
            <div style="margin: 30px 0;">
              <h3 style="color: #4f46e5;">Question-by-question coaching</h3>
              ${questionFeedback.map((qf, i) => `
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 0 0 8px; font-weight: bold; color: #374151;">Q${i + 1}: ${qf.question || ''}</p>
                  ${qf.whatWentWell ? `<p style="margin: 0 0 6px; color: #059669;"><strong>What worked:</strong> ${qf.whatWentWell}</p>` : ''}
                  ${qf.whatToImprove ? `<p style="margin: 0 0 6px; color: #d97706;"><strong>Improve:</strong> ${qf.whatToImprove}</p>` : ''}
                  ${qf.betterAnswer ? `<p style="margin: 0; color: #4b5563;"><strong>Stronger sample answer:</strong> ${qf.betterAnswer}</p>` : ''}
                </div>
              `).join('')}
            </div>` : ''}
            
            ${safeResources.length > 0 ? `
            <div style="background: #f0f9ff; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #0284c7;">
              <h3 style="color: #0369a1; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">📚 Recommended Learning Resources</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px; list-style: none;">
                ${safeResources.map((r) => `
                  <li style="margin-bottom: 12px;">
                    <a href="${r.url || '#'}" style="color: #0284c7; text-decoration: none; font-weight: 500;" target="_blank">
                      ${r.title || 'Resource'}
                    </a>
                    ${r.type ? ` <span style="color: #64748b; font-size: 14px;">(${r.type})</span>` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${safeCourses.length > 0 ? `
            <div style="background: #fdf4ff; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #9333ea;">
              <h3 style="color: #7e22ce; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">🎓 Recommended Courses</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px; list-style: none;">
                ${safeCourses.map((c) => `
                  <li style="margin-bottom: 12px;">
                    <a href="${c.url || '#'}" style="color: #9333ea; text-decoration: none; font-weight: bold;" target="_blank">
                      ${c.title || 'Course'}
                    </a>
                    ${c.platform ? ` <span style="color: #64748b; font-size: 14px;">- ${c.platform}</span>` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
            ` : ''}
            
            <div style="background: #f8fafc; padding: 25px; border-radius: 10px; border: 2px solid #e2e8f0; margin-top: 30px;">
              <p style="margin: 0 0 15px 0; color: #1e293b; font-weight: bold; font-size: 18px;">🎯 Recommended Next Steps</p>
              <ul style="color: #475569; line-height: 1.8; margin: 0; padding-left: 20px;">
                ${(actionPlan.length ? actionPlan : [
                  `Retry this ${jobRole} mock after rewriting weak answers`,
                  'Practice a 60-second STAR story for each job requirement',
                ]).map((s) => `<li style="margin-bottom: 10px;">${s}</li>`).join('')}
              </ul>
            </div>
            
            <div style="margin-top: 40px; padding-top: 25px; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="color: #64748b; margin: 15px 0; font-size: 15px; line-height: 1.6;">
                Keep practicing and good luck with your interviews!
              </p>
              <p style="color: #374151; font-weight: bold; margin: 15px 0; font-size: 16px;">
                Best regards,<br>
                <span style="color: #667eea;">The Talora Team</span>
              </p>
            </div>
          </div>
        </div>
      `;

      return sendEmailSafe({
        to: candidateEmail,
        subject: `Your Voice Interview Prep Feedback - ${jobRole}`,
        html: htmlContent,
        fromName: 'Talora Interview Prep',
      });
    } catch (error) {
      console.error('❌ Email sending error:', error);
      return false;
    }
  }
}

const emailService = new EmailService();
emailService.sendEmail = sendEmail;
emailService.sendEmailSafe = sendEmailSafe;

module.exports = emailService;
