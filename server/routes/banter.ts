import { Router, type Request, type Response } from 'express';
import db from '../db/client.js';
import { broadcaster } from '../realtime/broadcaster.js';

export const banterRouter = Router();

// Ensure banter tables exist in SQLite
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS banter_posts (
      id TEXT PRIMARY KEY,
      author TEXT NOT NULL,
      batch TEXT NOT NULL,
      text TEXT NOT NULL,
      cooked INTEGER NOT NULL DEFAULT 0,
      savage INTEGER NOT NULL DEFAULT 0,
      w INTEGER NOT NULL DEFAULT 0,
      ratio INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campus_hype (
      cohort_id TEXT PRIMARY KEY,
      hype_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO campus_hype (cohort_id, hype_count) VALUES ('cohort-seniors', 0);
    INSERT OR IGNORE INTO campus_hype (cohort_id, hype_count) VALUES ('cohort-juniors', 0);
  `);
} catch (err) {
  console.error('[Banter Router] Error creating tables:', err);
}

/**
 * GET /api/banter
 * Returns all campus banter posts ordered by creation time descending.
 */
banterRouter.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.query<any>(`
      SELECT id, author, batch, text, cooked, savage, w, ratio, created_at
      FROM banter_posts
      ORDER BY datetime(created_at) DESC
      LIMIT 100
    `);

    const posts = rows.map((r) => ({
      id: r.id,
      author: r.author,
      batch: r.batch,
      text: r.text,
      time: formatRelativeTime(r.created_at),
      created_at: r.created_at,
      reactions: {
        cooked: r.cooked || 0,
        savage: r.savage || 0,
        w: r.w || 0,
        ratio: r.ratio || 0,
      },
    }));

    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve banter feed', message: err.message });
  }
});

/**
 * POST /api/banter
 * Posts a new campus banter message.
 */
banterRouter.post('/', (req: Request, res: Response) => {
  try {
    const { author, batch, text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const cleanBatch = batch === 'Junior' ? 'Junior' : 'Senior';
    const cleanAuthor =
      author && typeof author === 'string' && author.trim()
        ? author.trim()
        : cleanBatch === 'Senior'
        ? 'Senior Fan (BM 26)'
        : 'Junior Fan (HRM 27)';
    const cleanText = text.trim().slice(0, 500); // 500 char max
    const id = 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const createdAt = new Date().toISOString();

    db.execute(
      `
      INSERT INTO banter_posts (id, author, batch, text, cooked, savage, w, ratio, created_at)
      VALUES (?, ?, ?, ?, 0, 0, 1, 0, ?)
    `,
      [id, cleanAuthor, cleanBatch, cleanText, createdAt]
    );

    const post = {
      id,
      author: cleanAuthor,
      batch: cleanBatch,
      text: cleanText,
      time: 'Just now',
      created_at: createdAt,
      reactions: { cooked: 0, savage: 0, w: 1, ratio: 0 },
    };

    broadcaster.broadcast('all', {
      type: 'BANTER_POST',
      post,
    });

    res.status(201).json(post);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create banter post', message: err.message });
  }
});

/**
 * POST /api/banter/:id/react
 * Increments an emotion reaction on a banter post.
 */
banterRouter.post('/:id/react', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.body || {};

    const validTypes = ['cooked', 'savage', 'w', 'ratio'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const post = db.queryOne<any>('SELECT * FROM banter_posts WHERE id = ?', [id]);
    if (!post) {
      return res.status(404).json({ error: 'Banter post not found' });
    }

    db.execute(`UPDATE banter_posts SET ${type} = ${type} + 1 WHERE id = ?`, [id]);

    const updated = db.queryOne<any>('SELECT cooked, savage, w, ratio FROM banter_posts WHERE id = ?', [id]);

    broadcaster.broadcast('all', {
      type: 'BANTER_REACTION',
      banterId: id,
      reactions: updated,
    });

    res.json({ success: true, reactions: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to register reaction', message: err.message });
  }
});

/**
 * GET /api/banter/hype
 * Returns current campus cheer counts.
 */
banterRouter.get('/hype', (_req: Request, res: Response) => {
  try {
    const seniorRow = db.queryOne<{ hype_count: number }>(
      "SELECT hype_count FROM campus_hype WHERE cohort_id = 'cohort-seniors'"
    );
    const juniorRow = db.queryOne<{ hype_count: number }>(
      "SELECT hype_count FROM campus_hype WHERE cohort_id = 'cohort-juniors'"
    );

    const seniorHype = seniorRow?.hype_count || 0;
    const juniorHype = juniorRow?.hype_count || 0;

    res.json({
      seniorHype,
      juniorHype,
      totalHype: seniorHype + juniorHype,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get campus hype', message: err.message });
  }
});

/**
 * POST /api/banter/hype
 * Increments cheer points for either Seniors or Juniors.
 */
banterRouter.post('/hype', (req: Request, res: Response) => {
  try {
    const { batch, amount } = req.body || {};
    const cohortId = batch === 'Junior' ? 'cohort-juniors' : 'cohort-seniors';
    const inc = typeof amount === 'number' && amount > 0 && amount <= 50 ? amount : 12;

    db.execute(
      `
      INSERT INTO campus_hype (cohort_id, hype_count, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(cohort_id) DO UPDATE SET
        hype_count = hype_count + ?,
        updated_at = datetime('now')
    `,
      [cohortId, inc, inc]
    );

    const seniorRow = db.queryOne<{ hype_count: number }>(
      "SELECT hype_count FROM campus_hype WHERE cohort_id = 'cohort-seniors'"
    );
    const juniorRow = db.queryOne<{ hype_count: number }>(
      "SELECT hype_count FROM campus_hype WHERE cohort_id = 'cohort-juniors'"
    );

    const seniorHype = seniorRow?.hype_count || 0;
    const juniorHype = juniorRow?.hype_count || 0;
    const data = {
      seniorHype,
      juniorHype,
      totalHype: seniorHype + juniorHype,
    };

    broadcaster.broadcast('all', {
      type: 'HYPE_UPDATE',
      ...data,
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record cheer', message: err.message });
  }
});

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch {
    return 'Recently';
  }
}
