/**
 * Calculate late minutes based on expected check-in time
 * @param {Date} checkInTime - Actual check-in time
 * @param {String} expectedTime - Expected check-in time (HH:mm format)
 * @returns {number} Late minutes (0 if on time or early)
 */
export const calculateLateMinutes = (checkInTime, expectedTime) => {
  const checkIn = new Date(checkInTime);
  const [hours, minutes] = expectedTime.split(':').map(Number);
  
  // Set expected time for the same date
  const expected = new Date(checkIn);
  expected.setHours(hours, minutes, 0, 0);
  
  const diffMs = checkIn - expected;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  return diffMinutes > 0 ? diffMinutes : 0;
};

/**
 * Calculate working hours between check-in and check-out
 * @param {Date} checkInTime - Check-in time
 * @param {Date} checkOutTime - Check-out time
 * @returns {number} Working hours in minutes
 */
export const calculateWorkingHours = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) return 0;
  
  const diffMs = new Date(checkOutTime) - new Date(checkInTime);
  return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
};

/**
 * Calculate overtime hours
 * @param {number} workingMinutes - Total working minutes
 * @param {number} expectedMinutes - Expected working minutes per day
 * @returns {number} Overtime in minutes (0 if no overtime)
 */
export const calculateOvertime = (workingMinutes, expectedMinutes = 480) => {
  // Default expected: 8 hours = 480 minutes
  const overtime = workingMinutes - expectedMinutes;
  return overtime > 0 ? overtime : 0;
};

/**
 * Determine attendance status
 * @param {Date} checkInTime - Check-in time
 * @param {String} expectedTime - Expected check-in time
 * @param {number} lateThreshold - Minutes after which it's considered late (default: 0)
 * @returns {String} Status: 'present' or 'late'
 */
export const getAttendanceStatus = (checkInTime, expectedTime, lateThreshold = 0) => {
  if (!checkInTime) return 'absent';
  
  const lateMinutes = calculateLateMinutes(checkInTime, expectedTime);
  return lateMinutes > lateThreshold ? 'late' : 'present';
};

/**
 * Calculate attendance points (for gamification)
 * @param {String} status - Attendance status
 * @param {number} lateMinutes - Late minutes
 * @returns {number} Points earned/lost
 */
export const calculateAttendancePoints = (status, lateMinutes = 0) => {
  switch (status) {
    case 'present':
      return lateMinutes === 0 ? 10 : Math.max(5 - Math.floor(lateMinutes / 5), 0);
    case 'late':
      return Math.max(-Math.floor(lateMinutes / 10), -5);
    case 'absent':
      return -10;
    default:
      return 0;
  }
};













