import Holiday from '../modles/Holiday.js';
import Attendance from '../modles/Attendance.js';
import { io } from '../socket/socket.js';

// Create holiday
export const createHoliday = async (req, res) => {
  try {
    const { name, nameAr, startDate, endDate, type, branches, appliesToAll, description } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ 
        message: 'الرجاء إدخال جميع الحقول المطلوبة' 
      });
    }

    const holiday = await Holiday.create({
      name,
      nameAr,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type: type || 'national',
      branches: branches || [],
      appliesToAll: appliesToAll !== false,
      description,
      createdBy: req.user._id
    });

    // Update attendance records for this period to mark as holiday
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    await Attendance.updateMany(
      {
        date: { $gte: start, $lte: end },
        isHoliday: false
      },
      {
        $set: {
          isHoliday: true,
          holidayName: nameAr || name,
          status: 'holiday'
        }
      }
    );

    // Emit Socket.io event for real-time update
    io.emit('holidayCreated', holiday);

    res.status(201).json({
      message: 'تم إنشاء العطلة بنجاح',
      holiday
    });
  } catch (error) {
    console.error('Create holiday error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء العطلة',
      error: error.message 
    });
  }
};

// Get all holidays
export const getHolidays = async (req, res) => {
  try {
    const { year, type, isActive } = req.query;
    
    const query = {};
    
    if (year) {
      const startYear = new Date(year, 0, 1);
      const endYear = new Date(year, 11, 31, 23, 59, 59);
      query.$or = [
        { startDate: { $gte: startYear, $lte: endYear } },
        { endDate: { $gte: startYear, $lte: endYear } },
        { startDate: { $lte: startYear }, endDate: { $gte: endYear } }
      ];
    }
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const holidays = await Holiday.find(query)
      .populate('createdBy', 'fullName employeeNumber')
      .populate('branches', 'name address')
      .sort({ startDate: 1 });

    res.status(200).json({ holidays });
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get calendar view (holidays by month)
export const getCalendar = async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const holidays = await Holiday.find({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      isActive: true
    }).populate('branches', 'name');

    // Build calendar structure
    const calendar = [];
    const daysInMonth = endDate.getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(targetYear, targetMonth - 1, day);
      const dayHolidays = holidays.filter(h => {
        const hStart = new Date(h.startDate);
        hStart.setHours(0, 0, 0, 0);
        const hEnd = new Date(h.endDate);
        hEnd.setHours(23, 59, 59, 999);
        return currentDate >= hStart && currentDate <= hEnd;
      });

      calendar.push({
        date: currentDate,
        day,
        dayOfWeek: currentDate.getDay(),
        isHoliday: dayHolidays.length > 0,
        holidays: dayHolidays.map(h => ({
          name: h.name,
          nameAr: h.nameAr,
          type: h.type
        }))
      });
    }

    res.status(200).json({
      year: targetYear,
      month: targetMonth,
      calendar
    });
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get single holiday
export const getHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const holiday = await Holiday.findById(id)
      .populate('createdBy', 'fullName employeeNumber')
      .populate('branches', 'name address');

    if (!holiday) {
      return res.status(404).json({ message: 'العطلة غير موجودة' });
    }

    res.status(200).json({ holiday });
  } catch (error) {
    console.error('Get holiday error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Update holiday
export const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nameAr, startDate, endDate, type, branches, appliesToAll, description, isActive } = req.body;

    const holiday = await Holiday.findById(id);

    if (!holiday) {
      return res.status(404).json({ message: 'العطلة غير موجودة' });
    }

    // Store old dates to update attendance
    const oldStartDate = holiday.startDate;
    const oldEndDate = holiday.endDate;

    // Update fields
    if (name) holiday.name = name;
    if (nameAr !== undefined) holiday.nameAr = nameAr;
    if (startDate) holiday.startDate = new Date(startDate);
    if (endDate) holiday.endDate = new Date(endDate);
    if (type) holiday.type = type;
    if (branches !== undefined) holiday.branches = branches;
    if (appliesToAll !== undefined) holiday.appliesToAll = appliesToAll;
    if (description !== undefined) holiday.description = description;
    if (isActive !== undefined) holiday.isActive = isActive;

    await holiday.save();

    // Update attendance records if dates changed
    if (startDate || endDate) {
      const newStart = holiday.startDate;
      const newEnd = holiday.endDate;

      // Remove holiday status from old period
      await Attendance.updateMany(
        {
          date: { $gte: oldStartDate, $lte: oldEndDate },
          holidayName: holiday.nameAr || holiday.name
        },
        {
          $unset: {
            isHoliday: 1,
            holidayName: 1,
            status: 1
          }
        }
      );

      // Add holiday status to new period
      await Attendance.updateMany(
        {
          date: { $gte: newStart, $lte: newEnd }
        },
        {
          $set: {
            isHoliday: true,
            holidayName: holiday.nameAr || holiday.name,
            status: 'holiday'
          }
        }
      );
    }

    // Emit Socket.io event for real-time update
    io.emit('holidayUpdated', holiday);

    res.status(200).json({
      message: 'تم تحديث العطلة بنجاح',
      holiday
    });
  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تحديث العطلة',
      error: error.message 
    });
  }
};

// Delete holiday
export const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const holiday = await Holiday.findById(id);

    if (!holiday) {
      return res.status(404).json({ message: 'العطلة غير موجودة' });
    }

    // Remove holiday status from attendance records
    await Attendance.updateMany(
      {
        holidayName: holiday.nameAr || holiday.name
      },
      {
        $unset: {
          isHoliday: 1,
          holidayName: 1
        },
        $set: {
          status: 'absent' // Reset to absent if no check-in exists
        }
      }
    );

    await Holiday.findByIdAndDelete(id);

    // Emit Socket.io event for real-time update
    io.emit('holidayDeleted', { id });

    res.status(200).json({ message: 'تم حذف العطلة بنجاح' });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء حذف العطلة',
      error: error.message 
    });
  }
};

// Get upcoming holidays
export const getUpcomingHolidays = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get limit from query params, default to 3 for mobile app
    const limit = parseInt(req.query.limit) || 3;

    const holidays = await Holiday.find({
      endDate: { $gte: today },
      isActive: true
    })
      .populate('branches', 'name')
      .sort({ startDate: 1 })
      .limit(limit);

    res.status(200).json({ holidays });
  } catch (error) {
    console.error('Get upcoming holidays error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Check if specific date is holiday
export const checkHolidayByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const holiday = await Holiday.findOne({
      startDate: { $lte: checkDate },
      endDate: { $gte: checkDate },
      isActive: true
    });

    res.status(200).json({ 
      isHoliday: !!holiday,
      holiday: holiday || null
    });
  } catch (error) {
    console.error('Check holiday error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Import holidays from CSV
export const importHolidays = async (req, res) => {
  try {
    const { holidays } = req.body; // Array of holiday objects

    if (!Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({ 
        message: 'الرجاء إرسال مصفوفة من العطل' 
      });
    }

    const createdHolidays = [];

    for (const holidayData of holidays) {
      const { name, nameAr, startDate, endDate, type } = holidayData;

      if (!name || !startDate || !endDate) {
        continue; // Skip invalid entries
      }

      const holiday = await Holiday.create({
        name,
        nameAr,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type: type || 'national',
        appliesToAll: true,
        createdBy: req.user._id
      });

      createdHolidays.push(holiday);
    }

    res.status(201).json({
      message: `تم استيراد ${createdHolidays.length} عطلة بنجاح`,
      holidays: createdHolidays
    });
  } catch (error) {
    console.error('Import holidays error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء استيراد العطل',
      error: error.message 
    });
  }
};













