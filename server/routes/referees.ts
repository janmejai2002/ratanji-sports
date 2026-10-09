import { Router, type Request, type Response } from 'express';
import { getDatabase } from '../db/client.js';
import { requireAdmin, ensureUserExists, ROLE_PERMISSIONS } from '../services/rbac.js';
import { PREDEFINED_ACCOUNTS } from './auth.js';

export const refereesRouter = Router();

// Derive a clean referee code (e.g. REF-023)
function formatRefereeCode(id: string, index: number = 1): string {
  if (id.includes('ref-1') || id.includes('023')) return 'REF-023';
  if (id.includes('ref-2') || id.includes('045')) return 'REF-045';
  if (id.includes('ref-3') || id.includes('012')) return 'REF-012';
  const num = id.replace(/[^0-9]/g, '');
  if (num) {
    return `REF-${num.padStart(3, '0')}`;
  }
  return `REF-${String(index + 20).padStart(3, '0')}`;
}

/**
 * GET /api/referees
 * Returns certified tournament referees with their assigned fixtures count.
 */
refereesRouter.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const rows = db.query<any>("SELECT * FROM users WHERE UPPER(role) = 'REFEREE' ORDER BY id ASC");

    // Ensure default referees exist in DB if empty
    if (rows.length === 0) {
      const defaults = [
        { id: 'usr-ref-1', name: 'Rohan Verma', email: 'rohan.ref@xlridelhi.ac.in', role: 'REFEREE' },
        { id: 'usr-ref-2', name: 'Pooja Sharma', email: 'pooja.ref@xlridelhi.ac.in', role: 'REFEREE' },
        { id: 'usr-ref-3', name: 'Amitabh Sen', email: 'amitabh.ref@xlridelhi.ac.in', role: 'REFEREE' },
      ];
      for (const d of defaults) {
        ensureUserExists(db, d.id, 'referee');
      }
    }

    const currentRows = db.query<any>("SELECT * FROM users WHERE UPPER(role) = 'REFEREE' ORDER BY id ASC");
    const allMatches = db.query<any>("SELECT id, sport_id, referee_id, venue, status, score_home, score_away FROM matches");

    const referees = currentRows.map((r, idx) => {
      const code = formatRefereeCode(r.id, idx + 1);
      const cleanId = r.id.replace(/^usr-/, '');
      const assignedMatches = allMatches.filter(
        (m) => m.referee_id === r.id || m.referee_id === `usr-${cleanId}` || m.referee_id === cleanId
      );

      return {
        id: r.id,
        code,
        name: r.name,
        email: r.email,
        role: 'REFEREE',
        sport_specialty: idx === 0 ? 'Football & Futsal' : idx === 1 ? 'Basketball & Volleyball' : 'Racquet Sports & Cricket',
        assigned_matches_count: assignedMatches.length,
        assigned_matches: assignedMatches.map((m) => ({
          id: m.id,
          sport_id: m.sport_id,
          venue: m.venue,
          status: m.status,
          score: `${m.score_home} - ${m.score_away}`,
        })),
        created_at: r.created_at,
      };
    });

    res.json(referees);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve referees', message: err.message });
  }
});

/**
 * POST /api/referees
 * Sports Committee registers a new referee and generates an official Referee ID.
 * Allowed: Admin only.
 */
refereesRouter.post('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const { name, email, sport_specialty } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Referee name is required.' });
    }

    const db = getDatabase();
    const cleanName = name.trim();

    // Generate unique code & id
    const existingRefs = db.query<any>("SELECT id FROM users WHERE UPPER(role) = 'REFEREE'");
    const nextNum = existingRefs.length + 10;
    const randomSuffix = Math.floor(10 + Math.random() * 89);
    const code = `REF-${String(nextNum + randomSuffix).padStart(3, '0')}`;
    const id = `usr-ref-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const cleanEmail = email && typeof email === 'string' && email.trim() !== ''
      ? email.trim()
      : `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}.ref@xlridelhi.ac.in`;

    db.execute(
      "INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, 'REFEREE')",
      [id, cleanName, cleanEmail]
    );

    // Register into PREDEFINED_ACCOUNTS so password login also works with standard password
    PREDEFINED_ACCOUNTS.push({
      id,
      name: `${cleanName} (Official ${code})`,
      email: cleanEmail,
      aliases: [code.toLowerCase(), id.toLowerCase(), cleanName.toLowerCase()],
      password: 'xlri-ref-2026',
      role: 'referee',
      badge: 'Official Referee / Umpire',
      description: `Certified official for ${sport_specialty || 'General Tournament Events'}`,
    });

    res.status(201).json({
      success: true,
      referee: {
        id,
        code,
        name: cleanName,
        email: cleanEmail,
        sport_specialty: sport_specialty || 'General Sports',
        role: 'REFEREE',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create referee', message: err.message });
  }
});

/**
 * POST /api/referees/login
 * Direct referee pass login: allows entering referee code/ID from the base screen.
 */
refereesRouter.post('/login', (req: Request, res: Response) => {
  try {
    const { code_or_id } = req.body || {};
    const query = String(code_or_id || '').trim().toLowerCase();

    if (!query) {
      return res.status(400).json({ error: 'Please enter your Referee ID or official code.' });
    }

    const db = getDatabase();
    const cleanCode = query.toUpperCase();

    // Check by ID or matching format
    let user = db.queryOne<any>(
      "SELECT * FROM users WHERE UPPER(role) = 'REFEREE' AND (LOWER(id) = ? OR LOWER(id) = 'usr-' || ? OR LOWER(email) = ? OR LOWER(name) LIKE ?)",
      [query, query, query, `%${query}%`]
    );

    // Check predefined
    if (!user) {
      const matchPredefined = PREDEFINED_ACCOUNTS.find(
        (a) => a.role === 'referee' && (
          a.id.toLowerCase() === query ||
          a.email.toLowerCase() === query ||
          a.name.toLowerCase().includes(query) ||
          a.aliases.some((al) => al.toLowerCase() === query)
        )
      );
      if (matchPredefined) {
        ensureUserExists(db, matchPredefined.id, 'referee');
        user = db.queryOne<any>("SELECT * FROM users WHERE id = ?", [matchPredefined.id]);
      }
    }

    // Default fallback to ref-1 if code is generic or starts with REF-
    if (!user && (cleanCode.startsWith('REF-') || query === 'referee' || query === 'umpire')) {
      user = db.queryOne<any>("SELECT * FROM users WHERE UPPER(role) = 'REFEREE' LIMIT 1");
    }

    if (!user) {
      return res.status(404).json({
        error: `Referee ID "${code_or_id}" not found in sports committee registry. Check your assigned ID or ask Sports Committee.`,
      });
    }

    const code = formatRefereeCode(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'referee',
        badge: `Official Referee (${code})`,
        code,
      },
      headers: {
        'x-user-role': 'referee',
        'x-user-id': user.id,
      },
      permissions: ROLE_PERMISSIONS.referee,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to authenticate referee', message: err.message });
  }
});
