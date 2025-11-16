/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Check if a location is within geofencing radius
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {number} locationLat - Location's latitude
 * @param {number} locationLon - Location's longitude
 * @param {number} radius - Allowed radius in meters
 * @returns {boolean} True if within radius
 */
export const isWithinRadius = (userLat, userLon, locationLat, locationLon, radius) => {
  const distance = calculateDistance(userLat, userLon, locationLat, locationLon);
  return distance <= radius;
};

/**
 * Find nearest location from user's position
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {Array} locations - Array of location objects with latitude, longitude, radius
 * @returns {Object|null} Nearest location object or null
 */
export const findNearestLocation = (userLat, userLon, locations) => {
  let nearestLocation = null;
  let minDistance = Infinity;

  locations.forEach(location => {
    const distance = calculateDistance(
      userLat, 
      userLon, 
      location.latitude, 
      location.longitude
    );
    
    if (distance <= location.radius && distance < minDistance) {
      minDistance = distance;
      nearestLocation = location;
    }
  });

  return nearestLocation;
};













