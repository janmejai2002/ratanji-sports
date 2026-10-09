/**
 * Event-Sourcing Scoring Service
 * Deterministic recalculation, audit event appending, event undo,
 * and sport state synchronization.
 * Ratanji Digital Sports Management & Scoring System
 */

import { db, DatabaseClient } from '../db/client.js';
import { getEngineForSport } from './sports-engines/index.js';
import type { BaseMatchEvent } from './sports-engines/types.js';

export interface LogEventParams {
  event_type: string;
  team?: any;
  player_id?: string | null;
  minute?: number;
  second?: number;
  payload?: any;
}

export class ScoringService {
  constructor(private database: DatabaseClient = db) {}

  public resolveEventTeam(rawTeam: unknown, match: any): 'home' | 'away' | null {
    if (!rawTeam) return null;
    const t = String(rawTeam).trim().toLowerCase();
    if (t === 'home' || t === 'away') return t;
    if (t === 'seniors' || t === 'cohort-seniors') {
      return match?.home_cohort_id?.includes('seniors') ? 'home' : 'away';
    }
    if (t === 'juniors' || t === 'cohort-juniors') {
      return match?.away_cohort_id?.includes('juniors') ? 'away' : 'home';
    }
    return null;
  }

  public getSportScoringType(sportId: string): string {
    const row = this.database.queryOne<{ scoring_type: string }>(
      "SELECT scoring_type FROM sports WHERE id = ? OR id = 'sport-' || ? OR LOWER(name) = LOWER(?)",
      [sportId, sportId, sportId]
    );
    return row?.scoring_type || 'GENERIC';
  }

  public validateEventForSport(scoringType: string, eventType: string): boolean {
    const st = scoringType.toUpperCase();
    const et = eventType.toUpperCase();

    const footballEvents = new Set([
      'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION',
      'PENALTY_GOAL', 'INJURY_TIME', 'STOPPAGE', 'HALF_TIME', 'PERIOD_END',
      'CARD', 'FOUL', 'CORNER', 'OFFSIDE', 'ASSIST'
    ]);
    const cricketEvents = new Set([
      'BALL', 'EXTRA', 'WICKET', 'INNINGS_SWITCH', 'INNINGS_END',
      'ALL_OUT', 'OVER_END', 'FOUR', 'SIX', 'DOT_BALL',
      'RUNS_1', 'RUNS_2', 'RUNS_3', 'RUNS_4', 'RUNS_6'
    ]);
    const basketballEvents = new Set([
      'SCORE_1PT', 'FREE_THROW', 'SCORE_2PT', 'FIELD_GOAL', 'SCORE_3PT',
      'POINTS', 'FOUL', 'TEAM_FOUL', 'PERSONAL_FOUL', 'TIMEOUT',
      'PERIOD_END', 'QUARTER_END', 'OVERTIME',
      'POINTS_1', 'POINTS_2', 'POINTS_3'
    ]);
    const badmintonEvents = new Set([
      'POINT', 'SET_WON', 'DEUCE', 'MATCH_CONCLUDED', 'FAULT', 'SERVE', 'LET', 'ACE'
    ]);

    if (st.includes('FOOTBALL')) return footballEvents.has(et);
    if (st.includes('CRICKET')) return cricketEvents.has(et);
    if (st.includes('BASKETBALL')) return basketballEvents.has(et);
    if (st.includes('BADMINTON')) return badmintonEvents.has(et);

    return true; // Generic supports flexible game events
  }

  public recalculateMatch(matchId: string, txClient?: DatabaseClient): {
    score_home: number;
    score_away: number;
    sport_state: any;
    current_period: string;
    match: any;
  } {
    const client = txClient || this.database;
    const match = client.queryOne<any>('SELECT * FROM matches WHERE id = ?', [matchId]);
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    const scoringType = this.getSportScoringType(match.sport_id);
    const engine = getEngineForSport(scoringType);

    const events = client.query<BaseMatchEvent>(`
      SELECT id, match_id, event_type, team, player_id, minute, second, payload_json, created_at
      FROM match_events
      WHERE match_id = ?
      ORDER BY minute ASC, second ASC, created_at ASC
    `, [matchId]);

    const result = engine.recalculate(events);
    const sportStateStr = JSON.stringify(result.sport_state);

    client.execute(`
      UPDATE matches
      SET score_home = ?,
          score_away = ?,
          sport_state_json = ?,
          current_period = COALESCE(?, current_period),
          updated_at = datetime('now')
      WHERE id = ?
    `, [
      result.score_home,
      result.score_away,
      sportStateStr,
      result.current_period || null,
      matchId,
    ]);

    const updatedMatch = client.queryOne<any>('SELECT * FROM matches WHERE id = ?', [matchId]);

    return {
      score_home: result.score_home,
      score_away: result.score_away,
      sport_state: result.sport_state,
      current_period: updatedMatch.current_period,
      match: updatedMatch,
    };
  }

  public logEvent(match: any, params: LogEventParams): {
    success: boolean;
    statusCode: number;
    error?: string;
    code?: string;
    event?: any;
    match?: any;
  } {
    const { event_type, minute, second, payload } = params;

    if (!event_type) {
      return { success: false, statusCode: 400, error: 'Missing required event_type' };
    }

    if (minute !== undefined && Number(minute) < 0) {
      return {
        success: false,
        statusCode: 400,
        error: 'Match minute cannot be negative',
        code: 'INVALID_MINUTE',
      };
    }

    const payloadObj = typeof payload === 'string'
      ? JSON.parse(payload || '{}')
      : (payload || {});

    if (payloadObj.points !== undefined && Number(payloadObj.points) < 0) {
      return {
        success: false,
        statusCode: 400,
        error: 'Points cannot be negative',
        code: 'INVALID_POINTS',
      };
    }

    if (payloadObj.runs !== undefined && Number(payloadObj.runs) < 0) {
      return {
        success: false,
        statusCode: 400,
        error: 'Runs cannot be negative',
        code: 'INVALID_RUNS',
      };
    }

    const scoringType = this.getSportScoringType(match.sport_id);
    if (!this.validateEventForSport(scoringType, event_type)) {
      return {
        success: false,
        statusCode: 400,
        error: `Invalid event_type '${event_type}' for sport '${scoringType}'`,
        code: 'INVALID_EVENT_TYPE',
      };
    }

    const normalizedTeam = this.resolveEventTeam(params.team, match);
    const eventId = 'ev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const min = Number(minute) || 0;
    const sec = Number(second) || 0;
    const payloadStr = JSON.stringify(payloadObj);

    let recalculated: any;
    this.database.transaction((tx) => {
      tx.execute(`
        INSERT INTO match_events (id, match_id, event_type, team, player_id, minute, second, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        eventId,
        match.id,
        event_type,
        normalizedTeam,
        params.player_id || null,
        min,
        sec,
        payloadStr,
      ]);

      recalculated = this.recalculateMatch(match.id, tx);
    });

    const eventRecord = {
      id: eventId,
      match_id: match.id,
      event_type,
      team: normalizedTeam,
      player_id: params.player_id || null,
      minute: min,
      second: sec,
      payload_json: payloadObj,
      score_home: recalculated.score_home,
      score_away: recalculated.score_away,
      sport_state: recalculated.sport_state,
    };

    return {
      success: true,
      statusCode: 201,
      event: eventRecord,
      match: recalculated.match,
    };
  }

  public deleteEvent(match: any, eventId: string): {
    success: boolean;
    statusCode: number;
    error?: string;
    code?: string;
    match?: any;
  } {
    const existing = this.database.queryOne<any>(
      'SELECT id FROM match_events WHERE id = ? AND match_id = ?',
      [eventId, match.id]
    );

    if (!existing) {
      return {
        success: false,
        statusCode: 404,
        error: `Event ${eventId} not found for match ${match.id}`,
        code: 'NOT_FOUND',
      };
    }

    let recalculated: any;
    this.database.transaction((tx) => {
      tx.execute('DELETE FROM match_events WHERE id = ? AND match_id = ?', [eventId, match.id]);
      recalculated = this.recalculateMatch(match.id, tx);
    });

    return {
      success: true,
      statusCode: 200,
      match: recalculated.match,
    };
  }
}

export const scoringService = new ScoringService();
