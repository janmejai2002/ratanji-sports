/**
 * Real-Time Broadcast Propagation Test Suite
 * Ratanji Digital Sports Management & Scoring System
 *
 * Strict E2E verification of WebSocket and Server-Sent Events (SSE) broadcasting:
 * - SSE connection acceptance and stream headers
 * - WebSocket broadcast hub connection & initial greeting
 * - Scoring event propagation (minute, team, event_type, scores)
 * - Match timer tick propagation (action, current_time_seconds)
 * - Synchronous standings recalculation & tournament broadcast upon publication
 *
 * ZERO swallowed catch blocks. ZERO optional if-guards. Full assertion fidelity.
 */

import {
  describe,
  it,
  expect,
  api,
  ADMIN_HEADERS,
  WebSocketClient,
  WS_URL,
  BASE_URL,
} from './e2e/helpers';

describe('Real-Time Broadcast Propagation (WebSocket & SSE)', () => {

  it('SSE endpoint /api/events accepts connection without error', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${BASE_URL}/api/events`, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    } finally {
      controller.abort();
    }
  });

  it('WebSocket client can establish connection to broadcast hub', async () => {
    const wsClient = new WebSocketClient(WS_URL);
    try {
      await wsClient.connect(3000);
      const greeting = await wsClient.waitForMessage(
        (msg: any) => msg.type === 'connected',
        2000
      );
      expect(greeting).toBeDefined();
      expect(greeting.type).toBe('connected');
      expect(greeting.message).toBe('Ratanji Live Broadcaster ready');
    } finally {
      wsClient.close();
    }
  });

  it('Scoring events broadcast to connected clients', async () => {
    const wsClient = new WebSocketClient(WS_URL);
    try {
      await wsClient.connect(3000);
      const greeting = await wsClient.waitForMessage((msg: any) => msg.type === 'connected', 2000);
      expect(greeting).toBeDefined();

      const createRes = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Broadcast Arena',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(createRes.status).toBe(201);
      const m = createRes.data;
      expect(m.id).toBeDefined();

      const eventRes = await api.post(`/api/matches/${m.id}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 10,
      }, ADMIN_HEADERS);
      expect(eventRes.status).toBe(201);

      const msg = await wsClient.waitForMessage(
        (msg: any) => msg.type === 'match:event' && msg.match_id === m.id,
        3000
      );
      expect(msg).toBeDefined();
      expect(msg.type).toBe('match:event');
      expect(msg.match_id).toBe(m.id);
      expect(msg.score_home).toBeGreaterThanOrEqual(1);
      expect(msg.event).toBeDefined();
      expect(msg.event.event_type).toBe('GOAL');
    } finally {
      wsClient.close();
    }
  });

  it('Timer state ticks broadcast to connected clients', async () => {
    const wsClient = new WebSocketClient(WS_URL);
    try {
      await wsClient.connect(3000);
      const greeting = await wsClient.waitForMessage((msg: any) => msg.type === 'connected', 2000);
      expect(greeting).toBeDefined();

      const createRes = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Timer Arena',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(createRes.status).toBe(201);
      const m = createRes.data;
      expect(m.id).toBeDefined();

      const timerRes = await api.post(`/api/matches/${m.id}/timer`, {
        action: 'start',
        seconds: 120,
      }, ADMIN_HEADERS);
      expect(timerRes.status).toBe(200);
      expect(timerRes.data.success).toBe(true);

      const msg = await wsClient.waitForMessage(
        (msg: any) => msg.type === 'match:timer' && msg.match_id === m.id,
        3000
      );
      expect(msg).toBeDefined();
      expect(msg.type).toBe('match:timer');
      expect(msg.match_id).toBe(m.id);
      expect(msg.action).toBe('start');
      expect(msg.current_time_seconds).toBe(120);
    } finally {
      wsClient.close();
    }
  });

  it('Standings recalculation broadcast triggered on match publication', async () => {
    const wsClient = new WebSocketClient(WS_URL);
    try {
      await wsClient.connect(3000);
      const greeting = await wsClient.waitForMessage((msg: any) => msg.type === 'connected', 2000);
      expect(greeting).toBeDefined();

      const createRes = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Standings Arena',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(createRes.status).toBe(201);
      const m = createRes.data;
      expect(m.id).toBeDefined();

      const submitRes = await api.post(`/api/matches/${m.id}/submit`, {}, ADMIN_HEADERS);
      expect(submitRes.status).toBe(200);

      const publishRes = await api.post(`/api/matches/${m.id}/publish`, {}, ADMIN_HEADERS);
      expect(publishRes.status).toBe(200);

      const msg = await wsClient.waitForMessage(
        (msg: any) => msg.type === 'standings:update' && msg.source_match_id === m.id,
        3000
      );
      expect(msg).toBeDefined();
      expect(msg.type).toBe('standings:update');
      expect(msg.standings).toBeDefined();
      expect(msg.source_match_id).toBe(m.id);
    } finally {
      wsClient.close();
    }
  });
});
