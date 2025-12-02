import User from '../modles/User.js';
import { getRecipientSockedId } from '../socket/socket.js';

/**
 * Get all pending employees waiting for approval
 */
export const getPendingEmployees = async (req, res) => {
  try {
    const { role } = req.user;

    // Only admin, HR, and manager can access
    if (!['admin', 'hr', 'manager'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول إلى هذه البيانات'
      });
    }

    const pendingEmployees = await User.find({ approvalStatus: 'pending' })
      .select('-password -faceEmbedding -faceLandmarks')
      .populate('branch', 'name address')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: pendingEmployees,
      message: 'تم جلب الموظفين المعلقين بنجاح'
    });
  } catch (error) {
    console.error('Error fetching pending employees:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الموظفين المعلقين',
      error: error.message
    });
  }
};

/**
 * Approve an employee
 */
export const approveEmployee = async (req, res) => {
  try {
    const { role } = req.user;
    const { employeeId } = req.params;

    // Only admin and HR can approve
    if (!['admin', 'hr'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالموافقة على الموظفين'
      });
    }

    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    if (employee.approvalStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `حالة الموظف ليست معلقة (الحالة الحالية: ${employee.approvalStatus})`
      });
    }

    // Update employee status
    employee.approvalStatus = 'approved';
    employee.approvedAt = new Date();
    employee.approvedBy = req.user._id;
    await employee.save();

    // Send notification via Socket.io - BROADCAST TO ALL
    try {
      const { io } = await import('../socket/socket.js');
      if (io) {
        const employeeIdStr = employee._id.toString();
        const notificationData = {
          message: 'تمت الموافقة على طلب التسجيل الخاص بك',
          employeeId: employeeIdStr,
          timestamp: new Date().toISOString()
        };
        
        console.log('📢 BROADCASTING approval notification:', notificationData);
        
        // SIMPLE: Broadcast to ALL - let client filter
        io.emit('employeeApproved', notificationData);
        console.log('✅ Broadcasted to all clients');
      }
    } catch (error) {
      console.error('❌ Socket error (non-fatal):', error.message);
      // Don't fail the approval if socket fails
    }

    res.status(200).json({
      success: true,
      data: employee,
      message: 'تمت الموافقة على الموظف بنجاح'
    });
  } catch (error) {
    console.error('Error approving employee:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الموافقة على الموظف',
      error: error.message
    });
  }
};

/**
 * Reject an employee
 */
export const rejectEmployee = async (req, res) => {
  try {
    const { role } = req.user;
    const { employeeId } = req.params;
    const { reason } = req.body;

    // Only admin and HR can reject
    if (!['admin', 'hr'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك برفض الموظفين'
      });
    }

    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    if (employee.approvalStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `حالة الموظف ليست معلقة (الحالة الحالية: ${employee.approvalStatus})`
      });
    }

    // Update employee status
    employee.approvalStatus = 'rejected';
    employee.rejectedAt = new Date();
    employee.rejectedBy = req.user._id;
    employee.rejectionReason = reason || null;
    await employee.save();

    // Send notification via Socket.io - BROADCAST TO ALL
    try {
      const { io } = await import('../socket/socket.js');
      if (io) {
        const employeeIdStr = employee._id.toString();
        const notificationData = {
          message: 'تم رفض طلب التسجيل الخاص بك',
          reason: reason || null,
          employeeId: employeeIdStr,
          timestamp: new Date().toISOString()
        };
        
        console.log('📢 BROADCASTING rejection notification:', notificationData);
        
        // Broadcast to ALL connected clients - simple and reliable
        io.emit('employeeRejected', notificationData);
        
        // Also try targeted delivery
        io.to(`user_${employeeIdStr}`).emit('employeeRejected', notificationData);
        io.to(employeeIdStr).emit('employeeRejected', notificationData);
        
        const socketId = getRecipientSockedId?.(employeeIdStr);
        if (socketId) {
          io.to(socketId).emit('employeeRejected', notificationData);
        }
        
        console.log('✅ Notification broadcasted successfully');
      }
    } catch (error) {
      console.error('❌ Socket error (non-fatal):', error.message);
      // Don't fail the rejection if socket fails
    }

    res.status(200).json({
      success: true,
      data: employee,
      message: 'تم رفض الموظف بنجاح'
    });
  } catch (error) {
    console.error('Error rejecting employee:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في رفض الموظف',
      error: error.message
    });
  }
};
