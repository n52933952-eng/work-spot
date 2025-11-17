import User from '../modles/User.js';
import Attendance from '../modles/Attendance.js';
import GenerateToken from '../utils/GenerateToken.js';
import { extractNormalizedLandmarks, compareFaces } from '../utils/faceLandmarkSimilarity.js';

// Complete registration with biometric data
export const completeRegistration = async (req, res) => {
  try {
    const { 
      employeeNumber, 
      email, 
      password, 
      fullName, 
      department, 
      position, 
      role, 
      profileImage, // User profile image (Base64)
      branch, // Location ID
      latitude, // User's location latitude
      longitude, // User's location longitude
      fingerprintPublicKey, // Fingerprint ID
      faceImage, // Base64 image
      faceId, // Face ID (hash)
      faceFeatures, // Face features from ML Kit (contains landmarks)
      faceData, // Full face detection data from ML Kit
      biometricType 
    } = req.body;

    // Validation
    if (!employeeNumber || !email || !password || !fullName) {
      return res.status(400).json({ 
        message: 'الرجاء إدخال جميع الحقول المطلوبة' 
      });
    }

    // Biometric data is REQUIRED
    // faceImage is now optional - we only need faceId (privacy: no images stored)
    console.log('🔍 Backend completeRegistration - Checking biometric data...');
    console.log('fingerprintPublicKey:', fingerprintPublicKey ? 'exists' : 'null/undefined');
    console.log('faceId:', faceId ? 'exists' : 'null/undefined');
    console.log('fingerprintPublicKey type:', typeof fingerprintPublicKey);
    console.log('faceId type:', typeof faceId);
    console.log('fingerprintPublicKey length:', fingerprintPublicKey?.length);
    console.log('faceId length:', faceId?.length);
    
    if (!fingerprintPublicKey || !faceId) {
      console.log('❌ Validation failed - missing biometric data');
      return res.status(400).json({ 
        message: 'يجب إكمال إعداد Fingerprint و Face Recognition' 
      });
    }
    
    console.log('✅ Biometric data validation passed');

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { employeeNumber }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'البريد الإلكتروني أو رقم الموظف موجود مسبقاً' 
      });
    }

    // Generate faceId function (same as frontend)
    const generateFaceId = (base64Image) => {
      const sample1 = base64Image.substring(0, 100);
      const sample2 = base64Image.substring(Math.floor(base64Image.length / 2), Math.floor(base64Image.length / 2) + 100);
      const sample3 = base64Image.substring(Math.max(0, base64Image.length - 100));
      const combined = sample1 + sample2 + sample3;
      const hash = combined.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0);
      return Math.abs(hash).toString(16);
    };

    // Generate faceId from faceImage (use provided faceId or generate from image)
    const newFaceId = faceId || generateFaceId(faceImage);
    
    // Extract normalized landmarks from face data for similarity matching
    // This is the CORRECT way to detect duplicate faces (landmark-based, not hash-based)
    let normalizedLandmarks = null;
    try {
      // Try to extract landmarks from faceData (full ML Kit detection result)
      if (faceData && (Array.isArray(faceData) ? faceData[0] : faceData)) {
        const face = Array.isArray(faceData) ? faceData[0] : faceData;
        normalizedLandmarks = extractNormalizedLandmarks(face);
      }
      // Fallback: try faceFeatures
      else if (faceFeatures && faceFeatures.landmarks) {
        normalizedLandmarks = extractNormalizedLandmarks({
          landmarks: faceFeatures.landmarks,
          frame: faceFeatures.frame,
          headEulerAngleX: faceFeatures.headEulerAngleX,
          headEulerAngleY: faceFeatures.headEulerAngleY,
          headEulerAngleZ: faceFeatures.headEulerAngleZ,
        });
      }
      
      if (normalizedLandmarks) {
        console.log('✅ Extracted normalized landmarks for duplicate checking');
      } else {
        console.log('⚠️ Could not extract landmarks - will use hash-based check as fallback');
      }
    } catch (error) {
      console.error('Error extracting landmarks:', error);
    }
    
    // SECURITY CHECK 1: Check for duplicate fingerprint FIRST (device-specific check)
    // This is faster and catches device-level duplicates immediately
    const existingFingerprintUser = await User.findOne({ fingerprintData: fingerprintPublicKey });
    
    if (existingFingerprintUser) {
      console.log('⚠️ Duplicate fingerprintPublicKey detected!');
      console.log(`   Existing user: ${existingFingerprintUser.email || existingFingerprintUser.fullName}`);
      
      // IMPORTANT: Check BOTH fingerprint AND face to determine if same person or different person
      // Step 1: Check face similarity (if landmarks available)
      if (normalizedLandmarks && existingFingerprintUser.faceLandmarks) {
        const similarity = compareFaces(normalizedLandmarks, existingFingerprintUser.faceLandmarks);
        console.log(`   Face similarity check: ${(similarity * 100).toFixed(1)}%`);
        
        if (similarity >= 0.75) {
          // Same person trying to register again on same device
          console.log(`   ✅ Same person detected (face similarity: ${(similarity * 100).toFixed(1)}%)`);
          return res.status(400).json({ 
            message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
          });
        } else {
          // Different person (face similarity < 75%) on same device - BLOCKED
          console.log(`   ❌ Different person detected (face similarity: ${(similarity * 100).toFixed(1)}% < 75%)`);
          return res.status(400).json({ 
            message: 'هذا الجهاز مستخدم بالفعل. يرجى استخدام جهاز آخر أو تسجيل الدخول بالحساب المسجل على هذا الجهاز.' 
          });
        }
      }
      
      // Step 2: Fallback - if no landmarks, check faceId (hash-based, less reliable)
      if (newFaceId && existingFingerprintUser.faceId) {
        if (newFaceId === existingFingerprintUser.faceId) {
          // Same person (exact faceId match)
          console.log('   ✅ Same person detected (exact faceId match)');
          return res.status(400).json({ 
            message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
          });
        } else {
          // Different person (different faceId) on same device - BLOCKED
          console.log('   ❌ Different person detected (different faceId)');
          return res.status(400).json({ 
            message: 'هذا الجهاز مستخدم بالفعل. يرجى استخدام جهاز آخر أو تسجيل الدخول بالحساب المسجل على هذا الجهاز.' 
          });
        }
      }
      
      // Step 3: If no face data available, assume different person (safety: block registration)
      // This should rarely happen if face capture is working properly
      console.log('   ⚠️ No face data available for comparison - blocking registration (safety)');
      return res.status(400).json({ 
        message: 'هذا الجهاز مستخدم بالفعل. يرجى استخدام جهاز آخر أو تسجيل الدخول بالحساب المسجل على هذا الجهاز.' 
      });
    }
    
    console.log('✅ Fingerprint check: Device is available for registration');
    
    // SECURITY CHECK 2: Check for duplicate face using LANDMARK-BASED similarity (correct method)
    // Get all users with faceLandmarks to compare
    const allUsersWithLandmarks = await User.find({ 
      faceLandmarks: { $exists: true, $ne: null } 
    }).select('faceLandmarks _id email fullName fingerprintData');
    
    // If we have landmarks, use landmark-based comparison (RELIABLE)
    if (normalizedLandmarks && allUsersWithLandmarks.length > 0) {
      console.log(`🔍 Checking ${allUsersWithLandmarks.length} users with landmarks for duplicate faces...`);
      
      for (const user of allUsersWithLandmarks) {
        if (user.faceLandmarks) {
          // Compare landmarks using similarity function
          // user.faceLandmarks is already normalized, so pass it directly
          const similarity = compareFaces(normalizedLandmarks, user.faceLandmarks);
          
          // Threshold: 0.75 (75%) similarity = same face
          // This is reliable because landmarks are stable for the same person
          if (similarity >= 0.75) {
            console.log(`⚠️ Duplicate face detected using landmarks!`);
            console.log(`   Similarity: ${(similarity * 100).toFixed(1)}%`);
            console.log(`   Existing user: ${user.email || user.fullName}`);
            console.log(`   Existing user fingerprintPublicKey: ${user.fingerprintData ? 'exists' : 'null'}`);
            
            // Check if this is the same device (same fingerprintPublicKey)
            if (user.fingerprintData === fingerprintPublicKey) {
              // Same person, same device - already registered
              return res.status(400).json({ 
                message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
              });
            } else {
              // Same person, different device - face already registered
              return res.status(400).json({ 
                message: 'هذا الوجه مسجل مسبقاً. يرجى استخدام حسابك الحالي أو تسجيل الدخول بالوجه.' 
              });
            }
          }
        }
      }
      console.log('✅ No duplicate faces found using landmark comparison');
    }
    
    // Fallback: Check exact faceId match (for backward compatibility)
    const existingFaceUserExact = await User.findOne({ faceId: newFaceId });
    if (existingFaceUserExact) {
      // Check if same device
      if (existingFaceUserExact.fingerprintData === fingerprintPublicKey) {
        return res.status(400).json({ 
          message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
        });
      } else {
        return res.status(400).json({ 
          message: 'هذا الوجه مسجل مسبقاً. يرجى استخدام حسابك الحالي أو تسجيل الدخول بالوجه.' 
        });
      }
    }

    // Create user with biometric data
    const userData = {
      employeeNumber,
      email,
      password,
      fullName,
      department,
      position,
      role: role || 'employee',
      profileImage: profileImage || null, // Store profile image (Base64)
      branch: branch || null, // Store location/branch reference
      fingerprintData: fingerprintPublicKey, // Store fingerprint ID (publicKey)
      faceImage: faceImage || null, // Face image is optional (privacy: no images stored)
      faceId: newFaceId, // Store face ID (hash) - kept for backward compatibility
      faceLandmarks: normalizedLandmarks || null, // Store normalized landmarks for reliable face matching
      faceIdEnabled: true,
      biometricType: biometricType || 'TouchID'
    };
    
    if (normalizedLandmarks) {
      console.log('✅ Saving normalized landmarks to database');
    } else {
      console.log('⚠️ No landmarks to save - user will only have faceId hash');
    }

    const user = await User.create(userData);

    // Generate token
    const token = GenerateToken(user._id, res);

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح مع المصادقة الحيوية',
      user: {
        _id: user._id,
        employeeNumber: user.employeeNumber,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        position: user.position,
        profileImage: user.profileImage,
        branch: user.branch,
        faceIdEnabled: user.faceIdEnabled,
        biometricType: user.biometricType
      },
      token
    });
  } catch (error) {
    console.error('Complete registration error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء الحساب',
      error: error.message 
    });
  }
};

// Register new user (legacy - kept for backward compatibility)
export const register = async (req, res) => {
  try {
    const { employeeNumber, email, password, fullName, department, position, role, faceImage, biometricType } = req.body;

    // Validation
    if (!employeeNumber || !email || !password || !fullName) {
      return res.status(400).json({ 
        message: 'الرجاء إدخال جميع الحقول المطلوبة' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { employeeNumber }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'البريد الإلكتروني أو رقم الموظف موجود مسبقاً' 
      });
    }

    // Create user with biometric data if provided
    const userData = {
      employeeNumber,
      email,
      password,
      fullName,
      department,
      position,
      role: role || 'employee'
    };

    // Add biometric data if provided
    if (faceImage) {
      userData.faceImage = faceImage;
      userData.faceIdEnabled = true;
    }
    if (biometricType) {
      userData.biometricType = biometricType;
    }

    const user = await User.create(userData);

    // Generate token
    const token = GenerateToken(user._id, res);

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      user: {
        _id: user._id,
        employeeNumber: user.employeeNumber,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        position: user.position,
        faceIdEnabled: user.faceIdEnabled,
        biometricType: user.biometricType
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء إنشاء الحساب',
      error: error.message 
    });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, employeeNumber, password } = req.body;

    // Find user by email or employee number
    const user = await User.findOne({
      $or: [
        email ? { email } : null,
        employeeNumber ? { employeeNumber } : null
      ].filter(Boolean)
    });

    if (!user) {
      return res.status(401).json({ 
        message: 'البريد الإلكتروني أو رقم الموظف غير صحيح' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'تم إيقاف هذا الحساب' 
      });
    }

    // Verify password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ 
        message: 'كلمة المرور غير صحيحة' 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = GenerateToken(user._id, res);

    res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        _id: user._id,
        employeeNumber: user.employeeNumber,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        position: user.position,
        faceIdEnabled: user.faceIdEnabled,
        twoFactorEnabled: user.twoFactorEnabled,
        attendancePoints: user.attendancePoints
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تسجيل الدخول',
      error: error.message 
    });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    const userId = req.user?._id;

    // For testing: reset today's attendance for this user on logout
    if (userId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      await Attendance.deleteMany({
        user: userId,
        date: { $gte: todayStart, $lte: todayEnd },
      });
    }

    res.cookie('jwt', '', { maxAge: 0 });
    res.status(200).json({ message: 'تم تسجيل الخروج بنجاح (وتم إعادة تعيين حضور اليوم لأغراض الاختبار)' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تسجيل الخروج',
      error: error.message 
    });
  }
};

// Get current user
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('branch', 'name address');
    
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Enable/Disable Face ID
export const toggleFaceId = async (req, res) => {
  try {
    const { enabled } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    user.faceIdEnabled = enabled === true || enabled === 'true';
    await user.save();

    res.status(200).json({ 
      message: user.faceIdEnabled ? 'تم تفعيل Face ID' : 'تم إلغاء تفعيل Face ID',
      faceIdEnabled: user.faceIdEnabled
    });
  } catch (error) {
    console.error('Toggle Face ID error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Enable/Disable Two Factor
export const toggleTwoFactor = async (req, res) => {
  try {
    const { enabled } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    user.twoFactorEnabled = enabled === true || enabled === 'true';
    await user.save();

    res.status(200).json({ 
      message: user.twoFactorEnabled ? 'تم تفعيل التحقق بخطوتين' : 'تم إلغاء تفعيل التحقق بخطوتين',
      twoFactorEnabled: user.twoFactorEnabled
    });
  } catch (error) {
    console.error('Toggle Two Factor error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ',
      error: error.message 
    });
  }
};

// Upload biometric data
export const uploadBiometric = async (req, res) => {
  try {
    const { faceImage, fingerprintData, biometricType } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // Update biometric data
    if (faceImage) {
      user.faceImage = faceImage;
      user.faceIdEnabled = true;
    }
    if (fingerprintData) {
      user.fingerprintData = fingerprintData;
    }
    if (biometricType) {
      user.biometricType = biometricType;
    }

    await user.save();

    res.status(200).json({ 
      message: 'تم حفظ البيانات الحيوية بنجاح',
      faceIdEnabled: user.faceIdEnabled,
      biometricType: user.biometricType
    });
  } catch (error) {
    console.error('Upload biometric error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء حفظ البيانات الحيوية',
      error: error.message 
    });
  }
};

// Login with biometric (fingerprint OR face recognition)
export const loginWithBiometric = async (req, res) => {
  try {
    const { faceImage, fingerprintPublicKey, employeeNumber, email } = req.body;

    let user = null;

    // Method 1: Login with Fingerprint (fingerprintPublicKey only)
    // NOTE: Only ONE user per device is allowed, so we can directly find the user
    if (fingerprintPublicKey && !faceImage) {
      // Find user by fingerprintPublicKey (only one user per device)
      user = await User.findOne({
        fingerprintData: fingerprintPublicKey
      });

      if (!user) {
        return res.status(401).json({ 
          message: 'البصمة غير مسجلة أو غير صحيحة' 
        });
      }

      if (!user.fingerprintData) {
        return res.status(400).json({ 
          message: 'لم يتم تسجيل بيانات البصمة لهذا المستخدم' 
        });
      }

      // Fingerprint is already verified on device, just verify it matches database
      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = GenerateToken(user._id, res);

      return res.status(200).json({
        message: 'تم تسجيل الدخول بنجاح بالبصمة',
        user: {
          _id: user._id,
          employeeNumber: user.employeeNumber,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          department: user.department,
          position: user.position,
          faceIdEnabled: user.faceIdEnabled,
          twoFactorEnabled: user.twoFactorEnabled,
          attendancePoints: user.attendancePoints,
          fingerprintData: user.fingerprintData, // Include for security verification
          faceId: user.faceId // Include for security verification
        },
        token
      });
    }

    // Method 2: Login with Face Recognition (faceId or faceImage with email/employeeNumber)
    // Prefer faceId (no image) for privacy, fallback to faceImage for backward compatibility
    const faceIdFromRequest = req.body.faceId;
    if ((faceIdFromRequest || faceImage) && !fingerprintPublicKey) {
      // Get faceId - either from request body (preferred, no image) or generate from faceImage
      let faceId = faceIdFromRequest;
      
      // If faceId not provided, generate from faceImage (fallback for backward compatibility)
      if (!faceId && faceImage) {
        const generateFaceId = (base64Image) => {
          const sample1 = base64Image.substring(0, 100);
          const sample2 = base64Image.substring(Math.floor(base64Image.length / 2), Math.floor(base64Image.length / 2) + 100);
          const sample3 = base64Image.substring(Math.max(0, base64Image.length - 100));
          const combined = sample1 + sample2 + sample3;
          const hash = combined.split('').reduce((acc, char) => {
            return ((acc << 5) - acc) + char.charCodeAt(0);
          }, 0);
          return Math.abs(hash).toString(16);
        };
        faceId = generateFaceId(faceImage);
      }
      
      if (!faceId) {
        return res.status(400).json({ 
          message: 'يرجى إرسال faceId أو صورة الوجه' 
        });
      }

      // Try to find user by faceId first (face-only login)
      // If faceId matches, login without requiring email/employeeNumber
      if (!email && !employeeNumber) {
        user = await User.findOne({
          faceId: faceId
        });

        if (user) {
          // Verify face is enabled
          if (!user.faceIdEnabled) {
            return res.status(403).json({ 
              message: 'المصادقة الحيوية غير مفعلة لهذا الحساب' 
            });
          }

          // Update last login
          user.lastLogin = new Date();
          await user.save();

          // Generate token
          const token = GenerateToken(user._id, res);

          return res.status(200).json({
            message: 'تم تسجيل الدخول بنجاح بالوجه',
            user: {
              _id: user._id,
              employeeNumber: user.employeeNumber,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              department: user.department,
              position: user.position,
              faceIdEnabled: user.faceIdEnabled,
              twoFactorEnabled: user.twoFactorEnabled,
              attendancePoints: user.attendancePoints,
              fingerprintData: user.fingerprintData, // Include for security verification
              faceId: user.faceId // Include for security verification
            },
            token
          });
        } else {
          return res.status(401).json({ 
            message: 'الوجه غير مسجل أو غير صحيح' 
          });
        }
      }

      // Find user by email or employee number (if provided)
      if (email || employeeNumber) {
        user = await User.findOne({
      $or: [
        email ? { email } : null,
        employeeNumber ? { employeeNumber } : null
      ].filter(Boolean)
    });
      }

    if (!user) {
      return res.status(401).json({ 
        message: 'المستخدم غير موجود' 
      });
    }

    if (!user.faceImage) {
      return res.status(400).json({ 
        message: 'لم يتم تسجيل بيانات الوجه لهذا المستخدم' 
      });
    }

      // Verify faceId matches (simple hash comparison)
      if (user.faceId !== faceId) {
        return res.status(401).json({ 
          message: 'الوجه غير متطابق' 
        });
      }

    // Simple face matching (in production, use proper face recognition algorithm)
    // For now, we'll just check if face image exists and is enabled
    // TODO: Implement proper face recognition comparison
    if (!user.faceIdEnabled) {
      return res.status(403).json({ 
        message: 'المصادقة الحيوية غير مفعلة لهذا الحساب' 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = GenerateToken(user._id, res);

      return res.status(200).json({
        message: 'تم تسجيل الدخول بنجاح بالوجه',
      user: {
        _id: user._id,
        employeeNumber: user.employeeNumber,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        position: user.position,
        faceIdEnabled: user.faceIdEnabled,
        twoFactorEnabled: user.twoFactorEnabled,
        attendancePoints: user.attendancePoints,
        fingerprintData: user.fingerprintData, // Include for security verification
        faceId: user.faceId // Include for security verification
      },
      token
    });
    }

    // If neither fingerprintPublicKey nor faceImage is provided
    return res.status(400).json({ 
      message: 'يرجى إرسال إما البصمة (fingerprintPublicKey) أو صورة الوجه (faceImage)' 
    });

  } catch (error) {
    console.error('Login with biometric error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تسجيل الدخول',
      error: error.message 
    });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'الرجاء إدخال كلمة المرور الحالية والجديدة' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' 
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // Verify current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      return res.status(401).json({ 
        message: 'كلمة المرور الحالية غير صحيحة' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تغيير كلمة المرور',
      error: error.message 
    });
  }
};




