import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/vehicles - Get user's vehicles
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.userId]
  );
  res.json({ success: true, data: result.rows });
}));

// GET /api/vehicles/:id
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT * FROM vehicles WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user!.userId]
  );
  if (result.rows.length === 0) throw new AppError('Vehicle not found', 404);
  res.json({ success: true, data: result.rows[0] });
}));

// POST /api/vehicles - Add vehicle
router.post(
  '/',
  authenticate,
  [
    body('vehicle_number').trim().notEmpty().withMessage('Vehicle number is required').toUpperCase(),
    body('vehicle_type').isIn(['CAR', 'BIKE', 'TRUCK', 'EV']).withMessage('Invalid vehicle type'),
    body('vehicle_model').trim().notEmpty().withMessage('Vehicle model is required'),
    body('nickname').optional().trim(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { vehicle_number, vehicle_type, vehicle_model, nickname } = req.body;

    const existing = await query('SELECT id FROM vehicles WHERE vehicle_number = $1', [vehicle_number]);
    if (existing.rows.length > 0) {
      throw new AppError('Vehicle number already registered', 409);
    }

    const result = await query(
      `INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, vehicle_model, nickname)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user!.userId, vehicle_number, vehicle_type, vehicle_model, nickname || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

// PUT /api/vehicles/:id - Update vehicle
router.put(
  '/:id',
  authenticate,
  [
    body('vehicle_type').optional().isIn(['CAR', 'BIKE', 'TRUCK', 'EV']),
    body('vehicle_model').optional().trim().notEmpty(),
    body('nickname').optional().trim(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { vehicle_type, vehicle_model, nickname } = req.body;

    const result = await query(
      `UPDATE vehicles SET
         vehicle_type = COALESCE($1, vehicle_type),
         vehicle_model = COALESCE($2, vehicle_model),
         nickname = COALESCE($3, nickname),
         updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [vehicle_type, vehicle_model, nickname, req.params.id, req.user!.userId]
    );

    if (result.rows.length === 0) throw new AppError('Vehicle not found', 404);
    res.json({ success: true, data: result.rows[0] });
  })
);

// DELETE /api/vehicles/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const activeRes = await query(
    `SELECT id FROM reservations WHERE vehicle_id = $1 AND status IN ('PENDING', 'CONFIRMED', 'ACTIVE')`,
    [req.params.id]
  );
  if (activeRes.rows.length > 0) {
    throw new AppError('Cannot delete vehicle with active reservations', 400);
  }

  const result = await query(
    `DELETE FROM vehicles WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user!.userId]
  );
  if (result.rows.length === 0) throw new AppError('Vehicle not found', 404);
  res.json({ success: true, message: 'Vehicle deleted successfully' });
}));

export default router;
