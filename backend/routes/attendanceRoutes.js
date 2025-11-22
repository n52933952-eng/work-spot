import express from 'express';
import {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMonthlyAttendance,
  getWeeklyAttendance
} from '../controllers/attendanceController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.post('/checkin', protectRoute, checkIn);
router.post('/checkout', protectRoute, checkOut);
router.get('/today', protectRoute, getTodayAttendance);
router.get('/monthly', protectRoute, getMonthlyAttendance);
router.get('/weekly', protectRoute, getWeeklyAttendance);

export default router;













