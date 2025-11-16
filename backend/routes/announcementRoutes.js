import express from 'express';
import {
  createAnnouncement,
  getMyAnnouncements,
  getAllAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '../controllers/announcementController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.post('/', protectRoute, createAnnouncement); // Admin only
router.get('/my', protectRoute, getMyAnnouncements);
router.get('/all', protectRoute, getAllAnnouncements); // Admin only
router.get('/:id', protectRoute, getAnnouncement);
router.put('/:id', protectRoute, updateAnnouncement); // Admin only
router.delete('/:id', protectRoute, deleteAnnouncement); // Admin only

export default router;













