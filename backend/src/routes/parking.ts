import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/parking/location - Get parking lot coordinates
router.get('/location', authenticate, asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT key, value FROM parking_config WHERE key IN ('parking_lot_name','parking_lot_lat','parking_lot_lng','parking_lot_address')`
  );

  const config: Record<string, string> = {};
  for (const row of result.rows) config[row.key] = row.value;

  res.json({
    success: true,
    data: {
      name:    config['parking_lot_name']    || 'Smart Parking',
      lat:     parseFloat(config['parking_lot_lat']  || '17.4485'),
      lng:     parseFloat(config['parking_lot_lng']  || '78.3908'),
      address: config['parking_lot_address'] || '',
    },
  });
}));

// GET /api/parking/slots - Get all parking slots
router.get('/slots', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, vehicle_type, section } = req.query;

  let sql = `
    SELECT ps.*, 
           COUNT(r.id) FILTER (WHERE r.status IN ('CONFIRMED', 'ACTIVE')) as active_reservations
    FROM parking_slots ps
    LEFT JOIN reservations r ON r.slot_id = ps.id AND r.status IN ('CONFIRMED', 'ACTIVE')
    WHERE ps.is_active = true
  `;
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND ps.status = $${paramIdx++}`;
    params.push(status);
  }
  if (vehicle_type) {
    sql += ` AND (ps.vehicle_type = $${paramIdx++} OR ps.vehicle_type = 'ANY')`;
    params.push(vehicle_type);
  }
  if (section) {
    sql += ` AND ps.section = $${paramIdx++}`;
    params.push(section);
  }

  sql += ` GROUP BY ps.id ORDER BY ps.section, ps.slot_number`;

  const result = await query(sql, params);
  res.json({ success: true, data: result.rows });
}));

// GET /api/parking/slots/best - Find best available slot
router.get('/slots/best', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { vehicle_type } = req.query;

  const sql = `
    SELECT ps.*
    FROM parking_slots ps
    WHERE ps.is_active = true 
      AND ps.status = 'AVAILABLE'
      AND ($1::text IS NULL OR ps.vehicle_type = $1 OR ps.vehicle_type = 'ANY')
    ORDER BY ps.distance_from_entrance ASC
    LIMIT 5
  `;

  const result = await query(sql, [vehicle_type || null]);
  res.json({ success: true, data: result.rows });
}));

// GET /api/parking/slots/stats - Get slot statistics
router.get('/slots/stats', authenticate, asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(`
    SELECT 
      COUNT(*) FILTER (WHERE is_active = true) as total,
      COUNT(*) FILTER (WHERE status = 'AVAILABLE' AND is_active = true) as available,
      COUNT(*) FILTER (WHERE status = 'OCCUPIED' AND is_active = true) as occupied,
      COUNT(*) FILTER (WHERE status = 'RESERVED' AND is_active = true) as reserved,
      COUNT(*) FILTER (WHERE status = 'MAINTENANCE' AND is_active = true) as maintenance
    FROM parking_slots
  `);
  res.json({ success: true, data: result.rows[0] });
}));

// GET /api/parking/slots/:id - Get single slot
router.get('/slots/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT ps.*, 
            r.booking_id, r.user_id as reserved_by_user_id, 
            r.start_time, r.expected_end_time, r.status as reservation_status
     FROM parking_slots ps
     LEFT JOIN reservations r ON r.slot_id = ps.id AND r.status IN ('CONFIRMED', 'ACTIVE')
     WHERE ps.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) throw new AppError('Slot not found', 404);
  res.json({ success: true, data: result.rows[0] });
}));

// POST /api/parking/slots - Admin: Add slot
router.post(
  '/slots',
  authenticate,
  requireAdmin,
  [
    body('slot_number').trim().notEmpty().withMessage('Slot number is required'),
    body('floor').trim().notEmpty().withMessage('Floor is required'),
    body('vehicle_type').isIn(['CAR', 'BIKE', 'TRUCK', 'EV', 'ANY']).withMessage('Invalid vehicle type'),
    body('distance_from_entrance').isInt({ min: 0 }).withMessage('Distance must be a positive number'),
    body('section').trim().notEmpty().withMessage('Section is required'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { slot_number, floor, vehicle_type, distance_from_entrance, section, status } = req.body;

    const result = await query(
      `INSERT INTO parking_slots (slot_number, floor, vehicle_type, distance_from_entrance, section, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [slot_number, floor, vehicle_type, distance_from_entrance, section, status || 'AVAILABLE']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

// PUT /api/parking/slots/:id - Admin: Update slot
router.put(
  '/slots/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { floor, vehicle_type, distance_from_entrance, section, status, is_active } = req.body;

    const result = await query(
      `UPDATE parking_slots SET
         floor = COALESCE($1, floor),
         vehicle_type = COALESCE($2, vehicle_type),
         distance_from_entrance = COALESCE($3, distance_from_entrance),
         section = COALESCE($4, section),
         status = COALESCE($5, status),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [floor, vehicle_type, distance_from_entrance, section, status, is_active, req.params.id]
    );

    if (result.rows.length === 0) throw new AppError('Slot not found', 404);
    res.json({ success: true, data: result.rows[0] });
  })
);

// DELETE /api/parking/slots/:id - Admin: Delete/deactivate slot
router.delete(
  '/slots/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await query(
      `UPDATE parking_slots SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) throw new AppError('Slot not found', 404);
    res.json({ success: true, message: 'Slot deactivated successfully' });
  })
);

export default router;
