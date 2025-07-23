const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  companyName: { type: String, required: true },
  companyLogo: String,
  companySize: { type: String, enum: ["1-10", "11-50", "51-200", "201-500", "500+"] },
  location: String,
  remote: { type: Boolean, default: false },
  employmentType: { type: String, enum: ["full-time", "part-time", "internship"] },
  experienceRequired: { type: Number }, // In years
  minSalary: Number,
  maxSalary: Number,
  skills: [String],
  tags: [String],
  rating: Number, // Optional company rating
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Job", jobSchema);
