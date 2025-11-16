import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkInTime: {
    type: Date
  },
  checkOutTime: {
    type: Date
  },
  checkInLocation: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  checkOutLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent', 'holiday', 'leave', 'half-day'],
    default: 'absent'
  },
  isHoliday: {
    type: Boolean,
    default: false
  },
  holidayName: {
    type: String
  },
  isOnLeave: {
    type: Boolean,
    default: false
  },
  leaveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leave'
  },
  workingHours: {
    type: Number, // in minutes
    default: 0
  },
  overtime: {
    type: Number, // in minutes
    default: 0
  },
  lateMinutes: {
    type: Number,
    default: 0
  },
  faceIdVerified: {
    type: Boolean,
    default: false
  },
  qrCodeUsed: {
    type: Boolean,
    default: false
  },
  qrCodeId: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;













