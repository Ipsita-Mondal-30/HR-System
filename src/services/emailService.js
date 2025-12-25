const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Check if nodemailer is properly imported
    if (!nodemailer || typeof nodemailer.createTransport !== 'function') {
      console.error('❌ Nodemailer not properly loaded');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendInterviewFeedback(candidateEmail, candidateName, analysis, jobRole) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email transporter not initialized, skipping email');
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
                  ${analysis.strengths.map(s => `<li>${s}</li>`).join('')}
                </ul>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                <h3 style="color: #dc2626; margin-top: 0;">→ Areas for Improvement:</h3>
                <ul style="color: #374151; line-height: 1.8;">
                  ${analysis.improvements.map(i => `<li>${i}</li>`).join('')}
                </ul>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                <h3 style="color: #4f46e5; margin-top: 0;">💡 Recommendations:</h3>
                <ul style="color: #374151; line-height: 1.8;">
                  ${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
              </div>
            </div>
            
            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #1e40af;">Detailed Feedback:</strong></p>
              <p style="color: #374151; line-height: 1.6; margin: 0;">${analysis.detailedFeedback}</p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="color: #6b7280; margin: 10px 0;">Keep practicing and good luck with your interviews!</p>
              <p style="color: #374151; font-weight: bold; margin: 10px 0;">Best regards,<br>The Talora Team</p>
            </div>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: `"Talora Interview Prep" <${process.env.EMAIL_USER}>`,
        to: candidateEmail,
        subject: `Your Interview Prep Feedback - ${jobRole}`,
        html: htmlContent
      });

      console.log('✅ Feedback email sent to:', candidateEmail);
      return true;
    } catch (error) {
      console.error('❌ Email sending error:', error);
      throw error;
    }
  }
  async sendVoiceInterviewFeedback(candidateEmail, candidateName, jobRole, score, status, strengths, weaknesses, improvementTips, resources = [], courses = []) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email transporter not initialized, skipping email');
        return false;
      }

      const statusColor = status === 'READY' ? '#059669' : status === 'NEEDS PRACTICE' ? '#f59e0b' : '#dc2626';
      const statusEmoji = status === 'READY' ? '✅' : status === 'NEEDS PRACTICE' ? '⚠️' : '📚';

      const scorePercentage = score;
      const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#f59e0b' : '#dc2626';
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 35px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎙️ Your Voice Interview Prep Results</h1>
          </div>
          
          <div style="background: white; padding: 35px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #374151; margin-bottom: 10px;">Hi <strong>${candidateName}</strong>,</p>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Thank you for completing the voice interview preparation for <strong style="color: #4f46e5;">${jobRole}</strong>! 
              Below is your detailed feedback and score.
            </p>
            
            <!-- Score Card -->
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
            
            <!-- Strengths Section -->
            <div style="background: #f0fdf4; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #10b981;">
              <h3 style="color: #059669; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">✓ What You Did Well</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
                ${strengths.map(s => `<li style="margin-bottom: 8px;">${s}</li>`).join('')}
              </ul>
            </div>
            
            <!-- Weaknesses Section -->
            <div style="background: #fffbeb; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #f59e0b;">
              <h3 style="color: #d97706; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">→ Areas to Improve</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
                ${weaknesses.map(w => `<li style="margin-bottom: 8px;">${w}</li>`).join('')}
              </ul>
            </div>
            
            <!-- Recommendations Section -->
            <div style="background: #eff6ff; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #3b82f6;">
              <h3 style="color: #2563eb; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">💡 Actionable Tips to Improve</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
                ${improvementTips.map(tip => `<li style="margin-bottom: 8px;">${tip}</li>`).join('')}
              </ul>
            </div>
            
            <!-- Resources Section -->
            ${resources.length > 0 ? `
            <div style="background: #f0f9ff; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #0284c7;">
              <h3 style="color: #0369a1; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">📚 Recommended Learning Resources</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px; list-style: none;">
                ${resources.map(r => `
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
            
            <!-- Courses Section -->
            ${courses.length > 0 ? `
            <div style="background: #fdf4ff; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #9333ea;">
              <h3 style="color: #7e22ce; margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: bold;">🎓 Recommended Courses</h3>
              <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px; list-style: none;">
                ${courses.map(c => `
                  <li style="margin-bottom: 12px;">
                    <a href="${c.url || '#'}" style="color: #9333ea; text-decoration: none; font-weight: 500;" target="_blank">
                      ${c.title || 'Course'}
                    </a>
                    ${c.platform ? ` <span style="color: #64748b; font-size: 14px;">- ${c.platform}</span>` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
            ` : ''}
            
            <!-- Next Steps Section -->
            <div style="background: #f8fafc; padding: 25px; border-radius: 10px; border: 2px solid #e2e8f0; margin-top: 30px;">
              <p style="margin: 0 0 15px 0; color: #1e293b; font-weight: bold; font-size: 18px;">🎯 Recommended Next Steps</p>
              <ul style="color: #475569; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;"><strong>Practice more:</strong> Retake this interview prep to improve your score</li>
                <li style="margin-bottom: 10px;"><strong>Focus on weak areas:</strong> Review the improvement suggestions above</li>
                <li style="margin-bottom: 10px;"><strong>Research thoroughly:</strong> Learn more about ${jobRole} roles and requirements</li>
                <li style="margin-bottom: 10px;"><strong>Prepare examples:</strong> Use the STAR method (Situation, Task, Action, Result)</li>
                ${resources.length > 0 || courses.length > 0 ? '<li style="margin-bottom: 10px;"><strong>Explore resources:</strong> Check out the recommended resources and courses above to enhance your skills</li>' : ''}
              </ul>
            </div>
            
            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 25px; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="color: #64748b; margin: 15px 0; font-size: 15px; line-height: 1.6;">
                Keep practicing and good luck with your interviews!<br>
                You can retry this interview prep anytime to improve your score.
              </p>
              <p style="color: #374151; font-weight: bold; margin: 15px 0; font-size: 16px;">
                Best regards,<br>
                <span style="color: #667eea;">The Talora Team</span>
              </p>
            </div>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: `"Talora Interview Prep" <${process.env.EMAIL_USER}>`,
        to: candidateEmail,
        subject: `Your Voice Interview Prep Feedback - ${jobRole}`,
        html: htmlContent
      });

      console.log('✅ Voice interview feedback email sent to:', candidateEmail);
      return true;
    } catch (error) {
      console.error('❌ Email sending error:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
