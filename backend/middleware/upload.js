import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directories if they don't exist
const uploadsDir = path.join(__dirname, '../public/uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const facesDir = path.join(uploadsDir, 'faces');

// Create directories
const leavesDir = path.join(uploadsDir, 'leaves');
[uploadsDir, profilesDir, facesDir, leavesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save profile images to profiles folder, face images to faces folder
    if (file.fieldname === 'profileImage') {
      cb(null, profilesDir);
    } else if (file.fieldname === 'faceImage') {
      cb(null, facesDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp_employeeNumber_fieldname.jpg
    const employeeNumber = req.body.employeeNumber || 'user';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${timestamp}_${employeeNumber}_${file.fieldname}${ext}`;
    cb(null, filename);
  }
});

// File filter - only accept images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('فقط ملفات الصور مسموح بها (JPEG, PNG, WebP)'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// Middleware for registration (profile + face images)
export const uploadRegistrationImages = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'faceImage', maxCount: 1 }
]);

// Middleware for single image upload
export const uploadSingleImage = upload.single('image');

// Configure multer for PDF uploads (for leave attachments)
const pdfStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, leavesDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp_userId_leave_attachment.pdf
    const userId = req.user?._id || 'user';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.pdf';
    const filename = `${timestamp}_${userId}_leave_attachment${ext}`;
    cb(null, filename);
  }
});

// File filter for PDFs only
const pdfFileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('فقط ملفات PDF مسموح بها'), false);
  }
};

// Configure multer for PDF uploads
export const uploadPDF = multer({
  storage: pdfStorage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// Middleware for leave attachment (single PDF)
export const uploadLeaveAttachment = uploadPDF.single('attachment');

export default upload;

