/**
 * Real-Time Broadcasting Hub (Dual Transport: WebSocket + SSE)
 * Sub-millisecond broadcast bus transmitting match timer updates,
 * scoring events, status transitions, and updated cohort standings.
 * Ratanji Digital Sports Management & Scoring System
 */

import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Request, Response } from 'express';

export interface BroadcastMessage {
  type: string;
  timestamp?: string;
  [key: string]: any;
}

interface SseClient {
  id: string;
  res: Response;
  channels: Set<string>;
}

export function safeJsonParse<T = any>(val: unknown, fallback: T = {} as T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export class RealtimeBroadcaster {
  private wss: WebSocketServer | null = null;
  private wsClients: Map<WebSocket, { isAlive: boolean; channels: Set<string> }> = new Map();
  private sseClients: Map<string, SseClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private ssePingInterval: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Attaches broadcaster to an HTTP server or existing WebSocketServer
   */
  public attach(serverOrWss: Server | WebSocketServer): void {
    if ('on' in serverOrWss && 'clients' in serverOrWss) {
      this.wss = serverOrWss as WebSocketServer;
    } else {
      this.wss = new WebSocketServer({ server: serverOrWss as Server });
    }

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    if (!this.wss) return;

    this.wss.on('error', (_err: any) => {
      // Defensive guard against unhandled EventEmitter error on wss during listen errors
    });

    this.wss.on('connection', (ws: WebSocket) => {
      // Default subscribe to 'all' so connected clients receive broadcasts out-of-the-box
      const clientMeta = { isAlive: true, channels: new Set<string>(['all']) };
      this.wsClients.set(ws, clientMeta);

      // Initial connection greeting
      this.safeSend(ws, {
        type: 'connected',
        message: 'Ratanjee Live Broadcaster ready',
        timestamp: new Date().toISOString(),
      });

      ws.on('pong', () => {
        const meta = this.wsClients.get(ws);
        if (meta) meta.isAlive = true;
      });

      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.action === 'subscribe' && data.channel) {
            clientMeta.channels.add(String(data.channel));
          } else if (data.action === 'unsubscribe' && data.channel) {
            clientMeta.channels.delete(String(data.channel));
          } else if (data.type === 'ping') {
            this.safeSend(ws, { type: 'pong', timestamp: new Date().toISOString() });
          }
        } catch {
          // Ignore invalid JSON frames
        }
      });

      ws.on('close', () => {
        this.wsClients.delete(ws);
      });

      ws.on('error', () => {
        this.wsClients.delete(ws);
      });
    });
  }

  /**
   * Express SSE route handler for GET /api/events
   */
  public handleSse(req: Request, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();

    const clientId = 'sse-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const channels = new Set<string>();

    const rawChannelsQuery = req.query.channels ?? req.query.channel;
    if (rawChannelsQuery) {
      const qChannels = Array.isArray(rawChannelsQuery)
        ? rawChannelsQuery.flatMap((c) => String(c).split(','))
        : String(rawChannelsQuery).split(',');

      for (const ch of qChannels) {
        const trimmed = ch.trim();
        if (trimmed) {
          channels.add(trimmed);
        }
      }
    }

    // Default to 'all' if no specific channels were specified or all entries were empty
    if (channels.size === 0) {
      channels.add('all');
    }

    const client: SseClient = { id: clientId, res, channels };
    this.sseClients.set(clientId, client);

    // Initial SSE greeting
    const greeting = JSON.stringify({
      type: 'connected',
      message: 'Ratanjee SSE stream connected',
      clientId,
      timestamp: new Date().toISOString(),
    });
    res.write(`data: ${greeting}\n\n`);

    req.on('close', () => {
      this.sseClients.delete(clientId);
    });

    res.on('close', () => {
      this.sseClients.delete(clientId);
    });
  }

  /**
   * Core broadcast dispatcher to both WebSocket and SSE subscribers
   */
  public broadcast(channel: string, message: BroadcastMessage): void {
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    const rawJson = JSON.stringify(message);
    const sseFormatted = `event: ${message.type}\ndata: ${rawJson}\n\n`;

    // 1. Deliver to WebSocket clients
    for (const [ws, meta] of this.wsClients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        if (meta.channels.has('all') || meta.channels.has(channel)) {
          this.safeSendRaw(ws, rawJson);
        }
      }
    }

    // 2. Deliver to SSE clients
    for (const [id, sseClient] of this.sseClients.entries()) {
      try {
        if (sseClient.channels.has('all') || sseClient.channels.has(channel)) {
          sseClient.res.write(sseFormatted);
        }
      } catch {
        this.sseClients.delete(id);
      }
    }
  }

  // Domain-specific broadcast helpers:

  public broadcastMatchEvent(matchId: string, event: any, matchState?: any): void {
    const payload = {
      type: 'match:event',
      match_id: matchId,
      event,
      score_home: matchState?.score_home ?? 0,
      score_away: matchState?.score_away ?? 0,
      sport_state: safeJsonParse(matchState?.sport_state_json, {}),
      match: matchState,
      timestamp: new Date().toISOString(),
    };
    this.broadcast(`match:${matchId}`, payload);
  }

  public broadcastMatchTimer(matchId: string, timerData: { action?: string; current_period: string; current_time_seconds: number }): void {
    const payload = {
      type: 'match:timer',
      match_id: matchId,
      action: timerData.action || 'tick',
      current_period: timerData.current_period,
      current_time_seconds: timerData.current_time_seconds,
      timestamp: new Date().toISOString(),
    };
    this.broadcast(`match:${matchId}`, payload);
  }

  public broadcastMatchStatus(matchId: string, fromStatus: string, toStatus: string, match: any): void {
    const payload = {
      type: 'match:status',
      match_id: matchId,
      from_status: fromStatus,
      to_status: toStatus,
      status: toStatus,
      match,
      timestamp: new Date().toISOString(),
    };
    this.broadcast(`match:${matchId}`, payload);
  }

  public broadcastStandingsUpdate(tournamentId: string, standings: any, sports: any, sourceMatchId?: string): void {
    const payload = {
      type: 'standings:update',
      tournament_id: tournamentId,
      standings,
      sports,
      source_match_id: sourceMatchId,
      timestamp: new Date().toISOString(),
    };
    this.broadcast('standings', payload);
  }

  private safeSend(ws: WebSocket, data: any): void {
    this.safeSendRaw(ws, JSON.stringify(data));
  }

  private safeSendRaw(ws: WebSocket, raw: string): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw, (err) => {
          if (err) this.wsClients.delete(ws);
        });
      }
    } catch {
      this.wsClients.delete(ws);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    // Ping WS clients every 30s
    this.heartbeatInterval = setInterval(() => {
      for (const [ws, meta] of this.wsClients.entries()) {
        if (!meta.isAlive) {
          this.wsClients.delete(ws);
          try { ws.terminate(); } catch {}
          continue;
        }
        meta.isAlive = false;
        try {
          ws.ping();
        } catch {
          this.wsClients.delete(ws);
        }
      }
    }, 30000);
    this.heartbeatInterval.unref();

    // Keep-alive SSE comments every 20s
    this.ssePingInterval = setInterval(() => {
      for (const [id, client] of this.sseClients.entries()) {
        try {
          client.res.write(': keep-alive\n\n');
        } catch {
          this.sseClients.delete(id);
        }
      }
    }, 20000);
    this.ssePingInterval.unref();
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.ssePingInterval) {
      clearInterval(this.ssePingInterval);
      this.ssePingInterval = null;
    }

    for (const [ws] of this.wsClients.entries()) {
      try {
        ws.terminate();
      } catch {}
    }
    this.wsClients.clear();

    for (const [id, client] of this.sseClients.entries()) {
      try {
        client.res.end();
      } catch {}
    }
    this.sseClients.clear();
  }
}

export const broadcaster = new RealtimeBroadcaster();
