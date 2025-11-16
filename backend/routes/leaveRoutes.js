import express from 'express';
import {
  createLeave,
  getMyLeaves,
  getAllLeaves,
  reviewLeave,
  deleteLeave
} from '../controllers/leaveController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.post('/', protectRoute, createLeave);
router.get('/my', protectRoute, getMyLeaves);
router.get('/all', protectRoute, getAllLeaves); // Admin/HR only
router.put('/:id/review', protectRoute, reviewLeave); // Admin/HR only
router.delete('/:id', protectRoute, deleteLeave);

export default router;













