/**
 * Empirical Adversarial Challenge Test Suite: Milestone M3
 * Challenger M3-1: Sport Scoring Engines & Event-Sourcing Undo Service
 * Ratanji Digital Sports Management & Scoring System
 *
 * Requirements:
 * 1. Cricket Engine:
 *    - Full 2-over sequence with mixed dots, singles, boundaries, wides, and no-balls.
 *    - Overs progression (0.1 -> 1.0 -> 2.0) and accurate legal ball accounting.
 *    - 10 wickets falling and innings completion state.
 * 2. Badminton Engine:
 *    - Deuce match reaching 20-20, extending rally-by-rally up to 29-29, and golden point at 30-29.
 *    - Winner awarded set, no score exceeds 30.
 *    - Serve court indicator toggling based on odd/even points.
 * 3. Football Engine:
 *    - 2 yellow cards for the same player -> automatic red card generation.
 *    - Own goals for home and away -> opponent score increment.
 * 4. Event Undo & Sourcing:
 *    - Post 10 sequential events, verify intermediate scores.
 *    - Delete events in reverse and random order -> score perfectly decrements back to 0-0 with zero drift.
 *    - Deleting non-existent event returns 404.
 * 5. Adversarial Edge Cases & Security Guards:
 *    - Cross-match event deletion isolation.
 *    - Scorecard lock enforcement on event deletions.
 *    - Input validation (negative numbers, invalid event types).
 */

import { describe, it, expect } from 'vitest';
import { api, ADMIN_HEADERS, REFEREE_HEADERS } from './e2e/helpers';
import { CricketEngine } from '../server/services/sports-engines/cricket.js';
import { BadmintonEngine } from '../server/services/sports-engines/badminton.js';
import { FootballEngine } from '../server/services/sports-engines/football.js';

describe('Challenger M3-1: Sport Scoring Engines & Event Undo Service', () => {

  // =========================================================================
  // 1. CRICKET ENGINE ADVERSARIAL STRESS
  // =========================================================================
  describe('1. Cricket Scoring Engine', () => {

    it('1.1: Simulates full 2-over sequence with mixed deliveries, verifying exact overs progression and legal ball accounting', async () => {
      // Create fresh Cricket match fixture
      const createRes = await api.post('/api/matches', {
        sport_id: 'cricket',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Challenger Cricket Oval',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(createRes.status);
      const matchId = createRes.data.id;

      // Delivery sequence across 2 overs (12 legal balls + wides + no-balls):
      // Over 1:
      // Ball 1: Dot ball (BALL, runs: 0) -> legal balls: 1, overs: '0.1', runs: 0
      // Ball 2: Single (BALL, runs: 1) -> legal balls: 2, overs: '0.2', runs: 1
      // Delivery 3: Wide (EXTRA, runs: 1, wide) -> legal balls: 2 (unchanged), overs: '0.2', runs: 2
      // Ball 4: Boundary Four (BALL, runs: 4) -> legal balls: 3, overs: '0.3', runs: 6
      // Delivery 5: No-ball (EXTRA, runs: 1, noball) -> legal balls: 3 (unchanged), overs: '0.3', runs: 7
      // Ball 6: Single (BALL, runs: 1) -> legal balls: 4, overs: '0.4', runs: 8
      // Ball 7: Boundary Six (BALL, runs: 6) -> legal balls: 5, overs: '0.5', runs: 14
      // Ball 8: Dot ball (BALL, runs: 0) -> legal balls: 6 (over rolls over!), overs: '1.0', runs: 14
      //
      // Over 2:
      // Ball 9: Single (BALL, runs: 1) -> legal balls: 7, overs: '1.1', runs: 15
      // Delivery 10: Bye (EXTRA, runs: 2, bye) -> legal balls: 8 (legal delivery!), overs: '1.2', runs: 17
      // Delivery 11: Leg-bye (EXTRA, runs: 1, leg_bye) -> legal balls: 9 (legal delivery!), overs: '1.3', runs: 18
      // Ball 12: Dot ball (BALL, runs: 0) -> legal balls: 10, overs: '1.4', runs: 18
      // Ball 13: Boundary Four (BALL, runs: 4) -> legal balls: 11, overs: '1.5', runs: 22
      // Ball 14: Single (BALL, runs: 1) -> legal balls: 12 (over rolls over!), overs: '2.0', runs: 23

      const deliveryPlan = [
        // Over 1
        { type: 'BALL', payload: { runs: 0 }, expectedOvers: '0.1', expectedBalls: 1, expectedRuns: 0 },
        { type: 'BALL', payload: { runs: 1 }, expectedOvers: '0.2', expectedBalls: 2, expectedRuns: 1 },
        { type: 'EXTRA', payload: { extra_type: 'wide', runs: 1 }, expectedOvers: '0.2', expectedBalls: 2, expectedRuns: 2 },
        { type: 'BALL', payload: { runs: 4 }, expectedOvers: '0.3', expectedBalls: 3, expectedRuns: 6 },
        { type: 'EXTRA', payload: { extra_type: 'noball', runs: 1 }, expectedOvers: '0.3', expectedBalls: 3, expectedRuns: 7 },
        { type: 'BALL', payload: { runs: 1 }, expectedOvers: '0.4', expectedBalls: 4, expectedRuns: 8 },
        { type: 'BALL', payload: { runs: 6 }, expectedOvers: '0.5', expectedBalls: 5, expectedRuns: 14 },
        { type: 'BALL', payload: { runs: 0 }, expectedOvers: '1.0', expectedBalls: 6, expectedRuns: 14 }, // End of Over 1
        // Over 2
        { type: 'BALL', payload: { runs: 1 }, expectedOvers: '1.1', expectedBalls: 7, expectedRuns: 15 },
        { type: 'EXTRA', payload: { extra_type: 'bye', runs: 2 }, expectedOvers: '1.2', expectedBalls: 8, expectedRuns: 17 },
        { type: 'EXTRA', payload: { extra_type: 'leg_bye', runs: 1 }, expectedOvers: '1.3', expectedBalls: 9, expectedRuns: 18 },
        { type: 'BALL', payload: { runs: 0 }, expectedOvers: '1.4', expectedBalls: 10, expectedRuns: 18 },
        { type: 'BALL', payload: { runs: 4 }, expectedOvers: '1.5', expectedBalls: 11, expectedRuns: 22 },
        { type: 'BALL', payload: { runs: 1 }, expectedOvers: '2.0', expectedBalls: 12, expectedRuns: 23 }, // End of Over 2
      ];

      for (let i = 0; i < deliveryPlan.length; i++) {
        const d = deliveryPlan[i];
        const res = await api.post(`/api/matches/${matchId}/events`, {
          event_type: d.type,
          team: 'home',
          minute: i + 1,
          payload_json: d.payload,
        }, ADMIN_HEADERS);

        expect(res.status).toBe(201);
        const state = res.data.sport_state;
        expect(state).toBeDefined();
        expect(state.innings1.overs).toBe(d.expectedOvers);
        expect(state.innings1.balls).toBe(d.expectedBalls);
        expect(state.innings1.runs).toBe(d.expectedRuns);
      }

      // Verify final match state via GET endpoint
      const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(detail.status).toBe(200);
      expect(detail.data.score_home).toBe(23);
      expect(detail.data.score_away).toBe(0);

      const sportState = typeof detail.data.sport_state_json === 'string'
        ? JSON.parse(detail.data.sport_state_json)
        : detail.data.sport_state_json;

      expect(sportState.innings1.overs).toBe('2.0');
      expect(sportState.innings1.balls).toBe(12);
      expect(sportState.innings1.runs).toBe(23);
      expect(sportState.innings1.extras.wides).toBe(1);
      expect(sportState.innings1.extras.noBalls).toBe(1);
      expect(sportState.innings1.extras.byes).toBe(2);
      expect(sportState.innings1.extras.legByes).toBe(1);
      expect(sportState.innings1.extras.total).toBe(5);
    });

    it('1.2: Simulates 10 wickets falling and verifies innings completion state and capping', async () => {
      const createRes = await api.post('/api/matches', {
        sport_id: 'cricket',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Challenger Cricket Oval',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      const matchId = createRes.data.id;

      // Post 10 sequential WICKET events
      for (let w = 1; w <= 10; w++) {
        const res = await api.post(`/api/matches/${matchId}/events`, {
          event_type: 'WICKET',
          team: 'home',
          minute: w,
          payload_json: { runs: 0, player_out: `batsman-${w}` },
        }, ADMIN_HEADERS);

        expect(res.status).toBe(201);
        expect(res.data.sport_state.innings1.wickets).toBe(w);
      }

      // Verify at 10 wickets: innings 1 has exactly 10 wickets (All Out)
      let detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      let sportState = typeof detail.data.sport_state_json === 'string'
        ? JSON.parse(detail.data.sport_state_json)
        : detail.data.sport_state_json;

      expect(sportState.innings1.wickets).toBe(10);

      // Attempt an 11th wicket event (adversarial overflow test)
      const overflowRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'WICKET',
        team: 'home',
        minute: 11,
        payload_json: { runs: 0 },
      }, ADMIN_HEADERS);
      expect(overflowRes.status).toBe(201);
      // Must be capped at 10 wickets maximum
      expect(overflowRes.data.sport_state.innings1.wickets).toBe(10);

      // Transition innings via INNINGS_SWITCH/INNINGS_END
      const switchRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'INNINGS_SWITCH',
        minute: 12,
      }, ADMIN_HEADERS);
      expect(switchRes.status).toBe(201);
      expect(switchRes.data.sport_state.currentInnings).toBe(2);
      expect(switchRes.data.sport_state.battingTeam).toBe('away');
      expect(switchRes.data.sport_state.targetRuns).toBe(detail.data.score_home + 1);
    });

    it('1.3: Direct CricketEngine unit oracle: legal vs illegal ball accounting', () => {
      const engine = new CricketEngine();
      const events: any[] = [
        { event_type: 'EXTRA', team: 'home', payload_json: { extra_type: 'wide', runs: 1 } },
        { event_type: 'EXTRA', team: 'home', payload_json: { extra_type: 'noball', runs: 1 } },
        { event_type: 'EXTRA', team: 'home', payload_json: { extra_type: 'leg_bye', runs: 1 } }, // legal
        { event_type: 'EXTRA', team: 'home', payload_json: { extra_type: 'bye', runs: 1 } },     // legal
        { event_type: 'WICKET', team: 'home', payload_json: { extra_type: 'wide', runs: 1 } },   // stumped on wide (illegal)
        { event_type: 'WICKET', team: 'home', payload_json: { runs: 0 } },                       // clean bowled (legal)
      ];

      const res = engine.recalculate(events);
      // Expected legal deliveries: leg_bye (1) + bye (1) + clean bowled (1) = 3 balls = '0.3' overs
      expect(res.sport_state.innings1.balls).toBe(3);
      expect(res.sport_state.innings1.overs).toBe('0.3');
      expect(res.sport_state.innings1.wickets).toBe(2);
    });
  });

  // =========================================================================
  // 2. BADMINTON ENGINE ADVERSARIAL STRESS
  // =========================================================================
  describe('2. Badminton Scoring Engine', () => {

    it('2.1: Simulates deuce at 20-20, extending rally-by-rally up to 29-29, and golden point at 30-29', async () => {
      const createRes = await api.post('/api/matches', {
        sport_id: 'badminton-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Badminton Championship Court',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(createRes.status);
      const matchId = createRes.data.id;

      // 1. Rally sequentially to 20-20
      // 20 points for Home, 20 points for Away
      for (let p = 1; p <= 20; p++) {
        await api.post(`/api/matches/${matchId}/events`, {
          event_type: 'POINT',
          team: 'home',
          minute: p,
        }, ADMIN_HEADERS);
        await api.post(`/api/matches/${matchId}/events`, {
          event_type: 'POINT',
          team: 'away',
          minute: p,
        }, ADMIN_HEADERS);
      }

      // Check state at 20-20
      let detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      let sportState = typeof detail.data.sport_state_json === 'string'
        ? JSON.parse(detail.data.sport_state_json)
        : detail.data.sport_state_json;

      expect(sportState.currentSetPoints.home).toBe(20);
      expect(sportState.currentSetPoints.away).toBe(20);
      expect(sportState.isDeuce).toBe(true);
      expect(sportState.sets.length).toBe(0); // Set not won yet, requires 2-point lead

      // 2. Extend rally-by-rally up to 29-29: alternating points so neither gets 2-point lead
      // 21-20 -> 21-21 -> 22-21 -> 22-22 ... up to 29-29
      for (let score = 21; score <= 29; score++) {
        // Home scores to lead by 1 (e.g. 21-20)
        let r1 = await api.post(`/api/matches/${matchId}/events`, {
          event_type: 'POINT',
          team: 'home',
          minute: score + 10,
        }, ADMIN_HEADERS);
        expect(r1.data.sport_state.currentSetPoints.home).toBe(score);
        expect(r1.data.sport_state.currentSetPoints.away).toBe(score - 1);
        expect(r1.data.sport_state.isDeuce).toBe(true);
        expect(r1.data.sport_state.sets.length).toBe(0); // 1-point lead is not enough

        // Away equalizes (e.g. 21-21)
        let r2 = await api.post(`/api/matches/${matchId}/events`, {
          event_type: 'POINT',
          team: 'away',
          minute: score + 10,
        }, ADMIN_HEADERS);
        expect(r2.data.sport_state.currentSetPoints.home).toBe(score);
        expect(r2.data.sport_state.currentSetPoints.away).toBe(score);
        expect(r2.data.sport_state.isDeuce).toBe(true);
        expect(r2.data.sport_state.sets.length).toBe(0); // Still tied
      }

      // 3. Golden Point at 30-29: Home scores the 30th point!
      const goldenRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'POINT',
        team: 'home',
        minute: 45,
      }, ADMIN_HEADERS);
      expect(goldenRes.status).toBe(201);

      // Verify winner is awarded the set and no score exceeds 30
      detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      sportState = typeof detail.data.sport_state_json === 'string'
        ? JSON.parse(detail.data.sport_state_json)
        : detail.data.sport_state_json;

      expect(detail.data.score_home).toBe(1); // Set 1 won by Home
      expect(detail.data.score_away).toBe(0);
      expect(sportState.sets.length).toBe(1);
      expect(sportState.sets[0].set).toBe(1);
      expect(sportState.sets[0].home).toBe(30);
      expect(sportState.sets[0].away).toBe(29);
      expect(sportState.sets[0].winner).toBe('home');
      expect(sportState.sets[0].home).toBeLessThanOrEqual(30);
      expect(sportState.sets[0].away).toBeLessThanOrEqual(30);

      // Current set resets for Set 2
      expect(sportState.currentSet).toBe(2);
      expect(sportState.currentSetPoints.home).toBe(0);
      expect(sportState.currentSetPoints.away).toBe(0);
    });

    it('2.2: Verifies serve court indicator toggles correctly based on odd/even points', async () => {
      const createRes = await api.post('/api/matches', {
        sport_id: 'badminton-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Badminton Court 2',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      const matchId = createRes.data.id;

      // Initial state: 0 points (even) -> serving home -> serviceCourt: 'right'
      const initDetail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      let state = typeof initDetail.data.sport_state_json === 'string'
        ? JSON.parse(initDetail.data.sport_state_json)
        : initDetail.data.sport_state_json;

      // Point 1: Home scores (1-0). Home serves, server score is 1 (odd) -> 'left'
      let p1 = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'POINT',
        team: 'home',
        minute: 1,
      }, ADMIN_HEADERS);
      expect(p1.data.sport_state.serving).toBe('home');
      expect(p1.data.sport_state.serviceCourt).toBe('left');

      // Point 2: Home scores (2-0). Home serves, server score is 2 (even) -> 'right'
      let p2 = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'POINT',
        team: 'home',
        minute: 2,
      }, ADMIN_HEADERS);
      expect(p2.data.sport_state.serving).toBe('home');
      expect(p2.data.sport_state.serviceCourt).toBe('right');

      // Point 3: Away scores (2-1). Away serves, server score is 1 (odd) -> 'left'
      let p3 = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'POINT',
        team: 'away',
        minute: 3,
      }, ADMIN_HEADERS);
      expect(p3.data.sport_state.serving).toBe('away');
      expect(p3.data.sport_state.serviceCourt).toBe('left');

      // Point 4: Away scores (2-2). Away serves, server score is 2 (even) -> 'right'
      let p4 = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'POINT',
        team: 'away',
        minute: 4,
      }, ADMIN_HEADERS);
      expect(p4.data.sport_state.serving).toBe('away');
      expect(p4.data.sport_state.serviceCourt).toBe('right');
    });

    it('2.3: Direct BadmintonEngine unit oracle: standard 21-point set completion with 2-point lead', () => {
      const engine = new BadmintonEngine();
      const events: any[] = [];
      // Home scores 21, Away scores 19
      for (let i = 0; i < 19; i++) {
        events.push({ event_type: 'POINT', team: 'home' });
        events.push({ event_type: 'POINT', team: 'away' });
      }
      events.push({ event_type: 'POINT', team: 'home' }); // 20-19
      events.push({ event_type: 'POINT', team: 'home' }); // 21-19 (win by 2)

      const result = engine.recalculate(events);
      expect(result.score_home).toBe(1);
      expect(result.score_away).toBe(0);
      expect(result.sport_state.sets.length).toBe(1);
      expect(result.sport_state.sets[0]).toEqual({
        set: 1,
        home: 21,
        away: 19,
        winner: 'home',
      });
      expect(result.sport_state.currentSet).toBe(2);
    });
  });

  // =========================================================================
  // 3. FOOTBALL ENGINE ADVERSARIAL STRESS
  // =========================================================================
  describe('3. Football Scoring Engine', () => {

    it('3.1: Simulates 2 yellow cards for the same player and verifies automatic red card generation', async () => {
      const createRes = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Football Arena',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(createRes.status);
      const matchId = createRes.data.id;

      const playerId = 'ply-26bm003'; // Rohan Dasgupta (Senior Striker)

      // 1st Yellow Card
      const y1Res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'YELLOW_CARD',
        team: 'home',
        player_id: playerId,
        minute: 25,
      }, ADMIN_HEADERS);
      expect(y1Res.status).toBe(201);
      expect(y1Res.data.sport_state.cards.home.yellow).toBe(1);
      expect(y1Res.data.sport_state.cards.home.red).toBe(0);
      expect(y1Res.data.sport_state.playerBookings[playerId]).toEqual({
        yellows: 1,
        red: false,
      });

      // 2nd Yellow Card for the same player
      const y2Res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'YELLOW_CARD',
        team: 'home',
        player_id: playerId,
        minute: 68,
      }, ADMIN_HEADERS);
      expect(y2Res.status).toBe(201);

      // Automatic Red Card Generation
      expect(y2Res.data.sport_state.cards.home.yellow).toBe(2);
      expect(y2Res.data.sport_state.cards.home.red).toBe(1); // Red card generated!
      expect(y2Res.data.sport_state.playerBookings[playerId]).toEqual({
        yellows: 2,
        red: true,
      });

      // Another player on Home gets yellow card: should NOT trigger another red
      const anotherPlayerId = 'ply-26bm006'; // Aditya Chopra (Senior Midfielder)
      const y3Res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'YELLOW_CARD',
        team: 'home',
        player_id: anotherPlayerId,
        minute: 75,
      }, ADMIN_HEADERS);
      expect(y3Res.status).toBe(201);
      expect(y3Res.data.sport_state.cards.home.yellow).toBe(3);
      expect(y3Res.data.sport_state.cards.home.red).toBe(1); // Still 1 red card
      expect(y3Res.data.sport_state.playerBookings[anotherPlayerId]).toEqual({
        yellows: 1,
        red: false,
      });
    });

    it('3.2: Simulates own goals for both home and away, verifying opponent score increment', async () => {
      const createRes = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Football Arena',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      const matchId = createRes.data.id;

      // 1. Home scores an OWN_GOAL -> score_away must increment (+1 to away)
      const ogHome = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'OWN_GOAL',
        team: 'home',
        minute: 15,
        payload_json: { player_id: 'defender-home-4' },
      }, ADMIN_HEADERS);
      expect(ogHome.status).toBe(201);
      expect(ogHome.data.score_home).toBe(0);
      expect(ogHome.data.score_away).toBe(1);

      // 2. Away scores an OWN_GOAL -> score_home must increment (+1 to home)
      const ogAway = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'OWN_GOAL',
        team: 'away',
        minute: 40,
        payload_json: { player_id: 'defender-away-3' },
      }, ADMIN_HEADERS);
      expect(ogAway.status).toBe(201);
      expect(ogAway.data.score_home).toBe(1);
      expect(ogAway.data.score_away).toBe(1);

      // Verify via GET endpoint
      const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(detail.data.score_home).toBe(1);
      expect(detail.data.score_away).toBe(1);
    });

    it('3.3: Direct FootballEngine unit oracle: substitutions, injury time and direct red card', () => {
      const engine = new FootballEngine();
      const events: any[] = [
        { event_type: 'RED_CARD', team: 'away', player_id: 'player-away-2', minute: 10 },
        { event_type: 'SUBSTITUTION', team: 'home', minute: 45, second: 0, payload_json: { player_in: 'sub-in', player_out: 'sub-out' } },
        { event_type: 'INJURY_TIME', minute: 45, payload_json: { extra_minutes: 4 } },
        { event_type: 'HALF_TIME', minute: 49 },
        { event_type: 'INJURY_TIME', minute: 90, payload_json: { extra_minutes: 3 } },
      ];

      const res = engine.recalculate(events);
      expect(res.sport_state.cards.away.red).toBe(1);
      expect(res.sport_state.playerBookings['player-away-2']).toEqual({ yellows: 0, red: true });
      expect(res.sport_state.substitutions.length).toBe(1);
      expect(res.sport_state.injuryTimeMinutes).toEqual({ half1: 4, half2: 3 });
      expect(res.current_period).toBe('2nd Half');
    });
  });

  // =========================================================================
  // 4. EVENT UNDO & SOURCING ADVERSARIAL STRESS
  // =========================================================================
  describe('4. Event Undo & Event-Sourcing Fidelity', () => {

    it('4.1: Posts 10 sequential events, verifies intermediate scores, then deletes events in reverse and random order with ZERO score drift', async () => {
      const createRes = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Undo Arena',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(createRes.status);
      const matchId = createRes.data.id;

      // 10 planned events with known expected intermediate scores
      const eventDefs = [
        { type: 'GOAL', team: 'home', expH: 1, expA: 0 },       // Ev 0: 1-0
        { type: 'GOAL', team: 'away', expH: 1, expA: 1 },       // Ev 1: 1-1
        { type: 'OWN_GOAL', team: 'home', expH: 1, expA: 2 },   // Ev 2: 1-2
        { type: 'GOAL', team: 'home', expH: 2, expA: 2 },       // Ev 3: 2-2
        { type: 'YELLOW_CARD', team: 'home', expH: 2, expA: 2 },// Ev 4: 2-2
        { type: 'GOAL', team: 'home', expH: 3, expA: 2 },       // Ev 5: 3-2
        { type: 'OWN_GOAL', team: 'away', expH: 4, expA: 2 },   // Ev 6: 4-2
        { type: 'GOAL', team: 'away', expH: 4, expA: 3 },       // Ev 7: 4-3
        { type: 'GOAL', team: 'home', expH: 5, expA: 3 },       // Ev 8: 5-3
        { type: 'GOAL', team: 'away', expH: 5, expA: 4 },       // Ev 9: 5-4
      ];

      const recordedEventIds: string[] = [];

      // Post 10 sequential events and verify intermediate scores
      for (let i = 0; i < eventDefs.length; i++) {
        const ed = eventDefs[i];
        const res = await api.post(`/api/matches/${matchId}/events`, {
          event_type: ed.type,
          team: ed.team,
          minute: i * 5,
        }, ADMIN_HEADERS);

        expect(res.status).toBe(201);
        expect(res.data.score_home).toBe(ed.expH);
        expect(res.data.score_away).toBe(ed.expA);
        recordedEventIds.push(res.data.id);
      }

      expect(recordedEventIds.length).toBe(10);

      // Verify score at peak: 5 - 4
      let check = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(check.data.score_home).toBe(5);
      expect((detail: any) => detail.data.score_away).toBeDefined();
      expect(check.data.score_away).toBe(4);
      expect(check.data.events.length).toBe(10);

      // Phase A: Delete first 3 events in REVERSE order (LIFO: 9, 8, 7)
      const ev9 = recordedEventIds[9];
      const del9 = await api.delete(`/api/matches/${matchId}/events/${ev9}`, ADMIN_HEADERS);
      expect(del9.status).toBe(200);
      expect(del9.data.score_home).toBe(5);
      expect(del9.data.score_away).toBe(3);

      const ev8 = recordedEventIds[8];
      const del8 = await api.delete(`/api/matches/${matchId}/events/${ev8}`, ADMIN_HEADERS);
      expect(del8.status).toBe(200);
      expect(del8.data.score_home).toBe(4);
      expect(del8.data.score_away).toBe(3);

      const ev7 = recordedEventIds[7];
      const del7 = await api.delete(`/api/matches/${matchId}/events/${ev7}`, ADMIN_HEADERS);
      expect(del7.status).toBe(200);
      expect(del7.data.score_home).toBe(4);
      expect(del7.data.score_away).toBe(2);

      // Remaining event indices: [0, 1, 2, 3, 4, 5, 6]
      // Phase B: Delete remaining events in RANDOM / NON-SEQUENTIAL order: [2, 5, 0, 4, 6, 1, 3]
      const randomIndices = [2, 5, 0, 4, 6, 1, 3];
      for (const idx of randomIndices) {
        const idToDelete = recordedEventIds[idx];
        const delRes = await api.delete(`/api/matches/${matchId}/events/${idToDelete}`, ADMIN_HEADERS);
        expect(delRes.status).toBe(200);
      }

      // Verification: When all events are deleted, match score MUST perfectly decrement back to 0-0
      const finalDetail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(finalDetail.data.score_home).toBe(0);
      expect(finalDetail.data.score_away).toBe(0);
      expect(finalDetail.data.events.length).toBe(0);
      expect(finalDetail.data.sport_state_json.homeGoals || 0).toBe(0);
      expect(finalDetail.data.sport_state_json.awayGoals || 0).toBe(0);
    });

    it('4.2: Verifies that deleting a non-existent event returns 404 NOT_FOUND', async () => {
      const createRes = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: '404 Arena',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      const matchId = createRes.data.id;

      const nonExistentId = 'ev-non-existent-99999999';
      const delRes = await api.delete(`/api/matches/${matchId}/events/${nonExistentId}`, ADMIN_HEADERS);

      expect(delRes.status).toBe(404);
      expect(delRes.data.error).toContain('not found');
      expect(delRes.data.code).toBe('NOT_FOUND');
    });

    it('4.3: Cross-match isolation: deleting an event belonging to Match A via Match B returns 404', async () => {
      // Create Match A and Match B
      const mA = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Arena A',
      }, ADMIN_HEADERS)).data;

      const mB = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Arena B',
      }, ADMIN_HEADERS)).data;

      // Post an event to Match A
      const evA = (await api.post(`/api/matches/${mA.id}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 10,
      }, ADMIN_HEADERS)).data;

      // Attempt to delete Match A's event using Match B's route
      const crossDel = await api.delete(`/api/matches/${mB.id}/events/${evA.id}`, ADMIN_HEADERS);
      expect(crossDel.status).toBe(404);

      // Verify Match A's score is unaffected
      const detailA = await api.get(`/api/matches/${mA.id}`, ADMIN_HEADERS);
      expect(detailA.data.score_home).toBe(1);
    });

    it('4.4: Scorecard Lock Guard: deleting events on a Submitted or Published match is strictly blocked (400 SCORECARD_LOCKED)', async () => {
      const match = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Locked Arena',
        referee_id: 'ref-lock-1',
      }, ADMIN_HEADERS)).data;

      const ev = (await api.post(`/api/matches/${match.id}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 20,
      }, ADMIN_HEADERS)).data;

      // Submit the scorecard (Draft -> Submitted)
      const subRes = await api.post(`/api/matches/${match.id}/submit`, {}, REFEREE_HEADERS('ref-lock-1'));
      expect([200, 201]).toContain(subRes.status);

      // Now attempt to delete the event: must be blocked because scorecard is locked
      const blockedDel = await api.delete(`/api/matches/${match.id}/events/${ev.id}`, ADMIN_HEADERS);
      expect(blockedDel.status).toBe(400);
      expect(blockedDel.data.code).toBe('SCORECARD_LOCKED');

      // Score must remain preserved
      const detail = await api.get(`/api/matches/${match.id}`, ADMIN_HEADERS);
      expect(detail.data.score_home).toBe(1);
    });
  });

  // =========================================================================
  // 5. ADVERSARIAL INPUT VALIDATION FOR SCORING ENGINES
  // =========================================================================
  describe('5. Adversarial Input Validation & Sport Boundaries', () => {

    it('5.1: Rejects negative points, runs, and minutes with 400 Bad Request', async () => {
      const match = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
      }, ADMIN_HEADERS)).data;

      // Negative minute
      const negMin = await api.post(`/api/matches/${match.id}/events`, {
        event_type: 'GOAL',
        minute: -5,
      }, ADMIN_HEADERS);
      expect(negMin.status).toBe(400);
      expect(negMin.data.code).toBe('INVALID_MINUTE');

      // Negative runs in Cricket
      const crMatch = (await api.post('/api/matches', {
        sport_id: 'cricket',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
      }, ADMIN_HEADERS)).data;

      const negRuns = await api.post(`/api/matches/${crMatch.id}/events`, {
        event_type: 'BALL',
        payload_json: { runs: -4 },
      }, ADMIN_HEADERS);
      expect(negRuns.status).toBe(400);
      expect(negRuns.data.code).toBe('INVALID_RUNS');
    });

    it('5.2: Rejects sport-incompatible event types (e.g. WICKET on Football)', async () => {
      const fbMatch = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
      }, ADMIN_HEADERS)).data;

      const incompatible = await api.post(`/api/matches/${fbMatch.id}/events`, {
        event_type: 'WICKET',
        team: 'home',
        minute: 10,
      }, ADMIN_HEADERS);

      expect(incompatible.status).toBe(400);
      expect(incompatible.data.code).toBe('INVALID_EVENT_TYPE');
    });
  });
});
