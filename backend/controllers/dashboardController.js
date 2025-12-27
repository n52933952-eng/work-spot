import Attendance from '../modles/Attendance.js';
import User from '../modles/User.js';
import Leave from '../modles/Leave.js';
import Holiday from '../modles/Holiday.js';
import Location from '../modles/Location.js';
import { calculateDistance } from '../utils/geofencing.js';

// Get dashboard data for admin/manager
export const getDashboard = async (req, res) => {
  try {
    // Only admin/hr/manager/generalManager can access
    if (!['admin', 'hr', 'manager', 'generalManager'].includes(req.user.role)) {
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

    // Get all users count - count all approved non-admin employees (employee, hr, manager)
    const totalEmployees = await User.countDocuments({ 
      role: { $ne: 'admin' }, 
      isActive: true,
      approvalStatus: 'approved'
    });
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
    // Only admin/hr/manager/generalManager can access
    if (!['admin', 'hr', 'manager', 'generalManager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const { department, isActive, role } = req.query;
    
    const query = {};
    
    // ALWAYS exclude admin users from employee list - NEVER show admin users
    // If a specific role filter is provided (and it's not admin), use that role
    if (role && role !== 'admin') {
      query.role = role; // Filter by specific role (employee, hr, manager)
    } else {
      // No role filter or invalid filter - exclude admin and show all other roles
      query.role = { $ne: 'admin' };
    }
    
    // Only show approved employees (pending employees appear in approval page)
    query.approvalStatus = 'approved';
    
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Debug log to verify the query
    console.log('🔍 getAllEmployees query:', JSON.stringify(query));
    console.log('🚫 Excluding admin users, showing only approved employees');

    const employees = await User.find(query)
      .select('-password')
      .populate('branch', 'name address')
      .sort({ createdAt: -1 });

    // Double-check: Filter out any admin users that might have slipped through (shouldn't happen)
    const filteredEmployees = employees.filter(emp => emp.role !== 'admin');
    
    console.log(`✅ Found ${employees.length} employees, after admin filter: ${filteredEmployees.length}`);

    res.status(200).json({ employees: filteredEmployees });
  } catch (error) {
    console.error('Get all employees error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Update employee (for admin/hr/manager)
export const updateEmployee = async (req, res) => {
  try {
    // Only admin/hr/manager/generalManager can update employees
    if (!['admin', 'hr', 'manager', 'generalManager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const { userId } = req.params;
    const { position, department, role, isActive } = req.body;

    const employee = await User.findById(userId);
    if (!employee) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    // Update fields if provided
    if (position !== undefined) employee.position = position;
    if (department !== undefined) employee.department = department;
    if (role !== undefined) employee.role = role;
    if (isActive !== undefined) employee.isActive = isActive;

    await employee.save();

    res.status(200).json({ 
      message: 'تم تحديث معلومات الموظف بنجاح',
      employee: employee.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } })
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get today's attendance for dashboard (simplified format)
export const getTodayAttendance = async (req, res) => {
  try {
    // Get date from query params, default to today
    let startDate, endDate;
    
    if (req.query.date) {
      // Single date provided
      const selectedDate = new Date(req.query.date);
      startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (req.query.startDate && req.query.endDate) {
      // Date range provided
      startDate = new Date(req.query.startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(req.query.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to today
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // Get attendances for the selected date/range
    const todayAttendances = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    }).populate('user', 'fullName employeeNumber department position profileImage');

    // Get all active and approved non-admin employees (employee, hr, manager)
    const allEmployees = await User.find({ 
      role: { $ne: 'admin' }, 
      isActive: true,
      approvalStatus: 'approved'
    }).select('_id fullName employeeNumber');

    // Calculate stats
    const presentEmployees = []; // Still at work (checked in, not checked out)
    const lateEmployees = [];
    const checkedOutEmployees = []; // Checked out today
    const checkedInUserIds = new Set();

    todayAttendances.forEach(att => {
      if (att.checkInTime && att.user) {
        checkedInUserIds.add(att.user._id.toString());
        
        const location = att.checkInLocation 
          ? att.checkInLocation.address || `${att.checkInLocation.latitude}, ${att.checkInLocation.longitude}`
          : 'غير متوفر';

        const checkInTimeFormatted = new Date(att.checkInTime).toLocaleTimeString('ar-JO', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });

        const employeeData = {
          id: att.user._id,
          employeeNumber: att.user.employeeNumber,
          name: att.user.fullName,
          checkInTime: checkInTimeFormatted,
          location: location,
          department: att.user.department,
          position: att.user.position,
          profileImage: att.user.profileImage
        };

        // Employee checked in - add to present/late based on status
        // They should appear in check-in tabs even if they checked out
        if (att.status === 'late') {
          lateEmployees.push({
            ...employeeData,
            lateMinutes: att.lateMinutes || 0,
            checkOutTime: att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('ar-JO', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            }) : null
          });
        } else {
          presentEmployees.push({
            ...employeeData,
            checkOutTime: att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('ar-JO', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            }) : null
          });
        }

        // If employee has checked out, ALSO add to checkedOutEmployees
        if (att.checkOutTime) {
          const checkOutTimeFormatted = new Date(att.checkOutTime).toLocaleTimeString('ar-JO', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          });
          
          const workingHours = att.workingHours || 0;
          const hours = Math.floor(workingHours / 60);
          const minutes = workingHours % 60;
          const workingHoursFormatted = `${hours}:${minutes.toString().padStart(2, '0')}`;

          checkedOutEmployees.push({
            ...employeeData,
            checkOutTime: checkOutTimeFormatted,
            workingHours: workingHoursFormatted,
            overtime: att.overtime > 0 ? Math.floor(att.overtime / 60) + ':' + (att.overtime % 60).toString().padStart(2, '0') : '0:00'
          });
        }
      }
    });

    // Calculate absent employees
    const absentEmployees = allEmployees
      .filter(emp => !checkedInUserIds.has(emp._id.toString()))
      .map(emp => {
        const expectedCheckIn = emp.expectedCheckInTime || '09:00';
        return {
          id: emp._id,
          employeeNumber: emp.employeeNumber,
          name: emp.fullName,
          expectedTime: `${expectedCheckIn} صباحاً`, // Expected check-in time
          expectedCheckOut: '05:00 مساءً' // Expected check-out time (5 PM)
        };
      });

    // Stats
    const stats = {
      present: presentEmployees.length,
      late: lateEmployees.length,
      checkedOut: checkedOutEmployees.length,
      absent: absentEmployees.length,
      total: allEmployees.length
    };

    // Get headquarters location (main location)
    const headquarters = await Location.findOne({
      type: 'main',
      isActive: true
    });

    // If no headquarters in DB, use default coordinates (University of Jordan)
    const headquartersLocation = headquarters || {
      latitude: 32.014206,
      longitude: 35.873015,
      name: 'المقر الرئيسي',
      nameAr: 'المقر الرئيسي - الجامعة الأردنية',
      address: 'University of Jordan, Queen Rania St., Amman, Jordan'
    };

    // Prepare map data with check-in locations and distances from headquarters
    const mapData = {
      headquarters: {
        latitude: headquartersLocation.latitude,
        longitude: headquartersLocation.longitude,
        name: headquartersLocation.nameAr || headquartersLocation.name,
        address: headquartersLocation.address
      },
      checkIns: []
    };

    // Collect all check-in locations with employee info and distances
    const checkInMap = new Map();
    todayAttendances.forEach(att => {
      if (att.checkInLocation && att.checkInLocation.latitude && att.checkInLocation.longitude) {
        const key = `${att.checkInLocation.latitude},${att.checkInLocation.longitude}`;
        
        if (!checkInMap.has(key)) {
          const distance = calculateDistance(
            headquartersLocation.latitude,
            headquartersLocation.longitude,
            att.checkInLocation.latitude,
            att.checkInLocation.longitude
          );
          
          checkInMap.set(key, {
            latitude: att.checkInLocation.latitude,
            longitude: att.checkInLocation.longitude,
            address: att.checkInLocation.address || 'غير متوفر',
            distance: Math.round(distance), // Distance in meters
            employees: []
          });
        }
        
        const location = checkInMap.get(key);
        location.employees.push({
          id: att?.user?._id,
          name: att?.user?.fullName,
          employeeNumber: att?.user?.employeeNumber,
          checkInTime: new Date(att.checkInTime).toLocaleTimeString('ar-JO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          checkOutTime: att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('ar-JO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }) : null
        });
      }
    });

    mapData.checkIns = Array.from(checkInMap.values());

    res.status(200).json({
      stats,
      employees: {
        present: presentEmployees,
        late: lateEmployees,
        checkedOut: checkedOutEmployees,
        absent: absentEmployees
      },
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      mapData
    });
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ في جلب بيانات الحضور',
      error: error.message 
    });
  }
};













