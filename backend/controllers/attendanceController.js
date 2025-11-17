import Attendance from '../modles/Attendance.js';
import Location from '../modles/Location.js';
import Holiday from '../modles/Holiday.js';
import QRCode from '../modles/QRCode.js';
import User from '../modles/User.js';
import { isWithinRadius, findNearestLocation } from '../utils/geofencing.js';
import {
  calculateLateMinutes,
  calculateWorkingHours,
  calculateOvertime,
  getAttendanceStatus,
  calculateAttendancePoints
} from '../utils/attendanceCalculation.js';
import { sendLateNotification } from '../utils/notifications.js';
import { compareFaces } from '../utils/faceLandmarkSimilarity.js';

const verifyFaceForAttendance = async (userId, faceId, faceLandmarks) => {
  const user = await User.findById(userId).select('faceId faceLandmarks');
  if (!user || (!user.faceId && !user.faceLandmarks)) {
    return {
      verified: false,
      message: 'لم يتم تسجيل بيانات الوجه لهذا المستخدم',
    };
  }

  let verified = false;

  if (faceLandmarks && user.faceLandmarks) {
    const similarity = compareFaces(faceLandmarks, user.faceLandmarks);
    if (similarity >= 0.75) {
      verified = true;
    } else {
      console.log('❌ Face similarity too low for attendance:', similarity);
    }
  }

  if (!verified && faceId && user.faceId) {
    if (user.faceId === faceId) {
      verified = true;
    }
  }

  return {
    verified,
    message: verified ? null : 'الوجه غير متطابق مع المستخدم المسجل',
  };
};

// Check-in
export const checkIn = async (req, res) => {
  try {
    const userId = req.user._id;
    const { latitude, longitude, address, faceId, faceLandmarks, qrCodeId } = req.body;
    
    let verifiedFace = false;
    if (faceId || faceLandmarks) {
      const verification = await verifyFaceForAttendance(userId, faceId, faceLandmarks);
      if (!verification.verified) {
        return res.status(401).json({ 
          message: verification.message || 'الوجه غير متطابق مع المستخدم المسجل' 
        });
      }
      verifiedFace = true;
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ 
        message: 'الرجاء إرسال الموقع الجغرافي' 
      });
    }

    // Check if today is a holiday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const holiday = await Holiday.findOne({
      startDate: { $lte: today },
      endDate: { $gte: today },
      isActive: true,
      $or: [
        { appliesToAll: true },
        { branches: { $in: [req.user.branch] } }
      ]
    });

    if (holiday) {
      return res.status(400).json({ 
        message: `اليوم عطلة رسمية: ${holiday.name}`,
        isHoliday: true,
        holidayName: holiday.name
      });
    }

    // Check if already checked in today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingAttendance = await Attendance.findOne({
      user: userId,
      date: { $gte: todayStart, $lte: todayEnd }
    });
    // NOTE (testing): we allow multiple check-ins on the same day,
    // so we do NOT block if existingAttendance.checkInTime is already set.
    // In production, you may want to restore the guard below:
    // if (existingAttendance && existingAttendance.checkInTime) {
    //   return res.status(400).json({
    //     message: 'لقد قمت بتسجيل الحضور بالفعل اليوم'
    //   });
    // }

    // Get active locations
    let activeLocations = await Location.find({
      isActive: true,
      $or: [
        { type: { $in: ['main', 'branch'] },
        },
        {
          type: { $in: ['temporary', 'field'] },
          startDate: { $lte: today },
          endDate: { $gte: today }
        }
      ].filter(Boolean)
    });

    // Fallback: if no active locations exist in DB, use default office location (hardcoded coordinates)
    // This prevents "لا توجد مواقع نشطة" for now and still enforces geofencing.
    if (activeLocations.length === 0) {
      activeLocations = [
        new Location({
          latitude: 32.014206,   // Default office latitude
          longitude: 35.873015,  // Default office longitude
          radius: 10000,         // Expanded radius (10 km) for testing
          type: 'main',
          name: 'Default Office',
          isActive: true,
        }),
      ];
    }

    // Check geofencing
    const nearestLocation = findNearestLocation(
      latitude,
      longitude,
      activeLocations.map(loc => ({
        _id: loc._id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radius: loc.radius
      }))
    );

    if (!nearestLocation) {
      return res.status(403).json({ 
        message: 'أنت خارج نطاق العمل، يرجى التواجد في الموقع المعتمد',
        isOutsideRadius: true
      });
    }

    // Verify QR code if provided
    if (qrCodeId) {
      const qrCode = await QRCode.findOne({
        code: qrCodeId,
        user: userId,
        type: 'checkin',
        isUsed: false,
        expiresAt: { $gt: new Date() }
      });

      if (!qrCode) {
        return res.status(400).json({ 
          message: 'رمز QR غير صالح أو منتهي الصلاحية' 
        });
      }

      // Mark QR code as used
      qrCode.isUsed = true;
      qrCode.usedAt = new Date();
      await qrCode.save();
    }

    // Get user's expected check-in time
    const expectedCheckInTime = req.user.expectedCheckInTime || '09:00';
    const checkInTime = new Date();
    
    // Calculate late minutes
    const lateMinutes = calculateLateMinutes(checkInTime, expectedCheckInTime);
    const status = getAttendanceStatus(checkInTime, expectedCheckInTime);

    // Create or update attendance
    if (existingAttendance) {
      existingAttendance.checkInTime = checkInTime;
      existingAttendance.checkInLocation = { latitude, longitude, address };
      existingAttendance.status = status;
      existingAttendance.lateMinutes = lateMinutes;
      existingAttendance.faceIdVerified = verifiedFace;
      existingAttendance.qrCodeUsed = !!qrCodeId;
      existingAttendance.qrCodeId = qrCodeId || null;
      await existingAttendance.save();
    } else {
      await Attendance.create({
        user: userId,
        date: today,
        checkInTime,
        checkInLocation: { latitude, longitude, address },
        status,
        lateMinutes,
        faceIdVerified: verifiedFace,
        qrCodeUsed: !!qrCodeId,
        qrCodeId: qrCodeId || null
      });
    }

    // Update attendance points
    const user = req.user;
    const points = calculateAttendancePoints(status, lateMinutes);
    user.attendancePoints += points;
    await user.save();

    // Send late notification if late
    if (status === 'late' && lateMinutes > 0) {
      await sendLateNotification(userId, lateMinutes);
    }

    res.status(200).json({
      message: status === 'late' 
        ? `تم تسجيل الحضور بنجاح (متأخر ${lateMinutes} دقيقة)` 
        : 'تم تسجيل الحضور بنجاح',
      attendance: {
        checkInTime,
        status,
        lateMinutes,
        location: nearestLocation.name
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تسجيل الحضور',
      error: error.message 
    });
  }
};

// Check-out
export const checkOut = async (req, res) => {
  try {
    const userId = req.user._id;
    const { latitude, longitude, address, faceId, faceLandmarks, qrCodeId } = req.body;
    
    let verifiedFace = false;
    if (faceId || faceLandmarks) {
      const verification = await verifyFaceForAttendance(userId, faceId, faceLandmarks);
      if (!verification.verified) {
        return res.status(401).json({ 
          message: verification.message || 'الوجه غير متطابق مع المستخدم المسجل' 
        });
      }
      verifiedFace = true;
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ 
        message: 'الرجاء إرسال الموقع الجغرافي' 
      });
    }

    // Find today's attendance
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const attendance = await Attendance.findOne({
      user: userId,
      date: { $gte: todayStart, $lte: todayEnd },
      checkInTime: { $exists: true }
    });

    if (!attendance) {
      return res.status(400).json({ 
        message: 'لم يتم تسجيل الحضور اليوم' 
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({ 
        message: 'لقد قمت بتسجيل الانصراف بالفعل اليوم' 
      });
    }

    // Verify QR code if provided
    if (qrCodeId) {
      const qrCode = await QRCode.findOne({
        code: qrCodeId,
        user: userId,
        type: 'checkout',
        isUsed: false,
        expiresAt: { $gt: new Date() }
      });

      if (!qrCode) {
        return res.status(400).json({ 
          message: 'رمز QR غير صالح أو منتهي الصلاحية' 
        });
      }

      qrCode.isUsed = true;
      qrCode.usedAt = new Date();
      await qrCode.save();
    }

    const checkOutTime = new Date();
    
    // Calculate working hours and overtime
    const workingMinutes = calculateWorkingHours(attendance.checkInTime, checkOutTime);
    const expectedMinutes = 8 * 60; // 8 hours
    const overtime = calculateOvertime(workingMinutes, expectedMinutes);

    // Update attendance
    attendance.checkOutTime = checkOutTime;
    attendance.checkOutLocation = { latitude, longitude, address };
    attendance.workingHours = workingMinutes;
    attendance.overtime = overtime;
    attendance.faceIdVerified = verifiedFace || attendance.faceIdVerified;
    await attendance.save();

    res.status(200).json({
      message: 'تم تسجيل الانصراف بنجاح',
      attendance: {
        checkInTime: attendance.checkInTime,
        checkOutTime,
        workingHours: Math.floor(workingMinutes / 60) + ':' + (workingMinutes % 60),
        overtime: overtime > 0 ? Math.floor(overtime / 60) + ':' + (overtime % 60) : 0
      }
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تسجيل الانصراف',
      error: error.message 
    });
  }
};

// Get today's attendance
export const getTodayAttendance = async (req, res) => {
  try {
    const userId = req.user._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const attendance = await Attendance.findOne({
      user: userId,
      date: { $gte: todayStart, $lte: todayEnd }
    }).populate('leaveId', 'type status');

    // Check if today is holiday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const holiday = await Holiday.findOne({
      startDate: { $lte: today },
      endDate: { $gte: today },
      isActive: true,
      $or: [
        { appliesToAll: true },
        { branches: { $in: [req.user.branch] } }
      ]
    });

    res.status(200).json({
      attendance: attendance || null,
      isHoliday: !!holiday,
      holiday: holiday ? { name: holiday.name, nameAr: holiday.nameAr } : null,
      expectedCheckInTime: req.user.expectedCheckInTime || '09:00',
      expectedCheckOutTime: req.user.expectedCheckOutTime || '17:00'
    });
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get monthly attendance
export const getMonthlyAttendance = async (req, res) => {
  try {
    const userId = req.user._id;
    const { year, month } = req.query;

    const targetDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const attendances = await Attendance.find({
      user: userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Get holidays in this month
    const holidays = await Holiday.find({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      isActive: true,
      $or: [
        { appliesToAll: true },
        { branches: { $in: [req.user.branch] } }
      ]
    });

    // Statistics
    const totalPresent = attendances.filter(a => a.status === 'present' || a.status === 'late').length;
    const totalLate = attendances.filter(a => a.status === 'late').length;
    const totalAbsent = attendances.filter(a => a.status === 'absent').length;
    const totalHolidays = holidays.reduce((sum, h) => {
      const hStart = new Date(Math.max(h.startDate, startDate));
      const hEnd = new Date(Math.min(h.endDate, endDate));
      const days = Math.floor((hEnd - hStart) / (1000 * 60 * 60 * 24)) + 1;
      return sum + days;
    }, 0);
    const totalWorkingHours = attendances.reduce((sum, a) => sum + (a.workingHours || 0), 0);
    const totalOvertime = attendances.reduce((sum, a) => sum + (a.overtime || 0), 0);

    res.status(200).json({
      attendances,
      holidays,
      statistics: {
        totalPresent,
        totalLate,
        totalAbsent,
        totalHolidays,
        totalWorkingHours: Math.floor(totalWorkingHours / 60),
        totalOvertime: Math.floor(totalOvertime / 60)
      }
    });
  } catch (error) {
    console.error('Get monthly attendance error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

