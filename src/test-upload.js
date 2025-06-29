const { uploadResume } = require('./src/config/cloudinary');

uploadResume('./test.pdf')  // Make sure this file exists in root
  .then((url) => console.log('✅ Uploaded to:', url))
  .catch((err) => console.error('❌ Upload failed:', err));
