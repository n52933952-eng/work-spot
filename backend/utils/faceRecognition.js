/**
 * Face Recognition using @vladmandic/face-api
 * Generates 128-D embeddings for face comparison
 */

import { createCanvas, loadImage } from 'canvas';

// Lazy load face-api to avoid module loading issues
let faceapi = null;
let tf = null;

// Initialize face-api models (load once on startup)
let modelsLoaded = false;

// Lazy load face-api module
const loadFaceApi = async () => {
  if (faceapi) return faceapi;
  
  try {
    // Dynamic import to handle module loading
    const tfModule = await import('@tensorflow/tfjs');
    tf = tfModule.default || tfModule;
    
    const faceApiModule = await import('@vladmandic/face-api');
    faceapi = faceApiModule.default || faceApiModule;
    
    // Set up face-api environment for Node.js
    if (faceapi.env && faceapi.env.monkeyPatch) {
      faceapi.env.monkeyPatch({ 
        Canvas: createCanvas, 
        Image: loadImage,
        createCanvasElement: () => createCanvas(1, 1),
        createImageData: (data, width, height) => {
          const canvas = createCanvas(width, height);
          const ctx = canvas.getContext('2d');
          return ctx.createImageData(width, height);
        }
      });
    }
    
    return faceapi;
  } catch (error) {
    console.error('❌ Error loading face-api module:', error);
    throw error;
  }
};

/**
 * Load face-api models (call this once at server startup)
 */
export const loadFaceModels = async () => {
  if (modelsLoaded) {
    console.log('✅ Face models already loaded');
    return;
  }

  try {
    // Load face-api module first
    await loadFaceApi();
    
    console.log('🔄 Loading face-api models...');
    
    // Load required models from CDN (models will be cached after first load)
    const modelUrl = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);

    modelsLoaded = true;
    console.log('✅ Face models loaded successfully');
  } catch (error) {
    console.error('❌ Error loading face models:', error);
    throw error;
  }
};

/**
 * Convert base64 image to canvas for face-api
 */
const base64ToCanvas = async (base64String) => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Use canvas to load image
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    return canvas;
  } catch (error) {
    console.error('Error converting base64 to canvas:', error);
    throw error;
  }
};

/**
 * Generate face embedding from base64 image
 * @param {string} base64Image - Base64 encoded image string
 * @returns {Promise<Float32Array|null>} - 128-D face embedding or null if no face detected
 */
export const generateFaceEmbedding = async (base64Image) => {
  // Ensure face-api is loaded
  await loadFaceApi();
  
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  try {
    // Convert base64 to canvas
    const canvas = await base64ToCanvas(base64Image);
    
    // Detect face and generate embedding
    const detection = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.log('⚠️ No face detected in image');
      return null;
    }

    // Return the 128-D descriptor (embedding) as a regular array
    const embedding = Array.from(detection.descriptor);
    console.log(`✅ Face embedding generated: ${embedding.length} dimensions`);
    
    return embedding;
  } catch (error) {
    console.error('❌ Error generating face embedding:', error);
    throw error;
  }
};

/**
 * Calculate cosine similarity between two embeddings
 * @param {Array<number>} embedding1 - First face embedding (128-D array)
 * @param {Array<number>} embedding2 - Second face embedding (128-D array)
 * @returns {number} - Similarity score between 0 and 1 (1 = identical, 0 = completely different)
 */
export const cosineSimilarity = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2) {
    return 0;
  }

  if (embedding1.length !== embedding2.length) {
    console.error('Embeddings have different lengths');
    return 0;
  }

  let dotProduct = 0.0;
  let norm1 = 0.0;
  let norm2 = 0.0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  
  if (denominator === 0) {
    return 0;
  }

  const similarity = dotProduct / denominator;
  
  // Normalize to 0-1 range (cosine similarity is already -1 to 1, but for faces it's usually 0 to 1)
  return Math.max(0, similarity);
};

/**
 * Compare two face embeddings
 * @param {Array<number>} embedding1 - First face embedding
 * @param {Array<number>} embedding2 - Second face embedding
 * @param {number} threshold - Similarity threshold (default: 0.6)
 * @returns {Object} - { match: boolean, similarity: number }
 */
export const compareFaces = (embedding1, embedding2, threshold = 0.6) => {
  const similarity = cosineSimilarity(embedding1, embedding2);
  const match = similarity >= threshold;
  
  return {
    match,
    similarity,
    threshold
  };
};

/**
 * Find best matching user by comparing embedding with all users
 * @param {Array<number>} embedding - Face embedding to search for
 * @param {Array} users - Array of user objects with faceEmbedding field
 * @param {number} threshold - Minimum similarity threshold (default: 0.6)
 * @returns {Object|null} - { user: User, similarity: number } or null if no match
 */
export const findMatchingUser = (embedding, users, threshold = 0.6) => {
  let bestMatch = null;
  let bestSimilarity = 0;

  for (const user of users) {
    if (!user.faceEmbedding || !Array.isArray(user.faceEmbedding) || user.faceEmbedding.length === 0) {
      continue;
    }

    const similarity = cosineSimilarity(embedding, user.faceEmbedding);
    
    if (similarity >= threshold && similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = { user, similarity };
    }
  }

  return bestMatch;
};

