import User from '../modles/User.js';
import Attendance from '../modles/Attendance.js';
import GenerateToken from '../utils/GenerateToken.js';
import { extractNormalizedLandmarks, compareFaces } from '../utils/faceLandmarkSimilarity.js';
import { findMatchingUser, cosineSimilarity } from '../utils/faceEmbeddingUtils.js';

// Complete registration with biometric data
export const completeRegistration = async (req, res) => {
  const registrationStartTime = Date.now();
  console.log('⏱️ Registration request received');
  console.log('📦 Request type:', req.is('multipart/form-data') ? 'multipart/form-data' : 'application/json');
  
  try {
    // Parse JSON fields from FormData
    const employeeNumber = req.body.employeeNumber;
    const email = req.body.email;
    const password = req.body.password;
    const fullName = req.body.fullName;
    const department = req.body.department || null;
    const position = req.body.position || null;
    const role = req.body.role || null;
    const branch = req.body.branch || null;
    const latitude = req.body.latitude ? parseFloat(req.body.latitude) : null;
    const longitude = req.body.longitude ? parseFloat(req.body.longitude) : null;
    const address = req.body.address || null;
    const streetName = req.body.streetName || null;
    // CRITICAL: Normalize fingerprint key (trim whitespace) to prevent intermittent mismatches
    const fingerprintPublicKey = req.body.fingerprintPublicKey ? req.body.fingerprintPublicKey.trim() : null;
    const faceId = req.body.faceId;
    const biometricType = req.body.biometricType;
    
    // Log if normalization changed the key
    if (req.body.fingerprintPublicKey && req.body.fingerprintPublicKey !== fingerprintPublicKey) {
      console.log('⚠️ WARNING: Fingerprint key had whitespace! Normalized.');
      console.log('   Original length:', req.body.fingerprintPublicKey.length);
      console.log('   Normalized length:', fingerprintPublicKey.length);
    }
    
    // Parse arrays/objects from JSON strings
    const faceEmbedding = req.body.faceEmbedding ? JSON.parse(req.body.faceEmbedding) : null;
    const faceFeatures = req.body.faceFeatures ? JSON.parse(req.body.faceFeatures) : null;
    const faceData = req.body.faceData ? JSON.parse(req.body.faceData) : null;
    
    // Get uploaded images from multer (saved to disk)
    // Store file paths (URLs) instead of base64
    let profileImage = null;
    let faceImage = null;
    
    if (req.files) {
      if (req.files.profileImage && req.files.profileImage[0]) {
        const file = req.files.profileImage[0];
        // Store relative path (URL path) instead of full file path
        profileImage = `/uploads/profiles/${file.filename}`;
        console.log('📦 Profile image saved:', profileImage, `(${(file.size / 1024).toFixed(2)} KB)`);
      }
      
      if (req.files.faceImage && req.files.faceImage[0]) {
        const file = req.files.faceImage[0];
        // Store relative path (URL path) instead of full file path
        faceImage = `/uploads/faces/${file.filename}`;
        console.log('📦 Face image saved:', faceImage, `(${(file.size / 1024).toFixed(2)} KB)`);
      }
    }
    
    console.log('📦 Form data parsed successfully');

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

    // Face embedding is now generated on-device (React Native)
    // Validate embedding if provided
    let validatedEmbedding = null;
    if (faceEmbedding) {
      if (!Array.isArray(faceEmbedding) || faceEmbedding.length === 0) {
        return res.status(400).json({ 
          message: 'بيانات الوجه غير صحيحة. يرجى المحاولة مرة أخرى.' 
        });
      }
      validatedEmbedding = faceEmbedding;
      console.log(`✅ Face embedding received from device: ${validatedEmbedding.length} dimensions`);
    } else {
      console.log('⚠️ No face embedding provided - will use landmarks as fallback');
    }

    // OPTIMIZATION: Run duplicate checks in parallel for faster registration
    // CRITICAL: Use normalized key for duplicate checks to ensure consistency
    const duplicateCheckStartTime = Date.now();
    
    console.log('🔍 Duplicate check: Using normalized fingerprint key for query...');
    console.log('   - Normalized key length:', fingerprintPublicKey?.length || 0);
    console.log('   - Normalized key first 50:', fingerprintPublicKey?.substring(0, 50) || 'null');
    
    const [existingUser, existingFingerprint] = await Promise.all([
      User.findOne({ $or: [{ email }, { employeeNumber }] }),
      User.findOne({ fingerprintData: fingerprintPublicKey }) // fingerprintPublicKey is already normalized at line 27
    ]);
    
    console.log(`⏱️ Duplicate checks completed in ${Date.now() - duplicateCheckStartTime}ms`);
    
    if (existingFingerprint) {
      console.log('🔍 Found existing fingerprint in database:');
      console.log('   - Existing user:', existingFingerprint.email || existingFingerprint.employeeNumber);
      console.log('   - Existing fingerprint length:', existingFingerprint.fingerprintData?.length || 0);
      console.log('   - Existing fingerprint first 50:', existingFingerprint.fingerprintData?.substring(0, 50) || 'null');
      console.log('   - Match with normalized key:', existingFingerprint.fingerprintData?.trim() === fingerprintPublicKey ? 'YES ✅' : 'NO ❌');
    }

    if (existingUser) {
      console.log('❌ Duplicate user found:', existingUser.email || existingUser.employeeNumber);
      return res.status(400).json({ 
        message: 'البريد الإلكتروني أو رقم الموظف موجود مسبقاً' 
      });
    }
    
    // Check for duplicate fingerprint BEFORE face check
    // This prevents same device from being used by multiple users
    if (existingFingerprint) {
      console.log('❌ Duplicate fingerprint found for device');
      console.log('   Existing user:', existingFingerprint.email || existingFingerprint.employeeNumber);
      // Don't return here - we need to check if it's the same person or different person
      // Continue to face similarity check below
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
    
    // SECURITY CHECK 1: FINGERPRINT-BASED DUPLICATE DETECTION (PRIMARY METHOD)
    // This is the PRIMARY and MOST RELIABLE method for detecting duplicate registrations
    // Fingerprint keys are device-specific and should be consistent
    console.log('🔍 [PRIMARY CHECK] Checking for duplicate fingerprintPublicKey...');
    console.log('   fingerprintPublicKey (first 50 chars):', fingerprintPublicKey ? fingerprintPublicKey.substring(0, 50) + '...' : 'null');
    console.log('   fingerprintPublicKey (last 50 chars):', fingerprintPublicKey ? '...' + fingerprintPublicKey.substring(Math.max(0, fingerprintPublicKey.length - 50)) : 'null');
    console.log('   fingerprintPublicKey length:', fingerprintPublicKey?.length || 0);
    
    const existingFingerprintUser = await User.findOne({ fingerprintData: fingerprintPublicKey });
    
    if (existingFingerprintUser) {
      console.log('🚨 [FINGERPRINT MATCH] Found existing user with SAME fingerprintPublicKey!');
      console.log('⚠️ Duplicate fingerprintPublicKey detected - BLOCKING registration');
      console.log(`   Existing user ID: ${existingFingerprintUser._id}`);
      console.log(`   Existing user email: ${existingFingerprintUser.email || 'N/A'}`);
      console.log(`   Existing user employeeNumber: ${existingFingerprintUser.employeeNumber || 'N/A'}`);
      console.log(`   Existing user fullName: ${existingFingerprintUser.fullName || 'N/A'}`);
      console.log(`   New registration email: ${email}`);
      console.log(`   New registration employeeNumber: ${employeeNumber}`);
      
      // CRITICAL: If fingerprint matches, this is DEFINITELY the same device
      // Check if it's the SAME user (same email/employeeNumber) trying to register again
      const isSameUser = existingFingerprintUser.email === email || 
                        existingFingerprintUser.employeeNumber === employeeNumber;
      
      if (isSameUser) {
        console.log('   ✅ Same user detected (email/employeeNumber match) - BLOCKING duplicate registration');
        return res.status(400).json({ 
          message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
        });
      }
      
      // If different email/employeeNumber but SAME fingerprint key, check face to confirm
      // This handles cases where someone tries to register with different credentials on same device
      console.log('   🔍 Different email/employeeNumber but SAME device - checking face...');
      
      // Step 1: Check face similarity using embeddings (most accurate)
      if (validatedEmbedding && existingFingerprintUser.faceEmbedding) {
        const embeddingSimilarity = cosineSimilarity(validatedEmbedding, existingFingerprintUser.faceEmbedding);
        console.log(`   Face embedding similarity: ${(embeddingSimilarity * 100).toFixed(1)}%`);
        
        if (embeddingSimilarity >= 0.90) {
          // Same person, same device - BLOCK
          console.log(`   ✅ Same person detected (face embedding: ${(embeddingSimilarity * 100).toFixed(1)}% >= 90%)`);
          return res.status(400).json({ 
            message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
          });
        }
      }
      
      // Step 2: Check face similarity using landmarks
      if (normalizedLandmarks && existingFingerprintUser.faceLandmarks) {
        const landmarkSimilarity = compareFaces(normalizedLandmarks, existingFingerprintUser.faceLandmarks);
        console.log(`   Face landmark similarity: ${(landmarkSimilarity * 100).toFixed(1)}%`);
        
        if (landmarkSimilarity >= 0.90) {
          // Same person, same device - BLOCK
          console.log(`   ✅ Same person detected (face landmark: ${(landmarkSimilarity * 100).toFixed(1)}% >= 90%)`);
          return res.status(400).json({ 
            message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
          });
        }
      }
      
      // Step 3: Check faceId (hash-based, less reliable but fast)
      if (newFaceId && existingFingerprintUser.faceId) {
        if (newFaceId === existingFingerprintUser.faceId) {
          // Same person, same device - BLOCK
          console.log('   ✅ Same person detected (exact faceId match)');
          return res.status(400).json({ 
            message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
          });
        }
      }
      
      // Step 4: If face doesn't match but fingerprint does, BLOCK registration
      // One device = One user only (device already used by someone else)
      console.log('   ❌ Different person detected on SAME device - BLOCKING (one device = one user)');
      return res.status(400).json({ 
        message: 'هذا الجهاز مستخدم بالفعل. يرجى استخدام جهاز آخر أو تسجيل الدخول بالحساب المسجل على هذا الجهاز.' 
      });
    }
    
    console.log('✅ Fingerprint check: No duplicate fingerprintPublicKey found - device is available');
    console.log('   This means either:');
    console.log('   1. First time registering on this device, OR');
    console.log('   2. Different device (different fingerprintPublicKey)');
    console.log('   Proceeding to face check...');
    
    // SECURITY CHECK 2: Check for duplicate face using EMBEDDING-BASED similarity (NEW - most accurate)
    // Priority: Use embeddings if available, fallback to landmarks
    if (validatedEmbedding) {
      console.log('🔍 Checking for duplicate faces using embeddings...');
      const startTime = Date.now();
      
      // OPTIMIZATION: Limit search scope for scalability
      // Check ALL users (active and inactive) to prevent duplicate registrations
      // Limit to 5000 users max to prevent performance issues
      // In production with many users, consider using a vector database (MongoDB Atlas Vector Search, Pinecone, etc.)
      const allUsersWithEmbeddings = await User.find({ 
        faceEmbedding: { $exists: true, $ne: null }
        // Note: Removed isActive filter - we need to check ALL users to prevent duplicates
      })
      .select('faceEmbedding _id email fullName fingerprintData')
      .limit(5000) // Safety limit: max 5000 users to check
      .lean(); // Use lean() for better performance (returns plain JS objects)
      
      const userCount = allUsersWithEmbeddings.length;
      console.log(`📊 Checking ${userCount} users with embeddings...`);
      
      if (userCount > 0) {
        // Registration duplicate check: 0.90 (90%) threshold
        // This is strict enough to catch the same person registering multiple times
        // while avoiding false positives from similar-looking different people
        // Face embeddings can vary slightly (lighting, angle, expression) so 90% is appropriate
        // Note: Login uses 65% which is more lenient for authentication
        const match = findMatchingUser(validatedEmbedding, allUsersWithEmbeddings, 0.90); // 0.90 threshold for registration (strict but reasonable)
        
        const searchTime = Date.now() - startTime;
        console.log(`⏱️ Embedding search completed in ${searchTime}ms (checked ${userCount} users)`);
        
        if (userCount >= 5000) {
          console.log('⚠️ WARNING: Reached 5000 user limit. Consider using a vector database for better scalability.');
        }
        
        if (match) {
          console.log(`🚨 [FACE MATCH] Duplicate face detected using embeddings!`);
          console.log(`   Similarity: ${(match.similarity * 100).toFixed(1)}%`);
          console.log(`   Existing user ID: ${match.user._id}`);
          console.log(`   Existing user: ${match.user.email || match.user.fullName || match.user.employeeNumber}`);
          console.log(`   Existing user fingerprintData: ${match.user.fingerprintData ? 'exists (' + match.user.fingerprintData.substring(0, 50) + '...)' : 'null'}`);
          console.log(`   New fingerprintPublicKey: ${fingerprintPublicKey ? fingerprintPublicKey.substring(0, 50) + '...' : 'null'}`);
          
          // Check if same device (fingerprint keys match)
          if (match.user.fingerprintData === fingerprintPublicKey) {
            // BOTH face AND fingerprint match - same person, same device
            console.log('   ✅ Same person, same device detected (fingerprint keys match) - BLOCKING');
            return res.status(400).json({ 
              message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
            });
          } else {
            // Face matches but fingerprint doesn't - BLOCK registration
            // One person = One account only (person already registered, must login instead)
            console.log('   ❌ Same person detected but different device - BLOCKING (one person = one account)');
            console.log('   💡 Person already registered. Please login instead of registering again.');
            return res.status(400).json({ 
              message: 'أنت مسجل بالفعل (الوجه والبصمة مسجلان). يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
            });
          }
        }
      }
      console.log('✅ No duplicate faces found using embedding comparison');
    }
    
    // FALLBACK: Check for duplicate face using LANDMARK-BASED similarity (for backward compatibility)
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
          
          // Threshold: 0.90 (90%) similarity = same face (STRICT for registration)
          // This matches the embedding threshold for consistency
          // Registration duplicate check must be strict to prevent same person registering multiple times
          // - Different people can have 85-90% similarity, so 90% is appropriate
          // - Login uses 65% which is more lenient for authentication
          if (similarity >= 0.90) {
            console.log(`🚨 [FACE MATCH] Duplicate face detected using landmarks!`);
            console.log(`   Similarity: ${(similarity * 100).toFixed(1)}%`);
            console.log(`   Existing user ID: ${user._id}`);
            console.log(`   Existing user: ${user.email || user.fullName || user.employeeNumber}`);
            console.log(`   Existing user fingerprintData: ${user.fingerprintData ? 'exists (' + user.fingerprintData.substring(0, 50) + '...)' : 'null'}`);
            console.log(`   New fingerprintPublicKey: ${fingerprintPublicKey ? fingerprintPublicKey.substring(0, 50) + '...' : 'null'}`);
            
            // Check if this is the same device (same fingerprintPublicKey)
            if (user.fingerprintData === fingerprintPublicKey) {
              // BOTH face AND fingerprint match - same person, same device
              console.log('   ✅ Same person, same device detected (fingerprintPublicKey matches) - BLOCKING');
              return res.status(400).json({ 
                message: 'أنت مسجل بالفعل على هذا الجهاز. يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
              });
            } else {
              // Face matches but fingerprint doesn't - BLOCK registration
              // One person = One account only (person already registered, must login instead)
              console.log('   ❌ Same person detected but different device - BLOCKING (one person = one account)');
              console.log('   💡 Person already registered. Please login instead of registering again.');
              return res.status(400).json({ 
                message: 'أنت مسجل بالفعل (الوجه والبصمة مسجلان). يرجى تسجيل الدخول بدلاً من التسجيل مرة أخرى.' 
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
    // CRITICAL: Ensure fingerprintPublicKey is normalized before saving
    const normalizedFingerprintForSave = fingerprintPublicKey ? fingerprintPublicKey.trim() : null;
    
    console.log('💾 Saving fingerprint to database:');
    console.log('   - Original key length:', fingerprintPublicKey?.length || 0);
    console.log('   - Normalized key length:', normalizedFingerprintForSave?.length || 0);
    console.log('   - First 100 chars:', normalizedFingerprintForSave?.substring(0, 100) || 'null');
    console.log('   - Last 100 chars:', normalizedFingerprintForSave ? '...' + normalizedFingerprintForSave.substring(Math.max(0, normalizedFingerprintForSave.length - 100)) : 'null');
    console.log('   - Full length:', normalizedFingerprintForSave?.length || 0);
    
    const userData = {
      employeeNumber,
      email,
      password,
      fullName,
      department,
      position,
      role: role || 'employee',
      profileImage: profileImage || null, // Store profile image URL path (e.g., "/uploads/profiles/123_user_profileImage.jpg")
      branch: branch || null, // Store location/branch reference
      fingerprintData: normalizedFingerprintForSave, // Store normalized fingerprint ID (publicKey)
      faceImage: faceImage || null, // Face image URL path (e.g., "/uploads/faces/123_user_faceImage.jpg")
      faceId: newFaceId, // Store face ID (hash) - kept for backward compatibility
      faceEmbedding: validatedEmbedding || null, // Store face embedding (generated on-device)
      faceLandmarks: normalizedLandmarks || null, // Store normalized landmarks (DEPRECATED - kept for backward compatibility)
      faceIdEnabled: true,
      biometricType: biometricType || 'TouchID',
      approvalStatus: 'pending' // New employees need admin approval
    };
    
    if (validatedEmbedding) {
      console.log(`✅ Saving face embedding to database (${validatedEmbedding.length}-D vector)`);
    } else if (normalizedLandmarks) {
      console.log('✅ Saving normalized landmarks to database (fallback)');
    } else {
      console.log('⚠️ No embedding or landmarks to save - user will only have faceId hash');
    }

    const createUserStartTime = Date.now();
    const user = await User.create(userData);
    const createUserTime = Date.now() - createUserStartTime;
    console.log(`✅ User created successfully in ${createUserTime}ms:`, user._id);
    
    // CRITICAL: Verify the fingerprint was saved correctly and can be queried
    const savedUser = await User.findById(user._id).select('fingerprintData email employeeNumber');
    if (savedUser) {
      console.log('🔍 Verification: Checking saved fingerprint in database...');
      console.log('   - Saved fingerprint length:', savedUser.fingerprintData?.length || 0);
      console.log('   - Saved fingerprint first 100:', savedUser.fingerprintData?.substring(0, 100) || 'null');
      console.log('   - Saved fingerprint last 100:', savedUser.fingerprintData ? '...' + savedUser.fingerprintData.substring(Math.max(0, savedUser.fingerprintData.length - 100)) : 'null');
      console.log('   - Matches what we tried to save:', savedUser.fingerprintData?.trim() === normalizedFingerprintForSave ? 'YES ✅' : 'NO ❌');
      if (savedUser.fingerprintData?.trim() !== normalizedFingerprintForSave) {
        console.error('❌ CRITICAL: Saved fingerprint does NOT match what we tried to save!');
        console.error('   This will cause login failures!');
      }
      
      // CRITICAL: Test if we can find this user using the normalized key (simulating login)
      console.log('🔍 Testing login query: Can we find this user with the normalized key?');
      const testLoginQuery = await User.findOne({ fingerprintData: normalizedFingerprintForSave });
      if (testLoginQuery && testLoginQuery._id.toString() === user._id.toString()) {
        console.log('✅ SUCCESS: Login query works! User can be found with normalized key.');
      } else if (testLoginQuery) {
        console.error('❌ ERROR: Login query found a DIFFERENT user! This is a critical bug!');
        console.error('   Expected user ID:', user._id);
        console.error('   Found user ID:', testLoginQuery._id);
      } else {
        console.error('❌ CRITICAL: Login query FAILED! User cannot be found with normalized key!');
        console.error('   This means login will fail even though registration succeeded!');
        console.error('   Trying with trimmed database value...');
        const testWithTrim = await User.findOne({ 
          fingerprintData: { $exists: true, $ne: null }
        });
        if (testWithTrim) {
          const trimmedDbKey = testWithTrim.fingerprintData.trim();
          if (trimmedDbKey === normalizedFingerprintForSave) {
            console.error('⚠️ Found match with trimmed comparison - database has whitespace!');
            console.error('   This suggests the key was saved with whitespace despite normalization.');
          }
        }
      }
    }

    // Send notification to admin about new employee registration
    try {
      const { io } = await import('../socket/socket.js');
      if (io) {
        // Find all admin users
        const admins = await User.find({ role: { $in: ['admin', 'hr', 'manager'] } }).select('_id');
        admins.forEach(admin => {
          // Send to both room formats for compatibility
          io.to(`user_${admin._id}`).emit('newEmployeeRegistration', {
            message: `موظف جديد ينتظر الموافقة: ${user.fullName} (${user.employeeNumber})`,
            employeeId: user._id,
            employeeName: user.fullName,
            employeeNumber: user.employeeNumber,
            department: user.department,
            position: user.position,
            timestamp: new Date().toISOString()
          });
          io.to(admin._id.toString()).emit('newEmployeeRegistration', {
            message: `موظف جديد ينتظر الموافقة: ${user.fullName} (${user.employeeNumber})`,
            employeeId: user._id,
            employeeName: user.fullName,
            employeeNumber: user.employeeNumber,
            department: user.department,
            position: user.position,
            timestamp: new Date().toISOString()
          });
        });
        console.log(`📢 Notification sent to ${admins.length} admin(s) about new employee registration`);
      }
    } catch (error) {
      console.error('Error sending notification to admin:', error);
      // Don't fail registration if notification fails
    }

    // Generate token (user can login but will see pending approval message)
    const token = GenerateToken(user._id, res);
    console.log('✅ Token generated');

    // Prepare response with image URLs (much smaller than base64!)
    const baseURL = process.env.API_BASE_URL || `http://${req.get('host')}`;
    
    const responseData = {
      message: 'تم إنشاء الحساب بنجاح. يرجى انتظار موافقة المدير.',
      user: {
        _id: user._id,
        employeeNumber: user.employeeNumber,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        position: user.position,
        // Send full URL for images (e.g., "http://192.168.100.66:5000/uploads/profiles/123_user_profileImage.jpg")
        profileImage: user.profileImage ? `${baseURL}${user.profileImage}` : null,
        faceImage: user.faceImage ? `${baseURL}${user.faceImage}` : null,
        branch: user.branch,
        faceIdEnabled: user.faceIdEnabled,
        biometricType: user.biometricType,
        approvalStatus: user.approvalStatus // Include approval status
      },
      token,
      requiresApproval: true // Flag to show approval message in mobile app
    };
    
    const totalTime = Date.now() - registrationStartTime;
    console.log('📤 Sending registration response...');
    console.log('📤 Response size:', JSON.stringify(responseData).length, 'bytes');
    console.log(`⏱️ Total registration time: ${totalTime}ms`);
    
    res.status(201).json(responseData);
    console.log('✅ Registration response sent successfully');
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
    const { username, email, employeeNumber, password } = req.body;

    // Simple admin login: username="admin" and password="admin"
    // This is for the admin web panel only
    if (username === 'admin' && password === 'admin') {
      let user = await User.findOne({
        $or: [
          { email: 'admin@admin.com' },
          { employeeNumber: 'admin' }
        ]
      });

      // If no admin exists, create one
      if (!user) {
        const bcrypt = (await import('bcryptjs')).default;
        const hashedPassword = await bcrypt.hash('admin', 10);
        
        user = await User.create({
          employeeNumber: 'admin',
          email: 'admin@admin.com',
          password: hashedPassword,
          fullName: 'System Administrator',
          role: 'admin',
          department: 'IT',
          position: 'Administrator',
          isActive: true,
          expectedCheckInTime: '09:00',
          expectedCheckOutTime: '17:00'
        });
        
        console.log('✅ Auto-created admin user: username=admin, password=admin');
      } else {
        // Admin exists - ensure it has admin role and correct password
        if (user.role !== 'admin') {
          user.role = 'admin';
          console.log('✅ Updated user role to admin');
        }
        
        // Reset password to 'admin' if it doesn't match
        const isPasswordCorrect = await user.comparePassword('admin');
        if (!isPasswordCorrect) {
          console.log('⚠️ Admin user exists but password is wrong. Resetting to "admin"...');
          const bcrypt = (await import('bcryptjs')).default;
          user.password = await bcrypt.hash('admin', 10);
          console.log('✅ Admin password reset to "admin"');
        }
        
        // Ensure user is active
        if (!user.isActive) {
          user.isActive = true;
          console.log('✅ Activated admin user');
        }
        
        await user.save();
      }
      
      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = GenerateToken(user._id, res);

      return res.status(200).json({
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
    }

    // Regular login: Find user by username, email or employee number
    // Username can be used as email (case-insensitive - email is stored lowercase)
    const loginIdentifier = username || email;
    const user = await User.findOne({
      $or: [
        loginIdentifier ? { email: loginIdentifier.toLowerCase() } : null,
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

    // Check approval status
    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({ 
        message: 'تم رفض طلب التسجيل. لا يمكنك تسجيل الدخول.',
        approvalStatus: 'rejected',
        rejectionReason: user.rejectionReason || null
      });
    }

    // Allow login even if pending - but user will see message in home screen
    // if (user.approvalStatus === 'pending') {
    //   return res.status(403).json({ 
    //     message: 'يرجى انتظار موافقة المدير على طلب التسجيل',
    //     approvalStatus: 'pending',
    //     requiresApproval: true
    //   });
    // }

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

    // Convert image paths to full URLs
    const baseURL = process.env.API_BASE_URL || `http://${req.get('host')}`;
    const userResponse = {
      ...user.toObject(),
      profileImage: user.profileImage ? `${baseURL}${user.profileImage}` : null,
      faceImage: user.faceImage ? `${baseURL}${user.faceImage}` : null,
    };

    res.status(200).json({ user: userResponse });
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
    // TEMPORARY: 70% threshold
    if (similarity >= 0.70) {
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
    const { faceImage, faceEmbedding, fingerprintPublicKey, employeeNumber, email, faceLandmarks, faceId } = req.body;

    console.log('🔍 Login request received:');
    console.log('  - fingerprintPublicKey:', !!fingerprintPublicKey, fingerprintPublicKey ? fingerprintPublicKey.substring(0, 20) + '...' : 'null');
    console.log('  - faceId:', !!faceId, faceId || 'null');
    console.log('  - faceImage:', !!faceImage);
    console.log('  - faceEmbedding:', !!faceEmbedding, faceEmbedding ? `array[${faceEmbedding.length}]` : 'null');
    console.log('  - faceLandmarks type:', typeof faceLandmarks);
    console.log('  - faceLandmarks keys:', faceLandmarks && typeof faceLandmarks === 'object' ? Object.keys(faceLandmarks) : 'null');
    console.log('  - faceLandmarks.faceData:', faceLandmarks?.faceData ? (Array.isArray(faceLandmarks.faceData) ? `array[${faceLandmarks.faceData.length}]` : typeof faceLandmarks.faceData) : 'null');
    console.log('  - faceLandmarks.faceFeatures:', !!faceLandmarks?.faceFeatures);
    console.log('  - email:', email);
    console.log('  - employeeNumber:', employeeNumber);

    let user = null;
    const hasFingerprint = !!fingerprintPublicKey;
    // Check if faceEmbedding is provided (NEW - generated on-device)
    const hasFaceEmbedding = !!(faceEmbedding && Array.isArray(faceEmbedding) && faceEmbedding.length > 0);
    // Check if faceLandmarks is a valid object with face data
    // Frontend sends: { faceData: [...], faceFeatures: {...}, faceId: "..." }
    const hasValidFaceLandmarks = faceLandmarks && typeof faceLandmarks === 'object' && (
      (faceLandmarks.faceData && Array.isArray(faceLandmarks.faceData) && faceLandmarks.faceData.length > 0) ||
      (faceLandmarks.faceFeatures && faceLandmarks.faceFeatures.landmarks) ||
      faceLandmarks.landmarks ||
      (Array.isArray(faceLandmarks) && faceLandmarks.length > 0)
    );
    const hasFace = !!(faceId || faceImage || faceEmbedding || hasValidFaceLandmarks);
    
    console.log('📊 Login method detection:');
    console.log('  - hasFingerprint:', hasFingerprint);
    console.log('  - hasFaceEmbedding:', hasFaceEmbedding);
    console.log('  - hasValidFaceLandmarks:', hasValidFaceLandmarks);
    console.log('  - hasFaceId:', !!faceId);
    console.log('  - hasFaceImage:', !!faceImage);
    console.log('  - hasFace:', hasFace);
    console.log('  - Will use:', hasFingerprint && !hasFace ? 'FINGERPRINT-ONLY' : hasFace ? 'FACE' : 'UNKNOWN');

    // FLEXIBLE LOGIN: Validate each method that's provided
    // 1. Fingerprint only → verify device matches
    // 2. Face only → verify face landmarks match
    // 3. Both → verify BOTH (device AND face)
    // 4. Email/password → traditional login (handled separately)

    // CRITICAL SECURITY: If face data is provided (faceId OR faceLandmarks), we MUST verify face
    // Even if fingerprint is also provided, face verification takes priority
    // This prevents friends from using your device with their face
    if (hasFace) {
      console.log('👤 Face data detected - MUST verify face (even if fingerprint provided)');
      // Skip fingerprint-only path - go directly to face verification
    } else if (hasFingerprint && !hasFace) {
      console.log('🔑 Using FINGERPRINT-ONLY login path (no face data provided)');
      
      // CRITICAL: Normalize the fingerprint key (trim whitespace, ensure consistent format)
      // This fixes intermittent issues where keys might have leading/trailing whitespace
      const normalizedFingerprintKey = fingerprintPublicKey ? fingerprintPublicKey.trim() : null;
      
      console.log('🔍 Normalized fingerprint key details:');
      console.log('   - Original length:', fingerprintPublicKey?.length || 0);
      console.log('   - Normalized length:', normalizedFingerprintKey?.length || 0);
      console.log('   - First 100 chars:', normalizedFingerprintKey?.substring(0, 100) || 'null');
      console.log('   - Last 100 chars:', normalizedFingerprintKey ? '...' + normalizedFingerprintKey.substring(Math.max(0, normalizedFingerprintKey.length - 100)) : 'null');
      
      if (!normalizedFingerprintKey) {
        console.log('❌ Fingerprint key is null or empty after normalization');
        return res.status(401).json({ 
          message: 'البصمة غير مسجلة أو غير صحيحة' 
        });
      }
      
      // Method 1: Fingerprint ONLY login (no face data at all)
      // Try exact match first
      user = await User.findOne({
        fingerprintData: normalizedFingerprintKey
      });
      
      // If exact match fails, try with trimmed database values (fallback for data inconsistencies)
      if (!user) {
        console.log('⚠️ Exact match failed, trying with trimmed database values...');
        // Get all users with fingerprint data and compare manually
        const allUsersWithFingerprint = await User.find({
          fingerprintData: { $exists: true, $ne: null }
        }).select('fingerprintData email employeeNumber fullName');
        
        console.log(`📊 Checking ${allUsersWithFingerprint.length} users with fingerprint data...`);
        
        for (const dbUser of allUsersWithFingerprint) {
          if (dbUser.fingerprintData) {
            const normalizedDbKey = dbUser.fingerprintData.trim();
            if (normalizedDbKey === normalizedFingerprintKey) {
              console.log('✅ Found match with normalized comparison!');
              console.log('   - User:', dbUser.email || dbUser.employeeNumber);
              console.log('   - Database key length:', dbUser.fingerprintData.length);
              console.log('   - Normalized DB key length:', normalizedDbKey.length);
              console.log('   - Sent key length:', normalizedFingerprintKey.length);
              user = await User.findById(dbUser._id);
              break;
            }
          }
        }
      }
      
      // Log detailed comparison if still no match
      if (!user) {
        console.log('❌ No user found with this fingerprintPublicKey (even after normalization)');
        console.log('🔍 Diagnostic: Checking first 5 users in database for comparison...');
        const sampleUsers = await User.find({
          fingerprintData: { $exists: true, $ne: null }
        }).limit(5).select('fingerprintData email employeeNumber');
        
        sampleUsers.forEach((sampleUser, index) => {
          console.log(`   User ${index + 1}: ${sampleUser.email || sampleUser.employeeNumber}`);
          console.log(`      DB key length: ${sampleUser.fingerprintData?.length || 0}`);
          console.log(`      DB key first 50: ${sampleUser.fingerprintData?.substring(0, 50) || 'null'}...`);
          console.log(`      Sent key first 50: ${normalizedFingerprintKey.substring(0, 50)}...`);
          console.log(`      Match: ${sampleUser.fingerprintData?.trim() === normalizedFingerprintKey ? 'YES ✅' : 'NO ❌'}`);
        });
        
        return res.status(401).json({ 
          message: 'البصمة غير مسجلة أو غير صحيحة' 
        });
      }

      if (!user.fingerprintData) {
      return res.status(400).json({ 
          message: 'لم يتم تسجيل بيانات البصمة لهذا المستخدم' 
        });
      }

      // Check approval status
      if (user.approvalStatus === 'rejected') {
        return res.status(403).json({ 
          message: 'تم رفض طلب التسجيل. لا يمكنك تسجيل الدخول.',
          approvalStatus: 'rejected',
          rejectionReason: user.rejectionReason || null
        });
      }

      // Allow login even if pending - but user will see message in home screen
      // if (user.approvalStatus === 'pending') {
      //   return res.status(403).json({ 
      //     message: 'يرجى انتظار موافقة المدير على طلب التسجيل',
      //     approvalStatus: 'pending',
      //     requiresApproval: true
      //   });
      // }

      console.log(`✅ Fingerprint verified for user: ${user.email || user.employeeNumber}`);
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
      console.log('═══════════════════════════════════════════════════════');
      console.log('👤 FACE LOGIN ATTEMPT STARTED');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📋 Face data summary:');
      console.log('   - hasFaceEmbedding:', hasFaceEmbedding);
      console.log('   - hasValidFaceLandmarks:', hasValidFaceLandmarks);
      console.log('   - hasFaceId:', !!faceId);
      console.log('   - hasFaceImage:', !!faceImage);
      console.log('   - faceEmbedding length:', faceEmbedding ? faceEmbedding.length : 'null');
      console.log('   - faceId value:', faceId || 'null');
      console.log('   - email:', email || 'null');
      console.log('   - employeeNumber:', employeeNumber || 'null');
      console.log('   - fingerprintPublicKey provided:', !!fingerprintPublicKey);
      console.log('═══════════════════════════════════════════════════════');
      
      // Face verification path (already logged above if we got here)
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
      
      if (!faceIdValue && !faceLandmarks && !faceImage && !faceEmbedding) {
        return res.status(400).json({ 
          message: 'يرجى إرسال faceId أو faceEmbedding أو صورة الوجه أو faceLandmarks' 
        });
      }

      // Device binding ENABLED for production security
      // Fixed: Now using stored key from AsyncStorage instead of regenerating
      const DEVICE_BINDING_ENABLED = true; // Device verification is ACTIVE
      
      // FACE LOGIN: Priority order - Embeddings (NEW) > Landmarks (FALLBACK)
      // Priority 1: Use faceEmbedding directly (generated on-device) - MOST ACCURATE
      if (hasFaceEmbedding) {
        try {
          console.log('═══════════════════════════════════════════════════════');
          console.log('🔍 METHOD 1: Searching for user by FACE EMBEDDING');
          console.log('═══════════════════════════════════════════════════════');
          console.log('📊 Face embedding details:');
          console.log('   - Embedding array length:', faceEmbedding.length);
          console.log('   - First 5 values:', faceEmbedding.slice(0, 5));
          console.log('   - Last 5 values:', faceEmbedding.slice(-5));
          console.log('   - Min value:', Math.min(...faceEmbedding));
          console.log('   - Max value:', Math.max(...faceEmbedding));
          console.log('═══════════════════════════════════════════════════════');
          const loginStartTime = Date.now();
          
          // OPTIMIZATION: Limit search scope for scalability (same as registration)
          const allUsers = await User.find({ 
            faceEmbedding: { $exists: true, $ne: null },
            isActive: true // Only check active users
          })
          .select('faceEmbedding _id email employeeNumber fullName faceIdEnabled fingerprintData')
          .limit(5000); // Safety limit: max 5000 users to check
          
          console.log(`📋 Found ${allUsers.length} users with faceEmbedding to compare`);
          
          // DIAGNOSTIC: Try with very low threshold to see ANY match (for debugging)
          const diagnosticMatch = findMatchingUser(faceEmbedding, allUsers, 0.50); // Very low threshold for diagnostics
          if (diagnosticMatch) {
            console.log(`🔍 DIAGNOSTIC: Best face match found: ${diagnosticMatch.user.email || diagnosticMatch.user.employeeNumber}`);
            console.log(`🔍 DIAGNOSTIC: Similarity: ${(diagnosticMatch.similarity * 100).toFixed(2)}%`);
            if (diagnosticMatch.similarity < 0.95) {
              console.log(`⚠️ WARNING: Similarity below threshold (${(diagnosticMatch.similarity * 100).toFixed(2)}% < 95%)`);
              console.log(`⚠️ This will be rejected. Expected: 95-100% for same person.`);
              console.log(`💡 HINT: Face size difference too large or embeddings inconsistent.`);
            } else {
              console.log(`✅ Good: Similarity above threshold (${(diagnosticMatch.similarity * 100).toFixed(2)}% >= 95%)`);
            }
          } else {
            console.log(`🔍 DIAGNOSTIC: No match found even at 50% threshold - completely different faces!`);
          }
          
          // TEMPORARY: 65% threshold due to TFLite non-determinism
          // Same person varies: 75-82% similarity between captures
          // Root causes: face detection variations, TFLite randomness, preprocessing
          // Lowered from 70% to 65% to be more lenient for login (registration uses 97%)
          // TODO: Implement multiple embeddings + voting system for stability
          console.log('🔍 Starting face embedding comparison...');
          console.log('   - Users in database to compare:', allUsers.length);
          console.log('   - Similarity threshold: 65% (0.65)');
          const match = findMatchingUser(faceEmbedding, allUsers, 0.65);
          
          const loginSearchTime = Date.now() - loginStartTime;
          console.log(`⏱️ Login embedding search completed in ${loginSearchTime}ms`);
          console.log(`📊 Search result: ${match ? 'MATCH FOUND ✅' : 'NO MATCH ❌'}`);
          if (match) {
            console.log('   - Matched user:', match.user.email || match.user.employeeNumber);
            console.log('   - Similarity:', (match.similarity * 100).toFixed(2) + '%');
          }
          
          if (match) {
            user = match.user;
            console.log(`✅ Found user by face embedding: ${(match.similarity * 100).toFixed(2)}% similarity`);
            
            // SECURITY: Face login is PRIMARY - if face matches, allow login regardless of fingerprint
            // Fingerprint is optional for face login (user can login with face from any device)
            // If fingerprint is provided and matches, great. If not, still allow if face matches.
            console.log('═══════════════════════════════════════════════════════');
            console.log('✅ FACE MATCHED - Allowing login (fingerprint is optional)');
            console.log('═══════════════════════════════════════════════════════');
            if (hasFingerprint && fingerprintPublicKey && user.fingerprintData) {
              // Fingerprint was provided - log it but don't block if it doesn't match
              console.log('📱 Fingerprint provided - checking (optional, won\'t block login):');
              console.log('   - Registered fingerprint length:', user.fingerprintData.length);
              console.log('   - Current fingerprint length:', fingerprintPublicKey.length);
              
              // Normalize both fingerprints (trim whitespace) before comparison
              const normalizedRegistered = user.fingerprintData.trim();
              const normalizedCurrent = fingerprintPublicKey.trim();
              
              if (normalizedRegistered === normalizedCurrent) {
                console.log('   ✅ Fingerprint matches - user logging in from registered device');
              } else {
                console.log('   ⚠️ Fingerprint doesn\'t match - but allowing login anyway (face matched)');
                console.log('   💡 User can login with face from any device');
              }
            } else if (!hasFingerprint) {
              console.log('📱 No fingerprint provided - face-only login');
            } else if (!user.fingerprintData) {
              console.log('📱 User has no registered fingerprint - face-only login');
            }
            console.log('✅ Proceeding with face login...');
            console.log('═══════════════════════════════════════════════════════');
          } else {
            console.log('═══════════════════════════════════════════════════════');
            console.log('❌ NO MATCH FOUND - Face embedding similarity below 65% threshold');
            console.log('═══════════════════════════════════════════════════════');
            console.log('🔍 DIAGNOSTIC: Checking all users with faceEmbedding for debugging...');
            
            // DIAGNOSTIC: Show all similarities even below threshold
            if (allUsers.length > 0) {
              console.log('📊 Similarity scores for all users in database:');
              const similarities = allUsers.map(u => ({
                user: u,
                similarity: cosineSimilarity(faceEmbedding, u.faceEmbedding)
              })).sort((a, b) => b.similarity - a.similarity); // Sort by similarity (highest first)
              
              console.log(`   Found ${similarities.length} users to compare:`);
              similarities.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.user.email || item.user.employeeNumber || item.user._id}: ${(item.similarity * 100).toFixed(2)}% similarity ${item.similarity >= 0.65 ? '✅ ABOVE THRESHOLD' : '❌ below threshold'}`);
              });
              
              if (similarities.length > 0) {
                const bestMatch = similarities[0];
                console.log(`\n🏆 Best match found: ${bestMatch.user.email || bestMatch.user.employeeNumber}`);
                console.log(`   - Similarity: ${(bestMatch.similarity * 100).toFixed(2)}%`);
                console.log(`   - Threshold required: 65%`);
                console.log(`   - Difference: ${((bestMatch.similarity - 0.65) * 100).toFixed(2)}%`);
                if (bestMatch.similarity < 0.65) {
                  console.log(`   ⚠️ Below threshold by: ${((0.65 - bestMatch.similarity) * 100).toFixed(2)}%`);
                }
              }
            } else {
              console.log('   ⚠️ No users found in database with faceEmbedding data!');
            }
            console.log('═══════════════════════════════════════════════════════');
            
            // FALLBACK: Try to find user by faceId if faceEmbedding failed
            if (faceId) {
              console.log('🔄 FALLBACK: Trying to find user by faceId:', faceId);
              console.log('🔍 Searching for user with faceId:', faceId);
              
              // First, check if ANY user has this faceId (for debugging)
              const anyUserWithFaceId = await User.findOne({ faceId: faceId });
              if (anyUserWithFaceId) {
                console.log('🔍 Found user with faceId (any status):', anyUserWithFaceId.email || anyUserWithFaceId.employeeNumber);
                console.log('   - isActive:', anyUserWithFaceId.isActive);
                console.log('   - faceIdEnabled:', anyUserWithFaceId.faceIdEnabled);
                console.log('   - approvalStatus:', anyUserWithFaceId.approvalStatus);
              } else {
                console.log('❌ No user found with faceId:', faceId);
                console.log('🔍 Checking all users with faceId for debugging...');
                const allUsersWithFaceId = await User.find({ faceId: { $exists: true, $ne: null } })
                  .select('faceId email employeeNumber isActive faceIdEnabled')
                  .limit(10);
                console.log(`📋 Found ${allUsersWithFaceId.length} users with faceId in database`);
                allUsersWithFaceId.forEach(u => {
                  console.log(`   - faceId: ${u.faceId}, email: ${u.email || u.employeeNumber}, isActive: ${u.isActive}, faceIdEnabled: ${u.faceIdEnabled}`);
                });
              }
              
              const userByFaceId = await User.findOne({ 
                faceId: faceId,
                isActive: true,
                faceIdEnabled: true
              }).select('_id email employeeNumber fullName faceIdEnabled fingerprintData faceId');
              
              if (userByFaceId) {
                console.log('✅ Found user by faceId (fallback):', userByFaceId.email || userByFaceId.employeeNumber);
                console.log('   - faceId:', userByFaceId.faceId);
                console.log('   - has fingerprintData:', !!userByFaceId.fingerprintData);
                
                // SECURITY: Face login is PRIMARY - if face matches, allow login regardless of fingerprint
                // Fingerprint is optional for face login (user can login with face from any device)
                console.log('✅ FACE MATCHED (faceId fallback) - Allowing login (fingerprint is optional)');
                if (hasFingerprint && fingerprintPublicKey && userByFaceId.fingerprintData) {
                  // Fingerprint was provided - log it but don't block if it doesn't match
                  const normalizedRegistered = userByFaceId.fingerprintData.trim();
                  const normalizedCurrent = fingerprintPublicKey.trim();
                  if (normalizedRegistered === normalizedCurrent) {
                    console.log('   ✅ Fingerprint matches - user logging in from registered device');
                  } else {
                    console.log('   ⚠️ Fingerprint doesn\'t match - but allowing login anyway (face matched)');
                  }
                } else {
                  console.log('   📱 Face-only login (no fingerprint check)');
                }
                
                // Use faceId match as user
                user = userByFaceId;
                console.log('✅ Using faceId match (fallback) - faceEmbedding similarity was too low');
                
                // Continue to approval status check and token generation (same as faceEmbedding match)
                // This will be handled after the if/else block
              } else {
                console.log('❌ No user found with matching faceId (with isActive=true and faceIdEnabled=true)');
                console.log('💡 Possible reasons:');
                console.log('   1. User is not active (isActive=false)');
                console.log('   2. Face ID is disabled (faceIdEnabled=false)');
                console.log('   3. Face ID does not exist in database');
                
                // FINAL ATTEMPT: Try to find user by faceId WITHOUT filters (for debugging)
                const anyUserByFaceId = await User.findOne({ faceId: faceId });
                if (anyUserByFaceId) {
                  console.log('🔍 DEBUG: Found user with faceId but with restrictions:');
                  console.log('   - isActive:', anyUserByFaceId.isActive);
                  console.log('   - faceIdEnabled:', anyUserByFaceId.faceIdEnabled);
                  console.log('   - approvalStatus:', anyUserByFaceId.approvalStatus);
                  console.log('   - email:', anyUserByFaceId.email || anyUserByFaceId.employeeNumber);
                  
                  // If user exists but is not active or faceId is disabled, provide specific error
                  if (!anyUserByFaceId.isActive) {
                    return res.status(403).json({ 
                      message: 'الحساب غير نشط. يرجى الاتصال بالمدير.' 
                    });
                  }
                  if (!anyUserByFaceId.faceIdEnabled) {
                    return res.status(403).json({ 
                      message: 'المصادقة الحيوية غير مفعلة لهذا الحساب' 
                    });
                  }
                }
                
                return res.status(401).json({ 
                  message: 'الوجه غير مسجل أو غير صحيح' 
                });
              }
            } else {
              console.log('❌ No faceId provided for fallback');
              return res.status(401).json({ 
                message: 'الوجه غير مسجل أو غير صحيح' 
              });
            }
          }
          
          // COMMON CODE: Handle user found by faceEmbedding OR faceId fallback
          if (user) {
            console.log('✅ User found (by faceEmbedding or faceId fallback):', user.email || user.employeeNumber);
            
            // Verify face is enabled
            if (!user.faceIdEnabled) {
              return res.status(403).json({ 
                message: 'المصادقة الحيوية غير مفعلة لهذا الحساب' 
              });
            }

            // Check approval status
            if (user.approvalStatus === 'rejected') {
              return res.status(403).json({ 
                message: 'تم رفض طلب التسجيل. لا يمكنك تسجيل الدخول.',
                approvalStatus: 'rejected',
                rejectionReason: user.rejectionReason || null
              });
            }

            // Allow login even if pending - but user will see message in home screen
            // if (user.approvalStatus === 'pending') {
            //   return res.status(403).json({ 
            //     message: 'يرجى انتظار موافقة المدير على طلب التسجيل',
            //     approvalStatus: 'pending',
            //     requiresApproval: true
            //   });
            // }

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
          }
        } catch (error) {
          console.error('❌ Error during face embedding login:', error);
          return res.status(400).json({ 
            message: 'فشل معالجة صورة الوجه. يرجى المحاولة مرة أخرى.' 
          });
        }
      }
      
      // Priority 2: Find user by faceLandmarks (FALLBACK - for backward compatibility)
      if (hasValidFaceLandmarks) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔍 METHOD 2: Searching for user by FACE LANDMARKS (Fallback)');
        console.log('═══════════════════════════════════════════════════════');
        
        // Extract actual face data from payload structure
        // Frontend sends: { faceData: [detectedFace], faceFeatures: {...} }
        let incomingFaceData = null;
        if (faceLandmarks.faceData && Array.isArray(faceLandmarks.faceData) && faceLandmarks.faceData.length > 0) {
          incomingFaceData = faceLandmarks.faceData[0]; // Use first face from ML Kit detection
          console.log('✅ Extracted face data from faceLandmarks.faceData[0]');
        } else if (faceLandmarks.faceFeatures?.landmarks) {
          // Fallback: use faceFeatures structure
          incomingFaceData = {
            landmarks: faceLandmarks.faceFeatures.landmarks,
            frame: faceLandmarks.faceFeatures.frame,
            headEulerAngleX: faceLandmarks.faceFeatures.headEulerAngleX,
            headEulerAngleY: faceLandmarks.faceFeatures.headEulerAngleY,
            headEulerAngleZ: faceLandmarks.faceFeatures.headEulerAngleZ,
          };
          console.log('✅ Extracted face data from faceLandmarks.faceFeatures');
        } else if (faceLandmarks.landmarks) {
          incomingFaceData = faceLandmarks;
          console.log('✅ Using faceLandmarks directly');
        }
        
        if (!incomingFaceData) {
          console.log('❌ Could not extract face data from faceLandmarks payload');
          return res.status(400).json({ 
            message: 'بيانات الوجه غير صحيحة' 
          });
        }
        
        // Get all users with faceLandmarks and compare
        const allUsers = await User.find({ 
          faceLandmarks: { $exists: true, $ne: null } 
        }).select('faceLandmarks _id email employeeNumber fullName faceIdEnabled fingerprintData');
        
        console.log(`📋 Found ${allUsers.length} users with faceLandmarks to compare`);
        
        let bestMatch = null;
        let bestSimilarity = 0;
        
        for (const candidateUser of allUsers) {
          if (candidateUser.faceLandmarks) {
            const similarity = compareFaces(incomingFaceData, candidateUser.faceLandmarks);
            console.log(`  - User ${candidateUser.email || candidateUser.employeeNumber}: ${(similarity * 100).toFixed(2)}% similarity`);
            // TEMPORARY: 70% threshold (same reason as above)
            if (similarity >= 0.70 && similarity > bestSimilarity) {
              bestMatch = candidateUser;
              bestSimilarity = similarity;
            }
          }
        }
        
        if (bestMatch) {
          user = bestMatch;
          console.log(`✅ Found user by face landmarks: ${(bestSimilarity * 100).toFixed(2)}% similarity`);
          
          // SECURITY: Face login is PRIMARY - if face matches, allow login regardless of fingerprint
          // Fingerprint is optional for face login (user can login with face from any device)
          console.log('✅ FACE MATCHED (landmarks) - Allowing login (fingerprint is optional)');
          if (hasFingerprint && fingerprintPublicKey && user.fingerprintData) {
            // Fingerprint was provided - log it but don't block if it doesn't match
            const normalizedRegistered = user.fingerprintData.trim();
            const normalizedCurrent = fingerprintPublicKey.trim();
            if (normalizedRegistered === normalizedCurrent) {
              console.log('   ✅ Fingerprint matches - user logging in from registered device');
            } else {
              console.log('   ⚠️ Fingerprint doesn\'t match - but allowing login anyway (face matched)');
            }
          } else {
            console.log('   📱 Face-only login (no fingerprint check)');
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
          console.log('❌ No user found with matching face landmarks (similarity < 75%)');
          return res.status(401).json({ 
            message: 'الوجه غير مسجل أو غير صحيح' 
          });
        }
      } else {
        console.log('⚠️ faceLandmarks not provided in request - cannot verify face');
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




