import Announcement from '../modles/Announcement.js';
import User from '../modles/User.js';
import { io } from '../socket/socket.js';

// Create announcement
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, type, targetAudience, departments, roles, specificUsers, expiresAt, attachments } = req.body;

    if (!title || !content) {
      return res.status(400).json({ 
        message: 'الرجاء إدخال العنوان والمحتوى' 
      });
    }

    // Only admin/hr/manager can create
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const normalizedSpecificUsers = Array.isArray(specificUsers)
      ? specificUsers.filter(Boolean)
      : specificUsers
      ? [specificUsers]
      : [];

    if (targetAudience === 'specific' && normalizedSpecificUsers.length === 0) {
      return res.status(400).json({
        message: 'الرجاء اختيار المستخدمين المستهدفين',
      });
    }

    const announcement = await Announcement.create({
      title,
      content,
      type: type || 'general',
      targetAudience: targetAudience || 'all',
      departments: departments || [],
      roles: roles || [],
      specificUsers: targetAudience === 'specific' ? normalizedSpecificUsers : [],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      attachments: attachments || [],
      createdBy: req.user._id
    });

    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('createdBy', 'fullName employeeNumber')
      .populate('specificUsers', 'fullName employeeNumber');

    if (io && populatedAnnouncement) {
      const targetUsers = [];

      if (populatedAnnouncement.targetAudience === 'specific' && populatedAnnouncement.specificUsers?.length) {
        populatedAnnouncement.specificUsers.forEach(user => {
          const userId = typeof user === 'string' ? user : user?._id?.toString();
          if (userId) {
            targetUsers.push(userId);
            io.to(userId).emit('announcementCreated', populatedAnnouncement);
          }
        });
      } else {
        io.emit('announcementCreated', populatedAnnouncement);
      }
    }

    res.status(201).json({
      message: 'تم إنشاء الإعلان بنجاح',
      announcement: populatedAnnouncement
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء الإعلان',
      error: error.message 
    });
  }
};

// Get announcements for user
export const getMyAnnouncements = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const userId = req.user._id;
    const user = await User.findById(userId);

    const expirationFilter = {
      $or: [
        { expiresAt: null },
        { expiresAt: { $gte: new Date() } },
      ],
    };

    const audienceConditions = [
      { targetAudience: 'all' },
      { specificUsers: userId },
    ];

    if (user?.department) {
      audienceConditions.push({ departments: user.department });
    }

    if (user?.role) {
      audienceConditions.push({ roles: user.role });
    }

    const query = {
      isActive: isActive !== 'false',
      $and: [
        expirationFilter,
        { $or: audienceConditions },
      ],
    };

    if (type) {
      query.type = type;
    }

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'fullName employeeNumber')
      .populate('specificUsers', 'fullName employeeNumber')
      .sort({ createdAt: -1 });

    // Mark as read
    for (const announcement of announcements) {
      const alreadyRead = announcement.readBy.some(
        r => r.user.toString() === userId.toString()
      );
      
      if (!alreadyRead) {
        announcement.readBy.push({
          user: userId,
          readAt: new Date()
        });
        await announcement.save();
      }
    }

    res.status(200).json({ announcements });
  } catch (error) {
    console.error('Get my announcements error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get all announcements (for admin)
export const getAllAnnouncements = async (req, res) => {
  try {
    // Only admin/hr/manager can access
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const { type, isActive, targetAudience } = req.query;
    
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (targetAudience) query.targetAudience = targetAudience;

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'fullName employeeNumber')
      .populate('specificUsers', 'fullName employeeNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ announcements });
  } catch (error) {
    console.error('Get all announcements error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Get single announcement
export const getAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'fullName employeeNumber')
      .populate('specificUsers', 'fullName employeeNumber');

    if (!announcement) {
      return res.status(404).json({ message: 'الإعلان غير موجود' });
    }

    // Mark as read if not already
    const userId = req.user._id;
    const alreadyRead = announcement.readBy.some(
      r => r.user.toString() === userId.toString()
    );
    
    if (!alreadyRead) {
      announcement.readBy.push({
        user: userId,
        readAt: new Date()
      });
      await announcement.save();
    }

    res.status(200).json({ announcement });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Update announcement
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admin/hr/manager can update
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const { title, content, type, targetAudience, departments, roles, specificUsers, expiresAt, isActive, attachments } = req.body;

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({ message: 'الإعلان غير موجود' });
    }

    // Update fields
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (targetAudience) announcement.targetAudience = targetAudience;
    if (departments !== undefined) announcement.departments = departments;
    if (roles !== undefined) announcement.roles = roles;
    if (specificUsers !== undefined) announcement.specificUsers = specificUsers;
    if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) announcement.isActive = isActive;
    if (attachments !== undefined) announcement.attachments = attachments;

    await announcement.save();

    res.status(200).json({
      message: 'تم تحديث الإعلان بنجاح',
      announcement: await Announcement.findById(id)
        .populate('createdBy', 'fullName employeeNumber')
        .populate('specificUsers', 'fullName employeeNumber')
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تحديث الإعلان',
      error: error.message 
    });
  }
};

// Delete announcement
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admin/hr/manager can delete
    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'غير مصرح لك' });
    }

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({ message: 'الإعلان غير موجود' });
    }

    await Announcement.findByIdAndDelete(id);

    res.status(200).json({ message: 'تم حذف الإعلان بنجاح' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء حذف الإعلان',
      error: error.message 
    });
  }
};













