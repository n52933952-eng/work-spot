import Attendance from '../modles/Attendance.js';
import User from '../modles/User.js';
import Holiday from '../modles/Holiday.js';
import Leave from '../modles/Leave.js';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ArabicReshaperFactory from 'arabic-reshaper';
import bidiFactory from 'bidi-js';
const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const arabicFontPath = path.resolve(
  __dirname,
  '..',
  '..',
  'node_modules',
  '@fontsource',
  'noto-naskh-arabic',
  'files',
  'noto-naskh-arabic-arabic-400-normal.ttf'
);
let arabicFontAvailable = fs.existsSync(arabicFontPath);
const arabicReshaper = typeof ArabicReshaperFactory === 'function'
  ? ArabicReshaperFactory()
  : ArabicReshaperFactory;
const bidi = typeof bidiFactory === 'function' ? bidiFactory() : bidiFactory;

const formatArabicText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const text = value.toString();
  if (!text.trim()) {
    return '';
  }
  if (!/[\u0600-\u06FF]/.test(text)) {
    return text;
  }
  try {
    const reshaped = arabicReshaper.convertArabic(text);
    const embedding = bidi.getEmbeddingLevels(reshaped, 'RTL');
    return bidi.getReorderedString(reshaped, embedding);
  } catch (error) {
    console.error('⚠️ Arabic text formatting failed, falling back to raw text:', error.message);
    return text;
  }
};

const patchPdfForArabic = (doc) => {
  const originalText = doc.text.bind(doc);
  doc.text = (value, ...args) => {
    const formatted = formatArabicText(value);
    return originalText(formatted, ...args);
  };
};

// Helper function to create PDF
const createPDF = (data, type) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    patchPdfForArabic(doc);

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Set font for Arabic support
    if (arabicFontAvailable) {
      try {
        doc.registerFont('Arabic', arabicFontPath);
        doc.font('Arabic');
      } catch (fontError) {
        arabicFontAvailable = false;
        console.error('⚠️ Failed to load Arabic font, falling back to Helvetica:', fontError.message);
        doc.font('Helvetica');
      }
    } else {
      doc.font('Helvetica');
    }

    if (type === 'monthly') {
      const sections = Array.isArray(data) ? data : [data];
      sections.forEach((section, index) => {
        if (index > 0) {
          doc.addPage();
        }

        doc.fontSize(20).text('Monthly Attendance Report', { align: 'left' });
        doc.moveDown();
        doc.fontSize(12).text(`Employee: ${section.user.fullName}`);
        doc.text(`Employee Number: ${section.user.employeeNumber}`);
        doc.text(`Month: ${section.month}/${section.year}`);
        doc.moveDown();

        doc.fontSize(14).text('Summary');
        doc.fontSize(12);
        doc.text(`Days Present: ${section.statistics.totalPresent}`);
        doc.text(`Late Days: ${section.statistics.totalLate}`);
        doc.text(`Absent Days: ${section.statistics.totalAbsent}`);
        doc.text(`Holidays: ${section.statistics.totalHolidays}`);
        doc.text(`Working Hours: ${section.statistics.totalWorkingHours}`);
        doc.text(`Overtime Hours: ${section.statistics.totalOvertime}`);
        doc.moveDown();

        doc.fontSize(14).text('Attendance Log');
        doc.moveDown();
        doc.fontSize(10);
        
        const tableTop = doc.y;
        doc.text('Date', 50, tableTop);
        doc.text('Status', 150, tableTop);
        doc.text('Check-in', 250, tableTop);
        doc.text('Check-out', 350, tableTop);
        doc.text('Working Hours', 450, tableTop);
        
        let y = tableTop + 20;
        section.attendances.forEach(att => {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }
          const date = new Date(att.date).toLocaleDateString('en-US');
          const statusLabel =
            att.status === 'present'
              ? 'Present'
              : att.status === 'late'
              ? 'Late'
              : att.status === 'leave'
              ? 'Leave'
              : att.status === 'holiday'
              ? 'Holiday'
              : 'Absent';
          const checkIn = att.checkInTime
            ? new Date(att.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : '-';
          const checkOut = att.checkOutTime
            ? new Date(att.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : '-';
          const workingHours = att.workingHours
            ? `${Math.floor(att.workingHours / 60)}:${(att.workingHours % 60).toString().padStart(2, '0')}`
            : '-';

          doc.text(date, 50, y);
          doc.text(statusLabel, 150, y);
          doc.text(checkIn, 250, y);
          doc.text(checkOut, 350, y);
          doc.text(workingHours, 450, y);
          y += 15;
        });
      });
    } else if (type === 'late') {
      // Late Arrivals Report (English)
      doc.fontSize(20).text('Late Arrivals Report', { align: 'left' });
      doc.moveDown();
      const startLabel = new Date(data.startDate).toLocaleDateString('en-US');
      const endLabel = new Date(data.endDate).toLocaleDateString('en-US');
      doc.fontSize(12).text(`Range: ${startLabel} - ${endLabel}`);
      doc.moveDown();

      // Statistics
      doc.fontSize(14).text('Summary');
      doc.fontSize(12);
      doc.text(`Total Late Entries: ${data.totalLate}`);
      doc.text(`Employees Late: ${data.lateUsers.length}`);
      doc.moveDown();

      // Late employees table
      doc.fontSize(14).text('Employees');
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
        doc.text(`Late Count: ${user.lateCount}`, 300, y);
        doc.text(`Total Late Minutes: ${user.totalLateMinutes}`, 450, y);
        y += 20;
      });
    } else if (type === 'overtime') {
      const sections = Array.isArray(data) ? data : [data];
      sections.forEach((section, index) => {
        if (index > 0) {
          doc.addPage();
        }

        doc.fontSize(20).text('Overtime Report', { align: 'left' });
        doc.moveDown();
        doc.fontSize(12).text(`Employee: ${section.user.fullName}`);
        doc.text(`Employee Number: ${section.user.employeeNumber}`);
        doc.text(`Month: ${section.month}/${section.year}`);
        doc.moveDown();

        doc.fontSize(14).text('Summary');
        doc.fontSize(12);
        doc.text(`Total Overtime Hours: ${section.totalOvertimeHours}`);
        doc.text(`Days with Overtime: ${section.daysWithOvertime}`);
        doc.moveDown();

        doc.fontSize(14).text('Daily Overtime');
        doc.moveDown();
        doc.fontSize(10);

        const tableTop = doc.y;
        doc.text('Date', 50, tableTop);
        doc.text('Overtime Hours', 200, tableTop);
        doc.text('Check-in', 320, tableTop);
        doc.text('Check-out', 420, tableTop);

        let y = tableTop + 20;
        section.entries.forEach(entry => {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }
          doc.text(new Date(entry.date).toLocaleDateString('en-US'), 50, y);
          doc.text(entry.overtimeHours.toString(), 200, y);
          doc.text(entry.checkIn || '-', 320, y);
          doc.text(entry.checkOut || '-', 420, y);
          y += 18;
        });
      });
    }

    doc.end();
  });
};

const buildMonthlyReportData = async (targetUserId, targetDate) => {
  const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new Error('الموظف غير موجود');
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

  return {
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
};

const buildOvertimeReportData = async (targetUserId, targetDate) => {
  const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new Error('الموظف غير موجود');
  }

  const attendances = await Attendance.find({
    user: targetUserId,
    overtime: { $gt: 0 },
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 });

  const entries = attendances.map(att => ({
    date: att.date,
    overtimeHours: Math.round((att.overtime || 0) / 60),
    checkIn: att.checkInTime
      ? new Date(att.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '-',
    checkOut: att.checkOutTime
      ? new Date(att.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '-',
  }));

  const totalOvertimeHours = entries.reduce((sum, entry) => sum + entry.overtimeHours, 0);

  return {
    user: {
      fullName: user.fullName,
      employeeNumber: user.employeeNumber,
    },
    month: targetDate.getMonth() + 1,
    year: targetDate.getFullYear(),
    totalOvertimeHours,
    daysWithOvertime: entries.length,
    entries,
  };
};

// Monthly Attendance Report
export const getMonthlyReport = async (req, res) => {
  try {
    const { userId, year, month, format } = req.query;
    const targetDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);

    const requestedAll = userId === 'all';

    if (requestedAll) {
      if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'غير مصرح لك' });
      }

      const employees = await User.find({ role: 'employee', isActive: true }).select('_id fullName employeeNumber');
      const reports = [];
      for (const employee of employees) {
        const reportData = await buildMonthlyReportData(employee._id, targetDate);
        reports.push(reportData);
      }

      if (format === 'pdf') {
        const pdfBuffer = await createPDF(reports, 'monthly');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=monthly-report-all-${targetDate.getMonth() + 1}-${targetDate.getFullYear()}.pdf`);
        res.send(pdfBuffer);
      } else {
        res.status(200).json({ reports });
      }
      return;
    }

    const targetUserId = userId || req.user._id;
    if (targetUserId !== req.user._id.toString() && 
        !['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const reportData = await buildMonthlyReportData(targetUserId, targetDate);

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
    const { startDate: startDateParam, endDate: endDateParam, userId, format } = req.query;
    
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    if (!startDateParam || !endDateParam) {
      return res.status(400).json({ message: 'الرجاء تحديد تاريخ البداية والنهاية' });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'تواريخ غير صالحة' });
    }

    endDate.setHours(23, 59, 59, 999);

    if (startDate > endDate) {
      return res.status(400).json({ message: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
    }

    const attendanceQuery = {
      status: 'late',
      date: { $gte: startDate, $lte: endDate },
    };

    if (userId && userId !== 'all') {
      attendanceQuery.user = userId;
    }

    const lateAttendances = await Attendance.find(attendanceQuery)
      .populate('user', 'fullName employeeNumber department');

    const userMap = new Map();
    lateAttendances.forEach(att => {
      const key = att.user._id.toString();
      if (!userMap.has(key)) {
        userMap.set(key, {
          user: att.user,
          lateCount: 0,
          totalLateMinutes: 0,
        });
      }
      const data = userMap.get(key);
      data.lateCount += 1;
      data.totalLateMinutes += att.lateMinutes || 0;
    });

    const lateUsers = Array.from(userMap.values()).map(data => ({
      fullName: data.user.fullName,
      employeeNumber: data.user.employeeNumber,
      department: data.user.department,
      lateCount: data.lateCount,
      totalLateMinutes: data.totalLateMinutes,
    }));

    const reportData = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalLate: lateAttendances.length,
      lateUsers,
    };

    if (format === 'pdf') {
      const pdfBuffer = await createPDF(reportData, 'late');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=late-report-${startDate.toISOString().slice(0,10)}-${endDate.toISOString().slice(0,10)}.pdf`);
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
    const { year, month, userId, format } = req.query;
    const targetDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);

    const requestedAll = userId === 'all';

    if (requestedAll) {
      if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'غير مصرح لك' });
      }

      const employees = await User.find({ role: 'employee', isActive: true }).select('_id fullName employeeNumber');
      const reports = [];
      for (const employee of employees) {
        const reportData = await buildOvertimeReportData(employee._id, targetDate);
        reports.push(reportData);
      }

      if (format === 'pdf') {
        const pdfBuffer = await createPDF(reports, 'overtime');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=overtime-report-all-${targetDate.getMonth() + 1}-${targetDate.getFullYear()}.pdf`);
        res.send(pdfBuffer);
      } else {
        res.status(200).json({ reports });
      }
      return;
    }

    const targetUserId = userId || req.user._id;
    if (targetUserId !== req.user._id.toString() &&
        !['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const reportData = await buildOvertimeReportData(targetUserId, targetDate);

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

