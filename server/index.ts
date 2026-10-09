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
import { banterRouter } from './routes/banter.js';
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
app.use('/api/banter', banterRouter);
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

// Sports Committee Operational Guide Guard (Restricted to logged-in sportsco only)
const isSportscoAuthorized = (req: express.Request): boolean => {
  const roleHeader = (req.headers['x-user-role'] as string)?.toLowerCase();
  const cookies = req.headers.cookie
    ? Object.fromEntries(
        req.headers.cookie.split(';').map((c) => {
          const [k, ...v] = c.trim().split('=');
          return [k, decodeURIComponent(v.join('='))];
        })
      )
    : {};
  const roleCookie = cookies['ratanji_role']?.toLowerCase() || cookies['user_role']?.toLowerCase();
  const roleQuery = (req.query?.role as string)?.toLowerCase() || (req.query?.auth as string)?.toLowerCase();

  return roleHeader === 'admin' || roleCookie === 'admin' || roleQuery === 'admin' || roleQuery === 'sportsco';
};

app.use(['/guide', '/manual', '/docs', '/docs/*'], (req, res, next) => {
  if (isSportscoAuthorized(req)) {
    if (req.path === '/guide' || req.path === '/manual' || req.path === '/docs' || req.path === '/docs/guide') {
      const q = req.query?.role ? `?role=${req.query.role}` : '';
      return res.redirect(`/docs/sports-committee-guide.html${q}`);
    }
    return next();
  }

  // Not authenticated as Sports Committee
  return res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Restricted • Sports Committee Only</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background: #090d16;
      color: #f8fafc;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: #0f172a;
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 1.25rem;
      padding: 2.25rem;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
      font-family: 'JetBrains Mono', monospace;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 0.75rem 0;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 0.925rem;
      line-height: 1.6;
      margin: 0 0 1.75rem 0;
    }
    .btn {
      display: inline-block;
      background: #f59e0b;
      color: #000000;
      font-weight: 800;
      font-size: 0.875rem;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: #fbbf24;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🔒 Sports Committee Only</div>
    <h1>Access Restricted</h1>
    <p>The Ratanjee Sports Committee Operational Manual is reserved strictly for authenticated Sports Committee members. Please log in with your committee credentials from the tournament portal.</p>
    <a href="/?login=committee" class="btn">Log In as Sports Committee</a>
  </div>
</body>
</html>`);
});

// Also serve public directory as static backup
const publicDir = path.resolve(process.cwd(), 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/docs')) return next();
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
