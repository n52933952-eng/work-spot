import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['general', 'urgent', 'policy', 'event'],
    default: 'general'
  },
  targetAudience: {
    type: String,
    enum: ['all', 'department', 'role', 'specific'],
    default: 'all'
  },
  departments: [{
    type: String
  }],
  roles: [{
    type: String
  }],
  specificUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  attachments: [{
    url: String,
    filename: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement;













