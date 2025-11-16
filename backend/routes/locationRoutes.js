import express from 'express';
import {
  createLocation,
  createDefaultLocation,
  getLocations,
  getLocation,
  updateLocation,
  deleteLocation,
  getActiveLocations
} from '../controllers/locationController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.post('/', protectRoute, createLocation); // Admin only in production
router.post('/default', protectRoute, createDefaultLocation); // Create default company location
router.get('/', protectRoute, getLocations);
router.get('/active', protectRoute, getActiveLocations);
router.get('/:id', protectRoute, getLocation);
router.put('/:id', protectRoute, updateLocation);
router.delete('/:id', protectRoute, deleteLocation);

export default router;

