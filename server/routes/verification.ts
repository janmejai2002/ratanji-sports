import { Router, type Request, type Response } from 'express';
import { getVerificationQueue, transitionMatch } from '../services/lifecycle.js';
import { requireAdmin, extractUser } from '../services/rbac.js';
import { getDatabase } from '../db/client.js';
import { seedDatabase } from '../db/seed.js';
import { broadcaster } from '../realtime/broadcaster.js';

export const verificationRouter = Router();

/**
 * GET /api/admin/verifications
 * Returns all matches in 'Submitted' status awaiting Sports Committee review.
 * Protected: Admin only (Spectator and Referee rejected with 401/403).
 */
verificationRouter.get('/', requireAdmin, (_req: Request, res: Response) => {
  try {
    const queue = getVerificationQueue();
    res.json(queue);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve verification queue', message: err.message });
  }
});

/**
 * POST /api/admin/verifications/:id/verify
 * Verification action alias.
 */
verificationRouter.post('/:id/verify', requireAdmin, (req: Request, res: Response) => {
  const user = req.user || extractUser(req);
  const result = transitionMatch(req.params.id, 'Verified', user!);
  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  res.json(result.match);
});

/**
 * POST /api/admin/verifications/:id/publish
 * Publication action alias.
 */
verificationRouter.post('/:id/publish', requireAdmin, (req: Request, res: Response) => {
  const user = req.user || extractUser(req);
  const result = transitionMatch(req.params.id, 'Published', user!);
  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  res.json(result.match);
});

/**
 * POST /api/admin/verifications/:id/reject
 * Rejection action alias.
 */
verificationRouter.post('/:id/reject', requireAdmin, (req: Request, res: Response) => {
  const user = req.user || extractUser(req);
  const { notes } = req.body || {};
  const result = transitionMatch(req.params.id, 'Draft', user!, notes);
  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  res.json(result.match);
});

/**
 * POST /api/admin/verifications/reset-tournament
 * Clean slate reset: wipes all mock matches, audits, events, and resets standings to 0-0.
 */
verificationRouter.post('/reset-tournament', requireAdmin, (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    seedDatabase(db, { clean: true, cleanOnly: true });

    broadcaster.broadcast('all', {
      type: 'TOURNAMENT_RESET',
      message: 'Tournament has been reset to pristine Day 0 state (0 matches, 0-0 standings)',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Tournament has been reset to Day 0: 0 matches, 0-0 cohort standings',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset tournament', message: err.message });
  }
});
