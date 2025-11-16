import express from 'express';
import {
  generateQRCode,
  verifyQRCode,
  getMyQRCodes
} from '../controllers/qrCodeController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

router.post('/generate', protectRoute, generateQRCode);
router.post('/verify', protectRoute, verifyQRCode);
router.get('/my', protectRoute, getMyQRCodes);

export default router;













