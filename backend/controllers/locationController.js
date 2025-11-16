import Location from '../modles/Location.js';
import User from '../modles/User.js';

// Create location
export const createLocation = async (req, res) => {
  try {
    const { name, address, latitude, longitude, radius, type, description, startDate, endDate } = req.body;

    if (!name || !address || !latitude || !longitude || !radius) {
      return res.status(400).json({ 
        message: 'الرجاء إدخال جميع الحقول المطلوبة' 
      });
    }

    // Validate type-specific requirements
    if ((type === 'temporary' || type === 'field') && (!startDate || !endDate)) {
      return res.status(400).json({ 
        message: 'الرجاء تحديد تاريخ البدء والانتهاء للمواقع المؤقتة' 
      });
    }

    const location = await Location.create({
      name,
      address,
      latitude,
      longitude,
      radius,
      type: type || 'main',
      description,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      createdBy: req.user._id
    });

    res.status(201).json({
      message: 'تم إنشاء الموقع بنجاح',
      location
    });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء الموقع',
      error: error.message 
    });
  }
};

// Create default company location (one-time setup)
export const createDefaultLocation = async (req, res) => {
  try {
    // Only admin can create default location
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    // Check if default location already exists
    const existingLocation = await Location.findOne({
      type: 'main',
      isActive: true
    });

    if (existingLocation) {
      return res.status(400).json({ 
        message: 'الموقع الافتراضي موجود بالفعل',
        location: existingLocation 
      });
    }

    // Company location: University of Jordan, Amman
    // Coordinates: 32.041394, 35.894126 (Testing location - Amman, Jordan)
    const location = await Location.create({
      name: 'المقر الرئيسي',
      nameAr: 'المقر الرئيسي - عمان',
      address: 'Jerjes Ar-Reihan St., Amman, Jordan',
      latitude: 32.041394, // Testing location - Amman, Jordan
      longitude: 35.894126, // Testing location - Amman, Jordan
      radius: 50, // 50 meters
      type: 'main',
      description: 'الموقع الرئيسي للشركة - جامعة الأردنية، عمان',
      createdBy: req.user._id,
      isActive: true
    });

    res.status(201).json({
      message: 'تم إنشاء الموقع الافتراضي بنجاح',
      location
    });
  } catch (error) {
    console.error('Create default location error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء الموقع الافتراضي',
      error: error.message 
    });
  }
};

// Get all locations
export const getLocations = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const locations = await Location.find(query)
      .populate('createdBy', 'fullName employeeNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ locations });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get single location
export const getLocation = async (req, res) => {
  try {
    const { id } = req.params;

    const location = await Location.findById(id)
      .populate('createdBy', 'fullName employeeNumber');

    if (!location) {
      return res.status(404).json({ message: 'الموقع غير موجود' });
    }

    res.status(200).json({ location });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Update location
export const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, latitude, longitude, radius, type, description, startDate, endDate, isActive } = req.body;

    const location = await Location.findById(id);

    if (!location) {
      return res.status(404).json({ message: 'الموقع غير موجود' });
    }

    // Update fields
    if (name) location.name = name;
    if (address) location.address = address;
    if (latitude !== undefined) location.latitude = latitude;
    if (longitude !== undefined) location.longitude = longitude;
    if (radius !== undefined) location.radius = radius;
    if (type) location.type = type;
    if (description !== undefined) location.description = description;
    if (startDate) location.startDate = new Date(startDate);
    if (endDate) location.endDate = new Date(endDate);
    if (isActive !== undefined) location.isActive = isActive;

    await location.save();

    res.status(200).json({
      message: 'تم تحديث الموقع بنجاح',
      location
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تحديث الموقع',
      error: error.message 
    });
  }
};

// Delete location
export const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;

    const location = await Location.findById(id);

    if (!location) {
      return res.status(404).json({ message: 'الموقع غير موجود' });
    }

    // Check if location is assigned to any users
    const usersWithLocation = await User.countDocuments({ branch: id });
    if (usersWithLocation > 0) {
      return res.status(400).json({ 
        message: `لا يمكن حذف الموقع لأنه مرتبط بـ ${usersWithLocation} موظف` 
      });
    }

    await Location.findByIdAndDelete(id);

    res.status(200).json({ message: 'تم حذف الموقع بنجاح' });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء حذف الموقع',
      error: error.message 
    });
  }
};

// Get active locations (for check-in)
export const getActiveLocations = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const locations = await Location.find({
      isActive: true,
      $or: [
        { type: { $in: ['main', 'branch'] } },
        {
          type: { $in: ['temporary', 'field'] },
          startDate: { $lte: today },
          endDate: { $gte: today }
        }
      ]
    }).select('name address latitude longitude radius type');

    res.status(200).json({ locations });
  } catch (error) {
    console.error('Get active locations error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};
