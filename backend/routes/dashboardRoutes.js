import express from 'express';
import {
  getDashboard,
  getLiveAttendanceBoard,
  getAllEmployees,
  getTodayAttendance,
  updateEmployee
} from '../controllers/dashboardController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.get('/', protectRoute, getDashboard);
router.get('/today', getTodayAttendance); // Simple endpoint for today's attendance
router.get('/live-board', getLiveAttendanceBoard); // Public endpoint for display
router.get('/employees', protectRoute, getAllEmployees);
router.put('/employees/:id', protectRoute, updateEmployee);

export default router;













