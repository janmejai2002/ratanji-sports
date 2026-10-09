/**
 * Football Scoring Engine
 * Rules: Goals (+1), Own Goals (+1 to opponent), Yellow Cards (2 -> Red),
 * Red Cards, Substitutions, Halves, Stoppage/Injury time.
 */

import type { SportEngine, BaseMatchEvent, EngineResult } from './types.js';

export interface FootballState {
  halves: number;
  currentHalf: number;
  homeGoals: number;
  awayGoals: number;
  cards: {
    home: { yellow: number; red: number };
    away: { yellow: number; red: number };
  };
  playerBookings: Record<string, { yellows: number; red: boolean }>;
  substitutions: Array<{
    minute: number;
    second: number;
    team: 'home' | 'away';
    player_in?: string;
    player_out?: string;
  }>;
  injuryTimeMinutes: { half1: number; half2: number };
}

export class FootballEngine implements SportEngine {
  readonly scoringType = 'FOOTBALL';

  recalculate(events: BaseMatchEvent[], initialRules?: any): EngineResult {
    let score_home = 0;
    let score_away = 0;
    let currentHalf = 1;
    let current_period = '1st Half';

    const cards = {
      home: { yellow: 0, red: 0 },
      away: { yellow: 0, red: 0 },
    };

    const playerBookings: Record<string, { yellows: number; red: boolean }> = {};
    const substitutions: FootballState['substitutions'] = [];
    const injuryTimeMinutes = { half1: 0, half2: 0 };

    for (const ev of events) {
      const type = String(ev.event_type || '').toUpperCase();
      const rawTeam = String(ev.team || '').toLowerCase();
      const team: 'home' | 'away' | null = rawTeam === 'home' || rawTeam === 'away' ? rawTeam : null;
      const min = Number(ev.minute) || 0;
      const sec = Number(ev.second) || 0;
      const payload = typeof ev.payload_json === 'string'
        ? JSON.parse(ev.payload_json || '{}')
        : (ev.payload_json || {});

      // Period management
      if (min > 45 && currentHalf === 1) {
        // Can be stoppage or transitioned
      }
      if (type === 'HALF_TIME' || type === 'PERIOD_END' && currentHalf === 1) {
        currentHalf = 2;
        current_period = '2nd Half';
      }

      // Scoring
      if (type === 'GOAL' || type === 'PENALTY_GOAL') {
        if (team === 'home') score_home += 1;
        else if (team === 'away') score_away += 1;
      } else if (type === 'OWN_GOAL') {
        if (team === 'home') score_away += 1;
        else if (team === 'away') score_home += 1;
      } else if (type === 'YELLOW_CARD') {
        if (team) cards[team].yellow += 1;
        if (ev.player_id) {
          if (!playerBookings[ev.player_id]) {
            playerBookings[ev.player_id] = { yellows: 1, red: false };
          } else {
            playerBookings[ev.player_id].yellows += 1;
            // 2nd yellow converts to red card
            if (playerBookings[ev.player_id].yellows >= 2 && !playerBookings[ev.player_id].red) {
              playerBookings[ev.player_id].red = true;
              if (team) cards[team].red += 1;
            }
          }
        }
      } else if (type === 'RED_CARD') {
        if (team) cards[team].red += 1;
        if (ev.player_id) {
          if (!playerBookings[ev.player_id]) {
            playerBookings[ev.player_id] = { yellows: 0, red: true };
          } else {
            playerBookings[ev.player_id].red = true;
          }
        }
      } else if (type === 'SUBSTITUTION') {
        if (team) {
          substitutions.push({
            minute: min,
            second: sec,
            team,
            player_in: payload.player_in || payload.playerIn,
            player_out: payload.player_out || payload.playerOut,
          });
        }
      } else if (type === 'INJURY_TIME' || type === 'STOPPAGE') {
        const extraMin = Number(payload.extra_minutes || payload.minutes || Math.round((payload.extra_seconds || 0) / 60)) || 0;
        if (currentHalf === 1) injuryTimeMinutes.half1 = extraMin;
        else injuryTimeMinutes.half2 = extraMin;
      }
    }

    const sport_state: FootballState = {
      halves: 2,
      currentHalf,
      homeGoals: score_home,
      awayGoals: score_away,
      cards,
      playerBookings,
      substitutions,
      injuryTimeMinutes,
    };

    return {
      score_home,
      score_away,
      sport_state,
      current_period,
    };
  }
}
