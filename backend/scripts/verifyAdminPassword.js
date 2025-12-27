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

const verifyAdminPassword = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO environment variable is not set!');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');

    // Find admin user by email (lowercase)
    const admin = await User.findOne({ 
      $or: [
        { email: 'yazan' },
        { email: 'Yazan' },
        { employeeNumber: 'admin' },
        { role: 'admin' }
      ]
    });

    if (!admin) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }

    console.log('✅ Admin user found:');
    console.log('   Email:', admin.email);
    console.log('   Employee Number:', admin.employeeNumber);
    console.log('   Role:', admin.role);

    // Test password
    const testPassword = 'Yazan$2004';
    const isPasswordCorrect = await bcrypt.compare(testPassword, admin.password);
    
    console.log('\n🔐 Password test:');
    console.log('   Testing password:', testPassword);
    console.log('   Password match:', isPasswordCorrect ? '✅ YES' : '❌ NO');

    if (!isPasswordCorrect) {
      console.log('\n⚠️  Password does not match. Updating password...');
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      // Use updateOne to bypass the pre-save hook that hashes passwords
      await User.updateOne(
        { _id: admin._id },
        { $set: { password: hashedPassword } }
      );
      console.log('✅ Password updated successfully!');
    }

    // Reload admin to get fresh data after potential update
    const updatedAdmin = await User.findById(admin._id);
    const verifyAgain = await bcrypt.compare(testPassword, updatedAdmin.password);
    console.log('\n🔍 Verification:');
    console.log('   Password match after update:', verifyAgain ? '✅ YES' : '❌ NO');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ MongoDB Disconnected');
  }
};

verifyAdminPassword();

