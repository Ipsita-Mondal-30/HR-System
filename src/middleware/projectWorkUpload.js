const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.txt', '.ppt', '.pptx',
]);
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1) || 'bin';
    const baseName = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);

    return {
      folder: 'project-work',
      resource_type: isImage ? 'image' : 'raw',
      format: isImage ? undefined : ext,
      public_id: `${Date.now()}-${baseName}`,
    };
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error('File type not allowed. Use PDF, DOC, images, ZIP, or PPT.'));
};

const projectWorkUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

module.exports = projectWorkUpload;
