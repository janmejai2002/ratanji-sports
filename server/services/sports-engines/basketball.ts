/**
 * Basketball Scoring Engine
 * Rules: Points (+1, +2, +3), Quarters (Q1-Q4, Overtime),
 * Team fouls per quarter (bonus threshold at 5 fouls), Timeouts.
 */

import type { SportEngine, BaseMatchEvent, EngineResult } from './types.js';

export interface BasketballState {
  currentQuarter: number;
  quarterName: string;
  quartersHome: number[];
  quartersAway: number[];
  teamFouls: { home: number; away: number };
  inBonus: { home: boolean; away: boolean };
  timeoutsRemaining: { home: number; away: number };
}

export class BasketballEngine implements SportEngine {
  readonly scoringType = 'BASKETBALL';

  private getQuarterName(quarter: number): string {
    if (quarter <= 4) return `Q${quarter}`;
    return `OT${quarter - 4}`;
  }

  recalculate(events: BaseMatchEvent[], initialRules?: any): EngineResult {
    let currentQuarter = 1;
    const quartersHome = [0, 0, 0, 0];
    const quartersAway = [0, 0, 0, 0];

    const teamFouls = { home: 0, away: 0 };
    const inBonus = { home: false, away: false };
    const timeoutsRemaining = { home: 3, away: 3 };

    for (const ev of events) {
      const type = String(ev.event_type || '').toUpperCase();
      const rawTeam = String(ev.team || '').toLowerCase();
      const team: 'home' | 'away' | null = rawTeam === 'home' || rawTeam === 'away' ? rawTeam : null;
      const payload = typeof ev.payload_json === 'string'
        ? JSON.parse(ev.payload_json || '{}')
        : (ev.payload_json || {});

      if (type === 'PERIOD_END' || type === 'QUARTER_END') {
        currentQuarter += 1;
        while (quartersHome.length < currentQuarter) {
          quartersHome.push(0);
          quartersAway.push(0);
        }
        // Team fouls reset each quarter
        teamFouls.home = 0;
        teamFouls.away = 0;
        inBonus.home = false;
        inBonus.away = false;
        continue;
      }

      let points = 0;
      if (type === 'SCORE_1PT' || type === 'FREE_THROW' || type === 'POINTS_1') {
        points = 1;
      } else if (type === 'SCORE_2PT' || type === 'FIELD_GOAL' || type === 'POINTS_2') {
        points = 2;
      } else if (type === 'SCORE_3PT' || type === 'POINTS_3') {
        points = 3;
      } else if (type === 'POINTS') {
        points = Math.max(0, Number(payload.points) || 1);
      }

      if (points > 0 && team) {
        const qIdx = currentQuarter - 1;
        if (team === 'home') {
          quartersHome[qIdx] = (quartersHome[qIdx] || 0) + points;
        } else {
          quartersAway[qIdx] = (quartersAway[qIdx] || 0) + points;
        }
      }

      if ((type === 'FOUL' || type === 'TEAM_FOUL') && team) {
        teamFouls[team] += 1;
        if (teamFouls[team] >= 5) {
          inBonus[team] = true;
        }
      }

      if (type === 'TIMEOUT' && team) {
        timeoutsRemaining[team] = Math.max(0, timeoutsRemaining[team] - 1);
      }
    }

    const score_home = quartersHome.reduce((acc, p) => acc + p, 0);
    const score_away = quartersAway.reduce((acc, p) => acc + p, 0);
    const quarterName = this.getQuarterName(currentQuarter);

    const sport_state: BasketballState = {
      currentQuarter,
      quarterName,
      quartersHome,
      quartersAway,
      teamFouls,
      inBonus,
      timeoutsRemaining,
    };

    return {
      score_home,
      score_away,
      sport_state,
      current_period: quarterName,
    };
  }
}
