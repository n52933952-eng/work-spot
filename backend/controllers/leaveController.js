import Leave from '../modles/Leave.js';
import Attendance from '../modles/Attendance.js';
import User from '../modles/User.js';

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
    const { type, startDate, endDate, reason, attachments } = req.body;
    const userId = req.user.role === 'admin' || req.user.role === 'hr' 
      ? req.body.userId || req.user._id 
      : req.user._id;

    if (!type || !startDate || !endDate || !reason) {
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

    const leave = await Leave.create({
      user: userId,
      type,
      startDate: start,
      endDate: end,
      days,
      reason,
      attachments: attachments || []
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

    res.status(201).json({
      message: 'تم إنشاء طلب الإجازة بنجاح',
      leave: await Leave.findById(leave._id).populate('user', 'fullName employeeNumber email')
    });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء طلب الإجازة',
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
      .populate('user', 'fullName employeeNumber email department')
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

    res.status(200).json({
      message: status === 'approved' ? 'تم قبول طلب الإجازة' : 'تم رفض طلب الإجازة',
      leave: await Leave.findById(leave._id)
        .populate('user', 'fullName employeeNumber email')
        .populate('reviewedBy', 'fullName employeeNumber')
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













