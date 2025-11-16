import express from 'express';
import {
  getDashboard,
  getLiveAttendanceBoard,
  getAllEmployees
} from '../controllers/dashboardController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.get('/', protectRoute, getDashboard);
router.get('/live-board', getLiveAttendanceBoard); // Public endpoint for display
router.get('/employees', protectRoute, getAllEmployees);

export default router;













