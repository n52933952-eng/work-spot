import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameAr: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['national', 'religious', 'company', 'custom'],
    default: 'national'
  },
  branches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  appliesToAll: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster date queries
holidaySchema.index({ startDate: 1, endDate: 1 });

const Holiday = mongoose.model('Holiday', holidaySchema);

export default Holiday;













