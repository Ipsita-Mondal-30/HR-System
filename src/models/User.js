const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, default: 'User' },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin', 'hr', 'candidate', 'employee'], default: null },
  
  // Candidate-specific fields
  phone: String,
  location: String,
  expectedSalary: String,
  experience: String,
  skills: [String],
  bio: String,
  resumeUrl: String,
  portfolio: String,
  linkedIn: String,
  github: String,
  profilePicture: String,
  
  // Saved jobs for candidates
  savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
  
  // Settings
  emailNotifications: { type: Boolean, default: true },
  profileVisible: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
