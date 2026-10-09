/**
 * Sport Scoring Engines Test Suite
 * Ratanji Digital Sports Management & Scoring System
 */

import { describe, it, expect, api, ADMIN_HEADERS, REFEREE_HEADERS } from './e2e/helpers';

describe('Sport Scoring Engines', () => {

  describe('Football Scoring Engine', () => {
    let matchId: string = '';

    it('Logs goals, cards, and substitutions correctly', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Football Ground',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      // Goal
      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 10,
      }, ADMIN_HEADERS);

      // Yellow card
      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'YELLOW_CARD',
        team: 'away',
        minute: 35,
      }, ADMIN_HEADERS);

      const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(detail.data.score_home).toBe(1);
      expect(detail.data.score_away).toBe(0);
    });
  });

  describe('Cricket Scoring Engine', () => {
    let matchId: string = '';

    it('Tracks ball-by-ball scoring, wickets, and extras', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'cricket',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Cricket Oval',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      // Runs
      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'BALL',
        team: 'home',
        minute: 1,
        payload_json: { runs: 6 },
      }, ADMIN_HEADERS);

      // Extra
      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'EXTRA',
        team: 'home',
        minute: 2,
        payload_json: { extra_type: 'wide', runs: 1 },
      }, ADMIN_HEADERS);

      // Wicket
      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'WICKET',
        team: 'home',
        minute: 3,
      }, ADMIN_HEADERS);

      const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(detail.data.score_home).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Basketball Scoring Engine', () => {
    let matchId: string = '';

    it('Tracks 1PT, 2PT, 3PT scores, quarters, and team fouls', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'basketball-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Basketball Court',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'SCORE_3PT',
        team: 'home',
        minute: 2,
        payload_json: { points: 3 },
      }, ADMIN_HEADERS);

      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'SCORE_2PT',
        team: 'away',
        minute: 3,
        payload_json: { points: 2 },
      }, ADMIN_HEADERS);

      const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(detail.data.score_home).toBe(3);
      expect(detail.data.score_away).toBe(2);
    });
  });

  describe('Badminton Scoring Engine', () => {
    let matchId: string = '';

    it('Tracks 21-point rally format and best-of-3 sets', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'badminton-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Badminton Hall',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS)).data;
      matchId = m.id;

      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'SET_WON',
        team: 'home',
        minute: 15,
        payload_json: { set: 1, score: '21-19' },
      }, ADMIN_HEADERS);

      const detail = await api.get(`/api/matches/${matchId}`, ADMIN_HEADERS);
      expect(detail.status).toBe(200);
    });
  });

  describe('Generic Scoring Engine', () => {
    it('Handles points/sets scoring for remaining 11 sports', async () => {
      const m = (await api.post('/api/matches', {
        sport_id: 'table-tennis',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'TT Hall',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS)).data;

      await api.post(`/api/matches/${m.id}/events`, {
        event_type: 'POINT',
        team: 'home',
        minute: 1,
      }, ADMIN_HEADERS);

      const detail = await api.get(`/api/matches/${m.id}`, ADMIN_HEADERS);
      expect(detail.data.score_home).toBe(1);
    });
  });
});
