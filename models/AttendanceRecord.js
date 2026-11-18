const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      required: [true, 'Session is required'],
      index: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      required: [true, 'Status is required']
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100
    },
    fingerUsed: {
      type: Boolean,
      default: false
    },
    markedBy: {
      type: String,
      enum: ['manual', 'biometric'],
      default: 'manual'
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate attendance: student can only have one record per session
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
