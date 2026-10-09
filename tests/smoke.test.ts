import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { DatabaseSync } from 'node:sqlite';

describe('Project Tooling & Scaffolding Smoke Test', () => {
  it('should respond to /api/health with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.node).toBeDefined();
  });

  it('should initialize native node:sqlite in-memory database with foreign keys', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(`
      CREATE TABLE test_cohorts (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE test_players (id TEXT PRIMARY KEY, cohort_id TEXT REFERENCES test_cohorts(id));
    `);

    db.prepare('INSERT INTO test_cohorts (id, name) VALUES (?, ?)').run('c1', 'Seniors');
    const result = db.prepare('INSERT INTO test_players (id, cohort_id) VALUES (?, ?)').run('p1', 'c1');
    expect(result.changes).toBe(1);

    const player = db.prepare('SELECT * FROM test_players WHERE id = ?').get('p1') as any;
    expect(player).toBeDefined();
    expect(player.cohort_id).toBe('c1');
    db.close();
  });
});
