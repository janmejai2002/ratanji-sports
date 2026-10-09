import { Router, type Request, type Response } from 'express';
import { getDatabase } from '../db/client.js';
import {
  extractUser,
  normalizeRole,
  ROLE_PERMISSIONS,
  ensureUserExists,
  type UserRole,
} from '../services/rbac.js';

export const authRouter = Router();

/**
 * GET /api/auth/me
 * Returns current authenticated session details and active permissions.
 */
authRouter.get('/me', (req: Request, res: Response) => {
  const user = req.user || extractUser(req);

  if (!user) {
    res.json({
      authenticated: false,
      user: {
        id: 'anonymous',
        role: 'spectator' as UserRole,
        name: 'Public Spectator',
      },
      permissions: ROLE_PERMISSIONS.spectator,
    });
    return;
  }

  const db = getDatabase();
  const dbUser = db.queryOne<any>('SELECT * FROM users WHERE id = ?', [user.id]);

  res.json({
    authenticated: true,
    user: {
      id: user.id,
      role: user.role,
      name: dbUser?.name || `${user.role.toUpperCase()} (${user.id})`,
      email: dbUser?.email || `${user.id.toLowerCase()}@sports.xlridelhi.ac.in`,
    },
    permissions: ROLE_PERMISSIONS[user.role],
  });
});

/**
 * GET /api/auth/users
 * Returns list of simulated user accounts available for fast switching in UI.
 */
authRouter.get('/users', (_req: Request, res: Response) => {
  const db = getDatabase();
  const dbUsers = db.query<any>('SELECT id, name, email, role FROM users ORDER BY role ASC, id ASC');

  // Ensure default test users are included in switchable list
  const defaults = [
    { id: 'admin-1', name: 'Sports Committee Admin', email: 'admin@sports.xlridelhi.ac.in', role: 'ADMIN' },
    { id: 'ref-1', name: 'Rohan Verma (Referee 1)', email: 'rohan.ref@xlridelhi.ac.in', role: 'REFEREE' },
    { id: 'ref-2', name: 'Pooja Sharma (Referee 2)', email: 'pooja.ref@xlridelhi.ac.in', role: 'REFEREE' },
    { id: 'ref-3', name: 'Amitabh Sen (Referee 3)', email: 'amitabh.ref@xlridelhi.ac.in', role: 'REFEREE' },
    { id: 'spec-1', name: 'Public Spectator', email: 'spectator@xlridelhi.ac.in', role: 'SPECTATOR' },
  ];

  const map = new Map<string, any>();
  for (const d of defaults) map.set(d.id, d);
  for (const u of dbUsers) map.set(u.id, u);

  res.json(Array.from(map.values()));
});

/**
 * POST /api/auth/switch
 * Simulated login / role switch returning credentials for headers.
 */
authRouter.post('/switch', (req: Request, res: Response) => {
  const { role: rawRole, userId } = req.body || {};
  const role = normalizeRole(rawRole);

  if (!role) {
    res.status(400).json({
      error: "Invalid role. Must be 'admin', 'referee', or 'spectator'",
      code: 'BAD_REQUEST',
    });
    return;
  }

  const id = typeof userId === 'string' && userId.trim() !== ''
    ? userId.trim()
    : `${role}-1`;

  const db = getDatabase();
  ensureUserExists(db, id, role);
  const dbUser = db.queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);

  res.json({
    success: true,
    user: {
      id,
      role,
      name: dbUser?.name || `${role.toUpperCase()} (${id})`,
      email: dbUser?.email || `${id.toLowerCase()}@sports.xlridelhi.ac.in`,
    },
    headers: {
      'x-user-role': role,
      'x-user-id': id,
    },
    permissions: ROLE_PERMISSIONS[role],
  });
});

/**
 * GET /api/auth/roles
 * Returns capability catalog for all three supported roles.
 */
authRouter.get('/roles', (_req: Request, res: Response) => {
  res.json({
    roles: [
      {
        id: 'spectator',
        name: 'Public Spectator',
        description: 'Read-only access to live match centers, contingent directories, and championship standings.',
        permissions: ROLE_PERMISSIONS.spectator,
      },
      {
        id: 'referee',
        name: 'Assigned Referee',
        description: 'Controls timers, logs scoring events, and submits scorecards for assigned matches in Draft status.',
        permissions: ROLE_PERMISSIONS.referee,
      },
      {
        id: 'admin',
        name: 'Sports Committee Admin',
        description: 'Full tournament administration: scheduling, referee assignments, verification approvals, score publications, and rejections.',
        permissions: ROLE_PERMISSIONS.admin,
      },
    ],
  });
});

/**
 * Predefined Shareable Accounts for Sports Committee Demo
 */
export interface PredefinedAccount {
  id: string;
  name: string;
  email: string;
  aliases: string[];
  password: string;
  role: UserRole;
  badge: string;
  description: string;
}

export const PREDEFINED_ACCOUNTS: PredefinedAccount[] = [
  {
    id: 'usr-admin-1',
    name: 'Sports Committee Admin',
    email: 'admin@sports.xlridelhi.ac.in',
    aliases: ['admin@xlri.edu', 'admin', 'committee', 'usr-admin-1', 'admin-1'],
    password: 'xlri-admin-2026',
    role: 'admin',
    badge: 'Committee Executive',
    description: 'Full authority: schedule matches, assign referees, audit scorecards, 1-click verify & publish to standings.',
  },
  {
    id: 'usr-ref-1',
    name: 'Rohan Verma (Official REF-023)',
    email: 'rohan.ref@xlridelhi.ac.in',
    aliases: ['referee@xlri.edu', 'referee', 'ref-1', 'usr-ref-1', 'umpire'],
    password: 'xlri-ref-2026',
    role: 'referee',
    badge: 'Official Referee / Umpire',
    description: 'On-field scoring console: match clock, whistle sound synthesizer, +Goal/+Point/+Card logging, and scorecard submission.',
  },
  {
    id: 'ply-26bm001',
    name: 'Kabir Mehta (Senior Contingent Lead)',
    email: 'captain@sports.xlridelhi.ac.in',
    aliases: ['captain@xlri.edu', 'captain', 'senior', 'ply-26bm001'],
    password: 'xlri-play-2026',
    role: 'spectator',
    badge: 'Contingent Captain',
    description: 'Seniors Batch 2026 contingent athlete: roster management, contingent stats, injury tracker, and player profile.',
  },
];

/**
 * POST /api/auth/login
 * Validates predefined credentials and returns session user details and role headers.
 */
authRouter.post('/login', (req: Request, res: Response) => {
  const { username, email, password } = req.body || {};
  const query = (email || username || '').trim().toLowerCase();
  const pass = (password || '').trim();

  if (!query || !pass) {
    return res.status(400).json({
      error: 'Please provide both username/email and password.',
      code: 'MISSING_CREDENTIALS',
    });
  }

  const account = PREDEFINED_ACCOUNTS.find(
    (acc) =>
      acc.email.toLowerCase() === query ||
      acc.id.toLowerCase() === query ||
      acc.aliases.some((a) => a.toLowerCase() === query)
  );

  if (!account || account.password !== pass) {
    return res.status(401).json({
      error: 'Invalid username/email or password. Use one of the predefined committee demo accounts.',
      code: 'INVALID_CREDENTIALS',
    });
  }

  const db = getDatabase();
  ensureUserExists(db, account.id, account.role);

  res.json({
    success: true,
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      badge: account.badge,
    },
    headers: {
      'x-user-role': account.role,
      'x-user-id': account.id,
    },
    permissions: ROLE_PERMISSIONS[account.role],
  });
});

/**
 * GET /api/auth/credentials
 * Returns the shareable credentials cheat sheet and network link for demo sharing.
 */
authRouter.get('/credentials', (_req: Request, res: Response) => {
  res.json({
    accounts: PREDEFINED_ACCOUNTS,
    shareLink: 'http://10.1.57.20:5173',
    localLink: 'http://localhost:5173',
  });
});
