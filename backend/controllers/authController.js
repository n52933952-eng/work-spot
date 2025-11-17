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
    console.log('🔍 Checking for duplicate fingerprintPublicKey...');
    console.log('   fingerprintPublicKey (first 50 chars):', fingerprintPublicKey ? fingerprintPublicKey.substring(0, 50) + '...' : 'null');
    
    const existingFingerprintUser = await User.findOne({ fingerprintData: fingerprintPublicKey });
    
    if (existingFingerprintUser) {
      console.log('✅ Found existing user with same fingerprintPublicKey!');
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
    
    console.log('✅ Fingerprint check: No duplicate fingerprintPublicKey found - device is available');
    console.log('   This means either:');
    console.log('   1. First time registering on this device, OR');
    console.log('   2. Different device (different fingerprintPublicKey)');
    console.log('   Proceeding to face check...');
    
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
            // This handles the case where fingerprintPublicKey might be different (keys recreated)
            // but face matches and we need to check if it's the same device
            if (user.fingerprintData === fingerprintPublicKey) {
              // Same person, same device - already registered
              console.log('   ✅ Same person, same device detected (fingerprintPublicKey matches)');
              return res.status(400).json({ 
                message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
              });
            } else {
              // Same person detected, but fingerprintPublicKey is different
              // This could mean:
              // 1. Different device (same person, different phone)
              // 2. Same device but keys were recreated (shouldn't happen, but possible)
              console.log('   ⚠️ Same person detected, but fingerprintPublicKey is different');
              console.log(`   Existing user fingerprintPublicKey: ${user.fingerprintData ? user.fingerprintData.substring(0, 50) + '...' : 'null'}`);
              console.log(`   New fingerprintPublicKey: ${fingerprintPublicKey ? fingerprintPublicKey.substring(0, 50) + '...' : 'null'}`);
              
              // Check if existing user has fingerprintPublicKey (means they registered with biometric)
              if (user.fingerprintData) {
                // User already registered with biometric (fingerprint) on another device
                // Show message that includes both face and fingerprint
                console.log('   Existing user has fingerprintPublicKey - they registered with biometric');
                return res.status(400).json({ 
                  message: 'أنت مسجل بالفعل (الوجه والبصمة مسجلان). يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
                });
              } else {
                // Existing user doesn't have fingerprintPublicKey (registered without biometric?)
                // Just show face duplicate message
                return res.status(400).json({ 
                  message: 'هذا الوجه مسجل مسبقاً. يرجى استخدام حسابك الحالي أو تسجيل الدخول بالوجه.' 
                });
              }
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
const verifyFaceSimilarity = (incomingLandmarks, storedLandmarks, context = 'login') => {
  if (!incomingLandmarks || !storedLandmarks) {
    return { verified: true };
  }

  try {
    const similarity = compareFaces(incomingLandmarks, storedLandmarks);
    console.log(`🔍 Face similarity (${context}): ${(similarity * 100).toFixed(2)}%`);
    if (similarity >= 0.75) {
      return { verified: true, similarity };
    }
    return { verified: false, similarity };
  } catch (error) {
    console.error('Error verifying face similarity:', error);
    return { verified: false };
  }
};

export const loginWithBiometric = async (req, res) => {
  try {
    const { faceImage, fingerprintPublicKey, employeeNumber, email, faceLandmarks, faceId } = req.body;

    let user = null;
    const hasFingerprint = !!fingerprintPublicKey;
    const hasFace = !!(faceId || faceImage || faceLandmarks);

    // FLEXIBLE LOGIN: Validate each method that's provided
    // 1. Fingerprint only → verify device matches
    // 2. Face only → verify face landmarks match
    // 3. Both → verify BOTH (device AND face)
    // 4. Email/password → traditional login (handled separately)

    // Step 1: Find user based on what's provided
    if (hasFingerprint && !hasFace) {
      // Method 1: Fingerprint ONLY login
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

      // Fingerprint verified - login successful
      user.lastLogin = new Date();
      await user.save();

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
          fingerprintData: user.fingerprintData,
          faceId: user.faceId
        },
        token
      });
    }

    // Step 2: Handle Face login (with or without fingerprint)
    if (hasFace) {
      // Get faceId - either from request body (preferred) or generate from faceImage
      let faceIdValue = faceId;
      
      if (!faceIdValue && faceImage) {
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
        faceIdValue = generateFaceId(faceImage);
      }
      
      if (!faceIdValue && !faceLandmarks) {
        return res.status(400).json({ 
          message: 'يرجى إرسال faceId أو صورة الوجه أو faceLandmarks' 
        });
      }

      // FACE-ONLY LOGIN: Find user by face landmarks (most secure)
      // Fingerprint is optional - only used as additional security layer if provided
      
      // Priority 1: Find user by faceLandmarks (if provided)
      if (faceLandmarks) {
        // Get all users with faceLandmarks and compare
        const allUsers = await User.find({ 
          faceLandmarks: { $exists: true, $ne: null } 
        }).select('faceLandmarks _id email employeeNumber fullName faceIdEnabled fingerprintData');
        
        let bestMatch = null;
        let bestSimilarity = 0;
        
        for (const candidateUser of allUsers) {
          if (candidateUser.faceLandmarks) {
            const similarity = compareFaces(faceLandmarks, candidateUser.faceLandmarks);
            if (similarity >= 0.75 && similarity > bestSimilarity) {
              bestMatch = candidateUser;
              bestSimilarity = similarity;
            }
          }
        }
        
        if (bestMatch) {
          user = bestMatch;
          console.log(`✅ Found user by face landmarks: ${(bestSimilarity * 100).toFixed(2)}% similarity`);
          
          // Optional: If fingerprint also provided, verify it matches (additional security)
          if (hasFingerprint && user.fingerprintData) {
            if (user.fingerprintData !== fingerprintPublicKey) {
              console.log('⚠️ Security: Fingerprint mismatch (face matched but wrong device)');
              return res.status(403).json({ 
                message: 'البصمة غير متطابقة مع المستخدم المسجل' 
              });
            }
            console.log('✅ Fingerprint also verified (additional security)');
          }
          
          // Verify face is enabled
          if (!user.faceIdEnabled) {
            return res.status(403).json({ 
              message: 'المصادقة الحيوية غير مفعلة لهذا الحساب' 
            });
          }

          user.lastLogin = new Date();
          await user.save();

          const token = GenerateToken(user._id, res);
          return res.status(200).json({
            message: hasFingerprint 
              ? 'تم تسجيل الدخول بنجاح بالوجه والبصمة'
              : 'تم تسجيل الدخول بنجاح بالوجه',
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
              fingerprintData: user.fingerprintData,
              faceId: user.faceId
            },
            token
          });
        } else {
          console.log('❌ No user found with matching face landmarks');
          return res.status(401).json({ 
            message: 'الوجه غير مسجل أو غير صحيح' 
          });
        }
      }

      // Face-only login (no fingerprint): find user by faceId or email/employeeNumber
      if (!email && !employeeNumber) {
        // Face-only login: find user by faceId
        if (faceIdValue) {
          user = await User.findOne({ faceId: faceIdValue });
        }
        
        if (!user) {
          return res.status(401).json({ 
            message: 'الوجه غير مسجل أو غير صحيح' 
          });
        }
      } else {
        // Face + email/employeeNumber: find user by credentials
        user = await User.findOne({
          $or: [
            email ? { email } : null,
            employeeNumber ? { employeeNumber } : null
          ].filter(Boolean)
        });

        if (!user) {
          return res.status(401).json({ 
            message: 'المستخدم غير موجود' 
          });
        }

        if (!user.faceLandmarks && !user.faceId) {
          return res.status(400).json({ 
            message: 'لم يتم تسجيل بيانات الوجه لهذا المستخدم' 
          });
        }
      }

      // SECURITY CHECK: Verify face landmarks (REQUIRED when face is provided)
      if (faceLandmarks && user.faceLandmarks) {
        const landmarkCheck = verifyFaceSimilarity(faceLandmarks, user.faceLandmarks, 'login-faceOnly');
        if (!landmarkCheck.verified) {
          console.log(`❌ Face similarity too low: ${(landmarkCheck.similarity * 100).toFixed(2)}%`);
          return res.status(401).json({ 
            message: 'الوجه غير متطابق مع المستخدم المسجل' 
          });
        }
        console.log(`✅ Face similarity verified: ${(landmarkCheck.similarity * 100).toFixed(2)}%`);
      } else if (faceIdValue && user.faceId) {
        // Fallback: use faceId hash comparison if landmarks not available
        if (user.faceId !== faceIdValue) {
          return res.status(401).json({ 
            message: 'الوجه غير متطابق' 
          });
        }
        console.log('✅ FaceId hash verified (fallback - landmarks not available)');
      } else {
        return res.status(400).json({ 
          message: 'لم يتم تسجيل بيانات الوجه لهذا المستخدم' 
        });
      }

      // Verify face is enabled
      if (!user.faceIdEnabled) {
        return res.status(403).json({ 
          message: 'المصادقة الحيوية غير مفعلة لهذا الحساب' 
        });
      }

      // All checks passed - login successful
      user.lastLogin = new Date();
      await user.save();

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
          fingerprintData: user.fingerprintData,
          faceId: user.faceId
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




