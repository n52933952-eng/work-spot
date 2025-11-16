import express from 'express';
import {
  register,
  completeRegistration,
  login,
  logout,
  getMe,
  toggleFaceId,
  toggleTwoFactor,
  changePassword,
  uploadBiometric,
  loginWithBiometric
} from '../controllers/authController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.post('/register', register);
router.post('/complete-registration', completeRegistration); // Complete registration with biometric data
router.post('/login', login);
router.post('/login/biometric', loginWithBiometric); // Login with face recognition
// Protect logout so we know which user is logging out
router.post('/logout', protectRoute, logout);
router.get('/me', protectRoute, getMe);
router.put('/face-id', protectRoute, toggleFaceId);
router.put('/biometric', protectRoute, uploadBiometric); // Upload biometric data after registration
router.put('/two-factor', protectRoute, toggleTwoFactor);
router.put('/change-password', protectRoute, changePassword);

export default router;




