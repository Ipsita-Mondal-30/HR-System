const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const baseName = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    return {
      folder: 'profile-pictures',
      resource_type: 'image',
      public_id: `${Date.now()}-${baseName}`,
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }],
    };
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype.startsWith('image/') && ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed'));
};

const profilePictureUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
});

module.exports = profilePictureUpload;
