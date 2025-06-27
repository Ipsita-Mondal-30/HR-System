const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: String,
  role: {
    type: String,
    enum: ['hr', 'admin', 'candidate'],
    default: 'hr'
  }
});

module.exports = mongoose.model('User', userSchema);
