import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { initSchema } from '../server/db/schema.js';
import { seedDatabase } from '../server/db/seed.js';

describe('Tier 1: Database Schema & Seed Data Integrity', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    initSchema(db);
    seedDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('T1.1: should create all 9 normalized relational tables', () => {
    const rows = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `).all() as { name: string }[];

    const tableNames = rows.map((r) => r.name);
    const expectedTables = [
      'audit_logs',
      'cohorts',
      'match_events',
      'matches',
      'players',
      'sports',
      'standings',
      'tournaments',
      'users',
    ];

    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected);
    }
  });

  it('T1.2: should load exactly 1 tournament with year 2026', () => {
    const tournaments = db.prepare('SELECT * FROM tournaments').all() as any[];
    expect(tournaments).toHaveLength(1);
    expect(tournaments[0].id).toBe('tourn-xlri-2026');
    expect(tournaments[0].name).toContain('XLRI Delhi');
    expect(tournaments[0].year).toBe(2026);
  });

  it('T1.3: should load exactly 2 cohorts: Seniors and Juniors', () => {
    const cohorts = db.prepare('SELECT * FROM cohorts ORDER BY id ASC').all() as any[];
    expect(cohorts).toHaveLength(2);

    const seniors = cohorts.find((c) => c.id === 'cohort-seniors');
    const juniors = cohorts.find((c) => c.id === 'cohort-juniors');

    expect(seniors).toBeDefined();
    expect(seniors.name).toBe('Seniors');
    expect(seniors.batch).toContain('2026');

    expect(juniors).toBeDefined();
    expect(juniors.name).toBe('Juniors');
    expect(juniors.batch).toContain('2027');
  });

  it('T1.4: should load all 15 sports with valid categories and scoring engines', () => {
    const sports = db.prepare('SELECT * FROM sports').all() as any[];
    expect(sports).toHaveLength(15);

    const expectedSports = [
      'sport-football',
      'sport-cricket',
      'sport-basketball-m',
      'sport-basketball-f',
      'sport-volleyball',
      'sport-table-tennis',
      'sport-track-field-m',
      'sport-track-field-f',
      'sport-tennis',
      'sport-chess',
      'sport-badminton-m',
      'sport-badminton-f',
      'sport-pool',
      'sport-throwball',
      'sport-futsal',
    ];

    const sportIds = sports.map((s) => s.id);
    for (const expectedId of expectedSports) {
      expect(sportIds).toContain(expectedId);
    }

    // Verify rules_json is valid JSON
    for (const sport of sports) {
      expect(() => JSON.parse(sport.rules_json)).not.toThrow();
      expect(['FOOTBALL', 'CRICKET', 'BASKETBALL', 'BADMINTON', 'GENERIC']).toContain(
        sport.scoring_type.toUpperCase()
      );
    }
  });

  it('T1.5: should load 4 users: 1 Admin and 3 Referees', () => {
    const users = db.prepare('SELECT * FROM users').all() as any[];
    expect(users).toHaveLength(4);

    const admins = users.filter((u) => u.role.toUpperCase() === 'ADMIN');
    const referees = users.filter((u) => u.role.toUpperCase() === 'REFEREE');

    expect(admins).toHaveLength(1);
    expect(referees).toHaveLength(3);

    const emails = users.map((u) => u.email);
    expect(new Set(emails).size).toBe(4);
  });

  it('T1.6: should load 100+ players distributed between Seniors and Juniors', () => {
    const players = db.prepare('SELECT * FROM players').all() as any[];
    expect(players.length).toBeGreaterThanOrEqual(100);
    expect(players.length).toBe(154);

    const seniors = players.filter((p) => p.cohort_id === 'cohort-seniors');
    const juniors = players.filter((p) => p.cohort_id === 'cohort-juniors');

    expect(seniors.length).toBe(77);
    expect(juniors.length).toBe(77);
  });

  it('T1.7: should include at least 8 injured players with valid statuses', () => {
    const players = db.prepare('SELECT * FROM players').all() as any[];
    const injured = players.filter((p) => p.status.toUpperCase() === 'INJURED');
    const active = players.filter((p) => p.status.toUpperCase() === 'ACTIVE');

    expect(injured.length).toBeGreaterThanOrEqual(8);
    expect(injured.length).toBe(10);
    expect(active.length + injured.length).toBe(players.length);

    // Verify both cohorts have injured players
    const seniorInjured = injured.filter((p) => p.cohort_id === 'cohort-seniors');
    const juniorInjured = injured.filter((p) => p.cohort_id === 'cohort-juniors');
    expect(seniorInjured.length).toBeGreaterThanOrEqual(1);
    expect(juniorInjured.length).toBeGreaterThanOrEqual(1);
  });

  it('T1.8: should have unique student IDs matching XLRI conventions (26BM/26HR & 27BM/27HR)', () => {
    const players = db.prepare('SELECT student_id, cohort_id FROM players').all() as any[];
    const studentIds = players.map((p) => p.student_id);

    expect(new Set(studentIds).size).toBe(players.length);

    for (const player of players) {
      if (player.cohort_id === 'cohort-seniors') {
        expect(player.student_id.startsWith('26BM') || player.student_id.startsWith('26HR')).toBe(true);
      } else {
        expect(player.student_id.startsWith('27BM') || player.student_id.startsWith('27HR')).toBe(true);
      }
    }
  });

  it('T1.9: should verify foreign key integrity for all players (cohort and sport)', () => {
    const orphanCohorts = db.prepare(`
      SELECT p.id FROM players p
      LEFT JOIN cohorts c ON p.cohort_id = c.id
      WHERE c.id IS NULL
    `).all();
    expect(orphanCohorts).toHaveLength(0);

    const orphanSports = db.prepare(`
      SELECT p.id FROM players p
      LEFT JOIN sports s ON p.primary_sport_id = s.id
      WHERE s.id IS NULL
    `).all();
    expect(orphanSports).toHaveLength(0);
  });

  it('T1.10: should load 12 initial matches spanning all lifecycle states', () => {
    const matches = db.prepare('SELECT * FROM matches').all() as any[];
    expect(matches).toHaveLength(12);

    const statuses = matches.map((m) => m.status.toUpperCase());
    const expectedStates = ['PUBLISHED', 'VERIFIED', 'SUBMITTED', 'DRAFT', 'SCHEDULED'];

    for (const st of expectedStates) {
      const matching = statuses.filter((s) => s === st);
      expect(matching.length).toBeGreaterThanOrEqual(1);
    }

    // Verify state distribution
    expect(statuses.filter((s) => s === 'PUBLISHED')).toHaveLength(4);
    expect(statuses.filter((s) => s === 'VERIFIED')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'SUBMITTED')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'DRAFT')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'SCHEDULED')).toHaveLength(2);
  });

  it('T1.11: should verify foreign key integrity for matches (tournament, sport, cohorts, referees)', () => {
    const orphanMatches = db.prepare(`
      SELECT m.id FROM matches m
      LEFT JOIN tournaments t ON m.tournament_id = t.id
      LEFT JOIN sports s ON m.sport_id = s.id
      LEFT JOIN cohorts ch ON m.home_cohort_id = ch.id
      LEFT JOIN cohorts ca ON m.away_cohort_id = ca.id
      LEFT JOIN users u ON m.referee_id = u.id
      WHERE t.id IS NULL OR s.id IS NULL OR ch.id IS NULL OR ca.id IS NULL OR (m.referee_id IS NOT NULL AND u.id IS NULL)
    `).all();

    expect(orphanMatches).toHaveLength(0);
  });

  it('T1.12: should populate match events linked to existing matches and players', () => {
    const events = db.prepare('SELECT * FROM match_events').all() as any[];
    expect(events.length).toBeGreaterThanOrEqual(10);

    const orphanEvents = db.prepare(`
      SELECT e.id FROM match_events e
      LEFT JOIN matches m ON e.match_id = m.id
      LEFT JOIN players p ON e.player_id = p.id
      WHERE m.id IS NULL OR (e.player_id IS NOT NULL AND p.id IS NULL)
    `).all();

    expect(orphanEvents).toHaveLength(0);
  });

  it('T1.13: should record official standings reflecting only the 4 PUBLISHED matches', () => {
    const standings = db.prepare('SELECT * FROM standings ORDER BY total_points DESC').all() as any[];
    expect(standings).toHaveLength(2);

    const seniors = standings.find((s) => s.cohort_id === 'cohort-seniors');
    const juniors = standings.find((s) => s.cohort_id === 'cohort-juniors');

    expect(seniors).toBeDefined();
    expect(juniors).toBeDefined();

    // Published matches count = 4
    expect(seniors.played).toBe(4);
    expect(juniors.played).toBe(4);

    // Seniors: 2 wins (Football, Badminton M), 1 draw (Chess), 1 loss (Basketball M) = 2*3 + 1*1 = 7 pts
    expect(seniors.won).toBe(2);
    expect(seniors.drawn).toBe(1);
    expect(seniors.lost).toBe(1);
    expect(seniors.total_points).toBe(7);

    // Juniors: 1 win (Basketball M), 1 draw (Chess), 2 losses = 1*3 + 1*1 = 4 pts
    expect(juniors.won).toBe(1);
    expect(juniors.drawn).toBe(1);
    expect(juniors.lost).toBe(2);
    expect(juniors.total_points).toBe(4);
  });

  it('T1.14: should verify audit logs recording lifecycle state transitions', () => {
    const logs = db.prepare('SELECT * FROM audit_logs').all() as any[];
    expect(logs.length).toBeGreaterThanOrEqual(7);

    const orphanLogs = db.prepare(`
      SELECT a.id FROM audit_logs a
      LEFT JOIN matches m ON a.match_id = m.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE (a.match_id IS NOT NULL AND m.id IS NULL) OR (a.user_id IS NOT NULL AND u.id IS NULL)
    `).all();

    expect(orphanLogs).toHaveLength(0);
  });

  it('T1.15: should reject invalid inserts that violate foreign key constraints', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, position, status)
        VALUES ('invalid-p', 'non-existent-cohort', 'Test Player', '99BM999', 'sport-football', 'Striker', 'ACTIVE')
      `).run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('T1.16: should ensure all 15 sports have at least 2 players in both Seniors and Juniors cohorts', () => {
    const sports = db.prepare('SELECT id, name FROM sports').all() as { id: string; name: string }[];
    expect(sports).toHaveLength(15);

    for (const sport of sports) {
      const seniorPlayers = db.prepare(`
        SELECT id FROM players
        WHERE primary_sport_id = ? AND cohort_id = 'cohort-seniors'
      `).all(sport.id);

      const juniorPlayers = db.prepare(`
        SELECT id FROM players
        WHERE primary_sport_id = ? AND cohort_id = 'cohort-juniors'
      `).all(sport.id);

      expect(
        seniorPlayers.length,
        `Sport ${sport.name} (${sport.id}) must have >= 2 senior players, found ${seniorPlayers.length}`
      ).toBeGreaterThanOrEqual(2);

      expect(
        juniorPlayers.length,
        `Sport ${sport.name} (${sport.id}) must have >= 2 junior players, found ${juniorPlayers.length}`
      ).toBeGreaterThanOrEqual(2);
    }
  });
});
