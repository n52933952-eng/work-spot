import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../modles/User.js';
import Attendance from '../modles/Attendance.js';
import Location from '../modles/Location.js';
import {
  calculateWorkingHours,
  calculateOvertime,
  getAttendanceStatus,
  calculateLateMinutes
} from '../utils/attendanceCalculation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (go up 2 levels: scripts -> backend -> root)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });
// Also try backend/.env as fallback
if (!process.env.MONGO) {
  dotenv.config({ path: join(__dirname, '..', '.env') });
}

const addTestAttendance = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO environment variable is not set!');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');

    // Find employee "Mu" (case insensitive search)
    const employee = await User.findOne({
      $or: [
        { fullName: /^Mu/i },
        { employeeNumber: /^5$/ },
        { email: /mu/i }
      ],
      role: 'employee'
    });

    if (!employee) {
      console.log('❌ Employee "Mu" not found!');
      console.log('   Searching for employees with "mu" in name...');
      const allEmployees = await User.find({ role: 'employee' }).select('fullName employeeNumber email');
      console.log('   Available employees:');
      allEmployees.forEach(emp => {
        console.log(`   - ${emp.fullName} (${emp.employeeNumber}) - ${emp.email}`);
      });
      await mongoose.disconnect();
      return;
    }

    console.log('✅ Found employee:', employee.fullName, `(${employee.employeeNumber})`);

    // Get default location (headquarters)
    const defaultLocation = await Location.findOne({ type: 'headquarters', isActive: true });
    if (!defaultLocation) {
      console.log('⚠️ No default location found, using coordinates (0, 0)');
    }

    // Set date to today (or you can specify a date)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    // Check if attendance already exists for today
    const existingAttendance = await Attendance.findOne({
      user: employee._id,
      date: {
        $gte: new Date(today),
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingAttendance) {
      console.log('⚠️ Attendance record already exists for today!');
      console.log('   Deleting existing record...');
      await Attendance.deleteOne({ _id: existingAttendance._id });
    }

    // Set check-in time: 9:00 AM today
    const checkInTime = new Date(today);
    checkInTime.setHours(9, 0, 0, 0); // 9:00 AM

    // Set check-out time: 8:00 PM today (for testing overtime)
    const checkOutTime = new Date(today);
    checkOutTime.setHours(20, 0, 0, 0); // 8:00 PM

    // Calculate working hours and overtime
    const workingMinutes = calculateWorkingHours(checkInTime, checkOutTime);
    const lateMinutes = calculateLateMinutes(checkInTime, employee.expectedCheckInTime || '09:00');
    const status = getAttendanceStatus(checkInTime, employee.expectedCheckInTime || '09:00', 0);
    
    // Calculate overtime correctly: from 5 PM (normal end) to checkout time
    // Only if checkout is at 6 PM or later
    const normalEndTime = new Date(checkInTime);
    normalEndTime.setHours(17, 0, 0, 0); // 5 PM = 17:00
    
    const overtimeThreshold = new Date(checkInTime);
    overtimeThreshold.setHours(18, 0, 0, 0); // 6 PM = 18:00
    
    let overtimeMinutes = 0;
    if (checkOutTime >= overtimeThreshold) {
      // Overtime = from 5 PM to checkout time
      const overtimeMs = checkOutTime - normalEndTime;
      overtimeMinutes = Math.floor(overtimeMs / (1000 * 60));
    }

    // Create attendance record
    const attendance = await Attendance.create({
      user: employee._id,
      date: today,
      checkInTime: checkInTime,
      checkOutTime: checkOutTime,
      checkInLocation: {
        latitude: defaultLocation?.latitude || 31.9539,
        longitude: defaultLocation?.longitude || 35.9106,
        address: defaultLocation?.name || 'Default Location'
      },
      checkOutLocation: {
        latitude: defaultLocation?.latitude || 31.9539,
        longitude: defaultLocation?.longitude || 35.9106,
        address: defaultLocation?.name || 'Default Location'
      },
      status: status,
      workingHours: workingMinutes,
      overtime: overtimeMinutes,
      lateMinutes: lateMinutes,
      faceIdVerified: true,
      notes: 'Test attendance record - will be removed after testing'
    });

    console.log('✅ Test attendance record created successfully!');
    console.log('   Employee:', employee.fullName);
    console.log('   Date:', today.toLocaleDateString('ar-JO'));
    console.log('   Check-in:', checkInTime.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }));
    console.log('   Check-out:', checkOutTime.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }));
    console.log('   Working hours:', (workingMinutes / 60).toFixed(2), 'hours');
    console.log('   Overtime:', (overtimeMinutes / 60).toFixed(2), 'hours');
    console.log('   Status:', status);
    console.log('');
    console.log('📝 Note: This is a test record. You can delete it later from the database.');
    console.log('   Attendance ID:', attendance._id);

  } catch (error) {
    console.error('❌ Error creating test attendance:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB Disconnected');
  }
};

addTestAttendance();

