import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import QRCode from 'qrcode';
import pool, { query } from '../database/db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { calculateFee, generateBookingId } from '../services/feeService';

const router = Router();

// GET /api/reservations - Get user's reservations
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, page = '1', limit = '10' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const isAdmin = req.user!.role === 'ADMIN';

  let sql = `
    SELECT r.*,
           u.full_name as user_name, u.email as user_email,
           v.vehicle_number, v.vehicle_type, v.vehicle_model,
           ps.slot_number, ps.floor, ps.section,
           ps.distance_from_entrance
    FROM reservations r
    JOIN users u ON u.id = r.user_id
    JOIN vehicles v ON v.id = r.vehicle_id
    JOIN parking_slots ps ON ps.id = r.slot_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIdx = 1;

  if (!isAdmin) {
    sql += ` AND r.user_id = $${paramIdx++}`;
    params.push(req.user!.userId);
  }

  if (status) {
    sql += ` AND r.status = $${paramIdx++}`;
    params.push(status);
  }

  sql += ` ORDER BY r.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(parseInt(limit as string), offset);

  const result = await query(sql, params);
  res.json({
    success: true,
    data: result.rows,
    page: parseInt(page as string),
    limit: parseInt(limit as string),
  });
}));

// POST /api/reservations - Create reservation
router.post(
  '/',
  authenticate,
  [
    body('slot_id').notEmpty().withMessage('Slot ID is required'),
    body('vehicle_id').notEmpty().withMessage('Vehicle ID is required'),
    body('reservation_date').isDate().withMessage('Valid date required (YYYY-MM-DD)'),
    body('start_time').notEmpty().withMessage('Start time is required'),
    body('expected_end_time').notEmpty().withMessage('Expected end time is required'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { slot_id, vehicle_id, reservation_date, start_time, expected_end_time } = req.body;

    const startDate = new Date(start_time);
    const endDate = new Date(expected_end_time);

    if (endDate <= startDate) {
      throw new AppError('End time must be after start time', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const slotResult = await client.query(
        `SELECT * FROM parking_slots WHERE id = $1 AND is_active = true FOR UPDATE`,
        [slot_id]
      );

      if (slotResult.rows.length === 0) throw new AppError('Slot not found', 404);
      const slot = slotResult.rows[0];

      if (slot.status !== 'AVAILABLE') {
        throw new AppError(`Slot is not available (current status: ${slot.status})`, 409);
      }

      const overlap = await client.query(
        `SELECT id FROM reservations 
         WHERE slot_id = $1 
           AND status IN ('CONFIRMED', 'ACTIVE', 'PENDING')
           AND NOT (expected_end_time <= $2 OR start_time >= $3)`,
        [slot_id, startDate, endDate]
      );

      if (overlap.rows.length > 0) {
        throw new AppError('Slot is already reserved for this time period', 409);
      }

      const vehicleResult = await client.query(
        `SELECT * FROM vehicles WHERE id = $1 AND user_id = $2`,
        [vehicle_id, req.user!.userId]
      );
      if (vehicleResult.rows.length === 0) throw new AppError('Vehicle not found', 404);
      const vehicle = vehicleResult.rows[0];

      const feeResult = await calculateFee(vehicle.vehicle_type, startDate, endDate);
      const bookingId = generateBookingId();

      const qrData = JSON.stringify({
        bookingId,
        slotNumber: slot.slot_number,
        vehicleNumber: vehicle.vehicle_number,
        date: reservation_date,
      });
      const qrCode = await QRCode.toDataURL(qrData);

      const reservationResult = await client.query(
        `INSERT INTO reservations 
         (booking_id, user_id, vehicle_id, slot_id, reservation_date, start_time, expected_end_time, 
          status, estimated_fee, qr_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', $8, $9)
         RETURNING *`,
        [bookingId, req.user!.userId, vehicle_id, slot_id, reservation_date,
          startDate, endDate, feeResult.estimatedFee, qrCode]
      );

      await client.query(
        `UPDATE parking_slots SET status = 'RESERVED', updated_at = NOW() WHERE id = $1`,
        [slot_id]
      );

      await client.query('COMMIT');

      await query(
        `INSERT INTO notifications (user_id, type, title, message, related_id)
         VALUES ($1, 'RESERVATION_CONFIRMED', 'Reservation Confirmed', $2, $3)`,
        [
          req.user!.userId,
          `Your reservation ${bookingId} for slot ${slot.slot_number} has been confirmed.`,
          reservationResult.rows[0].id,
        ]
      );

      const reservation = reservationResult.rows[0];

      res.status(201).json({
        success: true,
        data: {
          ...reservation,
          slot_number: slot.slot_number,
          vehicle_number: vehicle.vehicle_number,
          fee_breakdown: feeResult.breakdown,
          duration_hours: feeResult.durationHours,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// GET /api/reservations/:id - Get single reservation
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const isAdmin = req.user!.role === 'ADMIN';
  const whereClause = isAdmin ? '' : ' AND r.user_id = $2';
  const params: unknown[] = isAdmin ? [req.params.id] : [req.params.id, req.user!.userId];

  const result = await query(
    `SELECT r.*, 
            u.full_name as user_name, u.email as user_email,
            v.vehicle_number, v.vehicle_type, v.vehicle_model,
            ps.slot_number, ps.floor, ps.section, ps.distance_from_entrance,
            sess.entry_time, sess.exit_time, sess.final_fee, sess.fee_paid
     FROM reservations r
     JOIN users u ON u.id = r.user_id
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN parking_slots ps ON ps.id = r.slot_id
     LEFT JOIN parking_sessions sess ON sess.reservation_id = r.id
     WHERE r.id = $1${whereClause}`,
    params
  );

  if (result.rows.length === 0) throw new AppError('Reservation not found', 404);
  res.json({ success: true, data: result.rows[0] });
}));

// GET /api/reservations/booking/:bookingId
router.get('/booking/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT r.*, 
            u.full_name as user_name, u.email as user_email,
            v.vehicle_number, v.vehicle_type, v.vehicle_model,
            ps.slot_number, ps.floor, ps.section,
            sess.entry_time, sess.exit_time, sess.final_fee
     FROM reservations r
     JOIN users u ON u.id = r.user_id
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN parking_slots ps ON ps.id = r.slot_id
     LEFT JOIN parking_sessions sess ON sess.reservation_id = r.id
     WHERE r.booking_id = $1`,
    [req.params.bookingId]
  );

  if (result.rows.length === 0) throw new AppError('Booking not found', 404);
  res.json({ success: true, data: result.rows[0] });
}));

// DELETE /api/reservations/:id - Cancel reservation
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const isAdmin = req.user!.role === 'ADMIN';

  const result = await query(
    `SELECT r.*, ps.id as slot_id FROM reservations r 
     JOIN parking_slots ps ON ps.id = r.slot_id 
     WHERE r.id = $1 ${isAdmin ? '' : 'AND r.user_id = $2'}`,
    isAdmin ? [req.params.id] : [req.params.id, req.user!.userId]
  );

  if (result.rows.length === 0) throw new AppError('Reservation not found', 404);
  const reservation = result.rows[0];

  if (!['CONFIRMED', 'PENDING'].includes(reservation.status)) {
    throw new AppError(`Cannot cancel a ${reservation.status.toLowerCase()} reservation`, 400);
  }

  await query(
    `UPDATE reservations SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );

  await query(
    `UPDATE parking_slots SET status = 'AVAILABLE', updated_at = NOW() WHERE id = $1`,
    [reservation.slot_id]
  );

  await query(
    `INSERT INTO notifications (user_id, type, title, message, related_id)
     VALUES ($1, 'RESERVATION_CANCELLED', 'Reservation Cancelled', $2, $3)`,
    [
      reservation.user_id,
      `Your reservation ${reservation.booking_id} has been cancelled.`,
      reservation.id,
    ]
  );

  res.json({ success: true, message: 'Reservation cancelled successfully' });
}));

export default router;
