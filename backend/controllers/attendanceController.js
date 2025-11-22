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
import { cosineSimilarity } from '../utils/faceEmbeddingUtils.js';
import { io } from '../socket/socket.js';

const verifyFaceForAttendance = async (userId, faceId, faceLandmarks, faceEmbedding) => {
  const startTime = Date.now();
  // OPTIMIZATION: Only select fields we need, use lean() for faster query
  const user = await User.findById(userId).select('faceId faceLandmarks faceEmbedding').lean();
  const queryTime = Date.now() - startTime;
  console.log(`⏱️ Face verification DB query: ${queryTime}ms`);
  
  if (!user) {
    return {
      verified: false,
      message: 'المستخدم غير موجود',
    };
  }

  // PRIORITY 1: Use faceEmbedding directly (generated on-device) - MOST ACCURATE
  if (faceEmbedding && Array.isArray(faceEmbedding) && faceEmbedding.length > 0) {
    try {
      console.log('🔍 Verifying face using embedding (from device)...');
      const compareStart = Date.now();
      
      // Check if user has faceEmbedding stored
      if (!user.faceEmbedding || !Array.isArray(user.faceEmbedding) || user.faceEmbedding.length === 0) {
        console.log('❌ User does not have faceEmbedding stored - need to re-register biometrics');
        return {
          verified: false,
          message: 'يرجى إعادة تسجيل بيانات الوجه (إعداد المصادقة الحيوية)',
        };
      }
      
      // Compare embeddings using cosine similarity
      const similarity = cosineSimilarity(faceEmbedding, user.faceEmbedding);
      const compareTime = Date.now() - compareStart;
      console.log(`🔍 Attendance face similarity (embedding): ${(similarity * 100).toFixed(2)}% (${compareTime}ms)`);
      
      // Threshold: 0.6 for attendance (same as login)
      if (similarity >= 0.6) {
        console.log(`✅ Face verified for attendance: ${(similarity * 100).toFixed(2)}% similarity`);
        return {
          verified: true,
          message: null,
        };
      } else {
        console.log(`❌ Face similarity too low: ${(similarity * 100).toFixed(2)}% < 60%`);
        return {
          verified: false,
          message: 'الوجه غير متطابق مع المستخدم المسجل',
        };
      }
    } catch (error) {
      console.error('❌ Error during embedding-based verification:', error);
      // Fall through to landmark-based verification
    }
  }
  
  // PRIORITY 2: Fallback to landmark-based verification (for backward compatibility)
  // REQUIRE faceLandmarks for verification (most secure method)
  // If user doesn't have faceLandmarks stored, they need to re-register biometrics
  if (!user.faceLandmarks) {
    console.log('❌ User does not have faceLandmarks stored - need to re-register biometrics');
    return {
      verified: false,
      message: 'يرجى إعادة تسجيل بيانات الوجه (إعداد المصادقة الحيوية)',
    };
  }

  // REQUIRE faceLandmarks from request (no fallback to weak hash)
  if (!faceLandmarks) {
    console.log('❌ No faceLandmarks provided in request');
    return {
      verified: false,
      message: 'يرجى إرسال بيانات الوجه للتحقق (faceLandmarks)',
    };
  }

  // Extract actual face data from payload structure
  // Frontend sends: { faceData: [detectedFace], faceFeatures: {...} }
  let incomingFaceData = null;
  if (faceLandmarks.faceData && Array.isArray(faceLandmarks.faceData) && faceLandmarks.faceData.length > 0) {
    incomingFaceData = faceLandmarks.faceData[0]; // Use first face from ML Kit detection
    console.log('✅ Extracted face data from faceLandmarks.faceData[0]');
  } else if (faceLandmarks.faceFeatures?.landmarks) {
    // Fallback: use faceFeatures structure
    incomingFaceData = {
      landmarks: faceLandmarks.faceFeatures.landmarks,
      frame: faceLandmarks.faceFeatures.frame,
      headEulerAngleX: faceLandmarks.faceFeatures.headEulerAngleX,
      headEulerAngleY: faceLandmarks.faceFeatures.headEulerAngleY,
      headEulerAngleZ: faceLandmarks.faceFeatures.headEulerAngleZ,
    };
    console.log('✅ Extracted face data from faceLandmarks.faceFeatures');
  } else if (faceLandmarks.landmarks) {
    incomingFaceData = faceLandmarks;
    console.log('✅ Using faceLandmarks directly');
  }
  
  if (!incomingFaceData) {
    console.log('❌ Could not extract face data from faceLandmarks payload');
    return {
      verified: false,
      message: 'بيانات الوجه غير صحيحة',
    };
  }

  // Compare landmarks (REQUIRED - no fallback)
  const similarity = compareFaces(incomingFaceData, user.faceLandmarks);
  console.log(`🔍 Attendance face similarity: ${(similarity * 100).toFixed(2)}%`);
  
  // TEMPORARY: 70% threshold
  if (similarity >= 0.70) {
    console.log(`✅ Face verified for attendance: ${(similarity * 100).toFixed(2)}% similarity`);
    return {
      verified: true,
      message: null,
    };
  } else {
    console.log(`❌ Face similarity too low: ${(similarity * 100).toFixed(2)}% < 70%`);
    return {
      verified: false,
      message: 'الوجه غير متطابق مع المستخدم المسجل',
    };
  }
};

// Check-in
export const checkIn = async (req, res) => {
  const checkInStartTime = Date.now();
  try {
    const userId = req.user._id;
    const { latitude, longitude, address, faceId, faceEmbedding, faceLandmarks, faceIdVerified, qrCodeId, fingerprintPublicKey } = req.body;
    
    console.log('⏱️ Check-in request received');
    
    // DEVICE BINDING: Verify device fingerprint (security layer)
    const DEVICE_BINDING_ENABLED = true;
    const hasDeviceFingerprint = !!fingerprintPublicKey;
    
    // If face data is provided, verify both face AND device
    let verifiedFace = false;
    if (faceIdVerified || faceId || faceEmbedding || faceLandmarks) {
      if (!faceId && !faceEmbedding && !faceLandmarks) {
        return res.status(400).json({ 
          message: 'يرجى إرسال بيانات الوجه للتحقق (faceId أو faceEmbedding أو faceLandmarks)' 
        });
      }
      
      const faceVerifyStart = Date.now();
      const verification = await verifyFaceForAttendance(userId, faceId, faceLandmarks, faceEmbedding);
      const faceVerifyTime = Date.now() - faceVerifyStart;
      console.log(`⏱️ Face verification total: ${faceVerifyTime}ms`);
      
      if (!verification.verified) {
        console.log(`❌ Check-in rejected: ${verification.message}`);
        return res.status(401).json({ 
          message: verification.message || 'الوجه غير متطابق مع المستخدم المسجل' 
        });
      }
      verifiedFace = true;
      console.log('✅ Face verified for check-in');
      
      // SECURITY: If user used face check-in, also verify device binding
      if (DEVICE_BINDING_ENABLED && verifiedFace) {
        const user = await User.findById(userId).select('fingerprintData email').lean();
        if (user.fingerprintData) {
          if (!hasDeviceFingerprint || !fingerprintPublicKey) {
            console.log('⚠️ Security: Face verified but no device fingerprint provided');
            return res.status(403).json({ 
              message: 'يرجى تسجيل الحضور من جهازك المسجل' 
            });
          }
          if (user.fingerprintData !== fingerprintPublicKey) {
            console.log('⚠️ Security: Face verified but device fingerprint mismatch');
            console.log('   Registered device:', user.fingerprintData.substring(0, 30) + '...');
            console.log('   Current device:', fingerprintPublicKey.substring(0, 30) + '...');
            return res.status(403).json({ 
              message: 'لا يمكن تسجيل الحضور من جهاز آخر. يرجى استخدام جهازك المسجل.' 
            });
          }
          console.log('✅ Device binding verified for check-in');
        }
      }
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ 
        message: 'الرجاء إرسال الموقع الجغرافي' 
      });
    }

    // Prepare date ranges for queries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Run all database queries in parallel for maximum speed
    const dbQueryStart = Date.now();
    const [holiday, existingAttendance, activeLocations] = await Promise.all([
      // Check if today is a holiday
      Holiday.findOne({
        startDate: { $lte: today },
        endDate: { $gte: today },
        isActive: true,
        $or: [
          { appliesToAll: true },
          { branches: { $in: [req.user.branch] } }
        ]
      }).lean(), // Use lean() for faster queries
      
      // Check if already checked in today
      // NOTE: Don't use lean() here - we need to save it if it exists
      Attendance.findOne({
        user: userId,
        date: { $gte: todayStart, $lte: todayEnd }
      }),
      
      // Get active locations
      Location.find({
        isActive: true,
        $or: [
          { type: { $in: ['main', 'branch'] } },
          {
            type: { $in: ['temporary', 'field'] },
            startDate: { $lte: today },
            endDate: { $gte: today }
          }
        ]
      }).lean() // Use lean() for faster queries
    ]);
    const dbQueryTime = Date.now() - dbQueryStart;
    console.log(`⏱️ Parallel DB queries: ${dbQueryTime}ms`);

    // Check holiday
    if (holiday) {
      return res.status(400).json({ 
        message: `اليوم عطلة رسمية: ${holiday.name}`,
        isHoliday: true,
        holidayName: holiday.name
      });
    }

    // NOTE (testing): we allow multiple check-ins on the same day,
    // so we do NOT block if existingAttendance.checkInTime is already set.
    // In production, you may want to restore the guard below:
    // if (existingAttendance && existingAttendance.checkInTime) {
    //   return res.status(400).json({
    //     message: 'لقد قمت بتسجيل الحضور بالفعل اليوم'
    //   });
    // }

    let locations = activeLocations;

    // Fallback: if no active locations exist in DB, use default office location (hardcoded coordinates)
    // This prevents "لا توجد مواقع نشطة" for now and still enforces geofencing.
    if (locations.length === 0) {
      locations = [
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
      locations.map(loc => ({
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
    const saveStart = Date.now();
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
    const saveTime = Date.now() - saveStart;
    console.log(`⏱️ Attendance save: ${saveTime}ms`);

    // Update attendance points
    const pointsStart = Date.now();
    const user = req.user;
    const points = calculateAttendancePoints(status, lateMinutes);
    user.attendancePoints += points;
    await user.save();
    const pointsTime = Date.now() - pointsStart;
    console.log(`⏱️ User points update: ${pointsTime}ms`);

    // Send late notification if late (fire-and-forget - don't block response)
    if (status === 'late' && lateMinutes > 0) {
      sendLateNotification(userId, lateMinutes).catch(err => {
        console.error('⚠️ Failed to send late notification (non-critical):', err);
      });
    }

    const totalTime = Date.now() - checkInStartTime;
    console.log(`⏱️ Check-in total time: ${totalTime}ms`);
    console.log('📤 Sending response to client...');

    const responseData = {
      message: 'تم تسجيل الحضور بنجاح', // Always show success message without late minutes
      attendance: {
        checkInTime,
        status,
        lateMinutes,
        location: nearestLocation.name
      }
    };
    
    console.log('📤 Response data:', JSON.stringify(responseData).substring(0, 200) + '...');
    
    // Emit Socket.io event for real-time dashboard update
    try {
      const attendanceRecord = existingAttendance || await Attendance.findOne({
        user: userId,
        date: { $gte: todayStart, $lte: todayEnd }
      });
      
      if (attendanceRecord && io && req.user) {
        io.emit('attendance:checkin', {
          type: 'checkin',
          attendance: {
            id: attendanceRecord._id,
            user: {
              id: req.user._id,
              fullName: req.user.fullName,
              employeeNumber: req.user.employeeNumber,
              department: req.user.department,
              position: req.user.position,
              profileImage: req.user.profileImage
            },
            checkInTime: attendanceRecord.checkInTime || checkInTime,
            status: attendanceRecord.status || status,
            lateMinutes: attendanceRecord.lateMinutes || lateMinutes,
            location: attendanceRecord.checkInLocation?.address || address || 'غير متوفر'
          }
        });
        console.log('📡 Socket.io event emitted: attendance:checkin');
      }
    } catch (socketError) {
      console.error('⚠️ Failed to emit Socket.io event (non-critical):', socketError);
    }
    
    res.status(200).json(responseData);
    console.log('✅ Response sent successfully');
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
    const { latitude, longitude, address, faceId, faceEmbedding, faceLandmarks, faceIdVerified, qrCodeId, fingerprintPublicKey } = req.body;
    
    // DEVICE BINDING: Verify device fingerprint (security layer)
    const DEVICE_BINDING_ENABLED = true;
    const hasDeviceFingerprint = !!fingerprintPublicKey;
    
    // If face data is provided, verify both face AND device
    let verifiedFace = false;
    if (faceIdVerified || faceId || faceEmbedding || faceLandmarks) {
      if (!faceId && !faceEmbedding && !faceLandmarks) {
        return res.status(400).json({ 
          message: 'يرجى إرسال بيانات الوجه للتحقق (faceId أو faceEmbedding أو faceLandmarks)' 
        });
      }
      
      const verification = await verifyFaceForAttendance(userId, faceId, faceLandmarks, faceEmbedding);
      if (!verification.verified) {
        console.log(`❌ Check-out rejected: ${verification.message}`);
        return res.status(401).json({ 
          message: verification.message || 'الوجه غير متطابق مع المستخدم المسجل' 
        });
      }
      verifiedFace = true;
      console.log('✅ Face verified for check-out');
      
      // SECURITY: If user used face check-out, also verify device binding
      if (DEVICE_BINDING_ENABLED && verifiedFace) {
        const user = await User.findById(userId).select('fingerprintData email').lean();
        if (user.fingerprintData) {
          if (!hasDeviceFingerprint || !fingerprintPublicKey) {
            console.log('⚠️ Security: Face verified but no device fingerprint provided');
            return res.status(403).json({ 
              message: 'يرجى تسجيل الانصراف من جهازك المسجل' 
            });
          }
          if (user.fingerprintData !== fingerprintPublicKey) {
            console.log('⚠️ Security: Face verified but device fingerprint mismatch');
            console.log('   Registered device:', user.fingerprintData.substring(0, 30) + '...');
            console.log('   Current device:', fingerprintPublicKey.substring(0, 30) + '...');
            return res.status(403).json({ 
              message: 'لا يمكن تسجيل الانصراف من جهاز آخر. يرجى استخدام جهازك المسجل.' 
            });
          }
          console.log('✅ Device binding verified for check-out');
        }
      }
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
    // Standard working hours: 9 AM to 5 PM (8 hours = 480 minutes) in Jordan time
    const workingMinutes = calculateWorkingHours(attendance.checkInTime, checkOutTime);
    const expectedMinutes = 8 * 60; // 8 hours (9 AM to 5 PM)
    const overtime = calculateOvertime(workingMinutes, expectedMinutes);

    // Update attendance
    attendance.checkOutTime = checkOutTime;
    attendance.checkOutLocation = { latitude, longitude, address };
    attendance.workingHours = workingMinutes;
    attendance.overtime = overtime;
    attendance.faceIdVerified = verifiedFace || attendance.faceIdVerified;
    await attendance.save();

    // Emit Socket.io event for real-time dashboard update
    try {
      if (attendance && io && req.user) {
        io.emit('attendance:checkout', {
          type: 'checkout',
          attendance: {
            id: attendance._id,
            user: {
              id: req.user._id,
              fullName: req.user.fullName,
              employeeNumber: req.user.employeeNumber,
              department: req.user.department,
              position: req.user.position,
              profileImage: req.user.profileImage
            },
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime,
            workingHours: workingMinutes,
            overtime: overtime
          }
        });
        console.log('📡 Socket.io event emitted: attendance:checkout');
      }
    } catch (socketError) {
      console.error('⚠️ Failed to emit Socket.io event (non-critical):', socketError);
    }

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

// Get weekly attendance range
export const getWeeklyAttendance = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: 'يرجى تحديد بداية ونهاية الأسبوع',
      });
    }

    const weekStart = new Date(startDate);
    const weekEnd = new Date(endDate);

    if (isNaN(weekStart.getTime()) || isNaN(weekEnd.getTime())) {
      return res.status(400).json({
        message: 'تواريخ غير صالحة',
      });
    }

    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    const attendances = await Attendance.find({
      user: userId,
      date: { $gte: weekStart, $lte: weekEnd }
    }).sort({ date: 1 });

    const holidays = await Holiday.find({
      startDate: { $lte: weekEnd },
      endDate: { $gte: weekStart },
      isActive: true,
      $or: [
        { appliesToAll: true },
        { branches: { $in: [req.user.branch] } }
      ]
    });

    const totalPresent = attendances.filter(a => a.status === 'present' || a.status === 'late').length;
    const totalLate = attendances.filter(a => a.status === 'late').length;
    const totalAbsent = attendances.filter(a => a.status === 'absent').length;
    const totalHolidays = holidays.reduce((sum, holiday) => {
      const start = new Date(Math.max(new Date(holiday.startDate).getTime(), weekStart.getTime()));
      const end = new Date(Math.min(new Date(holiday.endDate).getTime(), weekEnd.getTime()));
      const diff = end.getTime() - start.getTime();
      if (diff < 0) {
        return sum;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
      return sum + days;
    }, 0);
    const totalWorkingMinutes = attendances.reduce((sum, a) => sum + (a.workingHours || 0), 0);
    const totalOvertimeMinutes = attendances.reduce((sum, a) => sum + (a.overtime || 0), 0);

    res.status(200).json({
      attendances,
      holidays,
      statistics: {
        totalPresent,
        totalLate,
        totalAbsent,
        totalHolidays,
        totalWorkingHours: Math.floor(totalWorkingMinutes / 60),
        totalOvertime: Math.floor(totalOvertimeMinutes / 60)
      }
    });
  } catch (error) {
    console.error('Get weekly attendance error:', error);
    res.status(500).json({
      message: 'حدث خطأ',
      error: error.message
    });
  }
};

