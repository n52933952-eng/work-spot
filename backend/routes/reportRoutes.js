import express from 'express';
import {
  getMonthlyReport,
  getLateReport,
  getOvertimeReport
} from '../controllers/reportController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.get('/monthly', protectRoute, getMonthlyReport);
router.get('/late', protectRoute, getLateReport);
router.get('/overtime', protectRoute, getOvertimeReport);

export default router;













