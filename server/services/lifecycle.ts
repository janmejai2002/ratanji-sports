import db from '../db/client.js';
import type { Match } from '../db/schema.js';
import { standingsService } from './standings.js';
import { broadcaster } from '../realtime/broadcaster.js';

// ==========================================
// 1. Types & Models
// ==========================================

export type LifecycleStatus = 'Scheduled' | 'Draft' | 'Submitted' | 'Verified' | 'Published' | 'Cancelled';

export interface UserContext {
  id: string;
  role: 'admin' | 'referee' | 'spectator' | string;
}

export interface TransitionResult {
  success: boolean;
  match?: Match;
  error?: string;
  statusCode: number;
}

// ==========================================
// 2. Normalization & Helper Functions
// ==========================================

/**
 * Normalizes any casing of status string to canonical PascalCase LifecycleStatus.
 */
export function normalizeStatus(status: unknown): LifecycleStatus {
  if (typeof status !== 'string') return 'Scheduled';
  const s = status.trim().toUpperCase();
  if (s === 'SCHEDULED') return 'Scheduled';
  if (s === 'DRAFT') return 'Draft';
  if (s === 'SUBMITTED') return 'Submitted';
  if (s === 'VERIFIED') return 'Verified';
  if (s === 'PUBLISHED') return 'Published';
  if (s === 'CANCELLED') return 'Cancelled';
  return status as LifecycleStatus;
}

/**
 * Normalizes referee ID to strip internal usr- prefix for clean API output.
 */
export function normalizeRefereeId(refereeId: string | null | undefined): string | null {
  if (!refereeId) return null;
  return refereeId.replace(/^usr-/, '');
}

/**
 * Compares assigned referee ID with request user ID supporting usr- prefix aliasing.
 */
export function isAssignedReferee(assignedRefId: string | null | undefined, userId: string | null | undefined): boolean {
  if (!assignedRefId || !userId) return false;
  const aNorm = assignedRefId.replace(/^usr-/, '');
  const uNorm = userId.replace(/^usr-/, '');
  return aNorm === uNorm;
}

/**
 * Checks if a match scorecard is locked against scoring event modifications.
 * Scorecards are locked in Submitted, Verified, and Published states.
 */
export function isScorecardLocked(status: string): boolean {
  const norm = normalizeStatus(status);
  return norm === 'Submitted' || norm === 'Verified' || norm === 'Published';
}

/**
 * Formats a raw database match record into the standard API representation.
 */
export function formatMatchResponse(rawMatch: any): any {
  if (!rawMatch) return null;
  return {
    ...rawMatch,
    status: normalizeStatus(rawMatch.status),
    referee_id: normalizeRefereeId(rawMatch.referee_id),
    score_home: Number(rawMatch.score_home) || 0,
    score_away: Number(rawMatch.score_away) || 0,
    current_time_seconds: Number(rawMatch.current_time_seconds) || 0,
  };
}

// ==========================================
// 3. State Machine Transition Engine
// ==========================================

/**
 * Executes a state transition on a match with validation, RBAC checks, and audit logging.
 *
 * Transition Graph:
 * - Scheduled -> Draft (Assigned Referee or Admin)
 * - Draft -> Submitted (Assigned Referee or Admin)
 * - Submitted -> Verified (Admin only)
 * - Verified -> Published (Admin only)
 * - Submitted -> Published (Admin direct shortcut)
 * - Submitted -> Draft (Admin rejection with non-empty notes)
 */
export function transitionMatch(
  matchId: string,
  targetStatusInput: string,
  user: UserContext,
  notes?: string
): TransitionResult {
  const targetStatus = normalizeStatus(targetStatusInput);

  // 1. Fetch match record
  const match = db.queryOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId]);
  if (!match) {
    return {
      success: false,
      error: `Match ${matchId} not found`,
      statusCode: 404,
    };
  }

  const currentStatus = normalizeStatus(match.status);
  const userRole = (user.role || '').toLowerCase();

  // 2. Published is immutable terminal state
  if (currentStatus === 'Published') {
    return {
      success: false,
      error: 'Published match is immutable and cannot undergo further status transitions',
      statusCode: 400,
    };
  }

  // 3. Validate transition rules and authorizations
  let action = 'STATUS_CHANGE';

  // Case A: Scheduled -> Draft
  if (currentStatus === 'Scheduled' && targetStatus === 'Draft') {
    if (userRole !== 'admin' && !(userRole === 'referee' && isAssignedReferee(match.referee_id, user.id))) {
      return {
        success: false,
        error: 'Unauthorized: Only assigned referee or admin can initiate match scoring draft',
        statusCode: 403,
      };
    }
    action = 'START_DRAFT';
  }
  // Case B: Draft -> Submitted (Scorecard Concluded)
  else if (currentStatus === 'Draft' && targetStatus === 'Submitted') {
    if (userRole !== 'admin' && !(userRole === 'referee' && isAssignedReferee(match.referee_id, user.id))) {
      return {
        success: false,
        error: 'Unauthorized: Only assigned referee or admin can submit scorecard for verification',
        statusCode: 403,
      };
    }
    action = 'SUBMIT';
  }
  // Case C: Submitted -> Verified (Sports Committee Verification)
  else if (currentStatus === 'Submitted' && targetStatus === 'Verified') {
    if (userRole !== 'admin') {
      return {
        success: false,
        error: 'Unauthorized: Only Sports Committee Admin can verify scorecards',
        statusCode: 403,
      };
    }
    action = 'VERIFY';
  }
  // Case D: Verified -> Published (Official Commit)
  else if (currentStatus === 'Verified' && targetStatus === 'Published') {
    if (userRole !== 'admin') {
      return {
        success: false,
        error: 'Unauthorized: Only Sports Committee Admin can publish match results',
        statusCode: 403,
      };
    }
    action = 'PUBLISH';
  }
  // Case E: Submitted -> Published (Admin Direct Shortcut)
  else if (currentStatus === 'Submitted' && targetStatus === 'Published') {
    if (userRole !== 'admin') {
      return {
        success: false,
        error: 'Unauthorized: Only Sports Committee Admin can publish match results',
        statusCode: 403,
      };
    }
    action = 'PUBLISH_SHORTCUT';
  }
  // Case F: Submitted -> Draft (Admin Rejection)
  else if (currentStatus === 'Submitted' && targetStatus === 'Draft') {
    if (userRole !== 'admin') {
      return {
        success: false,
        error: 'Unauthorized: Only Sports Committee Admin can reject submitted matches',
        statusCode: 403,
      };
    }

    // Validation: Rejection requires non-empty explanation notes
    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return {
        success: false,
        error: 'Rejection requires non-empty explanation notes',
        statusCode: 400,
      };
    }
    action = 'REJECT';
  }
  // Case G: Invalid transition attempt
  else {
    return {
      success: false,
      error: `Invalid lifecycle transition from ${currentStatus} to ${targetStatus}`,
      statusCode: 400,
    };
  }

  const cleanNotes = notes ? notes.trim() : null;

  // 4. Atomic Database Update & Audit Log
  db.transaction((tx) => {
    // Update match status and notes
    tx.execute(
      `UPDATE matches SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`,
      [targetStatus, cleanNotes, matchId]
    );

    // Record audit log
    const auditId = 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    tx.execute(
      `INSERT INTO audit_logs (id, match_id, user_id, action, from_status, to_status, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [auditId, matchId, user.id || 'system', action, currentStatus, targetStatus, cleanNotes]
    );
  });

  // 5. Fetch updated match
  const updated = db.queryOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId])!;
  const formattedMatch = formatMatchResponse(updated);

  // Broadcast match status transition
  broadcaster.broadcastMatchStatus(matchId, currentStatus, targetStatus, formattedMatch);

  // 6. Synchronous Standings Recalculation on Publication & Real-Time Broadcast
  if (targetStatus === 'Published') {
    try {
      standingsService.recalculate(match.tournament_id);
      const standings = standingsService.getStandings(match.tournament_id);
      const sports = standingsService.getSportBreakdowns();
      broadcaster.broadcastStandingsUpdate(match.tournament_id, standings, sports, matchId);
    } catch (err) {
      console.error('[Lifecycle] Standings recalculation error on publish:', err);
    }
  }

  return {
    success: true,
    match: formattedMatch,
    statusCode: 200,
  };
}

// ==========================================
// 4. Verification Queue Service
// ==========================================

/**
 * Returns all matches currently in 'Submitted' status awaiting admin verification.
 */
export function getVerificationQueue(): any[] {
  const matches = db.query<any>(`
    SELECT m.*, s.name as sport_name,
           hc.name as home_cohort_name, ac.name as away_cohort_name,
           u.name as referee_name
    FROM matches m
    LEFT JOIN sports s ON m.sport_id = s.id OR m.sport_id = 'sport-' || s.id
    LEFT JOIN cohorts hc ON m.home_cohort_id = hc.id
    LEFT JOIN cohorts ac ON m.away_cohort_id = ac.id
    LEFT JOIN users u ON m.referee_id = u.id OR m.referee_id = 'usr-' || u.id
    WHERE UPPER(m.status) = 'SUBMITTED'
    ORDER BY m.scheduled_at ASC
  `);

  return matches.map((m) => formatMatchResponse(m));
}
