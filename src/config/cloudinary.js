const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadResume = async (filePath) => {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: 'raw',
        folder: 'resumes',
        use_filename: true,
        unique_filename: true,
  
        // ✅ FORCE PUBLIC DELIVERY
        access_mode: 'public',
      });
  
      fs.unlinkSync(filePath);
      return result.secure_url;
    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      throw new Error('Failed to upload resume to Cloudinary');
    }
  };
  

module.exports = { uploadResume };
