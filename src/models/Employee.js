const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: String,
  email: String,
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  },
  joiningDate: Date,
  exitDate: Date,
  timeline: [
    {
      title: String,
      description: String,
      date: Date,
      feedback: String
    }
  ],
  learningProgress: [
    {
      courseTitle: String,
      platform: String,
      completion: Number, // percent
      certificationUrl: String,
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
