import Leave from '../modles/Leave.js';
import Attendance from '../modles/Attendance.js';
import User from '../modles/User.js';
import { io, getRecipientSockedId } from '../socket/socket.js'; // Import Socket.io
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Calculate days between two dates (excluding weekends)
const calculateWorkingDays = (startDate, endDate) => {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 5 && dayOfWeek !== 6) { // Exclude Friday and Saturday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

// Create leave request
export const createLeave = async (req, res) => {
  try {
    console.log('📥 [Backend] Received leave request:');
    console.log('  - req.body:', req.body);
    console.log('  - req.file:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');
    console.log('  - req.user:', req.user ? { _id: req.user._id, role: req.user.role } : 'No user');
    
    const { type, startDate, endDate, reason } = req.body;
    const userId = req.user.role === 'admin' || req.user.role === 'hr' 
      ? req.body.userId || req.user._id 
      : req.user._id;

    console.log('📋 [Backend] Extracted fields:');
    console.log('  - type:', type);
    console.log('  - startDate:', startDate);
    console.log('  - endDate:', endDate);
    console.log('  - reason:', reason);
    console.log('  - userId:', userId);

    if (!type || !startDate || !endDate || !reason) {
      console.error('❌ [Backend] Missing required fields:');
      console.error('  - type:', type ? '✓' : '✗');
      console.error('  - startDate:', startDate ? '✓' : '✗');
      console.error('  - endDate:', endDate ? '✓' : '✗');
      console.error('  - reason:', reason ? '✓' : '✗');
      return res.status(400).json({ 
        message: 'الرجاء إدخال جميع الحقول المطلوبة' 
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ 
        message: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' 
      });
    }

    const days = type === 'half-day' ? 0.5 : calculateWorkingDays(start, end);

    // Handle uploaded PDF attachment
    let attachments = [];
    if (req.file) {
      // Store relative path (URL path) instead of full file path
      const attachmentUrl = `/uploads/leaves/${req.file.filename}`;
      attachments.push({
        url: attachmentUrl,
        filename: req.file.originalname || req.file.filename
      });
      console.log('📎 Leave attachment uploaded:', attachmentUrl, `(${(req.file.size / 1024).toFixed(2)} KB)`);
    }

    const leave = await Leave.create({
      user: userId,
      type,
      startDate: start,
      endDate: end,
      days,
      reason,
      attachments: attachments
    });

    // Update attendance records to mark as on leave
    const startDateOnly = new Date(start);
    startDateOnly.setHours(0, 0, 0, 0);
    const endDateOnly = new Date(end);
    endDateOnly.setHours(23, 59, 59, 999);

    await Attendance.updateMany(
      {
        user: userId,
        date: { $gte: startDateOnly, $lte: endDateOnly },
        checkInTime: { $exists: false }
      },
      {
        $set: {
          isOnLeave: true,
          leaveId: leave._id,
          status: 'leave'
        }
      }
    );

    const populatedLeave = await Leave.findById(leave._id).populate('user', 'fullName employeeNumber email profileImage');

    // Emit Socket.io event to notify admins of new leave request
    io.emit('leaveCreated', populatedLeave);
    console.log(`📬 [Socket.io] New leave request created by user: ${userId}`);

    res.status(201).json({
      message: 'تم إنشاء طلب الإجازة بنجاح',
      leave: populatedLeave
    });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء طلب الإجازة',
      error: error.message 
    });
  }
};

// Download leave attachment
export const downloadAttachment = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../public/uploads/leaves', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'الملف غير موجود' });
    }
    
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Send the file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تحميل الملف',
      error: error.message 
    });
  }
};

// Get user's leaves
export const getMyLeaves = async (req, res) => {
  try {
    const { status, type, year } = req.query;
    const userId = req.user._id;

    const query = { user: userId };
    if (status) query.status = status;
    if (type) query.type = type;
    if (year) {
      const startYear = new Date(year, 0, 1);
      const endYear = new Date(year, 11, 31, 23, 59, 59);
      query.$or = [
        { startDate: { $gte: startYear, $lte: endYear } },
        { endDate: { $gte: startYear, $lte: endYear } }
      ];
    }

    const leaves = await Leave.find(query)
      .populate('reviewedBy', 'fullName employeeNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ leaves });
  } catch (error) {
    console.error('Get my leaves error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get all leaves (for admin/hr)
export const getAllLeaves = async (req, res) => {
  try {
    const { status, type, userId, year } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (userId) query.user = userId;
    if (year) {
      const startYear = new Date(year, 0, 1);
      const endYear = new Date(year, 11, 31, 23, 59, 59);
      query.$or = [
        { startDate: { $gte: startYear, $lte: endYear } },
        { endDate: { $gte: startYear, $lte: endYear } }
      ];
    }

    const leaves = await Leave.find(query)
      .populate('user', 'fullName employeeNumber email department profileImage')
      .populate('reviewedBy', 'fullName employeeNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ leaves });
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Review leave (approve/reject)
export const reviewLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        message: 'الرجاء تحديد حالة المراجعة (approved أو rejected)' 
      });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ 
        message: 'الرجاء إدخال سبب الرفض' 
      });
    }

    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({ message: 'طلب الإجازة غير موجود' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ 
        message: 'تم مراجعة هذا الطلب مسبقاً' 
      });
    }

    leave.status = status;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    if (rejectionReason) leave.rejectionReason = rejectionReason;

    await leave.save();

    // Update attendance records
    if (status === 'approved') {
      const startDateOnly = new Date(leave.startDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(leave.endDate);
      endDateOnly.setHours(23, 59, 59, 999);

      await Attendance.updateMany(
        {
          user: leave.user,
          date: { $gte: startDateOnly, $lte: endDateOnly },
          checkInTime: { $exists: false }
        },
        {
          $set: {
            isOnLeave: true,
            leaveId: leave._id,
            status: 'leave'
          }
        }
      );
    } else {
      // Rejected - remove leave status
      await Attendance.updateMany(
        {
          leaveId: leave._id
        },
        {
          $unset: {
            isOnLeave: 1,
            leaveId: 1
          },
          $set: {
            status: 'absent'
          }
        }
      );
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('user', 'fullName employeeNumber email profileImage')
      .populate('reviewedBy', 'fullName employeeNumber');

    // Emit Socket.io event for real-time updates - ONLY to specific user
    const userId = typeof leave.user === 'object' ? leave.user._id : leave.user;
    const userIdString = userId.toString();
    
    // Verify user ID is valid
    if (!userIdString || userIdString === 'undefined') {
      console.error('❌ [Socket.io] Invalid userId for leave notification:', userIdString);
    } else {
      if (status === 'approved') {
        // Emit ONLY to this specific user's room
        io.to(userIdString).emit('leaveApproved', populatedLeave);
        console.log(`✅ [Socket.io] Leave approved notification sent ONLY to user: ${userIdString} (room: ${userIdString})`);
        
        // Fallback: emit directly to socket ID if room method doesn't work
        const socketId = getRecipientSockedId(userIdString);
        if (socketId) {
          io.to(socketId).emit('leaveApproved', populatedLeave);
          console.log(`✅ [Socket.io] Leave approved also sent to socket ID: ${socketId} (fallback)`);
        }
      } else {
        // Emit ONLY to this specific user's room
        io.to(userIdString).emit('leaveRejected', {
          leave: populatedLeave,
          rejectionReason: rejectionReason
        });
        console.log(`❌ [Socket.io] Leave rejected notification sent ONLY to user: ${userIdString} (room: ${userIdString})`);
        
        // Fallback: emit directly to socket ID if room method doesn't work
        const socketId = getRecipientSockedId(userIdString);
        if (socketId) {
          io.to(socketId).emit('leaveRejected', {
            leave: populatedLeave,
            rejectionReason: rejectionReason
          });
          console.log(`❌ [Socket.io] Leave rejected also sent to socket ID: ${socketId} (fallback)`);
        }
      }
    }

    // Also emit to all admins for real-time admin panel update
    io.emit('leaveReviewed', populatedLeave);
    console.log(`📢 [Socket.io] Leave review broadcast to all admins`);

    res.status(200).json({
      message: status === 'approved' ? 'تم قبول طلب الإجازة' : 'تم رفض طلب الإجازة',
      leave: populatedLeave
    });
  } catch (error) {
    console.error('Review leave error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء مراجعة طلب الإجازة',
      error: error.message 
    });
  }
};

// Delete leave (cancel by user)
export const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;

    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({ message: 'طلب الإجازة غير موجود' });
    }

    // Only user can cancel their own pending leave, or admin can cancel any
    if (leave.user.toString() !== req.user._id.toString() && 
        !['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'غير مصرح لك بحذف هذا الطلب' 
      });
    }

    if (leave.status !== 'pending' && !['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(400).json({ 
        message: 'لا يمكن إلغاء طلب تمت مراجعته' 
      });
    }

    // Remove leave status from attendance
    await Attendance.updateMany(
      {
        leaveId: leave._id
      },
      {
        $unset: {
          isOnLeave: 1,
          leaveId: 1
        },
        $set: {
          status: 'absent'
        }
      }
    );

    await Leave.findByIdAndDelete(id);

    res.status(200).json({ message: 'تم حذف طلب الإجازة بنجاح' });
  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء حذف طلب الإجازة',
      error: error.message 
    });
  }
};













