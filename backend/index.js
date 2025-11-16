import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'; 
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import {app,server} from './socket/socket.js'
dotenv.config()

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

// Increase payload size limit for image uploads (Base64 images can be large)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(cookieParser())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running', status: 'ok' })
})

mongoose.connect(process.env.MONGO)
.then(() => console.log("MongoDB Connected"))
.catch((error) => console.log("MongoDB Connection Error:", error))

// Start scheduler for notifications
import('./utils/scheduler.js').then(module => {
  module.startScheduler()
}).catch(error => {
  console.error('Scheduler initialization error:', error)
})


const __dirname = path.resolve()

server.listen(process.env.PORT || 5000, () => {
    console.log(`Server is running on port ${process.env.PORT || 5000}`)
})


app.use(express.static(path.join(__dirname, 'backend', 'dist')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend', 'dist', 'index.html'))
})
