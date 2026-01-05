import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../modles/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
dotenv.config({ path: join(__dirname, '..', '..', '.env') });
dotenv.config({ path: join(__dirname, '..', '.env') });
dotenv.config();

const fixAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO environment variable is not set!');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected\n');

    // Delete ALL existing admin users
    const deleteResult = await User.deleteMany({
      $or: [
        { employeeNumber: 'admin' },
        { role: 'admin' }
      ]
    });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing admin user(s)\n`);

    // Create new admin with correct credentials
    const email = 'yazen'; // lowercase
    const password = 'Yazan$2004';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Use insertOne to bypass pre-save hook
    const adminUser = await User.create({
      employeeNumber: 'admin',
      email: email,
      password: password, // Will be hashed by pre-save hook (this is fine)
      fullName: 'System Administrator',
      role: 'admin',
      department: 'IT',
      position: 'Administrator',
      expectedCheckInTime: '09:00',
      expectedCheckOutTime: '17:00',
      isActive: true,
      approvalStatus: 'approved'
    });

    console.log('✅ Admin user created successfully!');
    console.log('   _id:', adminUser._id);
    console.log('   Email:', adminUser.email);
    console.log('   Employee Number:', adminUser.employeeNumber);
    console.log('   Role:', adminUser.role);
    console.log('   isActive:', adminUser.isActive);
    console.log('   approvalStatus:', adminUser.approvalStatus);
    
    // Verify password
    const isPasswordCorrect = await adminUser.comparePassword(password);
    console.log('   Password verified:', isPasswordCorrect ? '✅ YES' : '❌ NO');
    
    console.log('\n📝 Login credentials:');
    console.log('   Username/Email: Yazen (or yazen)');
    console.log('   Password: Yazan$2004');
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.code === 11000) {
      console.error('   Duplicate key error - user might already exist');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ MongoDB Disconnected');
  }
};

fixAdmin();

