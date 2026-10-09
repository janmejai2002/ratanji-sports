import { Router, type Request, type Response } from 'express';
import db from '../db/client.js';

export const sportsRouter = Router();

sportsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.query<any>('SELECT * FROM sports ORDER BY id ASC');
    const sports = rows.map((s) => {
      let rules = {};
      try {
        rules = JSON.parse(s.rules_json);
      } catch {}
      return {
        ...s,
        rules,
      };
    });
    res.json(sports);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve sports', message: err.message });
  }
});

sportsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const normalizedId = id.startsWith('sport-') ? id : `sport-${id}`;
    const row = db.queryOne<any>(
      'SELECT * FROM sports WHERE id = ? OR id = ? OR LOWER(name) = LOWER(?)',
      [id, normalizedId, id]
    );

    if (!row) {
      return res.status(404).json({ error: 'Sport not found' });
    }

    let rules = {};
    try {
      rules = JSON.parse(row.rules_json);
    } catch {}

    res.json({ ...row, rules });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve sport', message: err.message });
  }
});

/**
 * POST /api/sports
 * Add a new sport event to the tournament catalog.
 */
sportsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { name, category, scoring_type, rules } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Sport name is required.' });
    }

    const cleanName = name.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `sport-${slug}`;

    // Check for duplicate
    const existing = db.queryOne<any>('SELECT id FROM sports WHERE id = ? OR LOWER(name) = LOWER(?)', [id, cleanName]);
    if (existing) {
      return res.status(409).json({ error: `Sport "${cleanName}" already exists.` });
    }

    const cleanCat = category ? category.trim() : 'Court';
    const cleanScoring = scoring_type ? String(scoring_type).toUpperCase() : 'GENERIC';
    const rulesJson = typeof rules === 'object' ? JSON.stringify(rules) : (typeof rules === 'string' ? rules : '{}');

    db.execute(`
      INSERT INTO sports (id, name, category, scoring_type, rules_json)
      VALUES (?, ?, ?, ?, ?)
    `, [id, cleanName, cleanCat, cleanScoring, rulesJson]);

    const created = db.queryOne<any>('SELECT * FROM sports WHERE id = ?', [id]);
    res.status(201).json({
      success: true,
      sport: {
        ...created,
        rules: typeof rules === 'object' ? rules : {},
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add sports event', message: err.message });
  }
});

/**
 * PUT /api/sports/:id
 * Update an existing sport event.
 */
sportsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const normalizedId = id.startsWith('sport-') ? id : `sport-${id}`;
    const existing = db.queryOne<any>('SELECT * FROM sports WHERE id = ?', [normalizedId]);
    if (!existing) {
      return res.status(404).json({ error: `Sport ${id} not found.` });
    }

    const { name, category, scoring_type, rules } = req.body || {};
    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedCat = category !== undefined ? category.trim() : existing.category;
    const updatedScoring = scoring_type !== undefined ? String(scoring_type).toUpperCase() : existing.scoring_type;
    const updatedRules = rules !== undefined
      ? (typeof rules === 'object' ? JSON.stringify(rules) : String(rules))
      : existing.rules_json;

    db.execute(`
      UPDATE sports
      SET name = ?, category = ?, scoring_type = ?, rules_json = ?
      WHERE id = ?
    `, [updatedName, updatedCat, updatedScoring, updatedRules, normalizedId]);

    const updated = db.queryOne<any>('SELECT * FROM sports WHERE id = ?', [normalizedId]);
    res.json({ success: true, sport: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update sports event', message: err.message });
  }
});

/**
 * DELETE /api/sports/:id
 * Remove a sport event from the tournament catalog.
 */
sportsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const normalizedId = id.startsWith('sport-') ? id : `sport-${id}`;
    const existing = db.queryOne<any>('SELECT * FROM sports WHERE id = ?', [normalizedId]);
    if (!existing) {
      return res.status(404).json({ error: `Sport ${id} not found.` });
    }

    db.execute('DELETE FROM sports WHERE id = ?', [normalizedId]);
    res.json({ success: true, message: `Sport "${existing.name}" removed.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete sport', message: err.message });
  }
});
