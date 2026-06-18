const path = require('path');
const multer = require('multer');
const { MAX_RESUME_SIZE_BYTES, ALLOWED_RESUME_EXTENSIONS } = require('../utils/resumeValidation');

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_RESUME_EXTENSIONS.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error('Only PDF files are allowed'));
};

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_RESUME_SIZE_BYTES },
});

module.exports = resumeUpload;
