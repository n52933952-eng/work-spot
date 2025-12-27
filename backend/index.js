import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'; 
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import {app,server} from './socket/socket.js'
dotenv.config()

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Routes
import authRoutes from './routes/authRoutes.js'
import attendanceRoutes from './routes/attendanceRoutes.js'
import locationRoutes from './routes/locationRoutes.js'
import holidayRoutes from './routes/holidayRoutes.js'
import leaveRoutes from './routes/leaveRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import announcementRoutes from './routes/announcementRoutes.js'
import qrCodeRoutes from './routes/qrCodeRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import salaryRoutes from './routes/salaryRoutes.js'
import employeeApprovalRoutes from './routes/employeeApprovalRoutes.js'

// Increase payload size limit for image uploads (Base64 images can be large)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(cookieParser())

// Serve static files from public folder (for uploaded images)
app.use('/uploads', (req, res, next) => {
  // Set Content-Type for PDF files
  if (req.path.endsWith('.pdf')) {
    res.type('application/pdf');
  }
  next();
}, express.static(path.join(__dirname, 'public/uploads')))
console.log('📁 Serving static files from:', path.join(__dirname, 'public/uploads'))

// CORS configuration - allow localhost for development
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}))

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/locations', locationRoutes)
app.use('/api/holidays', holidayRoutes)
app.use('/api/leaves', leaveRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/qrcode', qrCodeRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/salary', salaryRoutes)
app.use('/api/employees/approval', employeeApprovalRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running', status: 'ok' })
})

// MongoDB Connection
if (!process.env.MONGO) {
  console.error('❌ MONGO environment variable is not set!');
  console.error('Please set MONGO in your .env file or Render.com environment variables');
  process.exit(1);
}

mongoose.connect(process.env.MONGO)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((error) => {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  })

// Start scheduler for notifications
import('./utils/scheduler.js').then(module => {
  module.startScheduler()
}).catch(error => {
  console.error('Scheduler initialization error:', error)
})

// Face recognition is now done on-device (React Native)
// Backend only stores and compares embeddings

server.listen(process.env.PORT || 5000, () => {
    console.log(`Server is running on port ${process.env.PORT || 5000}`)
})

// __dirname = /opt/render/project/src/backend
const FRONTEND_PATH = path.join(__dirname, '../frontent/dist');

app.use(express.static(FRONTEND_PATH));

app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});