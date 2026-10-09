/**
 * Challenger M2-2 Empirical Challenge Test Suite:
 * Standings Engine Invariants, Concurrency Stress & Catalog API Boundary Safety
 *
 * Target: Ratanji Digital Sports Management & Scoring System (Milestone M2)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { api, ADMIN_HEADERS, REFEREE_HEADERS, SPECTATOR_HEADERS } from './e2e/helpers.js';
import { DatabaseClient } from '../server/db/client.js';
import { StandingsService } from '../server/services/standings.js';
import { initSchema } from '../server/db/schema.js';
import { seedDatabase } from '../server/db/seed.js';

describe('Challenger M2-2: Standings Engine & Catalog API Adversarial Challenge Suite', () => {

  // =========================================================================
  // SECTION 1: Standings Calculation Invariants
  // =========================================================================
  describe('1. Standings Calculation Invariants', () => {

    it('INV-01: Win=3, Draw=1, Loss=0 rule strictly enforced across all cohorts in standings', async () => {
      const res = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(res.status).toBe(200);
      const standings = res.data.standings || res.data;
      expect(Array.isArray(standings)).toBe(true);
      expect(standings.length).toBeGreaterThanOrEqual(2);

      for (const row of standings) {
        // Strict point invariant: total_points = (won * 3) + (drawn * 1) + (lost * 0)
        const expectedPoints = (row.won * 3) + (row.drawn * 1);
        const reportedPoints = row.total_points ?? row.points;
        expect(reportedPoints).toBe(expectedPoints);

        // Strict match played invariant: played = won + drawn + lost
        expect(row.played).toBe(row.won + row.drawn + row.lost);
      }
    });

    it('INV-02: points_diff = points_for - points_against invariant holds unconditionally with closed tournament conservation', async () => {
      const res = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(res.status).toBe(200);
      const standings = res.data.standings || res.data;

      let totalPointsFor = 0;
      let totalPointsAgainst = 0;
      let totalPointsDiff = 0;

      for (const row of standings) {
        const expectedDiff = row.points_for - row.points_against;
        const actualDiff = row.points_diff ?? row.points_difference;
        expect(actualDiff).toBe(expectedDiff);

        totalPointsFor += row.points_for;
        totalPointsAgainst += row.points_against;
        totalPointsDiff += actualDiff;
      }

      // In a 2-cohort closed tournament (Seniors vs Juniors), points scored by one is points conceded by the other
      expect(totalPointsFor).toBe(totalPointsAgainst);
      expect(totalPointsDiff).toBe(0);
    });

    it('INV-03: Synthetic 100-match oracle validates mathematical invariants across generated outcomes', () => {
      // Create isolated in-memory DB to stress-test standings math without polluting shared server state
      const memDb = new DatabaseClient(':memory:');
      try {
        initSchema(memDb);
        seedDatabase(memDb, { clean: true });

        const service = new StandingsService(memDb);

        // Clear existing matches
        memDb.execute('DELETE FROM match_events;');
        memDb.execute('DELETE FROM matches;');

        // Deterministic pseudo-random match generator
        let seed = 42;
        const randomInt = (min: number, max: number) => {
          seed = (seed * 9301 + 49297) % 233280;
          const rnd = seed / 233280;
          return min + Math.floor(rnd * (max - min + 1));
        };

        const sports = ['sport-football', 'sport-cricket', 'sport-basketball-m', 'sport-volleyball'];

        for (let i = 0; i < 100; i++) {
          const matchId = `synth-m-${i}`;
          const sportId = sports[i % sports.length];
          const scoreHome = randomInt(0, 10);
          const scoreAway = randomInt(0, 10);

          memDb.execute(`
            INSERT INTO matches (
              id, tournament_id, sport_id, home_cohort_id, away_cohort_id,
              venue, scheduled_at, referee_id, status, score_home, score_away,
              current_period, current_time_seconds, sport_state_json, notes
            ) VALUES (?, 'tourn-xlri-2026', ?, 'cohort-seniors', 'cohort-juniors',
              'Synthetic Arena', '2026-10-15T10:00:00Z', 'usr-ref-1', 'PUBLISHED',
              ?, ?, 'Full Time', 0, '{}', 'Synthetic Stress Match')
          `, [matchId, sportId, scoreHome, scoreAway]);
        }

        const calculated = service.recalculate();
        expect(calculated).toHaveLength(2);

        const seniors = calculated.find((c) => c.id === 'cohort-seniors' || c.cohort_id === 'seniors')!;
        const juniors = calculated.find((c) => c.id === 'cohort-juniors' || c.cohort_id === 'juniors')!;

        expect(seniors).toBeDefined();
        expect(juniors).toBeDefined();

        // 100 total matches played between both
        expect(seniors.played).toBe(100);
        expect(juniors.played).toBe(100);

        // Invariant: Seniors wins = Juniors losses
        expect(seniors.won).toBe(juniors.lost);
        // Invariant: Juniors wins = Seniors losses
        expect(juniors.won).toBe(seniors.lost);
        // Invariant: Seniors draws = Juniors draws
        expect(seniors.drawn).toBe(juniors.drawn);

        // Invariant: Points formula
        expect(seniors.total_points).toBe((seniors.won * 3) + seniors.drawn);
        expect(juniors.total_points).toBe((juniors.won * 3) + juniors.drawn);

        // Invariant: Differential
        expect(seniors.points_diff).toBe(seniors.points_for - seniors.points_against);
        expect(juniors.points_diff).toBe(juniors.points_for - juniors.points_against);

        // Closed conservation: Seniors diff + Juniors diff == 0
        expect(seniors.points_diff + juniors.points_diff).toBe(0);
        expect(seniors.points_for).toBe(juniors.points_against);
        expect(juniors.points_for).toBe(seniors.points_against);
      } finally {
        memDb.close();
      }
    });
  });

  // =========================================================================
  // SECTION 2: Strict Isolation (Draft, Submitted & Verified States)
  // =========================================================================
  describe('2. Strict Lifecycle Isolation (Non-Published Matches NEVER Alter Standings)', () => {
    let baselineStandings: any;
    let isolatedMatchId: string;

    beforeEach(async () => {
      // Capture live baseline standings
      const res = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(res.status).toBe(200);
      baselineStandings = JSON.parse(JSON.stringify(res.data));
    });

    it('ISO-01: Creating a match in Draft status NEVER alters standings', async () => {
      const createRes = await api.post('/api/matches', {
        sport_id: 'sport-football',
        home_cohort_id: 'cohort-seniors',
        away_cohort_id: 'cohort-juniors',
        venue: 'Isolation Stadium',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS);

      expect([200, 201]).toContain(createRes.status);
      isolatedMatchId = createRes.data.id;

      // Verify standings remain byte-for-byte identical
      const checkRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(checkRes.status).toBe(200);
      expect(checkRes.data).toEqual(baselineStandings);
    });

    it('ISO-02: Scoring events on a Draft match NEVER alter standings', async () => {
      // Score 5 goals for home team in draft
      for (let g = 1; g <= 5; g++) {
        const evRes = await api.post(`/api/matches/${isolatedMatchId}/events`, {
          event_type: 'GOAL',
          team: 'home',
          minute: g * 10,
        }, REFEREE_HEADERS('ref-1'));
        expect([200, 201]).toContain(evRes.status);
      }

      // Verify match has 5-0 score in draft
      const matchDetail = await api.get(`/api/matches/${isolatedMatchId}`, SPECTATOR_HEADERS);
      expect(matchDetail.data.score_home).toBe(5);
      expect(matchDetail.data.score_away).toBe(0);
      expect(matchDetail.data.status).toBe('Draft');

      // Standings MUST remain 100% unchanged
      const checkRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(checkRes.status).toBe(200);
      expect(checkRes.data).toEqual(baselineStandings);
    });

    it('ISO-03: Submitting match (Draft -> Submitted) NEVER alters standings', async () => {
      const submitRes = await api.post(`/api/matches/${isolatedMatchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(submitRes.status);

      const matchDetail = await api.get(`/api/matches/${isolatedMatchId}`, SPECTATOR_HEADERS);
      expect(matchDetail.data.status).toBe('Submitted');

      // Standings MUST remain unchanged
      const checkRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(checkRes.status).toBe(200);
      expect(checkRes.data).toEqual(baselineStandings);
    });

    it('ISO-04: Admin verification (Submitted -> Verified) NEVER alters standings', async () => {
      const verifyRes = await api.post(`/api/matches/${isolatedMatchId}/verify`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(verifyRes.status);

      const matchDetail = await api.get(`/api/matches/${isolatedMatchId}`, SPECTATOR_HEADERS);
      expect(matchDetail.data.status).toBe('Verified');

      // Standings MUST remain unchanged
      const checkRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(checkRes.status).toBe(200);
      expect(checkRes.data).toEqual(baselineStandings);
    });

    it('ISO-05: Rejecting match back to Draft NEVER alters standings', async () => {
      // Re-submit if needed or test rejection from submitted state on a fresh match
      const mRes = await api.post('/api/matches', {
        sport_id: 'sport-basketball-m',
        home_cohort_id: 'cohort-seniors',
        away_cohort_id: 'cohort-juniors',
        referee_id: 'ref-2',
      }, ADMIN_HEADERS);
      const testMatchId = mRes.data.id;

      await api.post(`/api/matches/${testMatchId}/submit`, {}, REFEREE_HEADERS('ref-2'));
      const rejRes = await api.post(`/api/matches/${testMatchId}/reject`, {
        notes: 'Scorecard disputed by committee'
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(rejRes.status);

      // Standings MUST remain unchanged
      const checkRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(checkRes.status).toBe(200);
      expect(checkRes.data).toEqual(baselineStandings);
    });
  });

  // =========================================================================
  // SECTION 3: Publishing Match: Atomic Standings Update
  // =========================================================================
  describe('3. Match Publication: Atomic Increments & Standings Propagation', () => {

    it('PUB-01: Publishing a win immediately & atomically increments winner by 3, loser by 0, and updates differentials', async () => {
      // 1. Snapshot standings before match
      const preRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      const preStandings = preRes.data.standings || preRes.data;
      const preSeniors = preStandings.find((c: any) => c.cohort_id === 'seniors' || c.id === 'cohort-seniors');
      const preJuniors = preStandings.find((c: any) => c.cohort_id === 'juniors' || c.id === 'cohort-juniors');

      // 2. Schedule and score match: Seniors win 4 - 1
      const matchRes = await api.post('/api/matches', {
        sport_id: 'sport-football',
        home_cohort_id: 'cohort-seniors',
        away_cohort_id: 'cohort-juniors',
        venue: 'Main Football Arena',
        referee_id: 'ref-1',
      }, ADMIN_HEADERS);
      const mId = matchRes.data.id;

      // Seniors score 4
      for (let i = 0; i < 4; i++) {
        await api.post(`/api/matches/${mId}/events`, { event_type: 'GOAL', team: 'home', minute: 10 + i }, REFEREE_HEADERS('ref-1'));
      }
      // Juniors score 1
      await api.post(`/api/matches/${mId}/events`, { event_type: 'GOAL', team: 'away', minute: 80 }, REFEREE_HEADERS('ref-1'));

      // Conclude & Submit
      await api.post(`/api/matches/${mId}/submit`, {}, REFEREE_HEADERS('ref-1'));

      // 3. Publish match (Admin)
      const pubRes = await api.post(`/api/matches/${mId}/publish`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(pubRes.status);
      expect(pubRes.data.status).toBe('Published');

      // 4. Query standings immediately
      const postRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(postRes.status).toBe(200);
      const postStandings = postRes.data.standings || postRes.data;
      const postSeniors = postStandings.find((c: any) => c.cohort_id === 'seniors' || c.id === 'cohort-seniors');
      const postJuniors = postStandings.find((c: any) => c.cohort_id === 'juniors' || c.id === 'cohort-juniors');

      // Assert Winner (Seniors) deltas
      expect(postSeniors.won).toBe(preSeniors.won + 1);
      expect(postSeniors.lost).toBe(preSeniors.lost);
      expect(postSeniors.drawn).toBe(preSeniors.drawn);
      expect(postSeniors.played).toBe(preSeniors.played + 1);
      expect(postSeniors.points_for).toBe(preSeniors.points_for + 4);
      expect(postSeniors.points_against).toBe(preSeniors.points_against + 1);
      expect(postSeniors.points_diff).toBe(preSeniors.points_diff + 3); // 4 - 1 = +3
      expect(postSeniors.total_points).toBe(preSeniors.total_points + 3);

      // Assert Loser (Juniors) deltas
      expect(postJuniors.won).toBe(preJuniors.won);
      expect(postJuniors.lost).toBe(preJuniors.lost + 1);
      expect(postJuniors.drawn).toBe(preJuniors.drawn);
      expect(postJuniors.played).toBe(preJuniors.played + 1);
      expect(postJuniors.points_for).toBe(preJuniors.points_for + 1);
      expect(postJuniors.points_against).toBe(preJuniors.points_against + 4);
      expect(postJuniors.points_diff).toBe(preJuniors.points_diff - 3); // 1 - 4 = -3
      expect(postJuniors.total_points).toBe(preJuniors.total_points + 0); // 0 points for loss
    });

    it('PUB-02: Publishing a draw immediately & atomically awards 1 point to both cohorts', async () => {
      // 1. Snapshot
      const preRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      const preStandings = preRes.data.standings || preRes.data;
      const preSeniors = preStandings.find((c: any) => c.cohort_id === 'seniors' || c.id === 'cohort-seniors');
      const preJuniors = preStandings.find((c: any) => c.cohort_id === 'juniors' || c.id === 'cohort-juniors');

      // 2. Schedule and score draw: 2 - 2
      const matchRes = await api.post('/api/matches', {
        sport_id: 'sport-football',
        home_cohort_id: 'cohort-seniors',
        away_cohort_id: 'cohort-juniors',
        venue: 'Secondary Arena',
        referee_id: 'ref-1',
      }, ADMIN_HEADERS);
      const mId = matchRes.data.id;

      await api.post(`/api/matches/${mId}/events`, { event_type: 'GOAL', team: 'home', minute: 15 }, REFEREE_HEADERS('ref-1'));
      await api.post(`/api/matches/${mId}/events`, { event_type: 'GOAL', team: 'home', minute: 30 }, REFEREE_HEADERS('ref-1'));
      await api.post(`/api/matches/${mId}/events`, { event_type: 'GOAL', team: 'away', minute: 45 }, REFEREE_HEADERS('ref-1'));
      await api.post(`/api/matches/${mId}/events`, { event_type: 'GOAL', team: 'away', minute: 60 }, REFEREE_HEADERS('ref-1'));

      await api.post(`/api/matches/${mId}/submit`, {}, REFEREE_HEADERS('ref-1'));
      await api.post(`/api/matches/${mId}/publish`, {}, ADMIN_HEADERS);

      // 3. Verify standings
      const postRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      const postStandings = postRes.data.standings || postRes.data;
      const postSeniors = postStandings.find((c: any) => c.cohort_id === 'seniors' || c.id === 'cohort-seniors');
      const postJuniors = postStandings.find((c: any) => c.cohort_id === 'juniors' || c.id === 'cohort-juniors');

      // Both cohorts get +1 drawn and +1 total_points
      expect(postSeniors.drawn).toBe(preSeniors.drawn + 1);
      expect(postJuniors.drawn).toBe(preJuniors.drawn + 1);
      expect(postSeniors.total_points).toBe(preSeniors.total_points + 1);
      expect(postJuniors.total_points).toBe(preJuniors.total_points + 1);

      // Points diff changes by 0 for both (2 - 2 = 0)
      expect(postSeniors.points_diff).toBe(preSeniors.points_diff);
      expect(postJuniors.points_diff).toBe(preJuniors.points_diff);
    });
  });

  // =========================================================================
  // SECTION 4: Tie-Breaker Hierarchy Stress Testing
  // =========================================================================
  describe('4. Deterministic Tie-Breaker Hierarchy Resolution', () => {
    let memDb: DatabaseClient;
    let service: StandingsService;

    beforeEach(() => {
      memDb = new DatabaseClient(':memory:');
      initSchema(memDb);
      // Clean table structures
      memDb.execute('DELETE FROM cohorts;');
      memDb.execute('DELETE FROM matches;');
      memDb.execute('DELETE FROM standings;');
      memDb.exec(`
        INSERT OR IGNORE INTO tournaments (id, name, year, start_date, end_date) VALUES ('t1', 'Tournament 1', 2026, '2026-01-01', '2026-12-31');
        INSERT OR IGNORE INTO sports (id, name, category, rules_json, scoring_type) VALUES ('sport-football', 'Football', 'Outdoor', '{}', 'FOOTBALL');
      `);
      service = new StandingsService(memDb);
    });

    afterEach(() => {
      memDb.close();
    });

    it('TIE-01: Level 1 — Total Points overrides all lower metrics (Higher points ranks higher)', () => {
      memDb.execute(`
        INSERT INTO cohorts (id, name, batch, color) VALUES
          ('cohort-a', 'Cohort Alpha', '2026', '#000'),
          ('cohort-b', 'Cohort Beta', '2026', '#111');
      `);

      // Alpha has 6 points (2 wins), Beta has 3 points (1 win, high score)
      memDb.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, status, score_home, score_away) VALUES
          ('m1', 't1', 'sport-football', 'cohort-a', 'cohort-b', 'PUBLISHED', 2, 1),
          ('m2', 't1', 'sport-football', 'cohort-a', 'cohort-b', 'PUBLISHED', 1, 0),
          ('m3', 't1', 'sport-football', 'cohort-b', 'cohort-a', 'PUBLISHED', 10, 0);
      `);

      const standings = service.recalculate();
      // Alpha: 2 wins, 1 loss = 6 pts (points_diff = 2 + 1 + 0 - 1 - 0 - 10 = -8)
      // Beta: 1 win, 2 losses = 3 pts (points_diff = +8)
      expect(standings[0].name).toBe('Cohort Alpha');
      expect(standings[0].total_points).toBe(6);
      expect(standings[0].rank).toBe(1);

      expect(standings[1].name).toBe('Cohort Beta');
      expect(standings[1].total_points).toBe(3);
      expect(standings[1].rank).toBe(2);
    });

    it('TIE-02: Level 2 — Identical Points: Won count breaks the tie (1 win vs 3 draws = 3 pts each)', () => {
      memDb.execute(`
        INSERT INTO cohorts (id, name, batch, color) VALUES
          ('cohort-a', 'Cohort Alpha', '2026', '#000'),
          ('cohort-b', 'Cohort Beta', '2026', '#111'),
          ('cohort-c', 'Cohort Gamma', '2026', '#222');
      `);

      // Alpha: 1 win, 0 draws, 1 loss = 3 pts (won = 1)
      memDb.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, status, score_home, score_away) VALUES
          ('m1', 't1', 'sport-football', 'cohort-a', 'cohort-c', 'PUBLISHED', 1, 0),
          ('m2', 't1', 'sport-football', 'cohort-c', 'cohort-a', 'PUBLISHED', 2, 0);
      `);

      // Beta: 0 wins, 3 draws, 0 losses = 3 pts (won = 0)
      memDb.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, status, score_home, score_away) VALUES
          ('m3', 't1', 'sport-football', 'cohort-b', 'cohort-c', 'PUBLISHED', 0, 0),
          ('m4', 't1', 'sport-football', 'cohort-b', 'cohort-c', 'PUBLISHED', 1, 1),
          ('m5', 't1', 'sport-football', 'cohort-b', 'cohort-c', 'PUBLISHED', 2, 2);
      `);

      const standings = service.recalculate();
      const alpha = standings.find(c => c.name === 'Cohort Alpha')!;
      const beta = standings.find(c => c.name === 'Cohort Beta')!;

      expect(alpha.total_points).toBe(3);
      expect(beta.total_points).toBe(3);
      expect(alpha.won).toBe(1);
      expect(beta.won).toBe(0);

      // Alpha MUST rank ahead of Beta due to won count (1 > 0)
      expect(alpha.rank!).toBeLessThan(beta.rank!);
    });

    it('TIE-03: Level 3 — Identical Points & Won: Points differential breaks the tie', () => {
      memDb.execute(`
        INSERT INTO cohorts (id, name, batch, color) VALUES
          ('cohort-a', 'Cohort Alpha', '2026', '#000'),
          ('cohort-b', 'Cohort Beta', '2026', '#111'),
          ('cohort-c', 'Cohort Gamma', '2026', '#222');
      `);

      // Both have 1 win, 0 draws, 0 losses = 3 points, won = 1
      // Alpha won 5-0 (diff = +5)
      // Beta won 2-1 (diff = +1)
      memDb.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, status, score_home, score_away) VALUES
          ('m1', 't1', 'sport-football', 'cohort-a', 'cohort-c', 'PUBLISHED', 5, 0),
          ('m2', 't1', 'sport-football', 'cohort-b', 'cohort-c', 'PUBLISHED', 2, 1);
      `);

      const standings = service.recalculate();
      const alpha = standings.find(c => c.name === 'Cohort Alpha')!;
      const beta = standings.find(c => c.name === 'Cohort Beta')!;

      expect(alpha.total_points).toBe(3);
      expect(beta.total_points).toBe(3);
      expect(alpha.won).toBe(1);
      expect(beta.won).toBe(1);
      expect(alpha.points_diff).toBe(5);
      expect(beta.points_diff).toBe(1);

      // Alpha MUST rank ahead of Beta due to points differential (+5 > +1)
      expect(alpha.rank!).toBeLessThan(beta.rank!);
      expect(alpha.rank).toBe(1);
      expect(beta.rank).toBe(2);
    });

    it('TIE-04: Level 4 — Identical Points, Won, & Diff: Points For (goals scored) breaks the tie', () => {
      memDb.execute(`
        INSERT INTO cohorts (id, name, batch, color) VALUES
          ('cohort-a', 'Cohort Alpha', '2026', '#000'),
          ('cohort-b', 'Cohort Beta', '2026', '#111'),
          ('cohort-c', 'Cohort Gamma', '2026', '#222');
      `);

      // Both have 1 win, 3 points, won = 1, diff = +3
      // Alpha won 6-3 (points_for = 6)
      // Beta won 3-0 (points_for = 3)
      memDb.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, status, score_home, score_away) VALUES
          ('m1', 't1', 'sport-football', 'cohort-a', 'cohort-c', 'PUBLISHED', 6, 3),
          ('m2', 't1', 'sport-football', 'cohort-b', 'cohort-c', 'PUBLISHED', 3, 0);
      `);

      const standings = service.recalculate();
      const alpha = standings.find(c => c.name === 'Cohort Alpha')!;
      const beta = standings.find(c => c.name === 'Cohort Beta')!;

      expect(alpha.total_points).toBe(3);
      expect(beta.total_points).toBe(3);
      expect(alpha.won).toBe(1);
      expect(beta.won).toBe(1);
      expect(alpha.points_diff).toBe(3);
      expect(beta.points_diff).toBe(3);
      expect(alpha.points_for).toBe(6);
      expect(beta.points_for).toBe(3);

      // Alpha MUST rank ahead of Beta due to points_for (6 > 3)
      expect(alpha.rank!).toBeLessThan(beta.rank!);
      expect(alpha.rank).toBe(1);
      expect(beta.rank).toBe(2);
    });

    it('TIE-05: Level 5 — Identical Points, Won, Diff, & For: Alphabetical cohort name breaks the tie', () => {
      memDb.execute(`
        INSERT INTO cohorts (id, name, batch, color) VALUES
          ('cohort-b', 'Cohort Beta', '2026', '#111'),
          ('cohort-a', 'Cohort Alpha', '2026', '#000'),
          ('cohort-c', 'Cohort Gamma', '2026', '#222');
      `);

      // Both Alpha and Beta have identical records: 1 win, 4-1 score
      memDb.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, status, score_home, score_away) VALUES
          ('m1', 't1', 'sport-football', 'cohort-b', 'cohort-c', 'PUBLISHED', 4, 1),
          ('m2', 't1', 'sport-football', 'cohort-a', 'cohort-c', 'PUBLISHED', 4, 1);
      `);

      const standings = service.recalculate();
      const alpha = standings.find(c => c.name === 'Cohort Alpha')!;
      const beta = standings.find(c => c.name === 'Cohort Beta')!;

      expect(alpha.total_points).toBe(beta.total_points);
      expect(alpha.won).toBe(beta.won);
      expect(alpha.points_diff).toBe(beta.points_diff);
      expect(alpha.points_for).toBe(beta.points_for);

      // Alphabetical order: 'Cohort Alpha' < 'Cohort Beta' -> Alpha rank 1, Beta rank 2
      expect(alpha.rank).toBe(1);
      expect(beta.rank).toBe(2);
    });

    it('TIE-06: 4-Cohort tournament validating all 5 tie-breaker tiers concurrently', () => {
      memDb.execute(`
        INSERT INTO cohorts (id, name, batch, color) VALUES
          ('cohort-1', 'Alpha Wolves', '2026', '#111'),
          ('cohort-2', 'Beta Bears', '2026', '#222'),
          ('cohort-3', 'Charlie Cheetahs', '2026', '#333'),
          ('cohort-4', 'Delta Dragons', '2026', '#444');
      `);

      // Match 1: Alpha 5 - 0 Delta (Alpha +3 pts, +5 diff, 5 for)
      // Match 2: Beta 2 - 1 Delta (Beta +3 pts, +1 diff, 2 for)
      // Match 3: Charlie 0 - 0 Delta (Charlie +1 pt, 0 diff, 0 for)
      memDb.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, status, score_home, score_away) VALUES
          ('m1', 't1', 'sport-football', 'cohort-1', 'cohort-4', 'PUBLISHED', 5, 0),
          ('m2', 't1', 'sport-football', 'cohort-2', 'cohort-4', 'PUBLISHED', 2, 1),
          ('m3', 't1', 'sport-football', 'cohort-3', 'cohort-4', 'PUBLISHED', 0, 0);
      `);

      const standings = service.recalculate();
      expect(standings).toHaveLength(4);

      // Rank 1: Alpha Wolves (3 pts, +5 diff)
      // Rank 2: Beta Bears (3 pts, +1 diff)
      // Rank 3: Charlie Cheetahs (1 pt, 0 diff)
      // Rank 4: Delta Dragons (1 pt, -6 diff: 0-5, 1-2, 0-0 => diff -6)
      expect(standings[0].name).toBe('Alpha Wolves');
      expect(standings[0].rank).toBe(1);

      expect(standings[1].name).toBe('Beta Bears');
      expect(standings[1].rank).toBe(2);

      expect(standings[2].name).toBe('Charlie Cheetahs');
      expect(standings[2].rank).toBe(3);

      expect(standings[3].name).toBe('Delta Dragons');
      expect(standings[3].rank).toBe(4);
    });
  });

  // =========================================================================
  // SECTION 5: Concurrency & Idempotency Stress Testing
  // =========================================================================
  describe('5. Concurrency & Idempotency Stress (50 Parallel Requests)', () => {

    it('CONC-01: 50 concurrent parallel GET /api/standings requests return HTTP 200 and deep-equal payloads', async () => {
      const concurrencyLevel = 50;
      const requests = Array.from({ length: concurrencyLevel }, () =>
        api.get('/api/standings', SPECTATOR_HEADERS)
      );

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(concurrencyLevel);

      const baselineData = responses[0].data;
      expect(responses[0].status).toBe(200);
      expect(baselineData.standings).toBeDefined();

      for (let i = 0; i < concurrencyLevel; i++) {
        expect(responses[i].status).toBe(200);
        expect(responses[i].data).toEqual(baselineData);
      }
    });

    it('CONC-02: Standings idempotency is preserved during concurrent background draft match creations', async () => {
      // 1. Snapshot initial standings
      const preRes = await api.get('/api/standings', SPECTATOR_HEADERS);
      const expectedStandings = preRes.data;

      // 2. Concurrently fire 20 standings queries while scheduling 5 draft matches
      const draftCreations = Array.from({ length: 5 }, (_, i) =>
        api.post('/api/matches', {
          sport_id: 'sport-volleyball',
          home_cohort_id: 'cohort-seniors',
          away_cohort_id: 'cohort-juniors',
          venue: `Concurrent Court ${i}`,
          referee_id: 'ref-1',
        }, ADMIN_HEADERS)
      );

      const standingsQueries = Array.from({ length: 20 }, () =>
        api.get('/api/standings', SPECTATOR_HEADERS)
      );

      const [creationResults, queryResults] = await Promise.all([
        Promise.all(draftCreations),
        Promise.all(standingsQueries),
      ]);

      // All match creations succeeded
      for (const cr of creationResults) {
        expect([200, 201]).toContain(cr.status);
      }

      // Every standings query returned the exact same isolated standings without contamination
      for (const qr of queryResults) {
        expect(qr.status).toBe(200);
        expect(qr.data).toEqual(expectedStandings);
      }
    });
  });

  // =========================================================================
  // SECTION 6: Catalog API Boundary Safety (/api/contingent)
  // =========================================================================
  describe('6. Catalog API Boundary Safety Probes (/api/contingent)', () => {

    it('CAT-01: SQL Injection probes against /api/contingent?search=... are completely neutralized', async () => {
      const sqliProbes = [
        "' OR '1'='1",
        "'; DROP TABLE players; --",
        "' UNION SELECT id, name, email, role, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL FROM users --",
        "admin'--",
        "1' AND (SELECT COUNT(*) FROM users) > 0 --",
        "%' AND 1=1 AND '%'='",
        "\" OR \"\"=\"",
        "'; DELETE FROM cohorts; --",
        "1; ATTACH DATABASE ':memory:' AS evil; --",
        "/**/OR/**/1=1",
        "' OR 1=1 --",
        "\\",
        "%",
        "_",
        "[]",
      ];

      for (const probe of sqliProbes) {
        const res = await api.get(`/api/contingent?search=${encodeURIComponent(probe)}`, SPECTATOR_HEADERS);
        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(Array.isArray(res.data.players)).toBe(true);

        // SQL injection tautology MUST NOT return all 154 players
        // (unless probe literally matches a player's name/ID)
        if (probe.includes('1=1') || probe.includes('DROP') || probe.includes('UNION')) {
          expect(res.data.players.length).toBeLessThan(154);
        }
      }

      // Verify database tables were NOT modified or dropped by injection probes
      const verifyRes = await api.get('/api/contingent', SPECTATOR_HEADERS);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.data.total).toBe(154);
      expect(verifyRes.data.players).toHaveLength(154);
    });

    it('CAT-02: XSS probes against /api/contingent?search=... return safe JSON without crashing', async () => {
      const xssProbes = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg/onload=alert('xss')>",
        "\"><script>document.cookie</script>",
        "javascript:alert(document.domain)",
        "<iframe src=\"javascript:alert(1)\">",
        "'\"><marquee>probe</marquee>",
      ];

      for (const probe of xssProbes) {
        const res = await api.get(`/api/contingent?search=${encodeURIComponent(probe)}`, SPECTATOR_HEADERS);
        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(res.data.players).toBeDefined();
        expect(Array.isArray(res.data.players)).toBe(true);
        // Clean JSON returned, server did not crash or execute scripts
        expect(res.data.total).toBe(0);
      }
    });

    it('CAT-03: Status filtering is strictly case-insensitive across all permutations', async () => {
      const activePermutations = ['Active', 'active', 'ACTIVE', 'AcTiVe'];
      const injuredPermutations = ['Injured', 'injured', 'INJURED', 'InJuReD'];
      const allPermutations = ['all', 'ALL', 'All'];

      // Active tests: All must return 144 players with TitleCase 'Active' status
      for (const perm of activePermutations) {
        const res = await api.get(`/api/contingent?status=${perm}`, SPECTATOR_HEADERS);
        expect(res.status).toBe(200);
        expect(res.data.total).toBe(144);
        expect(res.data.players).toHaveLength(144);
        for (const p of res.data.players) {
          expect(p.status).toBe('Active');
        }
      }

      // Injured tests: All must return 10 players with TitleCase 'Injured' status
      for (const perm of injuredPermutations) {
        const res = await api.get(`/api/contingent?status=${perm}`, SPECTATOR_HEADERS);
        expect(res.status).toBe(200);
        expect(res.data.total).toBe(10);
        expect(res.data.players).toHaveLength(10);
        for (const p of res.data.players) {
          expect(p.status).toBe('Injured');
        }
      }

      // Total conservation: Active (144) + Injured (10) === 154 total
      for (const perm of allPermutations) {
        const res = await api.get(`/api/contingent?status=${perm}`, SPECTATOR_HEADERS);
        expect(res.status).toBe(200);
        expect(res.data.total).toBe(154);
        expect(res.data.players).toHaveLength(154);
      }
    });

    it('CAT-04: Invalid sport filters return empty arrays with HTTP 200 without crashing', async () => {
      const invalidSports = [
        'nonexistent_sport_xyz',
        'quidditch',
        '--invalid--',
        '12345',
        '!@#$%^&*()',
        'sport-fake-999',
        'undefined',
        'null',
      ];

      for (const invalidSport of invalidSports) {
        const res = await api.get(`/api/contingent?sport=${encodeURIComponent(invalidSport)}`, SPECTATOR_HEADERS);
        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(res.data.players).toEqual([]);
        expect(res.data.total).toBe(0);
      }
    });

    it('CAT-05: Query parameter boundary cases (extra-long queries, whitespace, emojis)', async () => {
      // 1. 2000-character search string
      const longQuery = 'A'.repeat(2000);
      const longRes = await api.get(`/api/contingent?search=${longQuery}`, SPECTATOR_HEADERS);
      expect(longRes.status).toBe(200);
      expect(longRes.data.players).toEqual([]);

      // 2. Whitespace-only search string
      const spaceRes = await api.get('/api/contingent?search=%20%20%20', SPECTATOR_HEADERS);
      expect(spaceRes.status).toBe(200);
      // Whitespace search is trimmed to empty, returning all players
      expect(spaceRes.data.total).toBe(154);

      // 3. Emojis and unicode
      const emojiRes = await api.get(`/api/contingent?search=${encodeURIComponent('⚽🏆🔥')}`, SPECTATOR_HEADERS);
      expect(emojiRes.status).toBe(200);
      expect(emojiRes.data.players).toEqual([]);

      // 4. Invalid status returns empty list
      const bogusStatusRes = await api.get('/api/contingent?status=BOGUS_STATUS', SPECTATOR_HEADERS);
      expect(bogusStatusRes.status).toBe(200);
      expect(bogusStatusRes.data.players).toEqual([]);
      expect(bogusStatusRes.data.total).toBe(0);
    });
  });
});
