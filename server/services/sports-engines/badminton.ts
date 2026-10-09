/**
 * Badminton Scoring Engine
 * Rules: 21-point rally format, best of 3 sets, deuce (must lead by 2),
 * hard cap at 30 points (golden point), serve court calculation (even=right, odd=left).
 */

import type { SportEngine, BaseMatchEvent, EngineResult } from './types.js';

export interface BadmintonSetRecord {
  set: number;
  home: number;
  away: number;
  winner: 'home' | 'away';
}

export interface BadmintonState {
  currentSet: number;
  sets: BadmintonSetRecord[];
  currentSetPoints: { home: number; away: number };
  serving: 'home' | 'away';
  serviceCourt: 'right' | 'left';
  isDeuce: boolean;
  matchConcluded: boolean;
}

export class BadmintonEngine implements SportEngine {
  readonly scoringType = 'BADMINTON';

  recalculate(events: BaseMatchEvent[], initialRules?: any): EngineResult {
    let currentSet = 1;
    let setsWonHome = 0;
    let setsWonAway = 0;
    let currentPointsHome = 0;
    let currentPointsAway = 0;
    let serving: 'home' | 'away' = 'home';
    const completedSets: BadmintonSetRecord[] = [];

    for (const ev of events) {
      const type = String(ev.event_type || '').toUpperCase();
      const rawTeam = String(ev.team || '').toLowerCase();
      const team: 'home' | 'away' | null = rawTeam === 'home' || rawTeam === 'away' ? rawTeam : null;
      const payload = typeof ev.payload_json === 'string'
        ? JSON.parse(ev.payload_json || '{}')
        : (ev.payload_json || {});

      if (type === 'SET_WON') {
        if (team === 'home') {
          setsWonHome += 1;
        } else if (team === 'away') {
          setsWonAway += 1;
        }

        let homeScore = currentPointsHome;
        let awayScore = currentPointsAway;
        if (payload.score && typeof payload.score === 'string') {
          const parts = payload.score.split('-').map((s: string) => Number(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            homeScore = parts[0];
            awayScore = parts[1];
          }
        }

        completedSets.push({
          set: payload.set || currentSet,
          home: homeScore,
          away: awayScore,
          winner: team || (setsWonHome > setsWonAway ? 'home' : 'away'),
        });

        currentSet += 1;
        currentPointsHome = 0;
        currentPointsAway = 0;
        continue;
      }

      if (type === 'POINT' && team) {
        serving = team;
        if (team === 'home') {
          currentPointsHome += 1;
        } else {
          currentPointsAway += 1;
        }

        // Check if set is won
        const h = currentPointsHome;
        const a = currentPointsAway;
        let setWinner: 'home' | 'away' | null = null;

        if (h >= 21 && h - a >= 2) {
          setWinner = 'home';
        } else if (h === 30) {
          setWinner = 'home';
        } else if (a >= 21 && a - h >= 2) {
          setWinner = 'away';
        } else if (a === 30) {
          setWinner = 'away';
        }

        if (setWinner) {
          if (setWinner === 'home') setsWonHome += 1;
          else setsWonAway += 1;

          completedSets.push({
            set: currentSet,
            home: h,
            away: a,
            winner: setWinner,
          });

          currentSet += 1;
          currentPointsHome = 0;
          currentPointsAway = 0;
        }
      }
    }

    const isDeuce = currentPointsHome >= 20 && currentPointsAway >= 20;
    const serverScore = serving === 'home' ? currentPointsHome : currentPointsAway;
    const serviceCourt: 'right' | 'left' = serverScore % 2 === 0 ? 'right' : 'left';
    const matchConcluded = setsWonHome >= 2 || setsWonAway >= 2;

    const current_period = matchConcluded
      ? 'Completed'
      : `Set ${currentSet} (${currentPointsHome}-${currentPointsAway})`;

    const sport_state: BadmintonState = {
      currentSet,
      sets: completedSets,
      currentSetPoints: { home: currentPointsHome, away: currentPointsAway },
      serving,
      serviceCourt,
      isDeuce,
      matchConcluded,
    };

    return {
      score_home: setsWonHome,
      score_away: setsWonAway,
      sport_state,
      current_period,
    };
  }
}
