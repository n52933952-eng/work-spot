import express from 'express';
import {
  createLeave,
  getMyLeaves,
  getAllLeaves,
  reviewLeave,
  deleteLeave,
  downloadAttachment
} from '../controllers/leaveController.js';
import protectRoute from '../midlewar/protectRoute.js';
import { uploadLeaveAttachment } from '../middleware/upload.js';

const router = express.Router();

router.post('/', protectRoute, uploadLeaveAttachment, createLeave);
router.get('/my', protectRoute, getMyLeaves);
router.get('/all', protectRoute, getAllLeaves); // Admin/HR only
router.get('/attachment/:filename', protectRoute, downloadAttachment); // Download attachment
router.put('/:id/review', protectRoute, reviewLeave); // Admin/HR only
router.delete('/:id', protectRoute, deleteLeave);

export default router;













