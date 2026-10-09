import { Router, type Request, type Response } from 'express';
import db from '../db/client.js';

export const rostersRouter = Router();

rostersRouter.get('/', (req: Request, res: Response) => {
  try {
    const { cohort, sport, status, search } = req.query;

    let sql = `
      SELECT p.id, p.cohort_id, c.name AS cohort_name, c.batch AS cohort_batch, c.color AS cohort_color,
             p.name, p.student_id, p.jersey_number,
             p.primary_sport_id, s.name AS sport_name,
             p.secondary_sport_id, p.position, p.status, p.stats_json
      FROM players p
      JOIN cohorts c ON p.cohort_id = c.id
      JOIN sports s ON p.primary_sport_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter: Cohort
    if (cohort) {
      const cStr = String(cohort).toLowerCase();
      if (cStr === 'seniors' || cStr === 'cohort-seniors') {
        sql += " AND p.cohort_id = 'cohort-seniors'";
      } else if (cStr === 'juniors' || cStr === 'cohort-juniors') {
        sql += " AND p.cohort_id = 'cohort-juniors'";
      } else {
        sql += ' AND (p.cohort_id = ? OR LOWER(c.name) = ?)';
        params.push(cohort, cStr);
      }
    }

    // Filter: Sport
    if (sport) {
      const sStr = String(sport).toLowerCase();
      const normalizedSportId = sStr.startsWith('sport-') ? sStr : `sport-${sStr}`;
      sql += ' AND (p.primary_sport_id = ? OR p.secondary_sport_id = ? OR LOWER(s.name) = ? OR LOWER(s.name) = LOWER(?))';
      params.push(normalizedSportId, normalizedSportId, sStr, sStr);
    }

    // Filter: Status (Case-Insensitive)
    if (status && String(status).toLowerCase() !== 'all') {
      const st = String(status).toUpperCase();
      sql += ' AND UPPER(p.status) = ?';
      params.push(st);
    }

    // Filter: Search (Safe parameterized query)
    if (search !== undefined && String(search).trim().length > 0) {
      const q = `%${String(search).trim()}%`;
      sql += ` AND (
        p.name LIKE ? OR
        p.student_id LIKE ? OR
        p.position LIKE ? OR
        c.name LIKE ? OR
        s.name LIKE ?
      )`;
      params.push(q, q, q, q, q);
    }

    sql += ' ORDER BY p.name ASC';

    const rows = db.query<any>(sql, params);

    const players = rows.map((p) => {
      let stats = {};
      try {
        stats = JSON.parse(p.stats_json);
      } catch {}

      // Normalize status to Title Case ('Active' | 'Injured') as required by tests
      const normalizedStatus = String(p.status).toUpperCase() === 'INJURED' ? 'Injured' : 'Active';

      return {
        id: p.id,
        cohort_id: p.cohort_id,
        cohort: p.cohort_name,
        cohort_name: p.cohort_name,
        cohort_batch: p.cohort_batch,
        cohort_color: p.cohort_color,
        name: p.name,
        student_id: p.student_id,
        jersey_number: p.jersey_number,
        primary_sport_id: p.primary_sport_id,
        sport_id: p.primary_sport_id,
        sport_name: p.sport_name,
        secondary_sport_id: p.secondary_sport_id,
        position: p.position,
        status: normalizedStatus,
        stats_json: p.stats_json,
        stats,
      };
    });

    res.json({
      players,
      total: players.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to query players', message: err.message });
  }
});

rostersRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const p = db.queryOne<any>(`
      SELECT p.id, p.cohort_id, c.name AS cohort_name, c.batch AS cohort_batch,
             p.name, p.student_id, p.jersey_number,
             p.primary_sport_id, s.name AS sport_name,
             p.secondary_sport_id, p.position, p.status, p.stats_json
      FROM players p
      JOIN cohorts c ON p.cohort_id = c.id
      JOIN sports s ON p.primary_sport_id = s.id
      WHERE p.id = ? OR p.student_id = ?
    `, [id, id]);

    if (!p) {
      return res.status(404).json({ error: 'Player not found' });
    }

    let stats = {};
    try {
      stats = JSON.parse(p.stats_json);
    } catch {}

    const normalizedStatus = String(p.status).toUpperCase() === 'INJURED' ? 'Injured' : 'Active';

    res.json({
      ...p,
      status: normalizedStatus,
      cohort: p.cohort_name,
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve player', message: err.message });
  }
});

/**
 * POST /api/contingent/players
 * Add a new student athlete to a squad / contingent.
 */
rostersRouter.post('/players', (req: Request, res: Response) => {
  try {
    const {
      name,
      cohort_id,
      student_id,
      jersey_number,
      primary_sport_id,
      secondary_sport_id,
      position,
      status,
      stats,
    } = req.body || {};

    if (!name || !primary_sport_id) {
      return res.status(400).json({ error: 'Player name and primary sport are required.' });
    }

    const resolvedCohort = cohort_id
      ? (cohort_id.startsWith('cohort-') ? cohort_id : `cohort-${cohort_id}`)
      : 'cohort-seniors';

    const resolvedSport = primary_sport_id.startsWith('sport-')
      ? primary_sport_id
      : `sport-${primary_sport_id}`;

    const id = 'ply-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const sId = student_id || ('STU' + Math.floor(1000 + Math.random() * 9000));
    const jersey = jersey_number !== undefined && jersey_number !== null ? Number(jersey_number) : 0;
    const playerStatus = (status && String(status).toUpperCase() === 'INJURED') ? 'INJURED' : 'ACTIVE';
    const statsJson = stats ? JSON.stringify(stats) : '{}';

    db.execute(`
      INSERT INTO players (
        id, cohort_id, name, student_id, jersey_number,
        primary_sport_id, secondary_sport_id, position, status, stats_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      resolvedCohort,
      name.trim(),
      sId,
      jersey,
      resolvedSport,
      secondary_sport_id || null,
      position || 'Player',
      playerStatus,
      statsJson,
    ]);

    const created = db.queryOne<any>('SELECT * FROM players WHERE id = ?', [id]);
    res.status(201).json({
      success: true,
      player: created,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create player', message: err.message });
  }
});

/**
 * PUT /api/contingent/players/:id
 * Edit athlete details (name, jersey number, position, sport, injury status).
 */
rostersRouter.put('/players/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.queryOne<any>('SELECT * FROM players WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: `Player ${id} not found.` });
    }

    const {
      name,
      jersey_number,
      position,
      status,
      primary_sport_id,
      cohort_id,
      student_id,
    } = req.body || {};

    const resolvedName = name !== undefined ? name.trim() : existing.name;
    const resolvedJersey = jersey_number !== undefined ? Number(jersey_number) : existing.jersey_number;
    const resolvedPosition = position !== undefined ? position.trim() : existing.position;
    const resolvedStatus = status !== undefined
      ? (String(status).toUpperCase() === 'INJURED' ? 'INJURED' : 'ACTIVE')
      : existing.status;
    const resolvedSport = primary_sport_id !== undefined
      ? (primary_sport_id.startsWith('sport-') ? primary_sport_id : `sport-${primary_sport_id}`)
      : existing.primary_sport_id;
    const resolvedCohort = cohort_id !== undefined
      ? (cohort_id.startsWith('cohort-') ? cohort_id : `cohort-${cohort_id}`)
      : existing.cohort_id;
    const resolvedStudentId = student_id !== undefined ? student_id : existing.student_id;

    db.execute(`
      UPDATE players
      SET name = ?,
          jersey_number = ?,
          position = ?,
          status = ?,
          primary_sport_id = ?,
          cohort_id = ?,
          student_id = ?
      WHERE id = ?
    `, [
      resolvedName,
      resolvedJersey,
      resolvedPosition,
      resolvedStatus,
      resolvedSport,
      resolvedCohort,
      resolvedStudentId,
      id,
    ]);

    const updated = db.queryOne<any>('SELECT * FROM players WHERE id = ?', [id]);
    res.json({
      success: true,
      player: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update player', message: err.message });
  }
});

/**
 * DELETE /api/contingent/players/:id
 * Remove athlete from contingent roster.
 */
rostersRouter.delete('/players/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.queryOne<any>('SELECT * FROM players WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: `Player ${id} not found.` });
    }

    db.execute('DELETE FROM players WHERE id = ?', [id]);
    res.json({ success: true, message: `Player ${existing.name} removed from squad.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete player', message: err.message });
  }
});

/**
 * PUT /api/contingent/cohorts/:id
 * Set / edit team cohort metadata (name, batch, color).
 */
rostersRouter.put('/cohorts/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resolvedId = id.startsWith('cohort-') ? id : `cohort-${id}`;
    const existing = db.queryOne<any>('SELECT * FROM cohorts WHERE id = ?', [resolvedId]);
    if (!existing) {
      return res.status(404).json({ error: `Cohort ${id} not found.` });
    }

    const { name, batch, color } = req.body || {};
    db.execute(`
      UPDATE cohorts
      SET name = COALESCE(?, name),
          batch = COALESCE(?, batch),
          color = COALESCE(?, color)
      WHERE id = ?
    `, [name, batch, color, resolvedId]);

    const updated = db.queryOne<any>('SELECT * FROM cohorts WHERE id = ?', [resolvedId]);
    res.json({ success: true, cohort: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update cohort', message: err.message });
  }
});
