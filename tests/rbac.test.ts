/**
 * Role-Based Access Control (RBAC) Test Suite
 * Ratanji Digital Sports Management & Scoring System
 */

import { describe, it, expect, api, ADMIN_HEADERS, REFEREE_HEADERS, SPECTATOR_HEADERS, ANONYMOUS_HEADERS } from './e2e/helpers';

describe('Role-Based Access Control (RBAC)', () => {
  let sampleMatchId: string = '';

  it('Public Spectator can view public endpoints', async () => {
    const r1 = await api.get('/api/sports', SPECTATOR_HEADERS);
    const r2 = await api.get('/api/contingent', SPECTATOR_HEADERS);
    const r3 = await api.get('/api/matches', SPECTATOR_HEADERS);
    const r4 = await api.get('/api/standings', SPECTATOR_HEADERS);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(r4.status).toBe(200);
  });

  it('Public Spectator cannot schedule matches (401/403 Forbidden)', async () => {
    const res = await api.post('/api/matches', {
      sport_id: 'football',
      venue: 'Blocked',
    }, SPECTATOR_HEADERS);
    expect([401, 403]).toContain(res.status);
  });

  it('Public Spectator cannot add, edit, or delete athletes (401/403 Forbidden)', async () => {
    const addRes = await api.post('/api/contingent/players', {
      name: 'Unauthorized Athlete',
      primary_sport_id: 'sport-football',
      cohort_id: 'cohort-seniors',
    }, SPECTATOR_HEADERS);
    expect([401, 403]).toContain(addRes.status);

    const editRes = await api.put('/api/contingent/players/ply-26bm001', {
      name: 'Hacked Name',
    }, SPECTATOR_HEADERS);
    expect([401, 403]).toContain(editRes.status);

    const delRes = await api.delete('/api/contingent/players/ply-26bm001', SPECTATOR_HEADERS);
    expect([401, 403]).toContain(delRes.status);
  });

  it('Public Spectator cannot add new sports (401/403 Forbidden)', async () => {
    const res = await api.post('/api/sports', {
      name: 'Unauthorized Sport',
    }, SPECTATOR_HEADERS);
    expect([401, 403]).toContain(res.status);
  });

  it('Anonymous user without headers cannot perform mutations', async () => {
    const res = await api.post('/api/matches', {
      sport_id: 'football',
    }, ANONYMOUS_HEADERS);
    expect([401, 403]).toContain(res.status);
  });

  it('Admin can schedule matches and assign referees', async () => {
    const res = await api.post('/api/matches', {
      sport_id: 'football',
      home_cohort_id: 'seniors',
      away_cohort_id: 'juniors',
      venue: 'Admin Ground',
      scheduled_at: new Date().toISOString(),
      referee_id: 'ref-1',
    }, ADMIN_HEADERS);
    expect([200, 201]).toContain(res.status);
    sampleMatchId = res.data.id;
  });

  it('Assigned Referee can log scoring events on their match', async () => {
    const res = await api.post(`/api/matches/${sampleMatchId}/events`, {
      event_type: 'GOAL',
      team: 'home',
      minute: 25,
    }, REFEREE_HEADERS('ref-1'));
    expect([200, 201]).toContain(res.status);
  });

  it('Unassigned Referee is blocked from logging events on other matches', async () => {
    const res = await api.post(`/api/matches/${sampleMatchId}/events`, {
      event_type: 'GOAL',
      team: 'away',
      minute: 28,
    }, REFEREE_HEADERS('ref-999'));
    expect([401, 403]).toContain(res.status);
  });

  it('Referee is blocked from publishing scores', async () => {
    const res = await api.post(`/api/matches/${sampleMatchId}/publish`, {}, REFEREE_HEADERS('ref-1'));
    expect([401, 403]).toContain(res.status);
  });

  it('Referee is blocked from verifying scorecards', async () => {
    const res = await api.post(`/api/matches/${sampleMatchId}/verify`, {}, REFEREE_HEADERS('ref-1'));
    expect([401, 403]).toContain(res.status);
  });

  it('Admin has full verification and publication authority', async () => {
    await api.post(`/api/matches/${sampleMatchId}/submit`, {}, ADMIN_HEADERS);
    const vRes = await api.post(`/api/matches/${sampleMatchId}/verify`, {}, ADMIN_HEADERS);
    expect([200, 201]).toContain(vRes.status);

    const pRes = await api.post(`/api/matches/${sampleMatchId}/publish`, {}, ADMIN_HEADERS);
    expect([200, 201]).toContain(pRes.status);
  });

  it('Public spectator and unauthenticated requests are blocked from accessing Sports Committee guide (403)', async () => {
    const unauthGuide = await api.get('/guide', ANONYMOUS_HEADERS);
    expect(unauthGuide.status).toBe(403);

    const unauthDocs = await api.get('/docs/sports-committee-guide.html', SPECTATOR_HEADERS);
    expect(unauthDocs.status).toBe(403);

    const refDocs = await api.get('/docs/sports-committee-guide.html', REFEREE_HEADERS('ref-1'));
    expect(refDocs.status).toBe(403);
  });

  it('Authenticated Sports Committee Admin has full access to operational guide', async () => {
    const adminDocs = await api.get('/docs/sports-committee-guide.html', ADMIN_HEADERS);
    expect(adminDocs.status).toBe(200);

    const adminGuide = await api.get('/guide', ADMIN_HEADERS);
    expect([200, 302]).toContain(adminGuide.status);
  });
});
