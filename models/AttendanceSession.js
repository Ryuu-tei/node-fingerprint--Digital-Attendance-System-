const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required'],
      index: true
    },
    sessionDate: {
      type: Date,
      required: [true, 'Session date is required']
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format']
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format']
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open'
    },
    topic: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

attendanceSessionSchema.pre('validate', function(next) {
  if (!this.startTime || !this.endTime) {
    return next();
  }

  const toMinutes = time => {
    const [hours, minutes] = String(time).split(':').map(Number);
    return hours * 60 + minutes;
  };

  if (
    /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(this.startTime) &&
    /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(this.endTime) &&
    toMinutes(this.endTime) <= toMinutes(this.startTime)
  ) {
    this.invalidate('endTime', 'End time must be after start time');
  }

  next();
});

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
