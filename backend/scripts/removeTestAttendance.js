import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../modles/User.js';
import Attendance from '../modles/Attendance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (go up 2 levels: scripts -> backend -> root)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });
// Also try backend/.env as fallback
if (!process.env.MONGO) {
  dotenv.config({ path: join(__dirname, '..', '.env') });
}

const removeTestAttendance = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO environment variable is not set!');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');

    // Find employee "Mu"
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
      await mongoose.disconnect();
      return;
    }

    console.log('✅ Found employee:', employee.fullName);

    // Find and delete test attendance records
    const testAttendances = await Attendance.find({
      user: employee._id,
      notes: 'Test attendance record - will be removed after testing'
    });

    if (testAttendances.length === 0) {
      console.log('⚠️ No test attendance records found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`📋 Found ${testAttendances.length} test attendance record(s)`);
    
    // Delete all test records
    const result = await Attendance.deleteMany({
      user: employee._id,
      notes: 'Test attendance record - will be removed after testing'
    });

    console.log(`✅ Deleted ${result.deletedCount} test attendance record(s)`);

  } catch (error) {
    console.error('❌ Error removing test attendance:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB Disconnected');
  }
};

removeTestAttendance();

