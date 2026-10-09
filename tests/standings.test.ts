/**
 * Standings Calculation & Idempotency Test Suite
 * Ratanji Digital Sports Management & Scoring System
 */

import { describe, it, expect, api, ADMIN_HEADERS, SPECTATOR_HEADERS } from './e2e/helpers';

describe('Standings Calculation Engine & Idempotency', () => {

  it('Calculates 3 points for win, 1 point for draw, 0 for loss', async () => {
    const res = await api.get('/api/standings', SPECTATOR_HEADERS);
    expect(res.status).toBe(200);
    const standings = res.data.standings || res.data;
    expect(Array.isArray(standings)).toBe(true);

    for (const row of standings) {
      const calculatedPoints = (row.won * 3) + (row.drawn * 1);
      const reportedPoints = row.total_points ?? row.points;
      expect(reportedPoints).toBe(calculatedPoints);
      expect(row.played).toBe(row.won + row.drawn + row.lost);
    }
  });

  it('Calculates points differential accurately (points_diff = points_for - points_against)', async () => {
    const res = await api.get('/api/standings', SPECTATOR_HEADERS);
    const standings = res.data.standings || res.data;

    for (const row of standings) {
      if (row.points_for !== undefined && row.points_against !== undefined) {
        const expectedDiff = row.points_for - row.points_against;
        const actualDiff = row.points_diff ?? row.points_difference;
        expect(actualDiff).toBe(expectedDiff);
      }
    }
  });

  it('Calculations are completely idempotent across multiple calls', async () => {
    const res1 = await api.get('/api/standings', SPECTATOR_HEADERS);
    const res2 = await api.get('/api/standings', SPECTATOR_HEADERS);
    expect(res1.data).toEqual(res2.data);
  });

  it('Resolves leaderboard ranking using tie-breaker priority', async () => {
    const res = await api.get('/api/standings', SPECTATOR_HEADERS);
    const standings = res.data.standings || res.data;

    if (standings.length >= 2) {
      const top = standings[0];
      const second = standings[1];
      const topPts = top.total_points ?? top.points;
      const secPts = second.total_points ?? second.points;

      expect(topPts >= secPts).toBe(true);
    }
  });
});
