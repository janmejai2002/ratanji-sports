/**
 * Generic Scoring Engine
 * Rules: Flexible points, goals, sets, and game tallies for remaining 11 sports:
 * Volleyball, Table Tennis, Track & Field M/F, Tennis, Chess, Pool, Throwball, Futsal.
 */

import type { SportEngine, BaseMatchEvent, EngineResult } from './types.js';

export interface GenericState {
  points: { home: number; away: number };
  sets: { home: number; away: number };
  eventsLogged: number;
}

export class GenericEngine implements SportEngine {
  readonly scoringType = 'GENERIC';

  recalculate(events: BaseMatchEvent[], initialRules?: any): EngineResult {
    let score_home = 0;
    let score_away = 0;
    const sets = { home: 0, away: 0 };

    for (const ev of events) {
      const type = String(ev.event_type || '').toUpperCase();
      const rawTeam = String(ev.team || '').toLowerCase();
      const team: 'home' | 'away' | null = rawTeam === 'home' || rawTeam === 'away' ? rawTeam : null;
      const payload = typeof ev.payload_json === 'string'
        ? JSON.parse(ev.payload_json || '{}')
        : (ev.payload_json || {});

      if (type === 'POINT' || type === 'SCORE_1PT' || type === 'GOAL') {
        const pts = Math.max(0, Number(payload.points || payload.runs) || 1);
        if (team === 'home') score_home += pts;
        else if (team === 'away') score_away += pts;
      } else if (type === 'OWN_GOAL') {
        if (team === 'home') score_away += 1;
        else if (team === 'away') score_home += 1;
      } else if (type === 'SET_WON' || type === 'GAME_WON') {
        if (team === 'home') {
          score_home += 1;
          sets.home += 1;
        } else if (team === 'away') {
          score_away += 1;
          sets.away += 1;
        }
      }
    }

    const sport_state: GenericState = {
      points: { home: score_home, away: score_away },
      sets,
      eventsLogged: events.length,
    };

    return {
      score_home,
      score_away,
      sport_state,
      current_period: 'In Progress',
    };
  }
}
