/**
 * Cricket Scoring Engine
 * Rules: Ball-by-ball (runs, legal ball count), Extras (wide, no-ball, bye, leg-bye),
 * Wickets, Innings switch, Overs calculation (6 balls = 1 over).
 */

import type { SportEngine, BaseMatchEvent, EngineResult } from './types.js';

export interface InningsState {
  team: 'home' | 'away';
  runs: number;
  wickets: number;
  balls: number;
  overs: string;
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    penalty: number;
    total: number;
  };
}

export interface CricketState {
  currentInnings: 1 | 2;
  battingTeam: 'home' | 'away';
  innings1: InningsState;
  innings2: InningsState;
  targetRuns?: number;
}

export class CricketEngine implements SportEngine {
  readonly scoringType = 'CRICKET';

  private formatOvers(balls: number): string {
    const fullOvers = Math.floor(balls / 6);
    const remBalls = balls % 6;
    return `${fullOvers}.${remBalls}`;
  }

  recalculate(events: BaseMatchEvent[], initialRules?: any): EngineResult {
    let currentInnings: 1 | 2 = 1;
    let battingTeam: 'home' | 'away' = 'home';

    const innings1: InningsState = {
      team: 'home',
      runs: 0,
      wickets: 0,
      balls: 0,
      overs: '0.0',
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
    };

    const innings2: InningsState = {
      team: 'away',
      runs: 0,
      wickets: 0,
      balls: 0,
      overs: '0.0',
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
    };

    for (const ev of events) {
      const type = String(ev.event_type || '').toUpperCase();
      const rawTeam = String(ev.team || '').toLowerCase();
      const explicitTeam = rawTeam === 'home' || rawTeam === 'away' ? (rawTeam as 'home' | 'away') : null;
      const payload = typeof ev.payload_json === 'string'
        ? JSON.parse(ev.payload_json || '{}')
        : (ev.payload_json || {});

      if (type === 'INNINGS_SWITCH' || type === 'INNINGS_END') {
        currentInnings = currentInnings === 1 ? 2 : 1;
        battingTeam = battingTeam === 'home' ? 'away' : 'home';
        continue;
      }

      // Determine which innings this event applies to:
      // If team is explicitly given on the event, route to that team's innings.
      // Otherwise use current active batting team.
      const targetTeam = explicitTeam || battingTeam;
      const activeInnings = targetTeam === 'home' ? innings1 : innings2;

      if (type === 'BALL' || type === 'FOUR' || type === 'SIX' || type === 'DOT_BALL' || type.startsWith('RUNS_')) {
        let runs = Math.max(0, Number(payload.runs) || 0);
        if (type === 'FOUR') runs = 4;
        else if (type === 'SIX') runs = 6;
        else if (type === 'DOT_BALL') runs = 0;
        else if (type === 'RUNS_1') runs = 1;
        else if (type === 'RUNS_2') runs = 2;
        else if (type === 'RUNS_3') runs = 3;
        else if (type === 'RUNS_4') runs = 4;
        else if (type === 'RUNS_6') runs = 6;
        activeInnings.runs += runs;
        activeInnings.balls += 1;
      } else if (type === 'EXTRA') {
        const extraType = String(payload.extra_type || payload.type || 'wide').toLowerCase();
        const runs = Math.max(1, Number(payload.runs) || 1);
        activeInnings.runs += runs;
        activeInnings.extras.total += runs;

        if (extraType.includes('wide')) {
          activeInnings.extras.wides += runs;
          // Wides are not legal balls
        } else if (extraType.includes('no_ball') || extraType.includes('noball') || extraType.includes('no-ball')) {
          activeInnings.extras.noBalls += runs;
          // No balls are not legal balls
        } else if (extraType.includes('leg_bye') || extraType.includes('legbye') || extraType.includes('leg-bye')) {
          activeInnings.extras.legByes += runs;
          activeInnings.balls += 1; // Legal delivery
        } else if (extraType.includes('bye')) {
          activeInnings.extras.byes += runs;
          activeInnings.balls += 1; // Legal delivery
        } else {
          activeInnings.extras.penalty += runs;
        }
      } else if (type === 'WICKET') {
        activeInnings.wickets = Math.min(10, activeInnings.wickets + 1);
        const runs = Math.max(0, Number(payload.runs) || 0);
        activeInnings.runs += runs;

        const isIllegalBall = payload.extra_type && (
          String(payload.extra_type).toLowerCase().includes('wide') ||
          String(payload.extra_type).toLowerCase().includes('no')
        );
        if (!isIllegalBall) {
          activeInnings.balls += 1;
        }
      }
    }

    innings1.overs = this.formatOvers(innings1.balls);
    innings2.overs = this.formatOvers(innings2.balls);

    const score_home = innings1.runs;
    const score_away = innings2.runs;

    const current_period = currentInnings === 1
      ? `1st Innings (${innings1.overs} ov)`
      : `2nd Innings (${innings2.overs} ov)`;

    const sport_state: CricketState = {
      currentInnings,
      battingTeam,
      innings1,
      innings2,
      targetRuns: currentInnings === 2 ? innings1.runs + 1 : undefined,
    };

    return {
      score_home,
      score_away,
      sport_state,
      current_period,
    };
  }
}
