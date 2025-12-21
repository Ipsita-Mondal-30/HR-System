// Quick test for email service
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing nodemailer...');
console.log('nodemailer type:', typeof nodemailer);
console.log('createTransport type:', typeof nodemailer.createTransport);

try {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  
  console.log('✅ Transporter created successfully!');
  console.log('Email user:', process.env.EMAIL_USER ? 'Set' : 'Not set');
  console.log('Email password:', process.env.EMAIL_PASSWORD ? 'Set' : 'Not set');
} catch (error) {
  console.error('❌ Error creating transporter:', error);
}
