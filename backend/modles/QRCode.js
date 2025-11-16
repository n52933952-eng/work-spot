import mongoose from 'mongoose';
import crypto from 'crypto';

const qrCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['checkin', 'checkout'],
    required: true
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    }
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate QR code before saving
qrCodeSchema.pre('save', async function(next) {
  if (!this.code) {
    this.code = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Index for faster queries
qrCodeSchema.index({ code: 1 });
qrCodeSchema.index({ user: 1, expiresAt: 1 });

const QRCode = mongoose.model('QRCode', qrCodeSchema);

export default QRCode;













