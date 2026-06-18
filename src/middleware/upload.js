const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_RESUME_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1) || 'pdf';
    const baseName = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    return {
      folder: 'resumes',
      resource_type: 'raw',
      format: ext,
      public_id: `${Date.now()}-${baseName}`,
    };
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_RESUME_EXTENSIONS.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_RESUME_SIZE_BYTES },
});

module.exports = upload;
