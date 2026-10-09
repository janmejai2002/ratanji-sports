import { describe, it, expect } from 'vitest';
import {
  calculateWinProbability,
  calculateMomentumWave,
  calculateClutchRating,
  generateMatchInsights,
  calculateDeuceProbability,
  calculateCricketChaseExpectancy,
  calculateExpectedScoringRates,
  getMatchAnalyticsReport,
  normalizeSportCategory,
  erf,
  normalCdf,
  poissonPmf,
} from '../src/services/sportsAnalytics.js';

describe('Sports Analytics Quantitative Engine', () => {
  // ==========================================================================
  // Mathematical Primitives & Safe Guards
  // ==========================================================================
  describe('Mathematical Primitives', () => {
    it('calculates erf and normalCdf correctly', () => {
      expect(erf(0)).toBeCloseTo(0, 4);
      expect(erf(1)).toBeCloseTo(0.8427, 3);
      expect(normalCdf(0)).toBeCloseTo(0.5, 4);
      expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
      expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
      expect(normalCdf(10)).toBe(1.0);
      expect(normalCdf(-10)).toBe(0.0);
      expect(normalCdf(NaN)).toBe(0.5);
    });

    it('calculates Poisson PMF safely', () => {
      // P(X = 0; lambda = 1.0) = e^(-1) ≈ 0.3679
      expect(poissonPmf(0, 1.0)).toBeCloseTo(0.3679, 3);
      // P(X = 2; lambda = 2.0) = 4 * e^(-2) / 2 ≈ 0.2707
      expect(poissonPmf(2, 2.0)).toBeCloseTo(0.2707, 3);
      expect(poissonPmf(0, 0)).toBe(1.0);
      expect(poissonPmf(2, -1)).toBe(0);
    });
  });

  // ==========================================================================
  // 1. calculateWinProbability
  // ==========================================================================
  describe('calculateWinProbability', () => {
    it('handles null/undefined match safely', () => {
      const res = calculateWinProbability(null);
      expect(res.homePct).toBe(50.0);
      expect(res.awayPct).toBe(50.0);
      expect(res.confidence).toBe('low');
      expect(res.summary).toBeDefined();
    });

    it('handles scheduled and pre-match 0-0 states', () => {
      const scheduledMatch = {
        id: 'm-1',
        sport_id: 'sport-football',
        status: 'Scheduled',
        score_home: 0,
        score_away: 0,
      };
      const res = calculateWinProbability(scheduledMatch, []);
      expect(res.homePct).toBe(50.0);
      expect(res.awayPct).toBe(50.0);
      expect(res.confidence).toBe('low');
      expect(res.summary).toContain('50-50');
    });

    it('handles concluded matches with official 100/0 or 0/100 percentages', () => {
      const homeWon = {
        id: 'm-2',
        sport_id: 'sport-football',
        status: 'Published',
        score_home: 3,
        score_away: 1,
      };
      const resHome = calculateWinProbability(homeWon);
      expect(resHome.homePct).toBe(100.0);
      expect(resHome.awayPct).toBe(0.0);
      expect(resHome.confidence).toBe('high');

      const awayWon = {
        id: 'm-3',
        sport_id: 'sport-football',
        status: 'Verified',
        score_home: 0,
        score_away: 2,
      };
      const resAway = calculateWinProbability(awayWon);
      expect(resAway.homePct).toBe(0.0);
      expect(resAway.awayPct).toBe(100.0);
      expect(resAway.confidence).toBe('high');

      const drawMatch = {
        id: 'm-4',
        sport_id: 'sport-football',
        status: 'Published',
        score_home: 2,
        score_away: 2,
      };
      const resDraw = calculateWinProbability(drawMatch);
      expect(resDraw.homePct).toBe(50.0);
      expect(resDraw.awayPct).toBe(50.0);
    });

    it('models Football low-scoring Poisson time-decay and lead protection', () => {
      // Home leading 2-0 with 15 mins remaining (75 mins elapsed = 4500 seconds)
      const lateLead = {
        id: 'm-foot-1',
        sport_id: 'sport-football',
        status: 'Draft',
        score_home: 2,
        score_away: 0,
        current_time_seconds: 4500, // 75 min
        current_period: '2nd Half',
      };
      const events = [
        { minute: 23, event_type: 'GOAL', team: 'home' },
        { minute: 61, event_type: 'GOAL', team: 'home' },
        { minute: 70, event_type: 'YELLOW_CARD', team: 'away' },
      ];

      const res = calculateWinProbability(lateLead, events);
      expect(res.homePct).toBeGreaterThan(90);
      expect(res.awayPct).toBeLessThan(10);
      expect(res.homePct + res.awayPct).toBe(100);
      expect(res.confidence).toBe('high');
      expect(res.summary).toContain('Seniors lead');
    });

    it('adjusts Football Poisson rate when team has a Red Card', () => {
      const matchWithRedCard = {
        id: 'm-foot-red',
        sport_id: 'sport-football',
        status: 'Draft',
        score_home: 1,
        score_away: 1,
        current_time_seconds: 3600, // 60 min
      };
      const events = [
        { minute: 15, event_type: 'GOAL', team: 'home' },
        { minute: 40, event_type: 'GOAL', team: 'away' },
        { minute: 55, event_type: 'RED_CARD', team: 'home' }, // Home down to 10 men
      ];

      const res = calculateWinProbability(matchWithRedCard, events);
      // Because Home has a red card at 1-1, Away should have higher win probability
      expect(res.awayPct).toBeGreaterThan(res.homePct);
      expect(res.summary).toContain('down a player');
    });

    it('models Basketball normal drift diffusion with quarter progression', () => {
      // Tied in Q4 late (36 min elapsed = 2160 seconds)
      const lateQ4Tied = {
        id: 'm-bball-1',
        sport_id: 'sport-basketball-m',
        status: 'Draft',
        score_home: 68,
        score_away: 68,
        current_time_seconds: 2160,
        current_period: 'Q4',
      };
      const tiedRes = calculateWinProbability(lateQ4Tied, []);
      expect(tiedRes.homePct).toBe(50.0);
      expect(tiedRes.awayPct).toBe(50.0);

      // Home leading by 9 points with 2 minutes left (38 min elapsed = 2280s)
      const lateQ4Lead = {
        id: 'm-bball-2',
        sport_id: 'sport-basketball-m',
        status: 'Draft',
        score_home: 78,
        score_away: 69,
        current_time_seconds: 2280,
        current_period: 'Q4',
      };
      const leadRes = calculateWinProbability(lateQ4Lead, [
        { minute: 1, event_type: 'SCORE_2PT', team: 'home' },
        { minute: 10, event_type: 'SCORE_3PT', team: 'home' },
        { minute: 20, event_type: 'SCORE_2PT', team: 'away' },
      ]);
      expect(leadRes.homePct).toBeGreaterThan(95);
      expect(leadRes.awayPct).toBeLessThan(5);
      expect(leadRes.homePct + leadRes.awayPct).toBe(100);
      expect(leadRes.confidence).toBe('high');
    });

    it('models Racquet sports (Badminton) deuce and set mechanics', () => {
      const badmintonMatch = {
        id: 'm-badmin-1',
        sport_id: 'sport-badminton-m',
        status: 'Draft',
        score_home: 1, // Sets won 1-0
        score_away: 0,
        current_period: 'Set 2',
        sport_state: {
          currentSet: 2,
          currentSetPoints: { home: 20, away: 20 },
        },
      };

      const res = calculateWinProbability(badmintonMatch, [
        { minute: 5, event_type: 'POINT', team: 'home' },
        { minute: 10, event_type: 'POINT', team: 'away' },
        { minute: 15, event_type: 'SET_WON', team: 'home' },
      ]);

      // Home has already won Set 1 and is at 20-20 in Set 2; Home is favored heavily
      expect(res.homePct).toBeGreaterThan(70);
      expect(res.summary).toContain('Sets: Seniors 1 - Juniors 0');
      expect(res.summary).toContain('[DEUCE]');
    });

    it('models Cricket T10 run-rate chase dynamics', () => {
      // 2nd innings chase: Juniors chasing 90, at 75/3 after 8 overs (need 16 off 12 balls)
      const cricketMatch = {
        id: 'm-cric-1',
        sport_id: 'sport-cricket',
        status: 'Draft',
        score_home: 89,
        score_away: 75,
        current_period: '2nd Innings (8.0 ov)',
        sport_state: {
          currentInnings: 2,
          battingTeam: 'away', // Juniors batting
          innings1: { runs: 89, wickets: 6, balls: 60, overs: '10.0' },
          innings2: { runs: 75, wickets: 3, balls: 48, overs: '8.0' },
        },
      };

      const res = calculateWinProbability(cricketMatch, [
        { minute: 1, event_type: 'BALL', payload_json: { runs: 4 } },
        { minute: 2, event_type: 'BALL', payload_json: { runs: 6 } },
        { minute: 3, event_type: 'WICKET' },
      ]);

      // Juniors need 15 runs in 12 balls with 7 wickets in hand; RRR = 7.5 RPO
      // This is a highly achievable chase for batting team (Juniors)
      expect(res.awayPct).toBeGreaterThan(55);
      expect(res.summary).toContain('2nd Innings: Need');
      expect(res.homePct + res.awayPct).toBe(100);
    });

    it('handles generic sports (Chess, Pool, Athletics)', () => {
      const chessMatch = {
        id: 'm-chess-1',
        sport_id: 'sport-chess',
        status: 'Draft',
        score_home: 2.5,
        score_away: 0.5,
      };
      const res = calculateWinProbability(chessMatch);
      expect(res.homePct).toBeGreaterThan(90);
      expect(res.confidence).toBe('high');
    });
  });

  // ==========================================================================
  // 2. calculateMomentumWave
  // ==========================================================================
  describe('calculateMomentumWave', () => {
    it('generates a calibrated historical baseline trajectory when events are empty', () => {
      const emptyMatch = {
        id: 'm-empty',
        sport_id: 'sport-football',
        current_time_seconds: 0,
      };
      const wave = calculateMomentumWave(emptyMatch, []);

      expect(wave).toBeInstanceOf(Array);
      expect(wave.length).toBeGreaterThanOrEqual(10);
      // All scores should be 0
      expect(wave[0].homeScore).toBe(0);
      expect(wave[0].awayScore).toBe(0);
      expect(wave[0].minute).toBe(0);
      expect(wave[0].note).toBeDefined();
      // Waveform values bounded within [-100, 100]
      for (const pt of wave) {
        expect(pt.momentum).toBeGreaterThanOrEqual(-100);
        expect(pt.momentum).toBeLessThanOrEqual(100);
        expect(isNaN(pt.momentum)).toBe(false);
      }
    });

    it('swings positive for Home (Seniors) events and negative for Away (Juniors)', () => {
      const match = {
        id: 'm-mom-1',
        sport_id: 'sport-football',
        current_time_seconds: 1800,
      };
      const events = [
        { minute: 5, event_type: 'GOAL', team: 'home' }, // Seniors score
        { minute: 15, event_type: 'GOAL', team: 'away' }, // Juniors score
        { minute: 20, event_type: 'RED_CARD', team: 'home' }, // Seniors penalized
      ];

      const wave = calculateMomentumWave(match, events);
      expect(wave.length).toBeGreaterThanOrEqual(21);

      // At minute 5, momentum should surge positive (favoring Seniors)
      const pt5 = wave.find((p) => p.minute === 5);
      expect(pt5?.momentum).toBeGreaterThan(10);
      expect(pt5?.homeScore).toBe(1);
      expect(pt5?.note).toContain('GOAL Seniors');

      // At minute 20, red card causes negative drop
      const pt20 = wave.find((p) => p.minute === 20);
      expect(pt20?.momentum).toBeLessThan(0);
    });

    it('accounts for sport-specific event weights: POINT (+2), WICKET (-10), RED_CARD (-15)', () => {
      const match = { id: 'm-weights', current_time_seconds: 600 };
      const basketballEvents = [
        { minute: 1, event_type: 'SCORE_3PT', team: 'home' },
        { minute: 2, event_type: 'SCORE_2PT', team: 'home' },
        { minute: 4, event_type: 'FOUL', team: 'away' },
      ];
      const wave = calculateMomentumWave(match, basketballEvents);
      const pt2 = wave.find((p) => p.minute === 2);
      expect(pt2?.momentum).toBeGreaterThan(0);
      expect(pt2?.homeScore).toBe(5);
    });

    it('strictly clamps values within [-100, 100]', () => {
      const match = { id: 'm-blowout', current_time_seconds: 600 };
      const delugeEvents = Array.from({ length: 20 }, (_, i) => ({
        minute: 2,
        event_type: 'GOAL',
        team: 'home',
      }));
      const wave = calculateMomentumWave(match, delugeEvents);
      for (const pt of wave) {
        expect(pt.momentum).toBeLessThanOrEqual(100);
        expect(pt.momentum).toBeGreaterThanOrEqual(-100);
      }
    });
  });

  // ==========================================================================
  // 3. calculateClutchRating
  // ==========================================================================
  describe('calculateClutchRating', () => {
    it('handles null match safely', () => {
      const res = calculateClutchRating(null);
      expect(res.leverage).toBe('Low');
      expect(res.leadChangeCount).toBe(0);
      expect(res.isNailBiter).toBe(false);
    });

    it('identifies Overtime Climax during overtime periods or deuce', () => {
      const otMatch = {
        sport_id: 'sport-basketball-m',
        current_period: 'OT1',
        score_home: 84,
        score_away: 84,
      };
      const res = calculateClutchRating(otMatch);
      expect(res.leverage).toBe('Overtime Climax');
      expect(res.isNailBiter).toBe(true);
    });

    it('accurately tallies lead changes across events', () => {
      const match = {
        sport_id: 'sport-basketball-m',
        score_home: 42,
        score_away: 41,
        current_time_seconds: 1800,
      };
      const events = [
        { minute: 1, event_type: 'SCORE_2PT', team: 'home' }, // Home 2-0
        { minute: 2, event_type: 'SCORE_3PT', team: 'away' }, // Away 3-2 (Lead change 1)
        { minute: 3, event_type: 'SCORE_2PT', team: 'home' }, // Home 4-3 (Lead change 2)
        { minute: 4, event_type: 'SCORE_2PT', team: 'away' }, // Away 5-4 (Lead change 3)
      ];
      const res = calculateClutchRating(match, events);
      expect(res.leadChangeCount).toBe(3);
      expect(res.isNailBiter).toBe(true);
    });

    it('classifies blowout games as Low leverage', () => {
      const blowout = {
        sport_id: 'sport-football',
        score_home: 4,
        score_away: 0,
        current_time_seconds: 4000,
      };
      const res = calculateClutchRating(blowout, []);
      expect(res.leverage).toBe('Low');
      expect(res.isNailBiter).toBe(false);
    });
  });

  // ==========================================================================
  // 4. generateMatchInsights
  // ==========================================================================
  describe('generateMatchInsights', () => {
    it('produces structured commentary insights', () => {
      const match = {
        id: 'm-ins-1',
        sport_id: 'sport-football',
        score_home: 1,
        score_away: 0,
        current_time_seconds: 4800,
      };
      const events = [
        { minute: 25, event_type: 'GOAL', team: 'home' },
        { minute: 70, event_type: 'YELLOW_CARD', team: 'away' },
        { minute: 75, event_type: 'YELLOW_CARD', team: 'home' },
        { minute: 78, event_type: 'RED_CARD', team: 'away' },
      ];

      const insights = generateMatchInsights(match, events);
      expect(insights.length).toBeGreaterThanOrEqual(3);

      for (const ins of insights) {
        expect(ins.title).toBeDefined();
        expect(ins.detail).toBeDefined();
        expect(['positive', 'neutral', 'critical']).toContain(ins.impact);
        expect(ins.metric).toBeDefined();
      }

      // Check disciplinary insight triggered by Red Card
      const cardInsight = insights.find((i) => i.title.includes('Disadvantage') || i.title.includes('Disciplinary'));
      expect(cardInsight).toBeDefined();
      expect(cardInsight?.impact).toBe('critical');
    });

    it('detects unanswered scoring runs', () => {
      const match = {
        sport_id: 'sport-basketball-m',
        score_home: 12,
        score_away: 2,
        current_time_seconds: 600,
      };
      const events = [
        { minute: 1, event_type: 'SCORE_2PT', team: 'home' },
        { minute: 2, event_type: 'SCORE_2PT', team: 'home' },
        { minute: 3, event_type: 'SCORE_3PT', team: 'home' },
        { minute: 4, event_type: 'SCORE_2PT', team: 'home' },
        { minute: 5, event_type: 'SCORE_3PT', team: 'home' },
      ];
      const insights = generateMatchInsights(match, events);
      const surge = insights.find((i) => i.title.includes('Surge') || i.title.includes('Momentum'));
      expect(surge).toBeDefined();
    });
  });

  // ==========================================================================
  // 5. Scoring Expectancy & Master Report
  // ==========================================================================
  describe('Expectancy & Master Report', () => {
    it('calculates Deuce Probability in badminton', () => {
      const deuce = calculateDeuceProbability(20, 20);
      expect(deuce.inDeuce).toBe(true);
      expect(deuce.pointsToWinHome).toBe(2);
      expect(deuce.pointsToWinAway).toBe(2);

      const preDeuce = calculateDeuceProbability(19, 18);
      expect(preDeuce.inDeuce).toBe(false);
      expect(preDeuce.deuceProbability).toBeGreaterThan(0);
    });

    it('calculates Cricket Chase Expectancy', () => {
      // Innings 1: 90 runs, Innings 2: 45 runs after 30 balls (5 overs), 2 wickets down
      const chase = calculateCricketChaseExpectancy(90, 45, 30, 2, 10);
      expect(chase.targetRuns).toBe(91);
      expect(chase.runsRemaining).toBe(46);
      expect(chase.ballsRemaining).toBe(30);
      expect(chase.oversRemaining).toBe('5.0');
      expect(chase.crr).toBe(9.0);
      expect(chase.rrr).toBeCloseTo(9.2, 1);
      expect(chase.wicketsRemaining).toBe(8);
      expect(chase.chaseProbPct).toBeGreaterThan(30);
    });

    it('generates a full MatchAnalyticsReport ready for Recharts visualization', () => {
      const match = {
        id: 'm-full-1',
        sport_id: 'sport-football',
        score_home: 2,
        score_away: 1,
        current_time_seconds: 3000,
        current_period: '2nd Half',
      };
      const events = [
        { minute: 12, event_type: 'GOAL', team: 'home' },
        { minute: 34, event_type: 'GOAL', team: 'away' },
        { minute: 48, event_type: 'GOAL', team: 'home' },
      ];

      const report = getMatchAnalyticsReport(match, events);
      expect(report.winProbability).toBeDefined();
      expect(report.momentumWave).toBeDefined();
      expect(report.momentumWave.length).toBeGreaterThan(0);
      expect(report.clutch).toBeDefined();
      expect(report.insights).toBeDefined();
      expect(report.expectedRates).toBeDefined();
      expect(report.expectedRates.projectedTotal).toBeGreaterThanOrEqual(3);
    });

    it('correctly maps 15 sports categories', () => {
      expect(normalizeSportCategory('sport-football')).toBe('FOOTBALL');
      expect(normalizeSportCategory('sport-futsal')).toBe('FUTSAL');
      expect(normalizeSportCategory('sport-basketball-m')).toBe('BASKETBALL');
      expect(normalizeSportCategory('sport-basketball-f')).toBe('BASKETBALL');
      expect(normalizeSportCategory('sport-cricket')).toBe('CRICKET');
      expect(normalizeSportCategory('sport-badminton-m')).toBe('BADMINTON');
      expect(normalizeSportCategory('sport-badminton-f')).toBe('BADMINTON');
      expect(normalizeSportCategory('sport-table-tennis')).toBe('TABLE_TENNIS');
      expect(normalizeSportCategory('sport-tennis')).toBe('TENNIS');
      expect(normalizeSportCategory('sport-volleyball')).toBe('VOLLEYBALL');
      expect(normalizeSportCategory('sport-throwball')).toBe('THROWBALL');
      expect(normalizeSportCategory('sport-chess')).toBe('CHESS');
      expect(normalizeSportCategory('sport-pool')).toBe('POOL');
      expect(normalizeSportCategory('sport-track-field-m')).toBe('ATHLETICS');
      expect(normalizeSportCategory('sport-track-field-f')).toBe('ATHLETICS');
    });

    it('survives extreme edge cases: division by zero, string numbers, negative times', () => {
      const weirdMatch = {
        id: 'm-weird',
        sport_id: 'sport-cricket',
        score_home: '0',
        score_away: '0',
        current_time_seconds: -100,
        current_period: null,
      };

      const winProb = calculateWinProbability(weirdMatch, []);
      expect(winProb.homePct).toBe(50.0);
      expect(winProb.awayPct).toBe(50.0);
      expect(winProb.confidence).toBe('low');

      const wave = calculateMomentumWave(weirdMatch, []);
      expect(wave.length).toBeGreaterThan(0);
      expect(wave[0].momentum).toBeDefined();

      const clutch = calculateClutchRating(weirdMatch);
      expect(clutch.leverage).toBeDefined();

      const insights = generateMatchInsights(weirdMatch, []);
      expect(insights.length).toBeGreaterThan(0);

      const rates = calculateExpectedScoringRates(weirdMatch, []);
      expect(rates.projectedTotal).toBe(0);
    });

    it('safely handles non-array events and null payloads', () => {
      const match = { id: 'm-safe', sport_id: 'sport-football', score_home: 1, score_away: 0 };
      expect(() => calculateWinProbability(match, null as any)).not.toThrow();
      expect(() => calculateMomentumWave(match, undefined as any)).not.toThrow();
      expect(() => generateMatchInsights(match, {} as any)).not.toThrow();
    });
  });
});
