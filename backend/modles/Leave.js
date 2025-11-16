import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['annual', 'sick', 'emergency', 'unpaid', 'half-day'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  days: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  attachments: [{
    url: String,
    filename: String
  }]
}, {
  timestamps: true
});

// Index for faster queries
leaveSchema.index({ user: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ status: 1 });

const Leave = mongoose.model('Leave', leaveSchema);

export default Leave;













