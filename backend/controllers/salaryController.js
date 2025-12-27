import Attendance from '../modles/Attendance.js';
import User from '../modles/User.js';
import Holiday from '../modles/Holiday.js';
import Leave from '../modles/Leave.js';
import Salary from '../modles/Salary.js';

const JORDAN_TIMEZONE = 'Asia/Amman';

/**
 * Convert date to Jordan timezone
 */
const convertToTimezone = (date, timeZone = JORDAN_TIMEZONE) => {
  if (!date) return null;
  return new Date(new Date(date).toLocaleString('en-US', { timeZone }));
};

/**
 * Calculate monthly salary for an employee
 */
export const calculateEmployeeSalary = async (req, res) => {
  try {
    const { userId, year, month } = req.query;
    const { role } = req.user;

    // Only admin, HR, and manager can access
    if (!['admin', 'hr', 'manager'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول إلى هذه البيانات'
      });
    }

    // Get target date
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;

    // Build query
    const query = {};
    if (userId) {
      query.user = userId;
    }

    // Get all employees if no specific user
    let employees;
    if (userId) {
      employees = await User.findById(userId);
      if (!employees) {
        return res.status(404).json({
          success: false,
          message: 'الموظف غير موجود'
        });
      }
      employees = [employees];
    } else {
      // Fetch all employees except admin users
      employees = await User.find({ role: { $ne: 'admin' }, isActive: true });
    }

    // Get holidays for the month
    const firstDay = new Date(targetYear, targetMonth - 1, 1);
    const lastDay = new Date(targetYear, targetMonth, 0);
    
    const holidays = await Holiday.find({
      startDate: { $lte: lastDay },
      endDate: { $gte: firstDay },
      isActive: true
    });

    // Calculate salary for each employee
    const salaryData = await Promise.all(
      employees.map(async (employee) => {
        // Get attendance records for the month
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(targetYear, targetMonth, 0);
        endDate.setHours(23, 59, 59, 999);

        const attendances = await Attendance.find({
          user: employee._id,
          date: {
            $gte: startDate,
            $lte: endDate
          }
        }).sort({ date: 1 });

        // Get approved leaves for the month
        const leaves = await Leave.find({
          user: employee._id,
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
          status: 'approved'
        });

        // Calculate working days
        const totalDays = lastDay.getDate();
        let workingDays = 0;
        let presentDays = 0;
        let absentDays = 0;
        let leaveDays = 0;
        let holidayDays = 0;
        let totalOvertimeHours = 0;
        let totalOvertimeMinutes = 0;
        let totalWorkingHours = 0;

        // Process each day of the month
        for (let day = 1; day <= totalDays; day++) {
          const currentDate = new Date(targetYear, targetMonth - 1, day);
          const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday

          // Skip weekends (Friday = 5, Saturday = 6)
          if (dayOfWeek === 5 || dayOfWeek === 6) {
            continue;
          }

          workingDays++;

          // Check if it's a holiday
          const isHoliday = holidays.some(holiday => {
            const holidayStart = new Date(holiday.startDate);
            const holidayEnd = new Date(holiday.endDate);
            holidayStart.setHours(0, 0, 0, 0);
            holidayEnd.setHours(23, 59, 59, 999);
            return currentDate >= holidayStart && currentDate <= holidayEnd;
          });

          if (isHoliday) {
            holidayDays++;
            continue;
          }

          // Check if on leave
          const isOnLeave = leaves.some(leave => {
            const leaveStart = new Date(leave.startDate);
            const leaveEnd = new Date(leave.endDate);
            leaveStart.setHours(0, 0, 0, 0);
            leaveEnd.setHours(23, 59, 59, 999);
            return currentDate >= leaveStart && currentDate <= leaveEnd;
          });

          if (isOnLeave) {
            leaveDays++;
            continue;
          }

          // Check attendance
          const attendance = attendances.find(att => {
            const attDate = new Date(att.date);
            return (
              attDate.getDate() === day &&
              attDate.getMonth() === targetMonth - 1 &&
              attDate.getFullYear() === targetYear
            );
          });

          if (attendance && attendance.checkInTime && attendance.checkOutTime) {
            presentDays++;
            
            // Calculate working hours
            const checkIn = convertToTimezone(attendance.checkInTime);
            const checkOut = convertToTimezone(attendance.checkOutTime);
            
            // Calculate total working minutes
            const workingMinutes = Math.floor((checkOut - checkIn) / (1000 * 60));
            totalWorkingHours += workingMinutes;

            // Calculate overtime (if checkout at 6 PM or later)
            // Normal working hours: 9 AM to 5 PM (8 hours)
            // Overtime = hours worked after 5 PM (normal end time)
            // Example: Checkout at 6 PM = 1 hour overtime, 7 PM = 2 hours, 8 PM = 3 hours
            const normalEndTime = new Date(checkIn);
            normalEndTime.setHours(17, 0, 0, 0); // 5 PM = 17:00 (normal end time)
            
            const overtimeThreshold = new Date(checkIn);
            overtimeThreshold.setHours(18, 0, 0, 0); // 6 PM = 18:00 (minimum for overtime)

            // Only count overtime if checkout is at 6 PM or later
            if (checkOut >= overtimeThreshold) {
              // Calculate overtime from 5 PM (normal end) to actual checkout time
              // This gives us the total extra hours worked
              const overtimeMs = checkOut - normalEndTime;
              const overtimeMinutes = Math.floor(overtimeMs / (1000 * 60));
              totalOvertimeMinutes += overtimeMinutes;
            }
          } else if (attendance && attendance.checkInTime && !attendance.checkOutTime) {
            // Checked in but not checked out yet
            presentDays++;
            const checkIn = convertToTimezone(attendance.checkInTime);
            // Convert current time to same timezone
            const now = convertToTimezone(new Date());
            const workingMinutes = Math.floor((now - checkIn) / (1000 * 60));
            totalWorkingHours += workingMinutes;
            
            // Calculate potential overtime if current time is after 6 PM
            const normalEndTime = new Date(checkIn);
            normalEndTime.setHours(17, 0, 0, 0); // 5 PM = 17:00 (normal end)
            
            const overtimeThreshold = new Date(checkIn);
            overtimeThreshold.setHours(18, 0, 0, 0); // 6 PM = 18:00 (overtime starts)
            
            // Only count overtime if current time is at 6 PM or later
            if (now >= overtimeThreshold) {
              // Overtime = from 5 PM to current time
              const overtimeMs = now - normalEndTime;
              const overtimeMinutes = Math.floor(overtimeMs / (1000 * 60));
              totalOvertimeMinutes += overtimeMinutes;
            }
          } else {
            absentDays++;
          }
        }

        // Convert minutes to hours
        totalOvertimeHours = totalOvertimeMinutes / 60;
        const totalWorkingHoursDecimal = totalWorkingHours / 60;

        // Calculate salary - SIMPLIFIED FOR DAILY CALCULATION (for customer demo)
        const baseSalary = employee.baseSalary || 0;
        
        // For demo: Calculate daily salary from monthly salary
        // Assuming 22 working days per month (standard)
        const dailySalary = baseSalary / 22;
        const hourlySalary = dailySalary / 8; // 8 hours per day (9 AM to 5 PM)

        // Base salary calculation - SIMPLIFIED:
        // For each day the employee worked, they get the daily salary
        // Example: If monthly salary is 40 JOD, daily = 40/22 = 1.82 JOD
        // If employee worked 1 day = 1.82 JOD
        const paidDays = presentDays + leaveDays + holidayDays;
        const baseSalaryAmount = (dailySalary * paidDays);

        // Overtime calculation:
        // If employee left at 6 PM or later, calculate overtime from 5 PM
        // Example: Left at 6 PM = 1 hour overtime, 7 PM = 2 hours, 8 PM = 3 hours
        const overtimeRate = employee.overtimeRate || 1.5;
        const overtimeSalary = totalOvertimeHours * hourlySalary * overtimeRate;

        // Total salary = Daily salary for worked days + Overtime
        const totalSalary = baseSalaryAmount + overtimeSalary;

        const salaryData = {
          employee: {
            _id: employee._id,
            fullName: employee.fullName,
            employeeNumber: employee.employeeNumber,
            email: employee.email,
            department: employee.department,
            position: employee.position,
            baseSalary: baseSalary,
            overtimeRate: overtimeRate
          },
          period: {
            year: targetYear,
            month: targetMonth,
            monthName: new Date(targetYear, targetMonth - 1).toLocaleDateString('ar-JO', { month: 'long' })
          },
          attendance: {
            totalDays: totalDays,
            workingDays: workingDays,
            presentDays: presentDays,
            absentDays: absentDays,
            leaveDays: leaveDays,
            holidayDays: holidayDays
          },
          hours: {
            totalWorkingHours: parseFloat(totalWorkingHoursDecimal.toFixed(2)),
            overtimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
            regularHours: parseFloat(Math.max(0, totalWorkingHoursDecimal - totalOvertimeHours).toFixed(2))
          },
          salary: {
            dailySalary: parseFloat(dailySalary.toFixed(2)),
            hourlySalary: parseFloat(hourlySalary.toFixed(2)),
            baseSalaryAmount: parseFloat(baseSalaryAmount.toFixed(2)),
            overtimeSalary: parseFloat(overtimeSalary.toFixed(2)),
            totalSalary: parseFloat(totalSalary.toFixed(2))
          },
          breakdown: {
            presentDaysSalary: parseFloat((dailySalary * presentDays).toFixed(2)),
            leaveDaysSalary: parseFloat((dailySalary * leaveDays).toFixed(2)),
            holidayDaysSalary: parseFloat((dailySalary * holidayDays).toFixed(2)),
            absentDaysDeduction: parseFloat((dailySalary * absentDays).toFixed(2)),
            paidDays: paidDays,
            overtimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
            overtimeRate: overtimeRate,
            overtimeAmount: parseFloat(overtimeSalary.toFixed(2))
          }
        };

        // Save or update salary record in database
        await Salary.findOneAndUpdate(
          {
            user: employee._id,
            year: targetYear,
            month: targetMonth
          },
          {
            user: employee._id,
            year: targetYear,
            month: targetMonth,
            attendance: salaryData.attendance,
            hours: salaryData.hours,
            salary: {
              baseSalary: baseSalary,
              dailySalary: salaryData.salary.dailySalary,
              hourlySalary: salaryData.salary.hourlySalary,
              baseSalaryAmount: salaryData.salary.baseSalaryAmount,
              overtimeSalary: salaryData.salary.overtimeSalary,
              totalSalary: salaryData.salary.totalSalary
            },
            breakdown: salaryData.breakdown,
            status: 'calculated'
          },
          {
            upsert: true,
            new: true
          }
        );

        return salaryData;
      })
    );

    res.status(200).json({
      success: true,
      data: salaryData,
      message: 'تم حساب الرواتب بنجاح'
    });
  } catch (error) {
    console.error('Error calculating salary:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حساب الرواتب',
      error: error.message
    });
  }
};

/**
 * Get all employees with their salary information
 */
export const getAllEmployeesSalaries = async (req, res) => {
  try {
    const { role } = req.user;

    if (!['admin', 'hr', 'manager'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول إلى هذه البيانات'
      });
    }

    // Fetch all employees except admin users
    const employees = await User.find({ role: { $ne: 'admin' }, isActive: true })
      .select('fullName employeeNumber email department position baseSalary overtimeRate profileImage role')
      .sort({ fullName: 1 });

    console.log(`✅ getAllEmployeesSalaries: Found ${employees.length} employees (excluding admin users)`);

    res.status(200).json({
      success: true,
      data: employees,
      message: 'تم جلب بيانات الموظفين بنجاح'
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات الموظفين',
      error: error.message
    });
  }
};

/**
 * Update employee salary
 */
export const updateEmployeeSalary = async (req, res) => {
  try {
    const { role } = req.user;
    const { userId } = req.params;
    const { baseSalary, overtimeRate } = req.body;

    if (!['admin', 'hr'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل الرواتب'
      });
    }

    if (baseSalary !== undefined && (isNaN(baseSalary) || baseSalary < 0)) {
      return res.status(400).json({
        success: false,
        message: 'الراتب الأساسي يجب أن يكون رقماً موجباً'
      });
    }

    if (overtimeRate !== undefined && (isNaN(overtimeRate) || overtimeRate < 1)) {
      return res.status(400).json({
        success: false,
        message: 'معدل العمل الإضافي يجب أن يكون 1 أو أكثر'
      });
    }

    const employee = await User.findById(userId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    if (baseSalary !== undefined) {
      employee.baseSalary = baseSalary;
    }
    if (overtimeRate !== undefined) {
      employee.overtimeRate = overtimeRate;
    }

    await employee.save();

    res.status(200).json({
      success: true,
      data: employee,
      message: 'تم تحديث الراتب بنجاح'
    });
  } catch (error) {
    console.error('Error updating salary:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الراتب',
      error: error.message
    });
  }
};

/**
 * Get saved salary records
 */
export const getSavedSalaries = async (req, res) => {
  try {
    const { role } = req.user;
    const { year, month, userId, status } = req.query;

    if (!['admin', 'hr', 'manager'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول إلى هذه البيانات'
      });
    }

    // Build query
    const query = {};
    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);
    if (userId) query.user = userId;
    if (status) query.status = status;

    const salaries = await Salary.find(query)
      .populate('user', 'fullName employeeNumber email department position profileImage')
      .populate('paidBy', 'fullName employeeNumber')
      .sort({ year: -1, month: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: salaries,
      message: 'تم جلب الرواتب المحفوظة بنجاح'
    });
  } catch (error) {
    console.error('Error fetching saved salaries:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الرواتب المحفوظة',
      error: error.message
    });
  }
};

/**
 * Update salary status (approve, mark as paid, etc.)
 */
export const updateSalaryStatus = async (req, res) => {
  try {
    const { role } = req.user;
    const { salaryId } = req.params;
    const { status, notes } = req.body;

    if (!['admin', 'hr'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل حالة الراتب'
      });
    }

    if (!['calculated', 'approved', 'paid'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة'
      });
    }

    const updateData = { status };
    if (notes) updateData.notes = notes;

    // If marking as paid, add payment info
    if (status === 'paid') {
      updateData.paidAt = new Date();
      updateData.paidBy = req.user._id;
    }

    const salary = await Salary.findByIdAndUpdate(
      salaryId,
      updateData,
      { new: true }
    ).populate('user', 'fullName employeeNumber email')
     .populate('paidBy', 'fullName employeeNumber');

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'الراتب غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      data: salary,
      message: 'تم تحديث حالة الراتب بنجاح'
    });
  } catch (error) {
    console.error('Error updating salary status:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث حالة الراتب',
      error: error.message
    });
  }
};

