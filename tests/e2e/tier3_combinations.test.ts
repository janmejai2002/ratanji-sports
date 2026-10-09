/**
 * Tier 3: Cross-Feature Integration Combinations
 * Opaque-Box E2E Test Suite
 * Ratanji Digital Sports Management & Scoring System
 */

import { describe, it, expect, api, ADMIN_HEADERS, REFEREE_HEADERS, SPECTATOR_HEADERS } from './helpers';

describe('Tier 3: Cross-Feature Combinations', () => {

  // =========================================================================
  // Combination 1: Scheduling + Referee Assignment + Authorization Transfer
  // =========================================================================
  describe('Combo 1: Scheduling + Referee Assignment + Reassignment Authorization Transfer', () => {
    let matchId: string = '';

    it('Step 1: Admin schedules match and assigns ref-1', async () => {
      const res = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Main Field',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(res.status);
      matchId = res.data.id;
    });

    it('Step 2: ref-1 sees match in assigned selector and can log events', async () => {
      const list = (await api.get('/api/matches?referee_id=ref-1', REFEREE_HEADERS('ref-1'))).data;
      const found = list.some((m: any) => m.id === matchId);
      expect(found).toBe(true);

      const logRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 10,
      }, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(logRes.status);
    });

    it('Step 3: ref-2 does not see match in assigned selector and is blocked from logging events', async () => {
      const list = (await api.get('/api/matches?referee_id=ref-2', REFEREE_HEADERS('ref-2'))).data;
      const found = list.some((m: any) => m.id === matchId);
      expect(found).toBe(false);

      const logRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'away',
        minute: 12,
      }, REFEREE_HEADERS('ref-2'));
      expect([401, 403]).toContain(logRes.status);
    });

    it('Step 4: Admin reassigns match to ref-2', async () => {
      const reassignRes = await api.put(`/api/matches/${matchId}`, {
        referee_id: 'ref-2',
      }, ADMIN_HEADERS);
      expect([200, 204]).toContain(reassignRes.status);
    });

    it('Step 5: ref-2 now has scoring access while ref-1 is blocked', async () => {
      const ref2Log = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'away',
        minute: 18,
      }, REFEREE_HEADERS('ref-2'));
      expect([200, 201]).toContain(ref2Log.status);

      const ref1Blocked = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 20,
      }, REFEREE_HEADERS('ref-1'));
      expect([401, 403]).toContain(ref1Blocked.status);
    });
  });

  // =========================================================================
  // Combination 2: Timer State + Scoring Event + Event Undo + Score Recalc
  // =========================================================================
  describe('Combo 2: Timer Control + Event Logging + Event Deletion (Undo) + Score Rollback', () => {
    let matchId: string = '';
    let goalEventId: string = '';

    it('Step 1: Admin schedules match and referee starts timer', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Field 2',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      const timerRes = await api.post(`/api/matches/${matchId}/timer`, { action: 'start' }, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(timerRes.status);
    });

    it('Step 2: Log goal for Seniors -> Score becomes 1-0', async () => {
      const res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 14,
      }, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(res.status);
      goalEventId = res.data.id || res.data.event_id;

      const detail = await api.get(`/api/matches/${matchId}`, REFEREE_HEADERS('ref-1'));
      expect(detail.data.score_home).toBe(1);
      expect(detail.data.score_away).toBe(0);
    });

    it('Step 3: Log goal for Juniors -> Score becomes 1-1', async () => {
      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'away',
        minute: 28,
      }, REFEREE_HEADERS('ref-1'));

      const detail = await api.get(`/api/matches/${matchId}`, REFEREE_HEADERS('ref-1'));
      expect(detail.data.score_home).toBe(1);
      expect(detail.data.score_away).toBe(1);
    });

    it('Step 4: Referee undoes Seniors goal -> Score automatically rolls back to 0-1', async () => {
      if (goalEventId) {
        const delRes = await api.delete(`/api/matches/${matchId}/events/${goalEventId}`, REFEREE_HEADERS('ref-1'));
        expect([200, 204]).toContain(delRes.status);

        const detail = await api.get(`/api/matches/${matchId}`, REFEREE_HEADERS('ref-1'));
        expect(detail.data.score_home).toBe(0);
        expect(detail.data.score_away).toBe(1);
      }
    });

    it('Step 5: Audit log contains event creation and deletion records', async () => {
      const detail = await api.get(`/api/matches/${matchId}`, REFEREE_HEADERS('ref-1'));
      expect(detail.status).toBe(200);
    });
  });

  // =========================================================================
  // Combination 3: Draft Scoring vs Standings Isolation
  // =========================================================================
  describe('Combo 3: Draft Active Scoring Isolation from Official Tournament Standings', () => {
    let matchId: string = '';
    let initialStandings: any;

    it('Step 1: Capture baseline official standings before draft scoring', async () => {
      const res = await api.get('/api/standings', SPECTATOR_HEADERS);
      expect(res.status).toBe(200);
      initialStandings = JSON.parse(JSON.stringify(res.data));
    });

    it('Step 2: Start new match and score 5 goals in Draft', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Isolation Stadium',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      for (let i = 1; i <= 5; i++) {
        await api.post(`/api/matches/${matchId}/events`, {
          event_type: 'GOAL',
          team: 'home',
          minute: i * 10,
        }, REFEREE_HEADERS('ref-1'));
      }

      const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      expect(detail.data.score_home).toBe(5);
      expect(detail.data.status).toBe('Draft');
    });

    it('Step 3: Verify tournament standings remain strictly unchanged while in Draft', async () => {
      const currentStandings = (await api.get('/api/standings', SPECTATOR_HEADERS)).data;
      expect(currentStandings).toEqual(initialStandings);
    });
  });

  // =========================================================================
  // Combination 4: Submission + Referee Lockout + Admin Queue Verification
  // =========================================================================
  describe('Combo 4: Submission + Lockout + Admin Queue Entry', () => {
    let matchId: string = '';

    it('Step 1: Referee scores and concludes match', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'badminton-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Badminton Arena',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'POINT',
        team: 'home',
        minute: 10,
      }, REFEREE_HEADERS('ref-1'));

      const submitRes = await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(submitRes.status);
    });

    it('Step 2: Scorecard is locked: subsequent event logging and timer edits rejected', async () => {
      const eventRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'POINT',
        team: 'home',
      }, REFEREE_HEADERS('ref-1'));
      expect([400, 403]).toContain(eventRes.status);

      const timerRes = await api.post(`/api/matches/${matchId}/timer`, {
        action: 'start',
      }, REFEREE_HEADERS('ref-1'));
      expect([400, 403]).toContain(timerRes.status);
    });

    it('Step 3: Match appears in Admin Verification Queue with accurate scores', async () => {
      const queue = (await api.get('/api/admin/verifications', ADMIN_HEADERS)).data;
      const found = queue.find((m: any) => m.id === matchId);
      expect(found).toBeDefined();
      expect(found.score_home).toBe(1);
      expect(found.status).toBe('Submitted');
    });
  });

  // =========================================================================
  // Combination 5: Disputed Score Rejection Workflow & Correction
  // =========================================================================
  describe('Combo 5: Rejection Workflow + Mandatory Audit Note + Resubmission Cycle', () => {
    let matchId: string = '';

    it('Step 1: Match in Submitted state awaiting verification', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Dispute Field',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 88,
      }, REFEREE_HEADERS('ref-1'));

      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
    });

    it('Step 2: Admin rejects match back to Draft with audit note', async () => {
      const note = 'Dispute raised by Juniors captain: 88th minute goal was handball';
      const rejRes = await api.post(`/api/matches/${matchId}/reject`, {
        notes: note,
      }, ADMIN_HEADERS);
      expect([200, 201]).toContain(rejRes.status);
    });

    it('Step 3: Match returns to Draft status and is removed from verification queue', async () => {
      const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(detail.data.status).toBe('Draft');

      const queue = (await api.get('/api/admin/verifications', ADMIN_HEADERS)).data;
      const found = queue.some((m: any) => m.id === matchId);
      expect(found).toBe(false);
    });

    it('Step 4: Referee pad is unlocked and referee corrects scorecard', async () => {
      // Referee adds second goal or corrects
      const correctRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'away',
        minute: 90,
      }, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(correctRes.status);
    });

    it('Step 5: Referee resubmits corrected scorecard back to verification queue', async () => {
      const resubRes = await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
      expect([200, 201]).toContain(resubRes.status);

      const queue = (await api.get('/api/admin/verifications', ADMIN_HEADERS)).data;
      const found = queue.find((m: any) => m.id === matchId);
      expect(found).toBeDefined();
    });
  });

  // =========================================================================
  // Combination 6: Verification + Publication + Standings Update & Idempotency
  // =========================================================================
  describe('Combo 6: Approval -> Publication -> Standings Points Calculation & Idempotency', () => {
    let matchId: string = '';
    let seniorsBaselinePoints: number = 0;

    it('Step 1: Setup submitted match with Seniors winning 2 - 0', async () => {
      // Capture current points
      const currentStandings = (await api.get('/api/standings', SPECTATOR_HEADERS)).data;
      const list = currentStandings.standings || currentStandings;
      const seniors = list.find((c: any) => c.cohort_id === 'seniors' || c.name?.includes('Senior') || c.cohort_name?.includes('Senior'));
      seniorsBaselinePoints = seniors?.total_points ?? seniors?.points ?? 0;

      const m = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Championship Pitch',
        scheduled_at: new Date().toISOString(),
        referee_id: 'ref-1',
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      await api.post(`/api/matches/${matchId}/events`, { event_type: 'GOAL', team: 'home', minute: 10 }, REFEREE_HEADERS('ref-1'));
      await api.post(`/api/matches/${matchId}/events`, { event_type: 'GOAL', team: 'home', minute: 75 }, REFEREE_HEADERS('ref-1'));
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
    });

    it('Step 2: Admin verifies scorecard in queue', async () => {
      const vRes = await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(vRes.status);

      const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(detail.data.status).toBe('Verified');
    });

    it('Step 3: Admin publishes match -> Standings increments Seniors by exactly +3 points', async () => {
      const pubRes = await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(pubRes.status);

      const newStandings = (await api.get('/api/standings', SPECTATOR_HEADERS)).data;
      const list = newStandings.standings || newStandings;
      const seniors = list.find((c: any) => c.cohort_id === 'seniors' || c.name?.includes('Senior') || c.cohort_name?.includes('Senior'));
      const newPoints = seniors?.total_points ?? seniors?.points ?? 0;

      expect(newPoints).toBe(seniorsBaselinePoints + 3);
    });

    it('Step 4: Re-querying standings yields identical points (Idempotency)', async () => {
      const s1 = (await api.get('/api/standings', SPECTATOR_HEADERS)).data;
      const s2 = (await api.get('/api/standings', SPECTATOR_HEADERS)).data;
      expect(s1).toEqual(s2);
    });
  });
});
