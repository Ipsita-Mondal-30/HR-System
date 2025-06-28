const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }
});

module.exports = mongoose.model('Role', roleSchema);
