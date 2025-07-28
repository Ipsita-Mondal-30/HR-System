const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, default: 'User' },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin', 'hr', 'candidate', 'employee'], default: null }
});

module.exports = mongoose.model('User', userSchema);
