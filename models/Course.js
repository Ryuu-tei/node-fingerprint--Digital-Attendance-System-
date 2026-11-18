const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Course code is required'],
      trim: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
      minlength: [3, 'Course name must be at least 3 characters']
    },
    description: {
      type: String,
      trim: true
    },
    lecturer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lecturer',
      required: [true, 'Lecturer is required']
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8
    },
    maxStudents: {
      type: Number,
      default: 100,
      min: 1
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index for finding courses by lecturer
courseSchema.index({ lecturer: 1, code: 1 });

module.exports = mongoose.model('Course', courseSchema);
