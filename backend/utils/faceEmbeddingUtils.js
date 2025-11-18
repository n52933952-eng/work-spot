/**
 * Face Embedding Utilities
 * Handles embedding comparison (embeddings are generated on-device in React Native)
 */

/**
 * Calculate cosine similarity between two embeddings
 * @param {Array<number>} embedding1 - First face embedding (192-D from TFLite, 128-D from landmarks, or other sizes)
 * @param {Array<number>} embedding2 - Second face embedding (must match embedding1 length)
 * @returns {number} - Similarity score between 0 and 1 (1 = identical, 0 = completely different)
 */
export const cosineSimilarity = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2) {
    return 0;
  }

  if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
    console.error('Embeddings must be arrays');
    return 0;
  }

  if (embedding1.length !== embedding2.length) {
    console.error(`Embeddings have different lengths: ${embedding1.length} vs ${embedding2.length}`);
    return 0;
  }

  let dotProduct = 0.0;
  let norm1 = 0.0;
  let norm2 = 0.0;

  for (let i = 0; i < embedding1.length; i++) {
    const val1 = typeof embedding1[i] === 'number' ? embedding1[i] : parseFloat(embedding1[i]);
    const val2 = typeof embedding2[i] === 'number' ? embedding2[i] : parseFloat(embedding2[i]);
    
    dotProduct += val1 * val2;
    norm1 += val1 * val1;
    norm2 += val2 * val2;
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  
  if (denominator === 0) {
    return 0;
  }

  const similarity = dotProduct / denominator;
  
  // Normalize to 0-1 range (cosine similarity is -1 to 1, but for faces it's usually 0 to 1)
  return Math.max(0, similarity);
};

/**
 * Find best matching user by comparing embedding with all users
 * @param {Array<number>} embedding - Face embedding to search for
 * @param {Array} users - Array of user objects with faceEmbedding field
 * @param {number} threshold - Minimum similarity threshold (default: 0.6)
 * @returns {Object|null} - { user: User, similarity: number } or null if no match
 */
export const findMatchingUser = (embedding, users, threshold = 0.6) => {
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestSimilarity = 0;
  const VERY_HIGH_MATCH = 0.98; // Early exit if we find a 98%+ match (very confident)

  for (const user of users) {
    if (!user.faceEmbedding || !Array.isArray(user.faceEmbedding) || user.faceEmbedding.length === 0) {
      continue;
    }

    const similarity = cosineSimilarity(embedding, user.faceEmbedding);
    
    if (similarity >= threshold && similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = { user, similarity };
      
      // OPTIMIZATION: Early exit if we find a very high match (98%+)
      // This saves time when checking many users
      if (similarity >= VERY_HIGH_MATCH) {
        break; // No need to check remaining users
      }
    }
  }

  return bestMatch;
};

/**
 * Compare two face embeddings
 * @param {Array<number>} embedding1 - First face embedding
 * @param {Array<number>} embedding2 - Second face embedding
 * @param {number} threshold - Similarity threshold (default: 0.6)
 * @returns {Object} - { match: boolean, similarity: number }
 */
export const compareFaceEmbeddings = (embedding1, embedding2, threshold = 0.6) => {
  const similarity = cosineSimilarity(embedding1, embedding2);
  const match = similarity >= threshold;
  
  return {
    match,
    similarity,
    threshold
  };
};



