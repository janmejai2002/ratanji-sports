import { Router, type Request, type Response } from 'express';
import db from '../db/client.js';
import {
  transitionMatch,
  formatMatchResponse,
  isScorecardLocked,
  normalizeStatus,
} from '../services/lifecycle.js';
import {
  requireAdmin,
  requireMatchRefereeOrAdmin,
  extractUser,
  ensureUserExists,
} from '../services/rbac.js';
import { scoringService } from '../services/scoring.js';
import { broadcaster } from '../realtime/broadcaster.js';

export const matchesRouter = Router();

/**
 * GET /api/matches
 * Public match fixtures & scores with filter support:
 * - ?status=Draft|Scheduled|Submitted|Verified|Published|Live
 * - ?sport=<sport_id>
 * - ?cohort=<cohort_id>
 * - ?referee_id=<referee_id>
 */
matchesRouter.get('/', (req: Request, res: Response) => {
  try {
    const { status, sport, cohort, referee_id } = req.query;

    let sql = `
      SELECT m.*, s.name as sport_name,
             hc.name as home_cohort_name, ac.name as away_cohort_name,
             u.name as referee_name
      FROM matches m
      LEFT JOIN sports s ON m.sport_id = s.id OR m.sport_id = 'sport-' || s.id
      LEFT JOIN cohorts hc ON m.home_cohort_id = hc.id
      LEFT JOIN cohorts ac ON m.away_cohort_id = ac.id
      LEFT JOIN users u ON m.referee_id = u.id OR m.referee_id = 'usr-' || u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter: Status (Case-Insensitive)
    if (status) {
      const st = String(status).toUpperCase();
      if (st === 'LIVE') {
        sql += " AND UPPER(m.status) IN ('DRAFT', 'LIVE', 'IN_PROGRESS')";
      } else {
        sql += ' AND UPPER(m.status) = ?';
        params.push(st);
      }
    }

    // Filter: Sport
    if (sport) {
      const sp = String(sport).toLowerCase();
      sql += " AND (LOWER(m.sport_id) = ? OR LOWER(m.sport_id) = 'sport-' || ? OR LOWER(s.name) = ?)";
      params.push(sp, sp, sp);
    }

    // Filter: Cohort
    if (cohort) {
      const co = String(cohort).toLowerCase();
      sql += " AND (m.home_cohort_id = ? OR m.home_cohort_id = 'cohort-' || ? OR m.away_cohort_id = ? OR m.away_cohort_id = 'cohort-' || ?)";
      params.push(co, co, co, co);
    }

    // Filter: Referee ID (supports ref-1 and usr-ref-1)
    if (referee_id) {
      const ref = String(referee_id);
      const cleanRef = ref.replace(/^usr-/, '');
      sql += " AND (m.referee_id = ? OR m.referee_id = 'usr-' || ? OR REPLACE(m.referee_id, 'usr-', '') = ?)";
      params.push(ref, cleanRef, cleanRef);
    }

    sql += ' ORDER BY m.scheduled_at ASC';

    const rows = db.query<any>(sql, params);
    const matches = rows.map((r) => formatMatchResponse(r));

    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve matches', message: err.message });
  }
});

/**
 * GET /api/matches/:id
 * Public match detail with scorecards, event log, and audit history.
 */
matchesRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;
    const match = db.queryOne<any>('SELECT * FROM matches WHERE id = ?', [matchId]);

    if (!match) {
      return res.status(404).json({ error: `Match ${matchId} not found` });
    }

    const events = db.query<any>(
      'SELECT * FROM match_events WHERE match_id = ? ORDER BY minute ASC, second ASC, created_at ASC',
      [matchId]
    );

    const auditLogs = db.query<any>(
      'SELECT * FROM audit_logs WHERE match_id = ? ORDER BY timestamp DESC',
      [matchId]
    );

    const formatted = formatMatchResponse(match);

    res.json({
      ...formatted,
      events,
      audit_logs: auditLogs,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve match detail', message: err.message });
  }
});

/**
 * POST /api/matches
 * Admin schedules a new match. Initializes in Draft status with 0-0 score.
 */
matchesRouter.post('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const {
      tournament_id,
      sport_id,
      home_cohort_id,
      away_cohort_id,
      venue,
      scheduled_at,
      referee_id,
      status,
      notes,
    } = req.body || {};

    if (!sport_id) {
      return res.status(400).json({ error: 'Missing required field: sport_id' });
    }

    // Resolve Foreign Keys
    const defaultTourn = tournament_id || 'tourn-xlri-2026';

    // Normalize sport_id
    const sportRow = db.queryOne<{ id: string }>(
      "SELECT id FROM sports WHERE id = ? OR id = 'sport-' || ? OR LOWER(name) = LOWER(?)",
      [sport_id, sport_id, sport_id]
    );
    const resolvedSportId = sportRow ? sportRow.id : (sport_id.startsWith('sport-') ? sport_id : `sport-${sport_id}`);

    // Normalize cohort IDs
    const resolvedHome = home_cohort_id
      ? (home_cohort_id.startsWith('cohort-') ? home_cohort_id : `cohort-${home_cohort_id}`)
      : 'cohort-seniors';
    const resolvedAway = away_cohort_id
      ? (away_cohort_id.startsWith('cohort-') ? away_cohort_id : `cohort-${away_cohort_id}`)
      : 'cohort-juniors';

    // Normalize referee_id and ensure user exists
    let resolvedRefereeId: string | null = null;
    if (referee_id) {
      const cleanRef = String(referee_id).trim();
      ensureUserExists(db, cleanRef, 'referee');
      resolvedRefereeId = cleanRef;
    }

    const matchId = 'match-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const initialStatus = status ? normalizeStatus(status) : 'Draft';
    const matchVenue = venue || 'Sports Complex Arena';
    const matchTime = scheduled_at || new Date().toISOString();

    db.transaction((tx) => {
      tx.execute(`
        INSERT INTO matches (
          id, tournament_id, sport_id, home_cohort_id, away_cohort_id,
          venue, scheduled_at, referee_id, status,
          score_home, score_away, current_period, current_time_seconds,
          sport_state_json, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Scheduled', 0, '{}', ?)
      `, [
        matchId,
        defaultTourn,
        resolvedSportId,
        resolvedHome,
        resolvedAway,
        matchVenue,
        matchTime,
        resolvedRefereeId,
        initialStatus,
        notes || '',
      ]);

      const auditId = 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
      tx.execute(`
        INSERT INTO audit_logs (id, match_id, user_id, action, from_status, to_status, notes)
        VALUES (?, ?, ?, 'SCHEDULE', 'None', ?, ?)
      `, [auditId, matchId, req.user?.id || 'admin-1', initialStatus, notes || 'Match scheduled']);
    });

    const created = db.queryOne<any>('SELECT * FROM matches WHERE id = ?', [matchId]);

    res.status(201).json(formatMatchResponse(created));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to schedule match', message: err.message });
  }
});

/**
 * PUT /api/matches/:id
 * Admin updates match details (e.g. reassign referee, update venue, time).
 */
matchesRouter.put('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;
    const match = db.queryOne<any>('SELECT * FROM matches WHERE id = ?', [matchId]);
    if (!match) {
      return res.status(404).json({ error: `Match ${matchId} not found` });
    }

    const { referee_id, venue, scheduled_at, notes } = req.body || {};

    let resolvedReferee = match.referee_id;
    if (referee_id !== undefined) {
      if (referee_id === null) {
        resolvedReferee = null;
      } else {
        const cleanRef = String(referee_id).trim();
        ensureUserExists(db, cleanRef, 'referee');
        resolvedReferee = cleanRef;
      }
    }

    db.execute(`
      UPDATE matches
      SET referee_id = ?,
          venue = COALESCE(?, venue),
          scheduled_at = COALESCE(?, scheduled_at),
          notes = COALESCE(?, notes),
          updated_at = datetime('now')
      WHERE id = ?
    `, [resolvedReferee, venue, scheduled_at, notes, matchId]);

    const updated = db.queryOne<any>('SELECT * FROM matches WHERE id = ?', [matchId]);
    res.json(formatMatchResponse(updated));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update match', message: err.message });
  }
});

// ==========================================
// Lifecycle State Machine Route Endpoints
// ==========================================

/**
 * POST /api/matches/:id/submit
 * Concludes match scoring and submits scorecard (Draft -> Submitted).
 * Allowed: Assigned Referee or Admin.
 */
matchesRouter.post('/:id/submit', (req: Request, res: Response) => {
  const user = req.user || extractUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  const result = transitionMatch(req.params.id, 'Submitted', user);
  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  res.status(200).json(result.match);
});

/**
 * POST /api/matches/:id/verify
 * Sports Committee verifies submitted scorecard (Submitted -> Verified).
 * Allowed: Admin only.
 */
matchesRouter.post('/:id/verify', (req: Request, res: Response) => {
  const user = req.user || extractUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Only admin can verify scorecards' });
  }

  const result = transitionMatch(req.params.id, 'Verified', user);
  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  res.status(200).json(result.match);
});

/**
 * POST /api/matches/:id/publish
 * Commits official result & triggers standings update (Verified/Submitted -> Published).
 * Allowed: Admin only.
 */
matchesRouter.post('/:id/publish', (req: Request, res: Response) => {
  const user = req.user || extractUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Only admin can publish match results' });
  }

  const result = transitionMatch(req.params.id, 'Published', user);
  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  res.status(200).json(result.match);
});

/**
 * POST /api/matches/:id/reject
 * Rejects submitted scorecard back to Draft with required explanation notes (Submitted -> Draft).
 * Allowed: Admin only.
 */
matchesRouter.post('/:id/reject', (req: Request, res: Response) => {
  const user = req.user || extractUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Only admin can reject submitted scorecards' });
  }

  const { notes } = req.body || {};
  const result = transitionMatch(req.params.id, 'Draft', user, notes);
  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  res.status(200).json(result.match);
});

// ==========================================
// Scoring Pad Operations (with Lock Check)
// ==========================================

/**
 * POST /api/matches/:id/events
 * Logs a scoring or match event.
 * Guarded: Must be in Draft status, and caller must be Assigned Referee or Admin.
 */
matchesRouter.post('/:id/events', requireMatchRefereeOrAdmin(), (req: Request, res: Response) => {
  try {
    const match = req.match;

    // 1. Enforce Scorecard Lock
    if (isScorecardLocked(match.status)) {
      return res.status(400).json({
        error: `Scorecard is locked against modifications. Match status is ${match.status}.`,
        code: 'SCORECARD_LOCKED',
      });
    }

    const { event_type, team, player_id, minute, second, payload_json } = req.body || {};
    if (!event_type) {
      return res.status(400).json({ error: 'Missing required event_type' });
    }

    // 2. Process & Persist Event via ScoringService
    const result = scoringService.logEvent(match, {
      event_type,
      team,
      player_id,
      minute: minute !== undefined ? Number(minute) : 0,
      second: second !== undefined ? Number(second) : 0,
      payload: payload_json,
    });

    if (!result.success) {
      return res.status(result.statusCode).json({ error: result.error, code: result.code });
    }

    // 3. Broadcast Real-Time Update
    broadcaster.broadcastMatchEvent(match.id, result.event, result.match);

    res.status(201).json(result.event);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record event', message: err.message });
  }
});

/**
 * DELETE /api/matches/:id/events/:eventId
 * Undoes a previously logged match event and recalculates match state.
 */
matchesRouter.delete('/:id/events/:eventId', requireMatchRefereeOrAdmin(), (req: Request, res: Response) => {
  try {
    const match = req.match;

    // 1. Enforce Scorecard Lock
    if (isScorecardLocked(match.status)) {
      return res.status(400).json({
        error: `Scorecard is locked against modifications. Match status is ${match.status}.`,
        code: 'SCORECARD_LOCKED',
      });
    }

    const { eventId } = req.params;

    // 2. Undo Event via ScoringService
    const result = scoringService.deleteEvent(match, eventId);
    if (!result.success) {
      return res.status(result.statusCode).json({ error: result.error, code: result.code });
    }

    // 3. Broadcast Event Deletion Update
    broadcaster.broadcastMatchEvent(match.id, { type: 'EVENT_DELETED', id: eventId }, result.match);
    broadcaster.broadcast(`match:${match.id}`, {
      type: 'match:event_deleted',
      match_id: match.id,
      deletedEventId: eventId,
      score_home: result.match.score_home,
      score_away: result.match.score_away,
      match: result.match,
    });

    res.status(200).json({
      success: true,
      deletedEventId: eventId,
      score_home: result.match.score_home,
      score_away: result.match.score_away,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete event', message: err.message });
  }
});

/**
 * POST /api/matches/:id/timer
 * Match timer commands (start, pause, reset, stoppage, resume, stop).
 */
matchesRouter.post('/:id/timer', requireMatchRefereeOrAdmin(), (req: Request, res: Response) => {
  try {
    const match = req.match;

    // 1. Enforce Scorecard Lock
    if (isScorecardLocked(match.status)) {
      return res.status(400).json({
        error: `Scorecard is locked against modifications. Match status is ${match.status}.`,
        code: 'SCORECARD_LOCKED',
      });
    }

    const { action, seconds, extra_seconds, period } = req.body || {};
    const validActions = ['start', 'pause', 'reset', 'stoppage', 'resume', 'stop'];

    // 2. Validate Action
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        error: `Unknown timer action: ${action}`,
        code: 'INVALID_TIMER_ACTION',
      });
    }

    // 3. Validate Stoppage Seconds
    if (action === 'stoppage' && extra_seconds !== undefined && Number(extra_seconds) < 0) {
      return res.status(400).json({
        error: 'Extra seconds cannot be negative',
        code: 'INVALID_EXTRA_SECONDS',
      });
    }

    let periodUpdate = match.current_period;
    let secondsUpdate = Number(match.current_time_seconds) || 0;

    if (action === 'start' || action === 'resume') {
      periodUpdate = period || (match.current_period === 'Scheduled' ? 'Live' : match.current_period);
    } else if (action === 'pause' || action === 'stop') {
      periodUpdate = 'Paused';
    } else if (action === 'reset') {
      secondsUpdate = 0;
    } else if (action === 'stoppage') {
      secondsUpdate += Number(extra_seconds) || 0;
    }

    if (seconds !== undefined) {
      secondsUpdate = Number(seconds) || 0;
    }

    db.execute(`
      UPDATE matches
      SET current_period = ?, current_time_seconds = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [periodUpdate, secondsUpdate, match.id]);

    broadcaster.broadcastMatchTimer(match.id, {
      action,
      current_period: periodUpdate,
      current_time_seconds: secondsUpdate,
    });

    res.json({
      success: true,
      current_period: periodUpdate,
      current_time_seconds: secondsUpdate,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update timer', message: err.message });
  }
});
