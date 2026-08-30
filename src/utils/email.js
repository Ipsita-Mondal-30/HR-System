const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail', // or use Mailgun, SendGrid etc
  auth: {
    user: process.env.EMAIL_USER,       // your Gmail or SMTP user
    pass: process.env.EMAIL_PASSWORD,   // your app password
  },
});

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️ Email credentials not configured. Email not sent to:', to);
    console.warn('   Set EMAIL_USER and EMAIL_PASSWORD environment variables');
    return null;
  }

  const mailOptions = {
    from: `"HR Bot 🤖" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timed out after 12s')), 12000)
      ),
    ]);
    console.log(`✅ Email sent successfully to: ${to}`, info.messageId);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

module.exports = { sendEmail };
