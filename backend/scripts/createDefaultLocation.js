import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Location from '../modles/Location.js';
import User from '../modles/User.js';

dotenv.config();

// Company location coordinates - University of Jordan
// Coordinates from Google Maps: 32°00'51.1"N 35°52'22.9"E
// Decimal: 32.014206, 35.873015
const COMPANY_LOCATION = {
  name: 'المقر الرئيسي',
  nameAr: 'المقر الرئيسي - الجامعة الأردنية',
  address: 'University of Jordan, Queen Rania St., Amman, Jordan',
  latitude: 32.014206, // University of Jordan
  longitude: 35.873015, // University of Jordan
  radius: 100, // 100 meters
  type: 'main',
  description: 'المقر الرئيسي للشركة - الجامعة الأردنية، عمان'
};

const createDefaultLocation = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO);
    console.log('MongoDB Connected');

    // Check if default location already exists
    const existingLocation = await Location.findOne({
      type: 'main',
      isActive: true
    });

    if (existingLocation) {
      console.log('Default location already exists:', existingLocation.name);
      return;
    }

    // Find first admin user to assign as creator
    const adminUser = await User.findOne({
      role: { $in: ['admin', 'manager'] },
      isActive: true
    });

    if (!adminUser) {
      console.log('Warning: No admin user found. Creating location without creator.');
    }

    // Create default location
    const location = await Location.create({
      ...COMPANY_LOCATION,
      createdBy: adminUser?._id || null,
      isActive: true
    });

    console.log('Default location created successfully:');
    console.log('- Name:', location.name);
    console.log('- Address:', location.address);
    console.log('- Coordinates:', location.latitude, location.longitude);
    console.log('- Radius:', location.radius, 'meters');
    console.log('- Location ID:', location._id);

    // Optionally, assign this location to all existing employees
    const employees = await User.find({
      role: 'employee',
      branch: null
    });

    if (employees.length > 0) {
      await User.updateMany(
        { role: 'employee', branch: null },
        { branch: location._id }
      );
      console.log(`- Assigned to ${employees.length} employees`);
    }

    console.log('\n✓ Default location setup completed!');
  } catch (error) {
    console.error('Error creating default location:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
};

createDefaultLocation();




