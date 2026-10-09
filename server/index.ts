import express from 'express';
import cors from 'cors';
import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDatabase } from './db/client.js';
import { initSchema } from './db/schema.js';
import { seedDatabase } from './db/seed.js';

import { authMiddleware } from './services/rbac.js';
import { authRouter } from './routes/auth.js';
import { matchesRouter } from './routes/matches.js';
import { verificationRouter } from './routes/verification.js';
import { sportsRouter } from './routes/sports.js';
import { rostersRouter } from './routes/rosters.js';
import { standingsRouter } from './routes/standings.js';
import { demoRouter } from './routes/demo.js';
import { refereesRouter } from './routes/referees.js';
import { broadcaster } from './realtime/broadcaster.js';

export const app = express();
export const server = createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());

// Global RBAC Context Extractor
app.use(authMiddleware);

// Basic health check endpoint
app.get(['/api/health', '/healthz', '/health'], (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    node: process.version,
  });
});

// REST API Route Mounts
app.use('/api/auth', authRouter);
app.use('/api/sports', sportsRouter);
app.use('/api/contingent', rostersRouter);
app.use('/api/rosters', rostersRouter); // alias
app.use('/api/matches', matchesRouter);
app.use('/api/admin/verifications', verificationRouter);
app.use('/api/standings', standingsRouter);
app.use('/api/referees', refereesRouter);
app.use('/api/demo', demoRouter);

// Real-time SSE event stream endpoint
app.get('/api/events', (req, res) => {
  broadcaster.handleSse(req, res);
});

// Attach WebSocket server & Realtime Broadcaster Hub
export const wss = new WebSocketServer({ server });
wss.on('error', (err: any) => {
  if (err?.code === 'EADDRINUSE') return;
  console.error('WebSocketServer error:', err);
});
broadcaster.attach(wss);

// Production or built static file serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwdDist = path.resolve(process.cwd(), 'dist');
const localDist = path.resolve(__dirname, '../dist');
const distPath = fs.existsSync(cwdDist) ? cwdDist : localDist;

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

let isListening = false;

export function startServer(port: number = 3001): Promise<Server> {
  return new Promise((resolve, reject) => {
    if (isListening || server.listening) {
      return resolve(server);
    }

    try {
      const client = getDatabase();
      initSchema(client);
      const cohortCount = client.queryOne<{ cnt: number }>('SELECT count(*) as cnt FROM cohorts');
      if (!cohortCount || cohortCount.cnt === 0) {
        const isClean = process.env.NODE_ENV === 'production' || process.env.CLEAN_TOURNAMENT === 'true';
        seedDatabase(client, { clean: true, cleanOnly: isClean });
      }
    } catch (err) {
      console.error('[Ratanjee Sports] Database initialization warning:', err);
    }

    const onError = (err: any) => {
      cleanup();
      if (err.code === 'EADDRINUSE') {
        // Port is already bound by another process or existing test harness
        isListening = true;
        resolve(server);
      } else {
        reject(err);
      }
    };

    const onListening = () => {
      cleanup();
      isListening = true;
      console.log(`[Ratanjee Sports] Server listening on http://localhost:${port}`);
      resolve(server);
    };

    const cleanup = () => {
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
    };

    server.once('error', onError);
    server.once('listening', onListening);

    server.listen(port, '0.0.0.0');
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    broadcaster.close();
    if (!isListening && !server.listening) {
      return resolve();
    }

    const finalizeServer = () => {
      if (server.listening) {
        server.close(() => {
          isListening = false;
          resolve();
        });
      } else {
        isListening = false;
        resolve();
      }
    };

    try {
      wss.close(() => {
        finalizeServer();
      });
    } catch {
      finalizeServer();
    }
  });
}

// In non-test environments, auto-start on PORT
if (process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT) || 3001;
  startServer(PORT).catch(console.error);
}
