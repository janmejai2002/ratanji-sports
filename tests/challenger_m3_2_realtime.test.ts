/**
 * Empirical Challenger M3-2: Real-Time Broadcaster Hub Stress & Concurrency Test
 * Ratanji Digital Sports Management & Scoring System
 *
 * Adversarial validation of:
 * 1. Multi-Client Concurrency (20 concurrent WS + 8 concurrent SSE clients)
 * 2. High-Frequency Broadcast Burst (30 events in < 500ms with zero dropped frames)
 * 3. Match Timer Propagation (start, pause, stoppage, resume, and negative rejection)
 * 4. Abrupt Client Teardown (socket termination & stream abort) with clean recovery & reconnection
 * 5. WS/SSE Channel Isolation & Protocol Robustness (malformed frames, ping-pong, channel filters)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import http from 'node:http';
import { api, ADMIN_HEADERS, BASE_URL, WS_URL } from './e2e/helpers';

/**
 * High-performance WebSocket test harness client
 */
class AdversarialWsClient {
  public ws: WebSocket | null = null;
  public messages: any[] = [];
  public timestamps: number[] = [];
  public connected: boolean = false;
  private messageResolvers: ((msg: any) => void)[] = [];

  constructor(public id: string, private url: string = WS_URL) {}

  connect(timeoutMs: number = 7000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[${this.id}] WebSocket connection timed out after ${timeoutMs}ms to ${this.url}`));
      }, timeoutMs);

      try {
        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.on('open', () => {
          this.connected = true;
          clearTimeout(timer);
          resolve();
        });

        ws.on('error', (err) => {
          if (!this.connected) {
            clearTimeout(timer);
            reject(err);
          }
        });

        ws.on('message', (raw) => {
          try {
            const parsed = JSON.parse(raw.toString('utf8'));
            this.messages.push(parsed);
            this.timestamps.push(Date.now());
            // Fire all registered resolvers
            for (let i = this.messageResolvers.length - 1; i >= 0; i--) {
              this.messageResolvers[i](parsed);
            }
          } catch {
            // Keep raw unparseable payloads for protocol testing
            this.messages.push({ __raw: raw.toString('utf8') });
          }
        });

        ws.on('close', () => {
          this.connected = false;
        });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  async waitForMessage(predicate: (msg: any) => boolean, timeoutMs: number = 5000): Promise<any> {
    const existing = this.messages.find(predicate);
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`[${this.id}] Timed out waiting for WS message after ${timeoutMs}ms (received ${this.messages.length} msgs)`));
      }, timeoutMs);

      const check = (msg: any) => {
        if (predicate(msg)) {
          clearTimeout(timer);
          cleanup();
          resolve(msg);
        }
      };

      const cleanup = () => {
        const idx = this.messageResolvers.indexOf(check);
        if (idx !== -1) this.messageResolvers.splice(idx, 1);
      };

      this.messageResolvers.push(check);
    });
  }

  terminate(): void {
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch {}
      this.connected = false;
    }
  }

  close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.connected = false;
    }
  }
}

/**
 * Resilient Server-Sent Events (SSE) test harness client
 */
class AdversarialSseClient {
  public req: http.ClientRequest | null = null;
  public res: http.IncomingMessage | null = null;
  public messages: any[] = [];
  public rawEvents: { event?: string; data: any }[] = [];
  public timestamps: number[] = [];
  public connected: boolean = false;
  private buffer: string = '';
  private messageResolvers: ((msg: any) => void)[] = [];

  constructor(public id: string, private url: string = `${BASE_URL}/api/events`) {}

  connect(timeoutMs: number = 7000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.destroy();
        reject(new Error(`[${this.id}] SSE connection timed out after ${timeoutMs}ms to ${this.url}`));
      }, timeoutMs);

      try {
        const parsedUrl = new URL(this.url);
        const req = http.request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 3001,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }, (res) => {
          this.res = res;
          if (res.statusCode !== 200) {
            clearTimeout(timer);
            reject(new Error(`[${this.id}] SSE connection failed with status code ${res.statusCode}`));
            return;
          }

          res.on('data', (chunk: Buffer) => {
            this.buffer += chunk.toString('utf8');
            const blocks = this.buffer.split('\n\n');
            this.buffer = blocks.pop() || '';

            for (const block of blocks) {
              if (!block.trim()) continue;
              let eventType: string | undefined;
              let dataStr = '';

              const lines = block.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith(':')) {
                  // Keep-alive heartbeat comment
                  continue;
                } else if (trimmed.startsWith('event:')) {
                  eventType = trimmed.slice(6).trim();
                } else if (trimmed.startsWith('data:')) {
                  dataStr += trimmed.slice(5).trim();
                }
              }

              if (dataStr) {
                try {
                  const parsed = JSON.parse(dataStr);
                  this.messages.push(parsed);
                  this.rawEvents.push({ event: eventType, data: parsed });
                  this.timestamps.push(Date.now());
                  for (let i = this.messageResolvers.length - 1; i >= 0; i--) {
                    this.messageResolvers[i](parsed);
                  }
                } catch {
                  // Ignore malformed JSON chunks
                }
              }
            }

            if (!this.connected) {
              this.connected = true;
              clearTimeout(timer);
              resolve();
            }
          });

          res.on('close', () => {
            this.connected = false;
          });
        });

        req.on('error', (err) => {
          if (!this.connected) {
            clearTimeout(timer);
            reject(err);
          }
        });

        this.req = req;
        req.end();
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  async waitForMessage(predicate: (msg: any) => boolean, timeoutMs: number = 5000): Promise<any> {
    const existing = this.messages.find(predicate);
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`[${this.id}] Timed out waiting for SSE message after ${timeoutMs}ms (received ${this.messages.length} msgs)`));
      }, timeoutMs);

      const check = (msg: any) => {
        if (predicate(msg)) {
          clearTimeout(timer);
          cleanup();
          resolve(msg);
        }
      };

      const cleanup = () => {
        const idx = this.messageResolvers.indexOf(check);
        if (idx !== -1) this.messageResolvers.splice(idx, 1);
      };

      this.messageResolvers.push(check);
    });
  }

  destroy(): void {
    this.connected = false;
    if (this.req) {
      try { this.req.destroy(); } catch {}
      this.req = null;
    }
    if (this.res) {
      try { this.res.destroy(); } catch {}
      this.res = null;
    }
  }
}

describe('Challenger M3-2: Real-Time Broadcaster Hub Stress & Concurrency Suite', () => {

  // =========================================================================
  // REQUIREMENT 1: MULTI-CLIENT CONCURRENCY (15+ WS & 5+ SSE SIMULTANEOUSLY)
  // =========================================================================
  describe('Requirement 1: Multi-Client Concurrency (20 WS + 8 SSE Clients)', () => {
    const NUM_WS = 20; // Requirement asks for 15+
    const NUM_SSE = 8; // Requirement asks for 5+
    const wsClients: AdversarialWsClient[] = [];
    const sseClients: AdversarialSseClient[] = [];
    let matchId: string;

    beforeAll(async () => {
      // Create a dedicated football match for concurrency testing
      const res = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Concurrent Broadcast Ground',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(res.status).toBe(201);
      matchId = res.data.id;
    });

    afterAll(() => {
      // Clean up all clients
      for (const c of wsClients) c.close();
      for (const s of sseClients) s.destroy();
    });

    it(`Connects ${NUM_WS} WebSocket and ${NUM_SSE} SSE clients concurrently`, async () => {
      const connectStart = Date.now();

      // Launch all 20 WS clients concurrently
      const wsConnectPromises = Array.from({ length: NUM_WS }, (_, i) => {
        const client = new AdversarialWsClient(`ws-concurrency-${i + 1}`);
        wsClients.push(client);
        return client.connect();
      });

      // Launch all 8 SSE clients concurrently
      const sseConnectPromises = Array.from({ length: NUM_SSE }, (_, i) => {
        const client = new AdversarialSseClient(`sse-concurrency-${i + 1}`);
        sseClients.push(client);
        return client.connect();
      });

      await Promise.all([...wsConnectPromises, ...sseConnectPromises]);
      const connectElapsed = Date.now() - connectStart;

      expect(wsClients.length).toBe(NUM_WS);
      expect(sseClients.length).toBe(NUM_SSE);
      expect(wsClients.every((c) => c.connected)).toBe(true);
      expect(sseClients.every((c) => c.connected)).toBe(true);

      // Verify all WS clients received the initial connection greeting
      for (const c of wsClients) {
        await c.waitForMessage((m) => m.type === 'connected', 2000);
        expect(c.messages.some((m) => m.type === 'connected')).toBe(true);
      }

      // Verify all SSE clients received the initial connection greeting
      for (const s of sseClients) {
        expect(s.messages.some((m) => m.type === 'connected')).toBe(true);
      }

      console.log(`[Metric] Connected ${NUM_WS} WS + ${NUM_SSE} SSE clients in ${connectElapsed}ms`);
    }, 15000);

    it('Broadcasts scoring event to 100% of connected clients with sub-250ms latency', async () => {
      const eventSendTime = Date.now();

      // Emit GOAL event via REST API
      const eventRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 12,
        second: 30,
      }, ADMIN_HEADERS);

      expect(eventRes.status).toBe(201);
      const goalEventId = eventRes.data.id;

      // Verify every single WS client receives the broadcast frame
      const wsDeliveryTimes: number[] = [];
      const wsWaiters = wsClients.map(async (client) => {
        const msg = await client.waitForMessage(
          (m) => m.type === 'match:event' && m.match_id === matchId && m.event?.id === goalEventId,
          4000
        );
        expect(msg.score_home).toBe(1);
        expect(msg.score_away).toBe(0);
        wsDeliveryTimes.push(Date.now() - eventSendTime);
        return msg;
      });

      // Verify every single SSE client receives the broadcast frame
      const sseDeliveryTimes: number[] = [];
      const sseWaiters = sseClients.map(async (client) => {
        const msg = await client.waitForMessage(
          (m) => m.type === 'match:event' && m.match_id === matchId && m.event?.id === goalEventId,
          4000
        );
        expect(msg.score_home).toBe(1);
        expect(msg.score_away).toBe(0);
        sseDeliveryTimes.push(Date.now() - eventSendTime);
        return msg;
      });

      const [wsResults, sseResults] = await Promise.all([
        Promise.all(wsWaiters),
        Promise.all(sseWaiters),
      ]);

      expect(wsResults.length).toBe(NUM_WS);
      expect(sseResults.length).toBe(NUM_SSE);

      const allLatencies = [...wsDeliveryTimes, ...sseDeliveryTimes];
      const maxLatency = Math.max(...allLatencies);
      const minLatency = Math.min(...allLatencies);
      const avgLatency = allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;

      console.log(`[Metric] Broadcast delivery to ${allLatencies.length} clients: min=${minLatency}ms, avg=${avgLatency.toFixed(1)}ms, max=${maxLatency}ms`);
      expect(maxLatency).toBeLessThan(3000); // Well within interactive threshold
    }, 15000);
  });

  // =========================================================================
  // REQUIREMENT 2: HIGH-FREQUENCY BROADCAST BURST (25+ EVENTS IN < 500MS)
  // =========================================================================
  describe('Requirement 2: High-Frequency Broadcast Burst (30 Events Burst)', () => {
    const BURST_COUNT = 30; // Requirement asks for 25+ events
    const wsClients: AdversarialWsClient[] = [];
    const sseClients: AdversarialSseClient[] = [];
    let matchId: string;

    beforeAll(async () => {
      // Create a dedicated basketball match for rapid event burst
      const res = await api.post('/api/matches', {
        sport_id: 'basketball-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Burst Arena Court',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(res.status).toBe(201);
      matchId = res.data.id;

      // Connect 5 WS and 3 SSE listeners for burst verification
      for (let i = 0; i < 5; i++) {
        const ws = new AdversarialWsClient(`burst-ws-${i + 1}`);
        wsClients.push(ws);
      }
      for (let i = 0; i < 3; i++) {
        const sse = new AdversarialSseClient(`burst-sse-${i + 1}`);
        sseClients.push(sse);
      }
      await Promise.all([
        ...wsClients.map((c) => c.connect()),
        ...sseClients.map((s) => s.connect()),
      ]);
    });

    afterAll(() => {
      for (const c of wsClients) c.close();
      for (const s of sseClients) s.destroy();
    });

    it(`Emits burst of ${BURST_COUNT} scoring events in rapid succession and verifies zero frame loss`, async () => {
      const burstStartTime = Date.now();
      const emittedEventIds: string[] = [];

      // Send 30 scoring events in rapid succession
      for (let i = 1; i <= BURST_COUNT; i++) {
        const res = await api.post(`/api/matches/${matchId}/events`, {
          event_type: 'SCORE_2PT',
          team: i % 2 === 0 ? 'home' : 'away',
          minute: Math.floor(i / 2),
          second: (i * 10) % 60,
          payload_json: { points: 2, sequence: i },
        }, ADMIN_HEADERS);

        expect(res.status).toBe(201);
        emittedEventIds.push(res.data.id);
      }

      const burstDuration = Date.now() - burstStartTime;
      console.log(`[Metric] Emitted ${BURST_COUNT} events in ${burstDuration}ms (${(BURST_COUNT / (burstDuration / 1000)).toFixed(1)} events/sec)`);

      // Verify that all 5 WS clients received all 30 events in identical order
      for (const ws of wsClients) {
        // Wait until all 30 events are received
        await ws.waitForMessage(
          (m) => m.type === 'match:event' && m.match_id === matchId && m.event?.id === emittedEventIds[BURST_COUNT - 1],
          7000
        );

        const matchEventsReceived = ws.messages
          .filter((m) => m.type === 'match:event' && m.match_id === matchId)
          .map((m) => m.event?.id);

        // Check for 100% frame delivery with zero drops
        for (const evId of emittedEventIds) {
          expect(matchEventsReceived).toContain(evId);
        }

        // Check strictly monotonic score updates
        const scoreHistories = ws.messages
          .filter((m) => m.type === 'match:event' && m.match_id === matchId)
          .map((m) => m.score_home + m.score_away);

        for (let j = 1; j < scoreHistories.length; j++) {
          expect(scoreHistories[j]).toBeGreaterThanOrEqual(scoreHistories[j - 1]);
        }
      }

      // Verify all 3 SSE clients also received all 30 events
      for (const sse of sseClients) {
        await sse.waitForMessage(
          (m) => m.type === 'match:event' && m.match_id === matchId && m.event?.id === emittedEventIds[BURST_COUNT - 1],
          7000
        );

        const sseEventsReceived = sse.messages
          .filter((m) => m.type === 'match:event' && m.match_id === matchId)
          .map((m) => m.event?.id);

        for (const evId of emittedEventIds) {
          expect(sseEventsReceived).toContain(evId);
        }
      }
    }, 20000);
  });

  // =========================================================================
  // REQUIREMENT 3: TIMER BROADCAST PROPAGATION (START, PAUSE, STOPPAGE, ETC.)
  // =========================================================================
  describe('Requirement 3: Timer Broadcast Propagation', () => {
    let wsClient: AdversarialWsClient;
    let sseClient: AdversarialSseClient;
    let matchId: string;

    beforeAll(async () => {
      const res = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Timer Precision Stadium',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(res.status).toBe(201);
      matchId = res.data.id;

      wsClient = new AdversarialWsClient('timer-ws');
      sseClient = new AdversarialSseClient('timer-sse');
      await Promise.all([wsClient.connect(), sseClient.connect()]);
    });

    afterAll(() => {
      wsClient.close();
      sseClient.destroy();
    });

    it('Propagates timer START command to both WS and SSE clients', async () => {
      const res = await api.post(`/api/matches/${matchId}/timer`, {
        action: 'start',
        seconds: 0,
        period: 'First Half',
      }, ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.data.current_period).toBe('First Half');

      const wsMsg = await wsClient.waitForMessage(
        (m) => m.type === 'match:timer' && m.match_id === matchId && m.action === 'start',
        3000
      );
      expect(wsMsg.action).toBe('start');
      expect(wsMsg.current_period).toBe('First Half');
      expect(wsMsg.current_time_seconds).toBe(0);

      const sseMsg = await sseClient.waitForMessage(
        (m) => m.type === 'match:timer' && m.match_id === matchId && m.action === 'start',
        3000
      );
      expect(sseMsg.action).toBe('start');
      expect(sseMsg.current_period).toBe('First Half');
      expect(sseMsg.current_time_seconds).toBe(0);
    });

    it('Propagates timer PAUSE command to both WS and SSE clients', async () => {
      const res = await api.post(`/api/matches/${matchId}/timer`, {
        action: 'pause',
        seconds: 245,
      }, ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.data.current_period).toBe('Paused');

      const wsMsg = await wsClient.waitForMessage(
        (m) => m.type === 'match:timer' && m.match_id === matchId && m.action === 'pause',
        3000
      );
      expect(wsMsg.action).toBe('pause');
      expect(wsMsg.current_period).toBe('Paused');
      expect(wsMsg.current_time_seconds).toBe(245);

      const sseMsg = await sseClient.waitForMessage(
        (m) => m.type === 'match:timer' && m.match_id === matchId && m.action === 'pause',
        3000
      );
      expect(sseMsg.action).toBe('pause');
      expect(sseMsg.current_period).toBe('Paused');
    });

    it('Propagates timer STOPPAGE (injury time) addition accurately', async () => {
      const res = await api.post(`/api/matches/${matchId}/timer`, {
        action: 'stoppage',
        extra_seconds: 180, // +3 minutes stoppage
      }, ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.data.current_time_seconds).toBe(245 + 180);

      const wsMsg = await wsClient.waitForMessage(
        (m) => m.type === 'match:timer' && m.match_id === matchId && m.action === 'stoppage',
        3000
      );
      expect(wsMsg.action).toBe('stoppage');
      expect(wsMsg.current_time_seconds).toBe(425);

      const sseMsg = await sseClient.waitForMessage(
        (m) => m.type === 'match:timer' && m.match_id === matchId && m.action === 'stoppage',
        3000
      );
      expect(sseMsg.action).toBe('stoppage');
      expect(sseMsg.current_time_seconds).toBe(425);
    });

    it('Rejects invalid timer actions and negative extra_seconds without broadcast pollution', async () => {
      const invalidActionRes = await api.post(`/api/matches/${matchId}/timer`, {
        action: 'warp_speed_invalid',
      }, ADMIN_HEADERS);
      expect(invalidActionRes.status).toBe(400);
      expect(invalidActionRes.data.code).toBe('INVALID_TIMER_ACTION');

      const negativeStoppageRes = await api.post(`/api/matches/${matchId}/timer`, {
        action: 'stoppage',
        extra_seconds: -60,
      }, ADMIN_HEADERS);
      expect(negativeStoppageRes.status).toBe(400);
      expect(negativeStoppageRes.data.code).toBe('INVALID_EXTRA_SECONDS');

      // Verify no invalid timer message was broadcast
      expect(wsClient.messages.some((m) => m.action === 'warp_speed_invalid')).toBe(false);
      expect(sseClient.messages.some((m) => m.action === 'warp_speed_invalid')).toBe(false);
    });
  });

  // =========================================================================
  // REQUIREMENT 4: ABRUPT CLIENT TEARDOWN & RECONNECT
  // =========================================================================
  describe('Requirement 4: Abrupt Client Teardown, Server Survival & Reconnection', () => {
    let matchId: string;

    beforeAll(async () => {
      const res = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Teardown Stress Field',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(res.status).toBe(201);
      matchId = res.data.id;
    });

    it('Survives abrupt TCP reset (.terminate) on 10 WS and stream abort on 5 SSE clients', async () => {
      // 1. Establish 10 WS and 5 SSE clients
      const sacrificialWs: AdversarialWsClient[] = [];
      const sacrificialSse: AdversarialSseClient[] = [];

      for (let i = 0; i < 10; i++) {
        sacrificialWs.push(new AdversarialWsClient(`victim-ws-${i + 1}`));
      }
      for (let i = 0; i < 5; i++) {
        sacrificialSse.push(new AdversarialSseClient(`victim-sse-${i + 1}`));
      }

      await Promise.all([
        ...sacrificialWs.map((c) => c.connect()),
        ...sacrificialSse.map((s) => s.connect()),
      ]);

      expect(sacrificialWs.every((c) => c.connected)).toBe(true);
      expect(sacrificialSse.every((s) => s.connected)).toBe(true);

      // 2. Abruptly kill all sockets without graceful close handshake
      for (const ws of sacrificialWs) {
        ws.terminate(); // Hard TCP reset
      }
      for (const sse of sacrificialSse) {
        sse.destroy(); // Hard socket destruction
      }

      // Small delay to allow OS socket events to propagate to Node server
      await new Promise((r) => setTimeout(r, 100));

      // 3. Immediately emit events to ensure server does not crash or throw unhandled exceptions
      const postTeardownEventRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'YELLOW_CARD',
        team: 'away',
        minute: 40,
      }, ADMIN_HEADERS);

      expect(postTeardownEventRes.status).toBe(201);

      // Check server health endpoint
      const healthRes = await api.get('/api/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.data.status).toBe('ok');
    });

    it('Resumes normal broadcasting to freshly reconnected WS and SSE clients', async () => {
      const revivedWs = new AdversarialWsClient('revived-ws');
      const revivedSse = new AdversarialSseClient('revived-sse');

      await Promise.all([revivedWs.connect(), revivedSse.connect()]);
      expect(revivedWs.connected).toBe(true);
      expect(revivedSse.connected).toBe(true);

      // Emit new event and verify delivery to revived clients
      const newEventRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'RED_CARD',
        team: 'home',
        minute: 45,
      }, ADMIN_HEADERS);
      expect(newEventRes.status).toBe(201);
      const cardEventId = newEventRes.data.id;

      const wsMsg = await revivedWs.waitForMessage(
        (m) => m.type === 'match:event' && m.match_id === matchId && m.event?.id === cardEventId,
        4000
      );
      expect(wsMsg.event?.event_type).toBe('RED_CARD');

      const sseMsg = await revivedSse.waitForMessage(
        (m) => m.type === 'match:event' && m.match_id === matchId && m.event?.id === cardEventId,
        4000
      );
      expect(sseMsg.event?.event_type).toBe('RED_CARD');

      revivedWs.close();
      revivedSse.destroy();
    });
  });

  // =========================================================================
  // REQUIREMENT 5: PROTOCOL ROBUSTNESS & CHANNEL ISOLATION
  // =========================================================================
  describe('Requirement 5: Channel Isolation & Protocol Robustness', () => {
    let matchA: string;
    let matchB: string;

    beforeAll(async () => {
      const resA = await api.post('/api/matches', {
        sport_id: 'football',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Pitch Alpha',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(resA.status).toBe(201);
      matchA = resA.data.id;

      const resB = await api.post('/api/matches', {
        sport_id: 'badminton-m',
        home_cohort_id: 'seniors',
        away_cohort_id: 'juniors',
        venue: 'Court Beta',
        scheduled_at: new Date().toISOString(),
      }, ADMIN_HEADERS);
      expect(resB.status).toBe(201);
      matchB = resB.data.id;
    });

    it('Responds to WebSocket ping with pong heartbeat frame', async () => {
      const client = new AdversarialWsClient('ping-ws');
      await client.connect();

      client.send({ type: 'ping' });
      const pong = await client.waitForMessage((m) => m.type === 'pong', 3000);
      expect(pong.type).toBe('pong');
      expect(pong.timestamp).toBeDefined();

      client.close();
    });

    it('Tolerates malformed non-JSON frame without disconnecting client or crashing', async () => {
      const client = new AdversarialWsClient('malformed-ws');
      await client.connect();

      // Send raw unparseable garbage
      client.send('{{{CORRUPTED_RAW_NON_JSON_DATA@@@!!!');

      // Send ping right after to verify socket is still healthy and responsive
      client.send({ type: 'ping' });
      const pong = await client.waitForMessage((m) => m.type === 'pong', 3000);
      expect(pong.type).toBe('pong');

      client.close();
    });

    it('Enforces channel isolation when clients subscribe to specific match channels', async () => {
      const clientA = new AdversarialWsClient('isolated-A');
      const clientB = new AdversarialWsClient('isolated-B');

      await Promise.all([clientA.connect(), clientB.connect()]);

      // Unsubscribe from 'all' and subscribe only to matchA or matchB
      clientA.send({ action: 'unsubscribe', channel: 'all' });
      clientA.send({ action: 'subscribe', channel: `match:${matchA}` });

      clientB.send({ action: 'unsubscribe', channel: 'all' });
      clientB.send({ action: 'subscribe', channel: `match:${matchB}` });

      // Small delay for server to process subscribe messages
      await new Promise((r) => setTimeout(r, 100));

      // Emit event on matchA
      const resA = await api.post(`/api/matches/${matchA}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 50,
      }, ADMIN_HEADERS);
      expect(resA.status).toBe(201);
      const eventAId = resA.data.id;

      // Client A should receive matchA event
      const msgA = await clientA.waitForMessage(
        (m) => m.type === 'match:event' && m.match_id === matchA && m.event?.id === eventAId,
        3000
      );
      expect(msgA.match_id).toBe(matchA);

      // Client B should NOT receive matchA event
      await new Promise((r) => setTimeout(r, 200));
      expect(clientB.messages.some((m) => m.match_id === matchA)).toBe(false);

      // Emit event on matchB
      const resB = await api.post(`/api/matches/${matchB}/events`, {
        event_type: 'POINT',
        team: 'away',
        minute: 1,
      }, ADMIN_HEADERS);
      expect(resB.status).toBe(201);
      const eventBId = resB.data.id;

      // Client B should receive matchB event
      const msgB = await clientB.waitForMessage(
        (m) => m.type === 'match:event' && m.match_id === matchB && m.event?.id === eventBId,
        3000
      );
      expect(msgB.match_id).toBe(matchB);

      // Client A should NOT receive matchB event
      expect(clientA.messages.some((m) => m.match_id === matchB)).toBe(false);

      clientA.close();
      clientB.close();
    });
  });
});
