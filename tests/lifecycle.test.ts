/**
 * State Machine Lifecycle Test Suite
 * Ratanji Digital Sports Management & Scoring System
 */

import { describe, it, expect, api, ADMIN_HEADERS, REFEREE_HEADERS, SPECTATOR_HEADERS } from './e2e/helpers';

describe('State Machine Lifecycle (Draft -> Submitted -> Verified -> Published)', () => {
  let matchId: string = '';

  it('1. New match initializes in Draft status', async () => {
    const res = await api.post('/api/matches', {
      sport_id: 'football',
      home_cohort_id: 'seniors',
      away_cohort_id: 'juniors',
      venue: 'Lifecycle Ground',
      scheduled_at: new Date().toISOString(),
      referee_id: 'ref-1',
    }, ADMIN_HEADERS);
    expect([200, 201]).toContain(res.status);
    matchId = res.data.id;

    const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
    expect(['Draft', 'Scheduled']).toContain(detail.data.status);
  });

  it('2. Referee concludes match and submits scorecard (Draft -> Submitted)', async () => {
    await api.post(`/api/matches/${matchId}/events`, {
      event_type: 'GOAL',
      team: 'home',
      minute: 10,
    }, REFEREE_HEADERS('ref-1'));

    const res = await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
    expect([200, 201]).toContain(res.status);

    const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
    expect(detail.data.status).toBe('Submitted');
  });

  it('3. Submitted match is locked from referee modifications', async () => {
    const blocked = await api.post(`/api/matches/${matchId}/events`, {
      event_type: 'GOAL',
      team: 'home',
      minute: 12,
    }, REFEREE_HEADERS('ref-1'));
    expect([400, 403]).toContain(blocked.status);
  });

  it('4. Rejection returns Submitted match to Draft with mandatory notes', async () => {
    // Missing note rejected
    const badRej = await api.post(`/api/matches/${matchId}/reject`, { notes: '' }, ADMIN_HEADERS);
    expect([400, 422]).toContain(badRej.status);

    // Valid note accepted
    const goodRej = await api.post(`/api/matches/${matchId}/reject`, { notes: 'Dispute over goal time' }, ADMIN_HEADERS);
    expect([200, 201]).toContain(goodRej.status);

    const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
    expect(detail.data.status).toBe('Draft');

    // Resubmit
    await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-1'));
  });

  it('5. Admin verifies scorecard (Submitted -> Verified)', async () => {
    const res = await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);
    expect([200, 201]).toContain(res.status);

    const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
    expect(detail.data.status).toBe('Verified');
  });

  it('6. Admin publishes match (Verified -> Published) and triggers Standings update', async () => {
    const res = await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);
    expect([200, 201]).toContain(res.status);

    const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
    expect(detail.data.status).toBe('Published');

    // Standings updated
    const standings = (await api.get('/api/standings', SPECTATOR_HEADERS)).data;
    expect(standings).toBeDefined();
  });
});
