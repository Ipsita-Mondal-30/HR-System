const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: String,
  headId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // or Employee
});

module.exports = mongoose.model('Department', departmentSchema);
