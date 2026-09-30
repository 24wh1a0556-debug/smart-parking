import { Router, Response } from 'express';
import pool, { query } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { calculateFee } from '../services/feeService';

const router = Router();

// POST /api/parking/entry - Verify and record vehicle entry
router.post('/entry', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { booking_id } = req.body;
  if (!booking_id) throw new AppError('Booking ID is required', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reservationResult = await client.query(
      `SELECT r.*, 
              v.vehicle_number, v.vehicle_type,
              ps.slot_number, ps.id as slot_db_id
       FROM reservations r
       JOIN vehicles v ON v.id = r.vehicle_id
       JOIN parking_slots ps ON ps.id = r.slot_id
       WHERE r.booking_id = $1 FOR UPDATE`,
      [booking_id]
    );

    if (reservationResult.rows.length === 0) {
      throw new AppError('Booking ID not found', 404);
    }

    const reservation = reservationResult.rows[0];

    if (reservation.status !== 'CONFIRMED') {
      if (reservation.status === 'ACTIVE') {
        throw new AppError('Vehicle has already entered', 400);
      }
      throw new AppError(`Reservation status is ${reservation.status}. Entry not allowed.`, 400);
    }

    const resDate = new Date(reservation.reservation_date);
    const today = new Date();
    resDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const dayDiff = Math.abs((today.getTime() - resDate.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff > 1) {
      throw new AppError('Reservation is not for today', 400);
    }

    const entryTime = new Date();

    await client.query(
      `INSERT INTO parking_sessions (reservation_id, entry_time, verified_by)
       VALUES ($1, $2, $3)`,
      [reservation.id, entryTime, req.user!.userId]
    );

    await client.query(
      `UPDATE reservations SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`,
      [reservation.id]
    );

    await client.query(
      `UPDATE parking_slots SET status = 'OCCUPIED', updated_at = NOW() WHERE id = $1`,
      [reservation.slot_db_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Entry verified successfully',
      data: {
        booking_id,
        slot_number: reservation.slot_number,
        vehicle_number: reservation.vehicle_number,
        entry_time: entryTime,
        expected_end_time: reservation.expected_end_time,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/parking/exit - Verify and record vehicle exit
router.post('/exit', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { booking_id } = req.body;
  if (!booking_id) throw new AppError('Booking ID is required', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reservationResult = await client.query(
      `SELECT r.*, 
              v.vehicle_number, v.vehicle_type,
              ps.slot_number, ps.id as slot_db_id,
              sess.id as session_id, sess.entry_time
       FROM reservations r
       JOIN vehicles v ON v.id = r.vehicle_id
       JOIN parking_slots ps ON ps.id = r.slot_id
       JOIN parking_sessions sess ON sess.reservation_id = r.id
       WHERE r.booking_id = $1 FOR UPDATE`,
      [booking_id]
    );

    if (reservationResult.rows.length === 0) {
      throw new AppError('Booking ID not found or no active session', 404);
    }

    const reservation = reservationResult.rows[0];

    if (reservation.status !== 'ACTIVE' && reservation.status !== 'OVERSTAY') {
      throw new AppError(`Reservation status is ${reservation.status}. Exit not allowed.`, 400);
    }

    const exitTime = new Date();
    const entryTime = new Date(reservation.entry_time);
    const durationMs = exitTime.getTime() - entryTime.getTime();
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));

    const feeResult = await calculateFee(reservation.vehicle_type, entryTime, exitTime);

    await client.query(
      `UPDATE parking_sessions SET 
         exit_time = $1, 
         actual_duration_minutes = $2, 
         final_fee = $3,
         fee_paid = true,
         updated_at = NOW()
       WHERE id = $4`,
      [exitTime, durationMinutes, feeResult.estimatedFee, reservation.session_id]
    );

    await client.query(
      `UPDATE reservations SET 
         status = 'COMPLETED', 
         actual_end_time = $1, 
         actual_fee = $2,
         updated_at = NOW()
       WHERE id = $3`,
      [exitTime, feeResult.estimatedFee, reservation.id]
    );

    await client.query(
      `UPDATE parking_slots SET status = 'AVAILABLE', updated_at = NOW() WHERE id = $1`,
      [reservation.slot_db_id]
    );

    await client.query('COMMIT');

    await query(
      `INSERT INTO notifications (user_id, type, title, message, related_id)
       VALUES ($1, 'SESSION_COMPLETED', 'Parking Session Completed', $2, $3)`,
      [
        reservation.user_id,
        `Your parking session for slot ${reservation.slot_number} is complete. Duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m. Fee: ₹${feeResult.estimatedFee}`,
        reservation.id,
      ]
    );

    res.json({
      success: true,
      message: 'Exit recorded successfully',
      data: {
        booking_id,
        slot_number: reservation.slot_number,
        vehicle_number: reservation.vehicle_number,
        entry_time: entryTime,
        exit_time: exitTime,
        duration_minutes: durationMinutes,
        duration_display: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
        final_fee: feeResult.estimatedFee,
        fee_breakdown: feeResult.breakdown,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// GET /api/parking/verify/:bookingId
router.get('/verify/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT r.*, 
            v.vehicle_number, v.vehicle_type, v.vehicle_model,
            ps.slot_number, ps.floor, ps.section,
            u.full_name as user_name
     FROM reservations r
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN parking_slots ps ON ps.id = r.slot_id
     JOIN users u ON u.id = r.user_id
     WHERE r.booking_id = $1`,
    [req.params.bookingId]
  );

  if (result.rows.length === 0) {
    res.json({ success: false, valid: false, message: 'Booking not found' });
    return;
  }

  const reservation = result.rows[0];
  const isValid = ['CONFIRMED', 'ACTIVE'].includes(reservation.status);

  res.json({
    success: true,
    valid: isValid,
    data: reservation,
    message: isValid ? 'Valid booking' : `Booking status: ${reservation.status}`,
  });
}));

// GET /api/parking/history
router.get('/history', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '10', vehicle_id, status } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const isAdmin = req.user!.role === 'ADMIN';

  let sql = `
    SELECT r.*, 
           v.vehicle_number, v.vehicle_type, v.vehicle_model,
           ps.slot_number, ps.floor, ps.section,
           u.full_name as user_name,
           sess.entry_time, sess.exit_time, sess.actual_duration_minutes, 
           sess.final_fee, sess.fee_paid
    FROM reservations r
    JOIN vehicles v ON v.id = r.vehicle_id
    JOIN parking_slots ps ON ps.id = r.slot_id
    JOIN users u ON u.id = r.user_id
    LEFT JOIN parking_sessions sess ON sess.reservation_id = r.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIdx = 1;

  if (!isAdmin) {
    sql += ` AND r.user_id = $${paramIdx++}`;
    params.push(req.user!.userId);
  }

  if (vehicle_id) {
    sql += ` AND r.vehicle_id = $${paramIdx++}`;
    params.push(vehicle_id);
  }
  if (status) {
    sql += ` AND r.status = $${paramIdx++}`;
    params.push(status);
  }

  sql += ` ORDER BY r.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(parseInt(limit as string), offset);

  const result = await query(sql, params);
  res.json({ success: true, data: result.rows });
}));

// GET /api/parking/overstay
router.get('/overstay', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const isAdmin = req.user!.role === 'ADMIN';
  const sql = `
    SELECT r.*, 
           v.vehicle_number, v.vehicle_type,
           ps.slot_number, ps.floor,
           u.full_name as user_name, u.email as user_email,
           sess.entry_time,
           EXTRACT(EPOCH FROM (NOW() - r.expected_end_time))/60 as overstay_minutes
    FROM reservations r
    JOIN vehicles v ON v.id = r.vehicle_id
    JOIN parking_slots ps ON ps.id = r.slot_id
    JOIN users u ON u.id = r.user_id
    JOIN parking_sessions sess ON sess.reservation_id = r.id
    WHERE r.status = 'ACTIVE' 
      AND r.expected_end_time < NOW()
      ${!isAdmin ? 'AND r.user_id = $1' : ''}
    ORDER BY r.expected_end_time ASC
  `;

  const result = await query(sql, !isAdmin ? [req.user!.userId] : []);
  res.json({ success: true, data: result.rows });
}));

export default router;
