const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' }
});

module.exports = mongoose.model('Employee', employeeSchema);
