import Attendance from '../modles/Attendance.js';
import User from '../modles/User.js';
import Leave from '../modles/Leave.js';
import Holiday from '../modles/Holiday.js';

// Get dashboard data for admin/manager
export const getDashboard = async (req, res) => {
  try {
    // Only admin/hr/manager can access
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Today's attendance stats
    const todayAttendances = await Attendance.find({
      date: { $gte: today, $lte: todayEnd }
    }).populate('user', 'fullName employeeNumber department');

    const presentNow = todayAttendances.filter(
      a => a.checkInTime && !a.checkOutTime
    ).length;

    const lateEmployees = todayAttendances.filter(
      a => a.status === 'late'
    ).map(a => ({
      user: {
        _id: a.user._id,
        fullName: a.user.fullName,
        employeeNumber: a.user.employeeNumber,
        department: a.user.department
      },
      checkInTime: a.checkInTime,
      lateMinutes: a.lateMinutes,
      location: a.checkInLocation
    }));

    // Get all users count
    const totalEmployees = await User.countDocuments({ role: 'employee', isActive: true });
    const absentEmployees = totalEmployees - todayAttendances.filter(
      a => a.checkInTime
    ).length;

    // Pending leave requests
    const pendingLeaves = await Leave.find({ status: 'pending' })
      .populate('user', 'fullName employeeNumber department')
      .sort({ createdAt: -1 })
      .limit(10);

    // Check if today is holiday
    const todayHoliday = await Holiday.findOne({
      startDate: { $lte: today },
      endDate: { $gte: today },
      isActive: true
    });

    // Get locations with check-ins today (for map)
    const locationsWithCheckIns = [];
    const locationMap = new Map();

    todayAttendances.forEach(att => {
      if (att.checkInLocation) {
        const key = `${att.checkInLocation.latitude},${att.checkInLocation.longitude}`;
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            latitude: att.checkInLocation.latitude,
            longitude: att.checkInLocation.longitude,
            address: att.checkInLocation.address,
            count: 0,
            employees: []
          });
        }
        const location = locationMap.get(key);
        location.count++;
        location.employees.push({
          fullName: att.user.fullName,
          checkInTime: att.checkInTime
        });
      }
    });

    locationsWithCheckIns.push(...Array.from(locationMap.values()));

    // Monthly statistics (current month)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthAttendances = await Attendance.find({
      date: { $gte: monthStart, $lte: monthEnd }
    });

    const monthStats = {
      totalPresent: monthAttendances.filter(a => a.status === 'present' || a.status === 'late').length,
      totalLate: monthAttendances.filter(a => a.status === 'late').length,
      totalAbsent: monthAttendances.filter(a => a.status === 'absent').length,
      totalOvertime: monthAttendances.reduce((sum, a) => sum + (a.overtime || 0), 0)
    };

    res.status(200).json({
      today: {
        presentNow,
        lateEmployees,
        absentEmployees,
        totalEmployees,
        isHoliday: !!todayHoliday,
        holiday: todayHoliday ? { name: todayHoliday.name, nameAr: todayHoliday.nameAr } : null,
        locationsWithCheckIns
      },
      month: monthStats,
      pendingLeaves
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get live attendance board data
export const getLiveAttendanceBoard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const attendances = await Attendance.find({
      date: { $gte: today, $lte: todayEnd },
      checkInTime: { $exists: true }
    })
      .populate('user', 'fullName employeeNumber department position')
      .sort({ checkInTime: 1 });

    const present = attendances.filter(a => !a.checkOutTime);
    const checkedOut = attendances.filter(a => a.checkOutTime);

    res.status(200).json({
      present: present.map(a => ({
        user: {
          fullName: a.user.fullName,
          employeeNumber: a.user.employeeNumber,
          department: a.user.department,
          position: a.user.position
        },
        checkInTime: a.checkInTime,
        status: a.status,
        lateMinutes: a.lateMinutes
      })),
      checkedOut: checkedOut.map(a => ({
        user: {
          fullName: a.user.fullName,
          employeeNumber: a.user.employeeNumber,
          department: a.user.department,
          position: a.user.position
        },
        checkInTime: a.checkInTime,
        checkOutTime: a.checkOutTime,
        workingHours: a.workingHours
      })),
      totalPresent: present.length,
      totalCheckedOut: checkedOut.length,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Get live attendance board error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get all employees (for admin)
export const getAllEmployees = async (req, res) => {
  try {
    // Only admin/hr/manager can access
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const { department, isActive, role } = req.query;
    
    const query = {};
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (role) query.role = role;

    const employees = await User.find(query)
      .select('-password')
      .populate('branch', 'name address')
      .sort({ createdAt: -1 });

    res.status(200).json({ employees });
  } catch (error) {
    console.error('Get all employees error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};













