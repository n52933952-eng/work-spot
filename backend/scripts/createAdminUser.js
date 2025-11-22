import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../modles/User.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend root directory
dotenv.config({ path: join(__dirname, '..', '.env') });

const createAdminUser = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO environment variable is not set!');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      $or: [
        { email: 'admin@admin.com' },
        { employeeNumber: 'ADMIN001' },
        { role: 'admin' }
      ]
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:');
      console.log('   Email:', existingAdmin.email);
      console.log('   Employee Number:', existingAdmin.employeeNumber);
      console.log('   Role:', existingAdmin.role);
      return;
    }

    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin', 10);
    
    const adminUser = await User.create({
      employeeNumber: 'ADMIN001',
      email: 'admin@admin.com',
      password: hashedPassword,
      fullName: 'System Administrator',
      role: 'admin',
      department: 'IT',
      position: 'Administrator',
      isActive: true,
      expectedCheckInTime: '09:00',
      expectedCheckOutTime: '17:00'
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Email: admin@admin.com');
    console.log('   Employee Number: ADMIN001');
    console.log('   Password: admin');
    console.log('   Role: admin');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
};

createAdminUser();

