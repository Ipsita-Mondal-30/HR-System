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
  async sendVoiceInterviewFeedback(candidateEmail, candidateName, jobRole, score, status, strengths, weaknesses, improvementTips) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email transporter not initialized, skipping email');
        return false;
      }

      const statusColor = status === 'READY' ? '#059669' : status === 'NEEDS PRACTICE' ? '#f59e0b' : '#dc2626';
      const statusEmoji = status === 'READY' ? '✅' : status === 'NEEDS PRACTICE' ? '⚠️' : '📚';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🎙️ Voice Interview Prep Feedback</h1>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #374151;">Hi <strong>${candidateName}</strong>,</p>
            <p style="color: #6b7280;">Thank you for completing the voice interview preparation for <strong style="color: #4f46e5;">${jobRole}</strong>!</p>
            
            <div style="background: #f3f4f6; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 40px; border-radius: 50px; margin-bottom: 20px;">
                <div style="font-size: 36px; font-weight: bold;">${score}/100</div>
                <div style="font-size: 14px; margin-top: 5px;">Prep Score</div>
              </div>
              
              <div style="display: inline-block; background: ${statusColor}; color: white; padding: 12px 30px; border-radius: 50px; font-size: 18px; font-weight: bold;">
                ${statusEmoji} ${status}
              </div>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border: 2px solid #10b981;">
              <h3 style="color: #059669; margin-top: 0;">✓ Your Strengths:</h3>
              <ul style="color: #374151; line-height: 1.8;">
                ${strengths.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border: 2px solid #f59e0b;">
              <h3 style="color: #d97706; margin-top: 0;">→ Weak Areas:</h3>
              <ul style="color: #374151; line-height: 1.8;">
                ${weaknesses.map(w => `<li>${w}</li>`).join('')}
              </ul>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border: 2px solid #3b82f6;">
              <h3 style="color: #2563eb; margin-top: 0;">💡 Learning Suggestions:</h3>
              <ul style="color: #374151; line-height: 1.8;">
                ${improvementTips.map(tip => `<li>${tip}</li>`).join('')}
              </ul>
            </div>
            
            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 30px;">
              <p style="margin: 0; color: #1e40af; font-weight: bold;">🎯 Next Steps:</p>
              <ul style="color: #374151; line-height: 1.6; margin: 10px 0 0 0;">
                <li>Review the feedback and work on weak areas</li>
                <li>Practice more interviews to improve your score</li>
                <li>Research the company and role thoroughly</li>
                <li>Feel free to retry the interview prep anytime!</li>
              </ul>
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
