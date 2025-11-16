import QRCode from '../modles/QRCode.js';
import Location from '../modles/Location.js';

// Generate QR Code for check-in/check-out
export const generateQRCode = async (req, res) => {
  try {
    const { type, locationId, latitude, longitude } = req.body;

    if (!type || !['checkin', 'checkout'].includes(type)) {
      return res.status(400).json({ 
        message: 'الرجاء تحديد نوع العملية (checkin أو checkout)' 
      });
    }

    if (!locationId || !latitude || !longitude) {
      return res.status(400).json({ 
        message: 'الرجاء إرسال الموقع والموقع الجغرافي' 
      });
    }

    // Verify location exists and is active
    const location = await Location.findById(locationId);
    if (!location || !location.isActive) {
      return res.status(404).json({ 
        message: 'الموقع غير موجود أو غير نشط' 
      });
    }

    // Create QR code
    const qrCode = await QRCode.create({
      user: req.user._id,
      type,
      location: locationId,
      latitude,
      longitude,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    res.status(201).json({
      message: 'تم إنشاء رمز QR بنجاح',
      qrCode: {
        code: qrCode.code,
        type: qrCode.type,
        expiresAt: qrCode.expiresAt
      }
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء رمز QR',
      error: error.message 
    });
  }
};

// Verify QR Code (used when scanning)
export const verifyQRCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        message: 'الرجاء إرسال رمز QR' 
      });
    }

    const qrCode = await QRCode.findOne({
      code,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).populate('location', 'name latitude longitude radius');

    if (!qrCode) {
      return res.status(400).json({ 
        message: 'رمز QR غير صالح أو منتهي الصلاحية' 
      });
    }

    // Check if QR code belongs to current user
    if (qrCode.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'رمز QR لا ينتمي لهذا المستخدم' 
      });
    }

    res.status(200).json({
      message: 'رمز QR صالح',
      qrCode: {
        code: qrCode.code,
        type: qrCode.type,
        location: qrCode.location,
        latitude: qrCode.latitude,
        longitude: qrCode.longitude,
        expiresAt: qrCode.expiresAt
      }
    });
  } catch (error) {
    console.error('Verify QR code error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء التحقق من رمز QR',
      error: error.message 
    });
  }
};

// Get user's active QR codes
export const getMyQRCodes = async (req, res) => {
  try {
    const qrCodes = await QRCode.find({
      user: req.user._id,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    })
      .populate('location', 'name address')
      .sort({ createdAt: -1 });

    res.status(200).json({ qrCodes });
  } catch (error) {
    console.error('Get my QR codes error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};













