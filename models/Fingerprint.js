const mongoose = require('mongoose');

const fingerprintSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true
    },
    fingerIndex: {
      type: Number,
      required: [true, 'Finger index is required'],
      min: 0,
      max: 9,
      validate: {
        validator: Number.isInteger,
        message: 'Finger index must be an integer'
      }
    },
    templateData: {
      type: String,
      required: [true, 'Template data is required'],
      // This stores base64 encoded fingerprint template
      // Typically 256-2048 bytes, stored as base64
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

// Prevent duplicate fingerprints for same student and finger
fingerprintSchema.index({ student: 1, fingerIndex: 1 }, { unique: true });

module.exports = mongoose.model('Fingerprint', fingerprintSchema);
