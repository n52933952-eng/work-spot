import cron from 'node-cron';

/**
 * Schedule daily reminders
 * Runs every minute to check for reminder times
 */
export const startScheduler = async () => {
  // Dynamic import to avoid circular dependency
  const { sendCheckInReminder, sendCheckOutReminder } = await import('./notifications.js');
  
  // Run every minute to check for reminder times
  cron.schedule('* * * * *', async () => {
    try {
      await sendCheckInReminder();
      await sendCheckOutReminder();
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  });

  console.log('Scheduler started - Reminders will be sent automatically');
};

