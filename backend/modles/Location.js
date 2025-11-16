import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameAr: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  radius: {
    type: Number,
    required: true,
    default: 50 // in meters
  },
  type: {
    type: String,
    enum: ['main', 'branch', 'temporary', 'field'],
    default: 'main'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    required: function() {
      return this.type === 'temporary' || this.type === 'field';
    }
  },
  endDate: {
    type: Date,
    required: function() {
      return this.type === 'temporary' || this.type === 'field';
    }
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

const Location = mongoose.model('Location', locationSchema);

export default Location;

