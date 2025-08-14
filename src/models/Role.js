const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  name: String, // Keep for backward compatibility
  description: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  createdAt: { type: Date, default: Date.now }
});

// Virtual to ensure name and title are synced
roleSchema.virtual('displayName').get(function() {
  return this.title || this.name;
});

// Pre-save hook to sync name and title
roleSchema.pre('save', function(next) {
  if (this.title && !this.name) {
    this.name = this.title;
  } else if (this.name && !this.title) {
    this.title = this.name;
  }
  next();
});

module.exports = mongoose.model('Role', roleSchema);
