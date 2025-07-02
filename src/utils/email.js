const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail', // or use Mailgun, SendGrid etc
  auth: {
    user: process.env.EMAIL_USER,       // your Gmail or SMTP user
    pass: process.env.EMAIL_PASSWORD,   // your app password
  },
});

const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: `"HR Bot 🤖" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendEmail };
