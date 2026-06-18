const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadPdfBuffer(buffer, folder, originalName) {
  const baseName = (originalName || 'resume')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        format: 'pdf',
        public_id: `${Date.now()}-${baseName}`,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result?.secure_url || result?.url);
      }
    );
    stream.end(buffer);
  });
}

function uploadVideoBuffer(buffer, folder, originalName, mimeType = 'video/webm') {
  const baseName = (originalName || 'interview-recording')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'video',
        public_id: `${Date.now()}-${baseName}`,
        format: mimeType.includes('mp4') ? 'mp4' : undefined,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result?.secure_url || result?.url);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { uploadPdfBuffer, uploadVideoBuffer };
