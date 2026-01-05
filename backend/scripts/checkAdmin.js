import mongoose from 'mongoose';
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

const checkAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO environment variable is not set!');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected\n');

    // Find admin user
    const admin = await User.findOne({
      $or: [
        { employeeNumber: 'admin' },
        { role: 'admin' },
        { email: 'yazen' },
        { email: 'yazan' }
      ]
    });

    if (admin) {
      console.log('✅ Admin user found:');
      console.log('   _id:', admin._id);
      console.log('   Email:', admin.email);
      console.log('   Employee Number:', admin.employeeNumber);
      console.log('   Role:', admin.role);
      console.log('   isActive:', admin.isActive);
      console.log('   approvalStatus:', admin.approvalStatus);
      console.log('\n📝 Login test:');
      console.log('   Try logging in with:');
      console.log('   - Username/Email: Yazen (or yazen)');
      console.log('   - Password: Yazan$2004');
      
      // Test password
      const bcrypt = (await import('bcryptjs')).default;
      const testPassword = 'Yazan$2004';
      const isPasswordCorrect = await bcrypt.compare(testPassword, admin.password);
      console.log('   - Password match:', isPasswordCorrect ? '✅ YES' : '❌ NO');
    } else {
      console.log('❌ No admin user found!');
      console.log('   Run: node scripts/createCustomAdmin.js');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ MongoDB Disconnected');
  }
};

checkAdmin();

