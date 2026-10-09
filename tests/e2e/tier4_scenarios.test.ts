/**
 * Tier 4: Real-World Application Scenarios
 * Opaque-Box E2E Test Suite
 * Ratanji Digital Sports Management & Scoring System
 */

import { describe, it, expect, api, ADMIN_HEADERS, REFEREE_HEADERS, SPECTATOR_HEADERS } from './helpers';

describe('Tier 4: Real-World Application Scenarios', () => {

  // =========================================================================
  // Scenario 1: High-Stakes XLRI Football Derby (Seniors vs Juniors)
  // =========================================================================
  describe('Scenario 1: High-Stakes Football Derby (Seniors vs Juniors)', () => {
    let derbyMatchId: string = '';

    it('1.1: Committee schedules the Football Derby at XLRI Main Ground', async () => {
      const res = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'XLRI Main Football Stadium',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(res.status);
      derbyMatchId = res.data.id;
    });

    it('1.2: Spectators see the Derby listed in Upcoming Fixtures', async () => {
      const fixtures = (await api.get('/api/matches?status=Scheduled', SPECTATOR_HEADERS)).data;
      const found = (fixtures || []).some((m: any) => m.id === derbyMatchId);
      expect(found).toBe(true);
    });

    it('1.3: Referee blows whistle, starts match clock and logs 1st Half events', async () => {
      await api.post(`/api/matches/${derbyMatchId}/timer`, { action: 'start' }, REFEREE_HEADERS('ref-1'));

      // 14th min: Senior Striker scores goal (1 - 0)
      const g1 = await api.post(`/api/matches/${derbyMatchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 14,
        payload_json: { scorer: 'Senior Striker', assist: 'Senior Midfielder' },
      }, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(g1.status);

      // 32nd min: Junior Defender cautioned with Yellow Card
      const y1 = await api.post(`/api/matches/${derbyMatchId}/events`, {
        event_type: 'YELLOW_CARD',
        team: 'away',
        minute: 32,
        payload_json: { foul: 'Reckless tackle' },
      }, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(y1.status);
    });

    it('1.4: 2nd Half: Juniors equalize in 62nd min (1 - 1)', async () => {
      const g2 = await api.post(`/api/matches/${derbyMatchId}/events`, {
        event_type: 'GOAL',
        team: 'away',
        minute: 62,
        payload_json: { scorer: 'Junior Winger' },
      }, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(g2.status);

      const detail = await api.get(`/api/matches/${derbyMatchId}`, SPECTATOR_HEADERS);
      expect(detail.data.score_home).toBe(1);
      expect(detail.data.score_away).toBe(1);
    });

    it('1.5: 88th min: Seniors score dramatic late winner (2 - 1)', async () => {
      const g3 = await api.post(`/api/matches/${derbyMatchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 88,
        payload_json: { scorer: 'Senior Captain', type: 'Header' },
      }, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(g3.status);

      const detail = await api.get(`/api/matches/${derbyMatchId}`, SPECTATOR_HEADERS);
      expect(detail.data.score_home).toBe(2);
      expect(detail.data.score_away).toBe(1);
    });

    it('1.6: Full-Time whistle: Referee concludes and submits final scorecard', async () => {
      await api.post(`/api/matches/${derbyMatchId}/timer`, { action: 'pause' }, REFEREE_HEADERS('ref-1'));
      const submitRes = await api.post(`/api/matches/${derbyMatchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(submitRes.status);
    });

    it('1.7: Committee Admin reviews in verification queue and publishes official result', async () => {
      const verifyRes = await api.post(`/api/matches/${derbyMatchId}/verify`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(verifyRes.status);

      const pubRes = await api.post(`/api/matches/${derbyMatchId}/publish`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(pubRes.status);
    });

    it('1.8: Public standings reflect 3 tournament points for Seniors win', async () => {
      const res = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(res.status).toBe(200);
      const list = res.data.standings || res.data;
      const seniors = list.find((c: any) => c.cohort_id === 'seniors' || c.name?.includes('Senior') || c.cohort_name?.includes('Senior'));
      expect(seniors.total_points ?? seniors.points).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // Scenario 2: T20 Limited-Overs Cricket Thriller
  // =========================================================================
  describe('Scenario 2: T20 Limited-Overs Cricket Thriller', () => {
    let cricketMatchId: string = '';

    it('2.1: Committee schedules Cricket fixture at Oval Ground', async () => {
      const res = await api.post('/api/matches', {
        sport_id: 'cricket',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'XLRI Cricket Oval',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-2',
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(res.status);
      cricketMatchId = res.data.id;
    });

    it('2.2: 1st Innings: Seniors bat, scoring runs, extras, and losing wickets', async () => {
      // Delivery 1: 4 runs boundary
      await api.post(`/api/matches/${cricketMatchId}/events`, {
        event_type: 'BALL',
        team: 'home',
        minute: 1,
        payload_json: { runs: 4, ball: '0.1' },
      }, REFEREE_HEADERS('ref-2'));

      // Delivery 2: Wide ball (+1 extra run)
      await api.post(`/api/matches/${cricketMatchId}/events`, {
        event_type: 'EXTRA',
        team: 'home',
        minute: 2,
        payload_json: { extra_type: 'wide', runs: 1 },
      }, REFEREE_HEADERS('ref-2'));

      // Delivery 3: Wicket bowled
      await api.post(`/api/matches/${cricketMatchId}/events`, {
        event_type: 'WICKET',
        team: 'home',
        minute: 3,
        payload_json: { kind: 'bowled', batsman: 'Senior Opener' },
      }, REFEREE_HEADERS('ref-2'));

      // 1st innings total: 20 runs
      for (let i = 0; i < 3; i++) {
        await api.post(`/api/matches/${cricketMatchId}/events`, {
          event_type: 'BALL',
          team: 'home',
          minute: 5 + i,
          payload_json: { runs: 5 },
        }, REFEREE_HEADERS('ref-2'));
      }
    });

    it('2.3: Innings change: Juniors chase target', async () => {
      await api.post(`/api/matches/${cricketMatchId}/events`, {
        event_type: 'INNINGS_END',
        team: 'home',
        minute: 20,
      }, REFEREE_HEADERS('ref-2'));

      // Juniors bat in 2nd innings
      await api.post(`/api/matches/${cricketMatchId}/events`, {
        event_type: 'BALL',
        team: 'away',
        minute: 25,
        payload_json: { runs: 6, ball: '0.1' },
      }, REFEREE_HEADERS('ref-2'));
    });

    it('2.4: Conclude cricket match and publish official result', async () => {
      await api.post(`/api/matches/${cricketMatchId}/submit`, {}, REFEREE_HEADERS('ref-2'));
      const pubRes = await api.post(`/api/matches/${cricketMatchId}/publish`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(pubRes.status);
    });
  });

  // =========================================================================
  // Scenario 3: Men's Basketball Overtime Clash
  // =========================================================================
  describe('Scenario 3: Men\'s Basketball Overtime Thriller', () => {
    let bbMatchId: string = '';

    it('3.1: Schedule Basketball match at Indoor Sports Complex', async () => {
      const res = await api.post('/api/matches', {
        sport_id: 'basketball-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Indoor Basketball Court',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(res.status);
      bbMatchId = res.data.id;
    });

    it('3.2: Q1 - Q4: Multi-point scoring (1PT, 2PT, 3PT) and Team Fouls', async () => {
      // 3-pointer by Seniors
      await api.post(`/api/matches/${bbMatchId}/events`, {
        event_type: 'SCORE_3PT',
        team: 'home',
        minute: 5,
        payload_json: { points: 3 },
      }, REFEREE_HEADERS('ref-1'));

      // 2-pointer by Juniors
      await api.post(`/api/matches/${bbMatchId}/events`, {
        event_type: 'SCORE_2PT',
        team: 'away',
        minute: 8,
        payload_json: { points: 2 },
      }, REFEREE_HEADERS('ref-1'));

      // Free throw (1PT)
      await api.post(`/api/matches/${bbMatchId}/events`, {
        event_type: 'SCORE_1PT',
        team: 'away',
        minute: 12,
        payload_json: { points: 1 },
      }, REFEREE_HEADERS('ref-1'));

      const detail = await api.get(`/api/matches/${bbMatchId}`, REFEREE_HEADERS('ref-1'));
      expect(detail.data.score_home).toBe(3);
      expect(detail.data.score_away).toBe(3);
    });

    it('3.3: Overtime period played and match concluded with Seniors win', async () => {
      // OT Senior 2PT basket
      await api.post(`/api/matches/${bbMatchId}/events`, {
        event_type: 'SCORE_2PT',
        team: 'home',
        minute: 42,
        payload_json: { points: 2 },
      }, REFEREE_HEADERS('ref-1'));

      await api.post(`/api/matches/${bbMatchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
      const pubRes = await api.post(`/api/matches/${bbMatchId}/publish`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(pubRes.status);
    });
  });

  // =========================================================================
  // Scenario 4: Badminton 3-Set Thriller with Deuce
  // =========================================================================
  describe('Scenario 4: Badminton 3-Set Thriller with Deuce', () => {
    let bmMatchId: string = '';

    it('4.1: Schedule Badminton match in Badminton Hall', async () => {
      const res = await api.post('/api/matches', {
        sport_id: 'badminton-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Badminton Hall Court 1',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(res.status);
      bmMatchId = res.data.id;
    });

    it('4.2: Set 1 won by Seniors (21-17) and Set 2 won by Juniors (19-21)', async () => {
      await api.post(`/api/matches/${bmMatchId}/events`, {
        event_type: 'SET_WON',
        team: 'home',
        minute: 15,
        payload_json: { set: 1, score_home: 21, score_away: 17 },
      }, REFEREE_HEADERS('ref-1'));

      await api.post(`/api/matches/${bmMatchId}/events`, {
        event_type: 'SET_WON',
        team: 'away',
        minute: 32,
        payload_json: { set: 2, score_home: 19, score_away: 21 },
      }, REFEREE_HEADERS('ref-1'));
    });

    it('4.3: Deciding Set 3 reaches 20-20 Deuce, resolved at 24-22', async () => {
      await api.post(`/api/matches/${bmMatchId}/events`, {
        event_type: 'DEUCE',
        team: 'home',
        minute: 50,
        payload_json: { score: '20-20' },
      }, REFEREE_HEADERS('ref-1'));

      await api.post(`/api/matches/${bmMatchId}/events`, {
        event_type: 'SET_WON',
        team: 'home',
        minute: 55,
        payload_json: { set: 3, score_home: 24, score_away: 22 },
      }, REFEREE_HEADERS('ref-1'));
    });

    it('4.4: Conclude, submit, and publish Badminton result', async () => {
      await api.post(`/api/matches/${bmMatchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
      const pubRes = await api.post(`/api/matches/${bmMatchId}/publish`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(pubRes.status);
    });
  });

  // =========================================================================
  // Scenario 5: Multi-Sport Simultaneous Championship Day
  // =========================================================================
  describe('Scenario 5: Multi-Sport Simultaneous Championship Day', () => {
    it('5.1: Multiple concurrent matches across Volleyball, TT, Chess, Pool, and Futsal', async () => {
      const sports = ['volleyball', 'table-tennis', 'chess', 'pool', 'futsal'];
      const matchIds: string[] = [];

      for (const sport of sports) {
        const res = await api.post('/api/matches', {
          sport_id: sport,
          home_cohort_id: 'seniors',
          away_cohort_id: 'juniors',
          venue: `${sport.toUpperCase()} Arena`,
          scheduled_at: new Date().toISOString(),
          referee_id: 'ref-1',
        }, ADMIN_HEADERS);
        matchIds.push(res.data.id);
      }

      // Concurrently submit all matches
      for (const id of matchIds) {
        await api.post(`/api/matches/${id}/events`, {
          event_type: 'POINT',
          team: 'juniors',
          minute: 10,
        }, REFEREE_HEADERS('ref-1'));

        await api.post(`/api/matches/${id}/submit`, {}, REFEREE_HEADERS('ref-1'));
      }

      // Admin verification queue has all 5 submitted matches
      const queue = (await api.get('/api/admin/verifications', ADMIN_HEADERS)).data;
      expect(queue.length).toBeGreaterThanOrEqual(5);

      // Publish all matches
      for (const id of matchIds) {
        await api.post(`/api/matches/${id}/publish`, {}, ADMIN_HEADERS);
      }

      // Standings leaderboard is fully populated and aggregates all sports
      const standings = (await api.get('/api/standings', SPECTATOR_HEADERS)).data;
      const list = standings.standings || standings;
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0].played).toBeGreaterThan(0);
    });
  });
});
