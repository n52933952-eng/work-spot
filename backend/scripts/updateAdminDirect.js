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

const updateAdminDirect = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO environment variable is not set!');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected\n');

    // Update the specific admin user by _id
    const adminId = '69503a8b6a06dc5c2c54f5f2';
    const newEmail = 'yazen'; // lowercase
    const newPassword = 'Yazan$2004';
    
    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update using updateOne to bypass pre-save hook
    const result = await User.updateOne(
      { _id: adminId },
      {
        $set: {
          email: newEmail,
          password: hashedPassword,
          fullName: 'System Administrator',
          role: 'admin',
          department: 'IT',
          position: 'Administrator',
          isActive: true,
          approvalStatus: 'approved'
        }
      }
    );
    
    console.log('📝 Update result:', result);
    
    if (result.matchedCount === 0) {
      console.log('❌ User not found with _id:', adminId);
    } else if (result.modifiedCount === 0) {
      console.log('⚠️ User found but no changes were made');
    } else {
      console.log('✅ User updated successfully!');
    }
    
    // Verify the update
    const updatedUser = await User.findById(adminId);
    if (updatedUser) {
      console.log('\n✅ Verification:');
      console.log('   Email:', updatedUser.email);
      console.log('   Employee Number:', updatedUser.employeeNumber);
      console.log('   Role:', updatedUser.role);
      
      // Test password
      const isPasswordCorrect = await bcrypt.compare(newPassword, updatedUser.password);
      console.log('   Password match:', isPasswordCorrect ? '✅ YES' : '❌ NO');
      
      console.log('\n📝 Login credentials:');
      console.log('   Username/Email: Yazen (or yazen)');
      console.log('   Password: Yazan$2004');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ MongoDB Disconnected');
  }
};

updateAdminDirect();

