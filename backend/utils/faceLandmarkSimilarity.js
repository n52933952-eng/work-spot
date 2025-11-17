/**
 * Face Landmark Similarity Comparison
 * Compares two faces using normalized landmark positions
 * Returns similarity score (0-1, where 1 is identical)
 */

/**
 * Normalize landmarks to face-relative coordinates
 * This makes comparison independent of face size and position in image
 */
const normalizeLandmarks = (landmarks, faceFrame) => {
  if (!landmarks || !faceFrame) return null;

  const faceWidth = faceFrame.width || 1;
  const faceHeight = faceFrame.height || 1;
  const faceCenterX = (faceFrame.left || 0) + faceWidth / 2;
  const faceCenterY = (faceFrame.top || 0) + faceHeight / 2;

  // Helper to extract and normalize landmark position
  const getNormalizedPos = (landmark) => {
    if (!landmark) return null;
    
    let x, y;
    if (landmark.position) {
      x = landmark.position.x;
      y = landmark.position.y;
    } else if (landmark.x !== undefined && landmark.y !== undefined) {
      x = landmark.x;
      y = landmark.y;
    } else {
      return null;
    }

    // Normalize to face-relative coordinates (center = 0,0)
    return {
      x: (x - faceCenterX) / faceWidth,
      y: (y - faceCenterY) / faceHeight,
    };
  };

  const normalized = {
    leftEye: getNormalizedPos(landmarks.leftEye),
    rightEye: getNormalizedPos(landmarks.rightEye),
    noseBase: getNormalizedPos(landmarks.noseBase),
    mouthLeft: getNormalizedPos(landmarks.mouthLeft),
    mouthRight: getNormalizedPos(landmarks.mouthRight),
    mouthBottom: getNormalizedPos(landmarks.mouthBottom),
  };

  // Calculate stable features
  if (normalized.leftEye && normalized.rightEye) {
    // Eye distance (normalized to face width)
    const eyeDistance = Math.sqrt(
      Math.pow(normalized.rightEye.x - normalized.leftEye.x, 2) +
      Math.pow(normalized.rightEye.y - normalized.leftEye.y, 2)
    );
    normalized.eyeDistance = eyeDistance;
  }

  // Nose to eye distance (average of both eyes)
  if (normalized.noseBase && normalized.leftEye && normalized.rightEye) {
    const leftEyeToNose = Math.sqrt(
      Math.pow(normalized.noseBase.x - normalized.leftEye.x, 2) +
      Math.pow(normalized.noseBase.y - normalized.leftEye.y, 2)
    );
    const rightEyeToNose = Math.sqrt(
      Math.pow(normalized.noseBase.x - normalized.rightEye.x, 2) +
      Math.pow(normalized.noseBase.y - normalized.rightEye.y, 2)
    );
    normalized.noseToEyeDistance = (leftEyeToNose + rightEyeToNose) / 2;
  }

  // Mouth to nose distance
  if (normalized.noseBase && normalized.mouthBottom) {
    normalized.mouthToNoseDistance = Math.sqrt(
      Math.pow(normalized.mouthBottom.x - normalized.noseBase.x, 2) +
      Math.pow(normalized.mouthBottom.y - normalized.noseBase.y, 2)
    );
  }

  // Face proportions
  normalized.faceWidth = faceWidth;
  normalized.faceHeight = faceHeight;
  normalized.faceAspectRatio = faceWidth / (faceHeight || 1);

  return normalized;
};

/**
 * Extract normalized landmarks from face data
 */
export const extractNormalizedLandmarks = (faceData) => {
  try {
    const landmarks = faceData.landmarks || {};
    const frame = faceData.frame || faceData.bounds || {};

    // Normalize landmarks
    const normalized = normalizeLandmarks(landmarks, frame);

    if (!normalized) return null;

    // Add head rotation angles (for normalization)
    normalized.headEulerAngleX = faceData.headEulerAngleX || faceData.rotationX || 0;
    normalized.headEulerAngleY = faceData.headEulerAngleY || faceData.rotationY || 0;
    normalized.headEulerAngleZ = faceData.headEulerAngleZ || faceData.rotationZ || 0;

    return normalized;
  } catch (error) {
    console.error('Error extracting normalized landmarks:', error);
    return null;
  }
};

/**
 * Calculate distance between two normalized landmark positions
 */
const landmarkDistance = (pos1, pos2) => {
  if (!pos1 || !pos2) return null;
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2)
  );
};

/**
 * Compare two normalized landmark sets
 * Returns similarity score (0-1, where 1 is identical)
 */
export const compareLandmarks = (landmarks1, landmarks2) => {
  if (!landmarks1 || !landmarks2) return 0;

  let totalSimilarity = 0;
  let featureCount = 0;

  // 1. Eye distance comparison (very stable)
  if (landmarks1.eyeDistance && landmarks2.eyeDistance) {
    const eyeDistDiff = Math.abs(landmarks1.eyeDistance - landmarks2.eyeDistance);
    const maxEyeDist = Math.max(landmarks1.eyeDistance, landmarks2.eyeDistance, 0.01);
    const eyeDistSimilarity = 1 - Math.min(eyeDistDiff / maxEyeDist, 1);
    totalSimilarity += eyeDistSimilarity * 0.2; // 20% weight
    featureCount += 0.2;
  }

  // 2. Nose-eye relative positions (stable)
  if (landmarks1.noseToEyeDistance && landmarks2.noseToEyeDistance) {
    const noseEyeDiff = Math.abs(landmarks1.noseToEyeDistance - landmarks2.noseToEyeDistance);
    const maxNoseEye = Math.max(landmarks1.noseToEyeDistance, landmarks2.noseToEyeDistance, 0.01);
    const noseEyeSimilarity = 1 - Math.min(noseEyeDiff / maxNoseEye, 1);
    totalSimilarity += noseEyeSimilarity * 0.15; // 15% weight
    featureCount += 0.15;
  }

  // 3. Mouth-nose relative positions (stable)
  if (landmarks1.mouthToNoseDistance && landmarks2.mouthToNoseDistance) {
    const mouthNoseDiff = Math.abs(landmarks1.mouthToNoseDistance - landmarks2.mouthToNoseDistance);
    const maxMouthNose = Math.max(landmarks1.mouthToNoseDistance, landmarks2.mouthToNoseDistance, 0.01);
    const mouthNoseSimilarity = 1 - Math.min(mouthNoseDiff / maxMouthNose, 1);
    totalSimilarity += mouthNoseSimilarity * 0.15; // 15% weight
    featureCount += 0.15;
  }

  // 4. Face proportions (width/height ratio)
  if (landmarks1.faceAspectRatio && landmarks2.faceAspectRatio) {
    const aspectDiff = Math.abs(landmarks1.faceAspectRatio - landmarks2.faceAspectRatio);
    const maxAspect = Math.max(landmarks1.faceAspectRatio, landmarks2.faceAspectRatio, 0.01);
    const aspectSimilarity = 1 - Math.min(aspectDiff / maxAspect, 1);
    totalSimilarity += aspectSimilarity * 0.1; // 10% weight
    featureCount += 0.1;
  }

  // 5. Individual landmark positions (normalized)
  const landmarkPositions = [
    { key: 'leftEye', weight: 0.1 },
    { key: 'rightEye', weight: 0.1 },
    { key: 'noseBase', weight: 0.1 },
    { key: 'mouthLeft', weight: 0.05 },
    { key: 'mouthRight', weight: 0.05 },
  ];

  for (const { key, weight } of landmarkPositions) {
    if (landmarks1[key] && landmarks2[key]) {
      const dist = landmarkDistance(landmarks1[key], landmarks2[key]);
      // Normalize distance (max expected distance is ~1.0 for normalized coordinates)
      const similarity = 1 - Math.min(dist / 1.0, 1);
      totalSimilarity += similarity * weight;
      featureCount += weight;
    }
  }

  // Normalize by feature count
  if (featureCount === 0) return 0;
  return totalSimilarity / featureCount;
};

/**
 * Main function: Compare two faces using landmarks
 * Can accept either:
 * - faceData object with landmarks property (from ML Kit)
 * - normalized landmarks object (already extracted from database)
 * Returns similarity score (0-1, where 1 is identical)
 */
export const compareFaces = (faceData1, faceData2) => {
  try {
    let landmarks1, landmarks2;
    
    // If faceData1 already has normalized landmarks (from database), use them directly
    if (faceData1.eyeDistance !== undefined || (faceData1.leftEye && faceData1.leftEye.x !== undefined)) {
      landmarks1 = faceData1; // Already normalized
    } else {
      landmarks1 = extractNormalizedLandmarks(faceData1);
    }
    
    // Same for faceData2
    if (faceData2.eyeDistance !== undefined || (faceData2.leftEye && faceData2.leftEye.x !== undefined)) {
      landmarks2 = faceData2; // Already normalized
    } else {
      landmarks2 = extractNormalizedLandmarks(faceData2);
    }

    if (!landmarks1 || !landmarks2) {
      console.log('⚠️ Could not extract landmarks from one or both faces');
      return 0;
    }

    // Compare landmarks
    const similarity = compareLandmarks(landmarks1, landmarks2);
    
    return similarity;
  } catch (error) {
    console.error('Error comparing faces:', error);
    return 0;
  }
};

