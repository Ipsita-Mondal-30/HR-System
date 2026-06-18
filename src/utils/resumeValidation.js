const path = require('path');

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_RESUME_MIMES = new Set(['application/pdf']);
const ALLOWED_RESUME_EXTENSIONS = new Set(['.pdf']);

function validateResumeFile(file) {
  if (!file) {
    return { valid: false, error: 'Resume file is required' };
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_RESUME_EXTENSIONS.has(ext)) {
    return { valid: false, error: 'Only PDF resumes are allowed' };
  }

  if (file.mimetype && !ALLOWED_RESUME_MIMES.has(file.mimetype)) {
    return { valid: false, error: 'Only PDF file type is allowed' };
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return { valid: false, error: 'Resume must be 10 MB or smaller' };
  }

  return { valid: true };
}

module.exports = {
  MAX_RESUME_SIZE_BYTES,
  ALLOWED_RESUME_MIMES,
  ALLOWED_RESUME_EXTENSIONS,
  validateResumeFile,
};
