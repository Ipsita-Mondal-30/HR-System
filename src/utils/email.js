const nodemailer = require('nodemailer');

let transporter = null;

function getMailConfig() {
  const user = String(process.env.EMAIL_USER || '').trim();
  const pass = String(process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  const fromName = process.env.EMAIL_FROM_NAME || 'Talora HR';
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    user,
    pass,
    fromName,
    host,
    port,
    secure: port === 465,
    configured: Boolean(user && pass),
  };
}

function isMailConfigured() {
  return getMailConfig().configured;
}

function createTransporter(overrides = {}) {
  const cfg = { ...getMailConfig(), ...overrides };
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

function resetTransporter() {
  transporter = null;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function sendWithTimeout(mailer, mailOptions, ms) {
  return Promise.race([
    mailer.sendMail(mailOptions),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Email send timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
}

async function sendEmail({ to, subject, html, text, fromName }) {
  const cfg = getMailConfig();
  const recipient = String(to || '').trim();

  if (!cfg.configured) {
    console.warn('⚠️ Email not sent — EMAIL_USER / EMAIL_PASSWORD are not set. Recipient:', recipient || '(none)');
    return null;
  }

  if (!looksLikeEmail(recipient)) {
    console.warn('⚠️ Email not sent — invalid or missing recipient:', recipient || '(none)');
    return null;
  }

  const mailOptions = {
    from: `"${fromName || cfg.fromName}" <${cfg.user}>`,
    to: recipient,
    subject: subject || 'Talora notification',
    html: html || undefined,
    text: text || undefined,
  };

  const attempts = [
    { port: cfg.port, secure: cfg.secure },
    cfg.port !== 465 ? { port: 465, secure: true } : null,
  ].filter(Boolean);

  let lastError;

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    try {
      const mailer =
        i === 0 && transporter
          ? transporter
          : createTransporter({ port: attempt.port, secure: attempt.secure });
      if (i === 0) transporter = mailer;

      const info = await sendWithTimeout(mailer, mailOptions, 30000);
      console.log(`✅ Email sent to ${recipient} (${info.messageId || 'ok'})`);
      return info;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Email attempt via port ${attempt.port} failed:`, error.message);
      transporter = null;
    }
  }

  console.error(`❌ Failed to send email to ${recipient}:`, lastError?.message);
  throw lastError || new Error('Failed to send email');
}

async function sendEmailSafe(options) {
  try {
    const info = await sendEmail(options);
    return Boolean(info);
  } catch (error) {
    console.error(`❌ Email send failed for ${options?.to}:`, error.message);
    return false;
  }
}

module.exports = {
  sendEmail,
  sendEmailSafe,
  isMailConfigured,
  getTransporter,
  getMailConfig,
  resetTransporter,
};
