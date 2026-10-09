import { Router, type Request, type Response } from 'express';
import { getDatabase } from '../db/client.js';
import { seedDatabase } from '../db/seed.js';
import { broadcaster } from '../realtime/broadcaster.js';
import { scoringService } from '../services/scoring.js';
import { formatMatchResponse } from '../services/lifecycle.js';

export const demoRouter = Router();

/**
 * POST /api/demo/reset
 * Restores the entire database to the pristine tournament seed data.
 */
demoRouter.post('/reset', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    seedDatabase(db, { clean: true });

    // Notify all active connected clients to refresh data
    broadcaster.broadcast('all', {
      type: 'DEMO_RESET',
      message: 'Demo tournament state has been reset to starting seed',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Demo database reset to original tournament state',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset demo state', message: err.message });
  }
});

/**
 * POST /api/demo/clean
 * Resets tournament to Day 0 (0 matches, 0-0 standings).
 */
demoRouter.post('/clean', (_req: Request, res: Response) => {
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
    res.status(500).json({ error: 'Failed to clean tournament', message: err.message });
  }
});

/**
 * POST /api/demo/simulate
 * Simulates a realistic live sport scoring event on an active match (Futsal or Badminton).
 */
demoRouter.post('/simulate', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    // Look for an active live match (e.g. match-09 Futsal or match-10 Badminton)
    let match = db.queryOne<any>(
      "SELECT * FROM matches WHERE status IN ('Draft', 'DRAFT') AND sport_id = 'sport-futsal' LIMIT 1"
    );

    if (!match) {
      match = db.queryOne<any>(
        "SELECT * FROM matches WHERE status IN ('Draft', 'DRAFT') LIMIT 1"
      );
    }

    if (!match) {
      return res.status(404).json({ error: 'No active Draft match found for simulation' });
    }

    // Determine random simulation action
    const isHome = Math.random() > 0.45;
    const team = isHome ? 'HOME' : 'AWAY';
    const isFutsal = match.sport_id.includes('futsal') || match.sport_id.includes('football');

    let eventType = isFutsal ? 'GOAL' : 'POINT';
    const roll = Math.random();
    if (roll > 0.85) {
      eventType = 'YELLOW_CARD';
    } else if (roll > 0.95) {
      eventType = 'RED_CARD';
    }

    // Select a player from corresponding cohort
    const cohortId = isHome ? match.home_cohort_id : match.away_cohort_id;
    const player = db.queryOne<any>(
      "SELECT id, name, jersey_number FROM players WHERE cohort_id = ? AND status = 'ACTIVE' ORDER BY RANDOM() LIMIT 1",
      [cohortId]
    );

    const currentMinute = Math.floor((match.current_time_seconds || 1800) / 60) + 1;
    const newSeconds = (match.current_time_seconds || 1800) + 45;

    // Advance clock
    db.execute(
      "UPDATE matches SET current_time_seconds = ?, updated_at = datetime('now') WHERE id = ?",
      [newSeconds, match.id]
    );

    // Record event via scoringService
    const result = scoringService.logEvent(match, {
      event_type: eventType,
      team,
      player_id: player?.id,
      minute: currentMinute,
      second: Math.floor(Math.random() * 59),
      payload: {
        simulated: true,
        playerName: player?.name,
        jerseyNumber: player?.jersey_number,
        detail: eventType === 'GOAL' ? 'Thunderous strike into top corner' : 'Crucial rally point',
      },
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Broadcast live event to all channels
    broadcaster.broadcastMatchEvent(match.id, result.event, result.match);

    res.json({
      success: true,
      event: result.event,
      match: formatMatchResponse(result.match),
      playerName: player?.name,
      team,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Simulation failed', message: err.message });
  }
});
