import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  employeeNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['employee', 'hr', 'admin', 'manager'],
    default: 'employee'
  },
  department: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  expectedCheckInTime: {
    type: String,
    default: '09:00'
  },
  expectedCheckOutTime: {
    type: String,
    default: '17:00'
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  faceIdEnabled: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String, // Base64 encoded profile image or file path
    default: null
  },
  faceImage: {
    type: String, // Base64 encoded image or file path
    default: null
  },
  faceId: {
    type: String, // Face ID (hash) for face recognition (kept for backward compatibility)
    default: null
  },
  faceLandmarks: {
    type: mongoose.Schema.Types.Mixed, // Store normalized face landmarks for similarity matching
    // Structure: {
    //   leftEye: { x: number, y: number },
    //   rightEye: { x: number, y: number },
    //   noseBase: { x: number, y: number },
    //   mouthLeft: { x: number, y: number },
    //   mouthRight: { x: number, y: number },
    //   mouthBottom: { x: number, y: number },
    //   eyeDistance: number, // Normalized eye distance
    //   faceWidth: number, // Normalized face width
    //   faceHeight: number, // Normalized face height
    //   noseToEyeDistance: number, // Normalized nose-to-eye distance
    //   mouthToNoseDistance: number, // Normalized mouth-to-nose distance
    //   faceAspectRatio: number, // width/height
    //   headEulerAngleX: number, // Head rotation X
    //   headEulerAngleY: number, // Head rotation Y
    //   headEulerAngleZ: number, // Head rotation Z
    // }
    default: null
  },
  fingerprintData: {
    type: String, // Fingerprint ID (publicKey from react-native-biometrics)
    default: null
  },
  biometricType: {
    type: String,
    enum: ['FaceID', 'TouchID', 'Fingerprint', 'FaceRecognition', null],
    default: null
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  attendancePoints: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;




