import type { Request, Response, NextFunction } from 'express';
import { DatabaseClient, getDatabase } from '../db/client.js';

// ==========================================
// 1. Types & Interfaces
// ==========================================

export type UserRole = 'spectator' | 'referee' | 'admin';

export interface AuthUser {
  id: string;
  role: UserRole;
  name?: string;
  email?: string;
}

export type Permission =
  | 'sports:read'
  | 'contingent:read'
  | 'matches:read'
  | 'matches:create'
  | 'matches:update'
  | 'matches:timer'
  | 'matches:events:create'
  | 'matches:events:delete'
  | 'matches:submit'
  | 'matches:verify'
  | 'matches:publish'
  | 'matches:reject'
  | 'admin:verifications:read'
  | 'standings:read';

// Augment Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      match?: any;
    }
  }
}

// ==========================================
// 2. Role Permission Matrix
// ==========================================

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    'sports:read',
    'contingent:read',
    'matches:read',
    'matches:create',
    'matches:update',
    'matches:timer',
    'matches:events:create',
    'matches:events:delete',
    'matches:submit',
    'matches:verify',
    'matches:publish',
    'matches:reject',
    'admin:verifications:read',
    'standings:read',
  ],
  referee: [
    'sports:read',
    'contingent:read',
    'matches:read',
    'matches:timer',
    'matches:events:create',
    'matches:events:delete',
    'matches:submit',
    'standings:read',
  ],
  spectator: [
    'sports:read',
    'contingent:read',
    'matches:read',
    'standings:read',
  ],
};

// ==========================================
// 3. Helper Functions
// ==========================================

/**
 * Normalizes raw role string to standard UserRole.
 */
export function normalizeRole(rawRole: unknown): UserRole | null {
  if (typeof rawRole !== 'string') return null;
  const cleaned = rawRole.trim().toLowerCase();
  if (cleaned === 'admin' || cleaned === 'referee' || cleaned === 'spectator') {
    return cleaned as UserRole;
  }
  return null;
}

/**
 * Checks if a given role possesses a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Compares match referee_id with request user_id, supporting usr- prefix aliasing.
 */
export function matchesRefereeId(
  matchRefereeId: string | null | undefined,
  reqUserId: string | null | undefined
): boolean {
  if (!matchRefereeId || !reqUserId) return false;
  if (matchRefereeId === reqUserId) return true;
  const mNorm = matchRefereeId.replace(/^usr-/, '');
  const uNorm = reqUserId.replace(/^usr-/, '');
  return mNorm === uNorm;
}

/**
 * Ensures user exists in SQLite users table to satisfy foreign key constraints.
 */
export function ensureUserExists(
  dbClient: DatabaseClient,
  userId: string,
  role: UserRole
): void {
  try {
    const existing = dbClient.queryOne<{ id: string }>('SELECT id FROM users WHERE id = ?', [userId]);
    if (!existing) {
      const roleUpper = role.toUpperCase();
      const name = role === 'admin'
        ? `Admin (${userId})`
        : role === 'referee'
        ? `Referee (${userId})`
        : `Spectator (${userId})`;
      const email = `${userId.toLowerCase()}@sports.xlridelhi.ac.in`;
      dbClient.execute(
        'INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)',
        [userId, name, email, roleUpper]
      );
    }
  } catch {
    // Gracefully handle if users table is not initialized yet
  }
}

/**
 * Extracts and validates AuthUser from request headers:
 * - 'x-user-role': 'admin' | 'referee' | 'spectator'
 * - 'x-user-id': string
 */
export function extractUser(req: Request, dbClient?: DatabaseClient): AuthUser | null {
  const rawRole = req.headers['x-user-role'];
  const rawId = req.headers['x-user-id'];

  const role = normalizeRole(rawRole);
  if (!role) return null;

  const id = typeof rawId === 'string' && rawId.trim() !== ''
    ? rawId.trim()
    : `${role}-1`;

  const client = dbClient || getDatabase();
  ensureUserExists(client, id, role);

  return { id, role };
}

// ==========================================
// 4. Middleware Hooks
// ==========================================

/**
 * Global auth extractor middleware. Attaches req.user if headers are valid.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const user = extractUser(req);
    if (user) {
      req.user = user;
    }
  } catch (err) {
    console.error('[authMiddleware] extraction error:', err);
  }
  next();
}

/**
 * Requires an authenticated user (rejects anonymous requests).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized: Authentication credentials required via x-user-role and x-user-id headers',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  next();
}

/**
 * Requires user to have one of the specified roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized: Missing user authentication',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Action requires one of roles [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}

/**
 * Requires admin role shortcut.
 */
export const requireAdmin = requireRole('admin');

/**
 * Requires admin OR assigned referee for the target match.
 * Pre-loads and caches match onto req.match.
 */
export function requireMatchRefereeOrAdmin(dbClient?: DatabaseClient) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized: Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const matchId = req.params.id || req.params.matchId;
    if (!matchId) {
      res.status(400).json({ error: 'Missing match ID in route parameters', code: 'BAD_REQUEST' });
      return;
    }

    const client = dbClient || getDatabase();
    const match = client.queryOne<any>('SELECT * FROM matches WHERE id = ?', [matchId]);

    if (!match) {
      res.status(404).json({ error: `Match ${matchId} not found`, code: 'NOT_FOUND' });
      return;
    }

    req.match = match;

    // Admin has universal authority
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Referee must be assigned to this match
    if (req.user.role === 'referee') {
      if (matchesRefereeId(match.referee_id, req.user.id)) {
        next();
        return;
      }
      res.status(403).json({
        error: `Forbidden: Referee ${req.user.id} is not assigned to match ${matchId} (assigned: ${match.referee_id || 'none'})`,
        code: 'FORBIDDEN_UNASSIGNED_REFEREE',
      });
      return;
    }

    // Spectator or other
    res.status(403).json({
      error: 'Forbidden: Insufficient privileges for match operation',
      code: 'FORBIDDEN',
    });
  };
}

/**
 * Enforces match state lock: mutations only permitted in Draft or Scheduled status.
 */
export function requireMatchDraftState(req: Request, res: Response, next: NextFunction): void {
  const match = req.match;
  if (!match) {
    res.status(500).json({ error: 'Match context missing from request', code: 'INTERNAL_ERROR' });
    return;
  }

  const status = String(match.status).toUpperCase();
  if (status === 'SUBMITTED' || status === 'VERIFIED' || status === 'PUBLISHED' || status === 'CANCELLED') {
    res.status(400).json({
      error: `Scorecard is locked against modifications. Match status is ${match.status}.`,
      code: 'SCORECARD_LOCKED',
    });
    return;
  }

  next();
}
