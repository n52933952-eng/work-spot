import Attendance from '../modles/Attendance.js';
import User from '../modles/User.js';
import Holiday from '../modles/Holiday.js';
import Leave from '../modles/Leave.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

// Helper function to create PDF
const createPDF = (data, type) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Set font for Arabic support
    doc.font('Helvetica');

    if (type === 'monthly') {
      // Monthly Attendance Report
      doc.fontSize(20).text('تقرير الحضور الشهري', { align: 'right' });
      doc.moveDown();
      doc.fontSize(12).text(`الموظف: ${data.user.fullName}`, { align: 'right' });
      doc.text(`رقم الموظف: ${data.user.employeeNumber}`, { align: 'right' });
      doc.text(`الشهر: ${data.month}/${data.year}`, { align: 'right' });
      doc.moveDown();

      // Statistics
      doc.fontSize(14).text('الإحصائيات:', { align: 'right' });
      doc.fontSize(12);
      doc.text(`عدد أيام الحضور: ${data.statistics.totalPresent}`, { align: 'right' });
      doc.text(`عدد التأخيرات: ${data.statistics.totalLate}`, { align: 'right' });
      doc.text(`عدد أيام الغياب: ${data.statistics.totalAbsent}`, { align: 'right' });
      doc.text(`عدد أيام العطل: ${data.statistics.totalHolidays}`, { align: 'right' });
      doc.text(`ساعات العمل: ${data.statistics.totalWorkingHours}`, { align: 'right' });
      doc.text(`ساعات العمل الإضافي: ${data.statistics.totalOvertime}`, { align: 'right' });
      doc.moveDown();

      // Attendance table
      doc.fontSize(14).text('سجل الحضور:', { align: 'right' });
      doc.moveDown();
      doc.fontSize(10);
      
      // Table header
      const tableTop = doc.y;
      doc.text('التاريخ', 50, tableTop);
      doc.text('حالة الحضور', 150, tableTop);
      doc.text('وقت الدخول', 250, tableTop);
      doc.text('وقت الخروج', 350, tableTop);
      doc.text('ساعات العمل', 450, tableTop);
      
      let y = tableTop + 20;
      data.attendances.forEach(att => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        const date = new Date(att.date).toLocaleDateString('ar-EG');
        doc.text(date, 50, y);
        doc.text(att.status === 'present' ? 'حاضر' : att.status === 'late' ? 'متأخر' : 'غائب', 150, y);
        doc.text(att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('ar-EG') : '-', 250, y);
        doc.text(att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('ar-EG') : '-', 350, y);
        doc.text(att.workingHours ? `${Math.floor(att.workingHours / 60)}:${att.workingHours % 60}` : '-', 450, y);
        y += 15;
      });
    } else if (type === 'late') {
      // Late Arrivals Report
      doc.fontSize(20).text('تقرير التأخيرات', { align: 'right' });
      doc.moveDown();
      doc.fontSize(12).text(`الشهر: ${data.month}/${data.year}`, { align: 'right' });
      doc.moveDown();

      // Statistics
      doc.fontSize(14).text('الإحصائيات:', { align: 'right' });
      doc.fontSize(12);
      doc.text(`إجمالي التأخيرات: ${data.totalLate}`, { align: 'right' });
      doc.text(`عدد الموظفين المتأخرين: ${data.lateUsers.length}`, { align: 'right' });
      doc.moveDown();

      // Late employees table
      doc.fontSize(14).text('الموظفون المتأخرون:', { align: 'right' });
      doc.moveDown();
      doc.fontSize(10);
      
      let y = doc.y;
      data.lateUsers.forEach(user => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        doc.text(user.fullName, 50, y);
        doc.text(user.employeeNumber, 200, y);
        doc.text(`عدد التأخيرات: ${user.lateCount}`, 300, y);
        doc.text(`إجمالي دقائق التأخير: ${user.totalLateMinutes}`, 450, y);
        y += 20;
      });
    } else if (type === 'overtime') {
      // Overtime Report
      doc.fontSize(20).text('تقرير العمل الإضافي', { align: 'right' });
      doc.moveDown();
      doc.fontSize(12).text(`الشهر: ${data.month}/${data.year}`, { align: 'right' });
      doc.moveDown();

      // Statistics
      doc.fontSize(14).text('الإحصائيات:', { align: 'right' });
      doc.fontSize(12);
      doc.text(`إجمالي ساعات العمل الإضافي: ${data.totalOvertimeHours}`, { align: 'right' });
      doc.text(`عدد الموظفين: ${data.overtimeUsers.length}`, { align: 'right' });
      doc.moveDown();

      // Overtime employees table
      doc.fontSize(14).text('الموظفون:', { align: 'right' });
      doc.moveDown();
      doc.fontSize(10);
      
      let y = doc.y;
      data.overtimeUsers.forEach(user => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        doc.text(user.fullName, 50, y);
        doc.text(user.employeeNumber, 200, y);
        doc.text(`ساعات العمل الإضافي: ${user.overtimeHours}`, 350, y);
        y += 20;
      });
    }

    doc.end();
  });
};

// Monthly Attendance Report
export const getMonthlyReport = async (req, res) => {
  try {
    const { userId, year, month, format } = req.query;
    const targetUserId = userId || req.user._id;
    
    // Check permissions
    if (targetUserId !== req.user._id.toString() && 
        !['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const targetDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    const attendances = await Attendance.find({
      user: targetUserId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    const holidays = await Holiday.find({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      isActive: true
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

    const reportData = {
      user: {
        fullName: user.fullName,
        employeeNumber: user.employeeNumber
      },
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
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
    };

    if (format === 'pdf') {
      const pdfBuffer = await createPDF(reportData, 'monthly');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=monthly-report-${targetDate.getMonth() + 1}-${targetDate.getFullYear()}.pdf`);
      res.send(pdfBuffer);
    } else {
      res.status(200).json(reportData);
    }
  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Late Arrivals Report
export const getLateReport = async (req, res) => {
  try {
    const { year, month, format } = req.query;
    
    // Only admin/hr/manager can access
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const targetDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const lateAttendances = await Attendance.find({
      status: 'late',
      date: { $gte: startDate, $lte: endDate }
    }).populate('user', 'fullName employeeNumber department');

    // Group by user
    const userMap = new Map();
    lateAttendances.forEach(att => {
      const userId = att.user._id.toString();
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user: att.user,
          lateCount: 0,
          totalLateMinutes: 0,
          lateDates: []
        });
      }
      const userData = userMap.get(userId);
      userData.lateCount++;
      userData.totalLateMinutes += att.lateMinutes || 0;
      userData.lateDates.push(att.date);
    });

    const lateUsers = Array.from(userMap.values()).map(data => ({
      fullName: data.user.fullName,
      employeeNumber: data.user.employeeNumber,
      department: data.user.department,
      lateCount: data.lateCount,
      totalLateMinutes: data.totalLateMinutes
    }));

    const reportData = {
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
      totalLate: lateAttendances.length,
      lateUsers
    };

    if (format === 'pdf') {
      const pdfBuffer = await createPDF(reportData, 'late');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=late-report-${targetDate.getMonth() + 1}-${targetDate.getFullYear()}.pdf`);
      res.send(pdfBuffer);
    } else {
      res.status(200).json(reportData);
    }
  } catch (error) {
    console.error('Get late report error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Overtime Report
export const getOvertimeReport = async (req, res) => {
  try {
    const { year, month, format } = req.query;
    
    // Only admin/hr/manager can access
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const targetDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const overtimeAttendances = await Attendance.find({
      overtime: { $gt: 0 },
      date: { $gte: startDate, $lte: endDate }
    }).populate('user', 'fullName employeeNumber department');

    // Group by user
    const userMap = new Map();
    overtimeAttendances.forEach(att => {
      const userId = att.user._id.toString();
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user: att.user,
          totalOvertime: 0
        });
      }
      const userData = userMap.get(userId);
      userData.totalOvertime += att.overtime || 0;
    });

    const overtimeUsers = Array.from(userMap.values()).map(data => ({
      fullName: data.user.fullName,
      employeeNumber: data.user.employeeNumber,
      department: data.user.department,
      overtimeHours: Math.floor(data.totalOvertime / 60)
    }));

    const totalOvertimeHours = overtimeUsers.reduce((sum, u) => sum + u.overtimeHours, 0);

    const reportData = {
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
      totalOvertimeHours,
      overtimeUsers
    };

    if (format === 'pdf') {
      const pdfBuffer = await createPDF(reportData, 'overtime');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=overtime-report-${targetDate.getMonth() + 1}-${targetDate.getFullYear()}.pdf`);
      res.send(pdfBuffer);
    } else {
      res.status(200).json(reportData);
    }
  } catch (error) {
    console.error('Get overtime report error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

