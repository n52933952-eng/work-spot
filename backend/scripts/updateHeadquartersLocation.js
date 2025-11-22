import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Location from '../modles/Location.js';

dotenv.config();

// Correct University of Jordan coordinates
// From Google Maps: 32°00'51.1"N 35°52'22.9"E
const UNIVERSITY_OF_JORDAN = {
  name: 'المقر الرئيسي',
  nameAr: 'المقر الرئيسي - الجامعة الأردنية',
  address: 'University of Jordan, Queen Rania St., Amman, Jordan',
  latitude: 32.014206,
  longitude: 35.873015,
  radius: 100, // 100 meters
  type: 'main',
  description: 'المقر الرئيسي للشركة - الجامعة الأردنية، عمان'
};

const updateHeadquartersLocation = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO);
    console.log('MongoDB Connected');

    // Find existing main location
    const existingLocation = await Location.findOne({
      type: 'main',
      isActive: true
    });

    if (existingLocation) {
      // Update existing location
      existingLocation.name = UNIVERSITY_OF_JORDAN.name;
      existingLocation.nameAr = UNIVERSITY_OF_JORDAN.nameAr;
      existingLocation.address = UNIVERSITY_OF_JORDAN.address;
      existingLocation.latitude = UNIVERSITY_OF_JORDAN.latitude;
      existingLocation.longitude = UNIVERSITY_OF_JORDAN.longitude;
      existingLocation.radius = UNIVERSITY_OF_JORDAN.radius;
      existingLocation.description = UNIVERSITY_OF_JORDAN.description;

      await existingLocation.save();

      console.log('✓ Headquarters location updated successfully!');
      console.log('- Name:', existingLocation.nameAr);
      console.log('- Address:', existingLocation.address);
      console.log('- Coordinates:', existingLocation.latitude, existingLocation.longitude);
      console.log('- Radius:', existingLocation.radius, 'meters');
    } else {
      console.log('No existing main location found. Please run createDefaultLocation.js first.');
    }
  } catch (error) {
    console.error('Error updating headquarters location:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
};

updateHeadquartersLocation();

