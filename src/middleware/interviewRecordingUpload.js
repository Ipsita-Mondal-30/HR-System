const multer = require('multer');

const interviewRecordingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'audio/webm', 'audio/mpeg'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(webm|mp4|mov|avi|mp3|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Recording must be a video or audio file (webm, mp4, mov)'));
    }
  },
});

module.exports = interviewRecordingUpload;
