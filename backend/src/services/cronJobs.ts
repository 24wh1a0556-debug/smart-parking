import cron from 'node-cron';
import { query } from '../database/db';

// Run every 5 minutes to check for overstay reservations
export const startOverstayCron = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Find active reservations past their expected end time
      const overstayResult = await query(`
        UPDATE reservations 
        SET status = 'OVERSTAY', updated_at = NOW()
        WHERE status = 'ACTIVE' 
          AND expected_end_time < NOW() - INTERVAL '10 minutes'
        RETURNING id, booking_id, user_id, slot_id
      `);

      if (overstayResult.rows.length > 0) {
        console.log(`⚠ Marked ${overstayResult.rows.length} reservation(s) as OVERSTAY`);

        // Create overstay notifications
        for (const res of overstayResult.rows) {
          await query(
            `INSERT INTO notifications (user_id, type, title, message, related_id)
             VALUES ($1, 'OVERSTAY', 'Parking Time Exceeded', 
                     'Your parking time has exceeded the reserved duration. Please exit or extend your booking.', $2)
             ON CONFLICT DO NOTHING`,
            [res.user_id, res.id]
          );
        }
      }
    } catch (err) {
      console.error('Overstay cron error:', err);
    }
  });

  console.log('✅ Overstay monitoring cron job started (every 5 minutes)');
};
