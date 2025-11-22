/**
 * Calculate late minutes based on expected check-in time
 * @param {Date} checkInTime - Actual check-in time
 * @param {String} expectedTime - Expected check-in time (HH:mm format)
 * @returns {number} Late minutes (0 if on time or early)
 */
const JORDAN_TIMEZONE = 'Asia/Amman';

const convertToTimezone = (date, timeZone = JORDAN_TIMEZONE) => {
  if (!date) return null;
  return new Date(new Date(date).toLocaleString('en-US', { timeZone }));
};

export const calculateLateMinutes = (checkInTime, expectedTime) => {
  const checkIn = convertToTimezone(checkInTime);
  if (!checkIn || !expectedTime) return 0;
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
  const checkIn = convertToTimezone(checkInTime);
  const checkOut = convertToTimezone(checkOutTime);
  const diffMs = checkOut - checkIn;
  return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
};

/**
 * Calculate overtime hours
 * @param {number} workingMinutes - Total working minutes
 * @param {number} expectedMinutes - Expected working minutes per day
 * @returns {number} Overtime in minutes (0 if no overtime)
 */
export const calculateOvertime = (workingMinutes, expectedMinutes = 480) => {
  // Default expected: 8 hours = 480 minutes (9 AM to 5 PM)
  const overtime = workingMinutes - expectedMinutes;
  return overtime > 0 ? overtime : 0;
};

/**
 * Get standard working hours configuration for Jordan
 * @returns {Object} Working hours config
 */
export const getWorkingHoursConfig = () => {
  return {
    startTime: '09:00', // 9 AM
    endTime: '17:00',   // 5 PM
    durationMinutes: 480, // 8 hours
    timezone: 'Asia/Amman' // Jordan timezone
  };
};

/**
 * Get expected check-out time based on check-in time
 * @param {Date} checkInTime - Check-in time
 * @param {String} expectedCheckInTime - Expected check-in time (default: '09:00')
 * @returns {Date} Expected check-out time (8 hours after expected check-in)
 */
export const getExpectedCheckOutTime = (checkInTime, expectedCheckInTime = '09:00') => {
  const checkIn = convertToTimezone(checkInTime);
  const [hours, minutes] = expectedCheckInTime.split(':').map(Number);
  
  // Set expected check-in time for the same date
  const expectedCheckIn = new Date(checkIn);
  expectedCheckIn.setHours(hours, minutes, 0, 0);
  
  // Expected check-out is 8 hours after expected check-in (9 AM to 5 PM)
  const expectedCheckOut = new Date(expectedCheckIn);
  expectedCheckOut.setHours(expectedCheckOut.getHours() + 8);
  
  return expectedCheckOut;
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













