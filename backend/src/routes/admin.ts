import { Router, Response } from 'express';
import { query } from '../database/db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard - Dashboard stats
router.get('/dashboard', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];

  const [slotsStats, usersStats, todayRes, todayRevenue, activeRes, overstay] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true) as total_slots,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE' AND is_active = true) as available,
        COUNT(*) FILTER (WHERE status = 'OCCUPIED' AND is_active = true) as occupied,
        COUNT(*) FILTER (WHERE status = 'RESERVED' AND is_active = true) as reserved,
        COUNT(*) FILTER (WHERE status = 'MAINTENANCE' AND is_active = true) as maintenance
      FROM parking_slots
    `),
    query(`SELECT COUNT(*) as total_users, COUNT(*) FILTER (WHERE is_active = true) as active_users FROM users WHERE role = 'USER'`),
    query(`SELECT COUNT(*) as count FROM reservations WHERE reservation_date = $1 AND status != 'CANCELLED'`, [today]),
    query(`
      SELECT COALESCE(SUM(COALESCE(actual_fee, estimated_fee)), 0) as revenue
      FROM reservations 
      WHERE reservation_date = $1 AND status IN ('COMPLETED', 'ACTIVE')
    `, [today]),
    query(`SELECT COUNT(*) as count FROM reservations WHERE status = 'ACTIVE'`),
    query(`
      SELECT COUNT(*) as count FROM reservations 
      WHERE status = 'ACTIVE' AND expected_end_time < NOW()
    `),
  ]);

  res.json({
    success: true,
    data: {
      slots: slotsStats.rows[0],
      users: usersStats.rows[0],
      today_reservations: parseInt(todayRes.rows[0].count),
      today_revenue: parseFloat(todayRevenue.rows[0].revenue),
      active_sessions: parseInt(activeRes.rows[0].count),
      overstay_alerts: parseInt(overstay.rows[0].count),
    },
  });
}));

// GET /api/admin/analytics - Analytics data
router.get('/analytics', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { days = '30' } = req.query;
  const daysNum = parseInt(days as string);

  const [hourlyOccupancy, dailyReservations, slotUsage, vehicleTypes, peakHours] = await Promise.all([
    query(`
      SELECT 
        EXTRACT(HOUR FROM start_time) as hour,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM parking_slots WHERE is_active = true), 0), 1) as occupancy_percent
      FROM reservations
      WHERE created_at > NOW() - INTERVAL '${daysNum} days'
        AND status IN ('COMPLETED', 'ACTIVE', 'OVERSTAY')
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY hour
    `),
    query(`
      SELECT 
        DATE(reservation_date) as date,
        COUNT(*) as reservations,
        COALESCE(SUM(COALESCE(actual_fee, estimated_fee)), 0) as revenue
      FROM reservations
      WHERE reservation_date > CURRENT_DATE - INTERVAL '${daysNum} days'
        AND status != 'CANCELLED'
      GROUP BY DATE(reservation_date)
      ORDER BY date
    `),
    query(`
      SELECT ps.slot_number, ps.section, ps.floor, COUNT(r.id) as total_reservations
      FROM parking_slots ps
      LEFT JOIN reservations r ON r.slot_id = ps.id AND r.status IN ('COMPLETED', 'ACTIVE')
      GROUP BY ps.id, ps.slot_number, ps.section, ps.floor
      ORDER BY total_reservations DESC
      LIMIT 10
    `),
    query(`
      SELECT v.vehicle_type, COUNT(*) as count
      FROM reservations r
      JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.created_at > NOW() - INTERVAL '${daysNum} days'
        AND r.status != 'CANCELLED'
      GROUP BY v.vehicle_type
    `),
    query(`
      SELECT 
        EXTRACT(HOUR FROM entry_time) as hour,
        COUNT(*) as sessions
      FROM parking_sessions
      WHERE entry_time > NOW() - INTERVAL '${daysNum} days'
      GROUP BY EXTRACT(HOUR FROM entry_time)
      ORDER BY sessions DESC
      LIMIT 5
    `),
  ]);

  res.json({
    success: true,
    data: {
      hourly_occupancy: hourlyOccupancy.rows,
      daily_stats: dailyReservations.rows,
      slot_usage: slotUsage.rows,
      vehicle_types: vehicleTypes.rows,
      peak_hours: peakHours.rows,
    },
  });
}));

// GET /api/admin/revenue - Revenue stats
router.get('/revenue', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const [today, weekly, monthly, monthlyBreakdown] = await Promise.all([
    query(`
      SELECT COALESCE(SUM(COALESCE(actual_fee, estimated_fee)), 0) as revenue
      FROM reservations 
      WHERE reservation_date = CURRENT_DATE AND status IN ('COMPLETED', 'ACTIVE')
    `),
    query(`
      SELECT COALESCE(SUM(COALESCE(actual_fee, estimated_fee)), 0) as revenue
      FROM reservations 
      WHERE reservation_date >= CURRENT_DATE - INTERVAL '7 days'
        AND status IN ('COMPLETED', 'ACTIVE')
    `),
    query(`
      SELECT COALESCE(SUM(COALESCE(actual_fee, estimated_fee)), 0) as revenue
      FROM reservations 
      WHERE DATE_TRUNC('month', reservation_date) = DATE_TRUNC('month', CURRENT_DATE)
        AND status IN ('COMPLETED', 'ACTIVE')
    `),
    query(`
      SELECT 
        DATE(reservation_date) as date,
        COUNT(*) as transactions,
        COALESCE(SUM(COALESCE(actual_fee, estimated_fee)), 0) as revenue
      FROM reservations
      WHERE reservation_date >= CURRENT_DATE - INTERVAL '30 days'
        AND status IN ('COMPLETED', 'ACTIVE')
      GROUP BY DATE(reservation_date)
      ORDER BY date DESC
    `),
  ]);

  res.json({
    success: true,
    data: {
      today: parseFloat(today.rows[0].revenue),
      weekly: parseFloat(weekly.rows[0].revenue),
      monthly: parseFloat(monthly.rows[0].revenue),
      daily_breakdown: monthlyBreakdown.rows,
    },
  });
}));

// GET /api/admin/users - List all users
router.get('/users', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  const result = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
            COUNT(v.id) as vehicle_count,
            COUNT(r.id) as total_reservations
     FROM users u
     LEFT JOIN vehicles v ON v.user_id = u.id
     LEFT JOIN reservations r ON r.user_id = u.id AND r.status NOT IN ('CANCELLED')
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [parseInt(limit as string), offset]
  );

  res.json({ success: true, data: result.rows });
}));

// PUT /api/admin/users/:id/toggle - Toggle user active status
router.put('/users/:id/toggle', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `UPDATE users SET is_active = NOT is_active, updated_at = NOW() 
     WHERE id = $1 AND role != 'ADMIN'
     RETURNING id, full_name, email, is_active`,
    [req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('User not found or cannot modify admin', 404);
  res.json({ success: true, data: result.rows[0] });
}));

// GET /api/admin/pricing - Get pricing config
router.get('/pricing', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(`SELECT * FROM pricing_config WHERE is_active = true ORDER BY vehicle_type`);
  res.json({ success: true, data: result.rows });
}));

// PUT /api/admin/pricing/:id - Update pricing
router.put('/pricing/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { first_hour_rate, additional_hour_rate, daily_max_rate } = req.body;

  const result = await query(
    `UPDATE pricing_config SET
       first_hour_rate = COALESCE($1, first_hour_rate),
       additional_hour_rate = COALESCE($2, additional_hour_rate),
       daily_max_rate = COALESCE($3, daily_max_rate),
       updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [first_hour_rate, additional_hour_rate, daily_max_rate, req.params.id]
  );

  if (result.rows.length === 0) throw new AppError('Pricing config not found', 404);
  res.json({ success: true, data: result.rows[0] });
}));

// GET /api/admin/system-health
router.get('/system-health', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const dbResult = await query(`SELECT NOW() as db_time`);

  res.json({
    success: true,
    data: {
      api: 'healthy',
      database: 'connected',
      db_time: dbResult.rows[0].db_time,
      uptime_seconds: process.uptime(),
      memory_usage: process.memoryUsage(),
      node_version: process.version,
    },
  });
}));

export default router;
