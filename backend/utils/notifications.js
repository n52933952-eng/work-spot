import { io } from '../socket/socket.js';
import User from '../modles/User.js';
import Attendance from '../modles/Attendance.js';
import Holiday from '../modles/Holiday.js';

/**
 * Send late arrival notification
 */
export const sendLateNotification = async (userId, lateMinutes) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    io.to(userId).emit('notification', {
      type: 'late',
      title: 'تنبيه تأخير',
      message: `تم تسجيل الحضور متأخراً بمقدار ${lateMinutes} دقيقة`,
      lateMinutes
    });
  } catch (error) {
    console.error('Send late notification error:', error);
  }
};

/**
 * Send check-in reminder (before work start)
 */
export const sendCheckInReminder = async () => {
  try {
    const users = await User.find({ 
      role: 'employee', 
      isActive: true 
    });

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if today is a holiday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const holiday = await Holiday.findOne({
      startDate: { $lte: today },
      endDate: { $gte: today },
      isActive: true,
      appliesToAll: true
    });

    if (holiday) return; // Don't send reminders on holidays

    // Check today's attendance
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayAttendances = await Attendance.find({
      date: { $gte: todayStart, $lte: todayEnd },
      checkInTime: { $exists: true }
    });
    
    const checkedInUserIds = todayAttendances.map(a => a.user.toString());

    for (const user of users) {
      // Skip if already checked in
      if (checkedInUserIds.includes(user._id.toString())) continue;

      const expectedTime = user.expectedCheckInTime || '09:00';
      const [expectedHour, expectedMinute] = expectedTime.split(':').map(Number);
      
      // Send reminder 15 minutes before expected time and at expected time
      const reminder1Hour = expectedHour;
      const reminder1Minute = expectedMinute - 15;
      const reminder2Hour = expectedHour;
      const reminder2Minute = expectedMinute;

      if (
        (currentHour === reminder1Hour && currentMinute === Math.max(0, reminder1Minute)) ||
        (currentHour === reminder2Hour && currentMinute === reminder2Minute)
      ) {
        io.to(user._id.toString()).emit('notification', {
          type: 'reminder',
          title: 'تذكير الحضور',
          message: `وقت الحضور المتوقع: ${expectedTime} - يرجى تسجيل الحضور`,
          action: 'checkin'
        });
      }
    }
  } catch (error) {
    console.error('Send check-in reminder error:', error);
  }
};

/**
 * Send check-out reminder (before work end)
 */
export const sendCheckOutReminder = async () => {
  try {
    const users = await User.find({ 
      role: 'employee', 
      isActive: true 
    });

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if today is a holiday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const holiday = await Holiday.findOne({
      startDate: { $lte: today },
      endDate: { $gte: today },
      isActive: true,
      appliesToAll: true
    });

    if (holiday) return;

    // Check today's attendance
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayAttendances = await Attendance.find({
      date: { $gte: todayStart, $lte: todayEnd },
      checkInTime: { $exists: true }
    });

    for (const att of todayAttendances) {
      if (att.checkOutTime) continue; // Already checked out

      const user = await User.findById(att.user);
      if (!user) continue;

      const expectedTime = user.expectedCheckOutTime || '17:00';
      const [expectedHour, expectedMinute] = expectedTime.split(':').map(Number);
      
      // Send reminder 15 minutes before expected time
      const reminderHour = expectedHour;
      const reminderMinute = expectedMinute - 15;

      if (currentHour === reminderHour && currentMinute === Math.max(0, reminderMinute)) {
        io.to(user._id.toString()).emit('notification', {
          type: 'reminder',
          title: 'تذكير الانصراف',
          message: `وقت الانصراف المتوقع: ${expectedTime} - يرجى تسجيل الانصراف`,
          action: 'checkout'
        });
      }
    }
  } catch (error) {
    console.error('Send check-out reminder error:', error);
  }
};

/**
 * Broadcast announcement to users
 */
export const broadcastAnnouncement = (announcement, targetUserIds) => {
  try {
    const notification = {
      type: 'announcement',
      title: announcement.title,
      message: announcement.content,
      announcementId: announcement._id
    };

    if (targetUserIds && targetUserIds.length > 0) {
      targetUserIds.forEach(userId => {
        io.to(userId).emit('notification', notification);
      });
    } else {
      io.emit('notification', notification); // Broadcast to all
    }
  } catch (error) {
    console.error('Broadcast announcement error:', error);
  }
};













