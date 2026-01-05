import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../modles/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env - try multiple locations
// Try root directory first (where .env usually is)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });
// Also try backend directory
dotenv.config({ path: join(__dirname, '..', '.env') });
// Try current directory as fallback
dotenv.config();

const createCustomAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO environment variable is not set!');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');

    // Custom admin credentials
    // Note: Email will be stored in lowercase due to User model schema (lowercase: true)
    const adminData = {
      employeeNumber: 'admin',
      email: 'Yazen', // Admin login email (stored in lowercase as 'yazen')
      password: 'Yazan$2004', // Admin password
      fullName: 'System Administrator',
      role: 'admin',
      department: 'IT',
      position: 'Administrator',
      expectedCheckInTime: '09:00',
      expectedCheckOutTime: '17:00',
      isActive: true,
      approvalStatus: 'approved'
    };

    // Check if admin already exists (case-insensitive email search)
    // Look for admin by employeeNumber 'admin' OR any admin role user OR email 'yazan'/'Yazen'
    const existingAdmin = await User.findOne({
      $or: [
        { employeeNumber: 'admin' },
        { email: 'yazan' },
        { email: 'Yazen' },
        { email: adminData.email.toLowerCase() },
        { role: 'admin', email: { $exists: true } }
      ]
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:');
      console.log('   Email:', existingAdmin.email);
      console.log('   Employee Number:', existingAdmin.employeeNumber);
      console.log('   Role:', existingAdmin.role);
      
      // Update existing admin with new password and email
      // Use updateOne to bypass pre-save hook (password is already hashed)
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      
      await User.updateOne(
        { _id: existingAdmin._id },
        {
          $set: {
            password: hashedPassword, // Already hashed, so bypass pre-save hook
            email: adminData.email.toLowerCase(), // Ensure lowercase: "Yazen" -> "yazen"
            fullName: adminData.fullName,
            role: 'admin',
            department: adminData.department,
            position: adminData.position,
            isActive: true,
            approvalStatus: 'approved'
          }
        }
      );
      
      console.log('✅ Updated existing admin user with new credentials');
      console.log('   New password has been set');
      console.log('   New email:', adminData.email.toLowerCase());
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    // Create admin user
    const adminUser = await User.create({
      ...adminData,
      password: hashedPassword
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Email (Login):', adminUser.email);
    console.log('   Password:', adminData.password);
    console.log('   Employee Number:', adminUser.employeeNumber);
    console.log('   Role: admin');
    console.log('   Full Name:', adminUser.fullName);
    console.log('\n📝 Login credentials:');
    console.log('   Username/Email: Yazen');
    console.log('   Password: Yazan$2004');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB Disconnected');
  }
};

createCustomAdmin();

