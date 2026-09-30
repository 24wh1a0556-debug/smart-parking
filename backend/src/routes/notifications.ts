import { Router, Response } from 'express';
import { query } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  const result = await query(
    `SELECT * FROM notifications WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [req.user!.userId, parseInt(limit as string), offset]
  );

  const unreadCount = await query(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [req.user!.userId]
  );

  res.json({
    success: true,
    data: result.rows,
    unread_count: parseInt(unreadCount.rows[0].count),
  });
}));

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user!.userId]
  );
  if (result.rows.length === 0) throw new AppError('Notification not found', 404);
  res.json({ success: true, message: 'Notification marked as read' });
}));

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1`,
    [req.user!.userId]
  );
  res.json({ success: true, message: 'All notifications marked as read' });
}));

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user!.userId]
  );
  if (result.rows.length === 0) throw new AppError('Notification not found', 404);
  res.json({ success: true, message: 'Notification deleted' });
}));

export default router;
