const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadResume = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'auto',      // ✅ Trick: upload as image/video/raw automatically
      folder: 'resumes',          // your folder
      access_mode: 'public'       // important
    });

    fs.unlinkSync(filePath); // delete local copy
    return result.secure_url;
  } catch (err) {
    console.error('❌ Cloudinary upload failed:', err);
    throw new Error('Failed to upload resume to Cloudinary');
  }
};

module.exports = { uploadResume };
