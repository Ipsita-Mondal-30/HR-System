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
  status: { 
    type: String, 
    enum: ["active", "inactive", "pending", "rejected", "open", "closed"], 
    default: "active" 
  },
  isApproved: { type: Boolean, default: false },
  rejectionReason: String,
  type: String, // For admin interface compatibility
  salary: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'USD' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Virtual for salary object (for admin interface compatibility)
jobSchema.virtual('salaryRange').get(function() {
  if (this.minSalary || this.maxSalary) {
    return {
      min: this.minSalary,
      max: this.maxSalary,
      currency: 'USD'
    };
  }
  return this.salary;
});

// Update the updatedAt field before saving
jobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Sync salary fields
  if (this.salary && (this.salary.min || this.salary.max)) {
    this.minSalary = this.salary.min;
    this.maxSalary = this.salary.max;
  } else if (this.minSalary || this.maxSalary) {
    this.salary = {
      min: this.minSalary,
      max: this.maxSalary,
      currency: 'USD'
    };
  }
  
  // Set type for admin compatibility
  if (!this.type && this.employmentType) {
    this.type = this.employmentType;
  }
  
  next();
});

module.exports = mongoose.model("Job", jobSchema);
