import express from 'express';
import {
  createHoliday,
  getHolidays,
  getCalendar,
  getHoliday,
  updateHoliday,
  deleteHoliday,
  importHolidays
} from '../controllers/holidayController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.post('/', protectRoute, createHoliday); // Admin only
router.post('/import', protectRoute, importHolidays); // Admin only
router.get('/', protectRoute, getHolidays);
router.get('/calendar', protectRoute, getCalendar);
router.get('/:id', protectRoute, getHoliday);
router.put('/:id', protectRoute, updateHoliday); // Admin only
router.delete('/:id', protectRoute, deleteHoliday); // Admin only

export default router;













