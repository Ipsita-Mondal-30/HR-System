const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin', 'hr', 'candidate'], default: 'candidate' }
});

module.exports = mongoose.model('User', userSchema);
