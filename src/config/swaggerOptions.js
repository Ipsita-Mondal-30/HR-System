const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

module.exports = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'HR System API',
      version: '1.0.0',
      description:
        'REST API for the HR Management System — authentication, hiring, interviews, employees, projects, and more.',
      contact: {
        name: 'HR System',
      },
    },
    servers: [
      { url: BASE_URL, description: 'Current environment' },
      { url: 'http://localhost:8080', description: 'Local development' },
      { url: 'https://hr-system-x2uf.onrender.com', description: 'Production' },
    ],
    tags: [
      { name: 'Health', description: 'Server health and diagnostics' },
      { name: 'Auth', description: 'Authentication and user session' },
      { name: 'Jobs', description: 'Job postings and salary data' },
      { name: 'Applications', description: 'Job applications' },
      { name: 'Application Drafts', description: 'Saved application drafts' },
      { name: 'Candidate', description: 'Candidate portal endpoints' },
      { name: 'Interviews', description: 'Interview scheduling and scorecards' },
      { name: 'Interview Prep', description: 'Practice questions and feedback' },
      { name: 'Video Interview', description: 'Video interview prep sessions' },
      { name: 'Voice Interview', description: 'AI voice interview sessions' },
      { name: 'HR', description: 'HR dashboard and operations' },
      { name: 'Admin', description: 'Admin management endpoints' },
      { name: 'Employees', description: 'Employee profiles and self-service' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Feedback', description: 'Employee feedback' },
      { name: 'OKRs', description: 'Objectives and key results' },
      { name: 'Achievements', description: 'Employee achievements' },
      { name: 'Notifications', description: 'User notifications' },
      { name: 'Resume Analysis', description: 'AI resume analysis' },
      { name: 'Hiring', description: 'Market hiring insights' },
      { name: 'Departments', description: 'Department management' },
      { name: 'Roles', description: 'Job role definitions' },
      { name: 'Users', description: 'User management' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT from login or OAuth. Pass as `Authorization: Bearer <token>`.',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth_token',
          description: 'JWT stored in the `auth_token` cookie after login.',
        },
      },
    },
  },
  apis: [
    path.join(__dirname, '../docs/schemas.js'),
    path.join(__dirname, '../docs/paths/*.js'),
  ],
};
