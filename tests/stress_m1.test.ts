import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { initSchema } from '../server/db/schema.js';
import { seedDatabase } from '../server/db/seed.js';
import { DatabaseClient } from '../server/db/client.js';

describe('Challenger M1 Empirical Stress Tests', () => {
  let client: DatabaseClient;

  beforeEach(() => {
    client = new DatabaseClient(':memory:');
    initSchema(client);
    seedDatabase(client);
  });

  afterEach(() => {
    client.close();
  });

  describe('1. Foreign Key Violation Rejections', () => {
    it('FK-01: rejects player insert with non-existent cohort_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
          VALUES ('ply-err-1', 'cohort-ghost', 'Ghost Player', '99BM001', 'sport-football', 'ACTIVE')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-02: rejects player insert with non-existent primary_sport_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
          VALUES ('ply-err-2', 'cohort-seniors', 'Ghost Player', '99BM002', 'sport-fake-99', 'ACTIVE')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-03: rejects player insert with non-existent secondary_sport_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, secondary_sport_id, status)
          VALUES ('ply-err-3', 'cohort-seniors', 'Ghost Player', '99BM003', 'sport-football', 'sport-fake-99', 'ACTIVE')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-04: rejects match insert with non-existent tournament_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
          VALUES ('m-err-1', 'tourn-fake', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-05: rejects match insert with non-existent sport_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
          VALUES ('m-err-2', 'tourn-xlri-2026', 'sport-invalid', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-06: rejects match insert with non-existent home_cohort_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
          VALUES ('m-err-3', 'tourn-xlri-2026', 'sport-football', 'cohort-fake-home', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-07: rejects match insert with non-existent away_cohort_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
          VALUES ('m-err-4', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-fake-away', 'Ground', '2026-10-10', 'DRAFT')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-08: rejects match insert with non-existent referee_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, referee_id)
          VALUES ('m-err-5', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT', 'usr-ghost-ref')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-09: rejects match_event insert with non-existent match_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO match_events (id, match_id, event_type, minute, second)
          VALUES ('ev-err-1', 'match-ghost', 'GOAL', 10, 0)
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-10: rejects match_event insert with non-existent player_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO match_events (id, match_id, event_type, player_id, minute, second)
          VALUES ('ev-err-2', 'match-01', 'GOAL', 'ply-ghost', 10, 0)
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-11: rejects standings insert with non-existent cohort_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO standings (cohort_id, played, won, drawn, lost, points_for, points_against, points_diff, total_points)
          VALUES ('cohort-ghost', 0, 0, 0, 0, 0, 0, 0, 0)
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-12: rejects audit_log insert with non-existent match_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO audit_logs (id, match_id, action)
          VALUES ('aud-err-1', 'match-ghost', 'TEST')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-13: rejects audit_log insert with non-existent user_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO audit_logs (id, user_id, action)
          VALUES ('aud-err-2', 'usr-ghost', 'TEST')
        `);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-14: prevents deletion of sports referenced by players or matches (RESTRICT)', () => {
      expect(() => {
        client.execute(`DELETE FROM sports WHERE id = 'sport-football'`);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-15: prevents deletion of cohorts referenced by matches (RESTRICT)', () => {
      expect(() => {
        client.execute(`DELETE FROM cohorts WHERE id = 'cohort-seniors'`);
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-16: cascades deletion from matches to match_events (CASCADE)', () => {
      const beforeEvents = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM match_events WHERE match_id = 'match-01'`)[0].count;
      expect(beforeEvents).toBeGreaterThan(0);
      client.execute(`DELETE FROM matches WHERE id = 'match-01'`);
      const afterEvents = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM match_events WHERE match_id = 'match-01'`)[0].count;
      expect(afterEvents).toBe(0);
    });

    it('FK-17: sets referee_id to NULL on matches when referee user is deleted (SET NULL)', () => {
      client.execute(`
        INSERT INTO users (id, name, email, role) VALUES ('usr-temp-ref', 'Temp Ref', 'temp@xlri.ac.in', 'REFEREE');
      `);
      client.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, referee_id)
        VALUES ('m-temp-ref', 'tourn-xlri-2026', 'sport-chess', 'cohort-seniors', 'cohort-juniors', 'Hall', '2026-10-10', 'DRAFT', 'usr-temp-ref');
      `);
      client.execute(`DELETE FROM users WHERE id = 'usr-temp-ref'`);
      const matchRow = client.queryOne<{ referee_id: string | null }>(`SELECT referee_id FROM matches WHERE id = 'm-temp-ref'`);
      expect(matchRow?.referee_id).toBeNull();
    });
  });

  describe('2. Unique Constraints & Check Constraints', () => {
    it('UQ-01: enforces unique email on users', () => {
      expect(() => {
        client.execute(`
          INSERT INTO users (id, name, email, role)
          VALUES ('usr-dup', 'Imposter', 'admin@sports.xlridelhi.ac.in', 'ADMIN')
        `);
      }).toThrow(/UNIQUE constraint failed: users\.email/i);
    });

    it('UQ-02: enforces unique student_id on players', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
          VALUES ('ply-dup', 'cohort-juniors', 'Imposter', '26BM001', 'sport-football', 'ACTIVE')
        `);
      }).toThrow(/UNIQUE constraint failed: players\.student_id/i);
    });

    it('UQ-03: enforces unique primary keys across entities', () => {
      expect(() => {
        client.execute(`
          INSERT INTO tournaments (id, name, year, start_date, end_date)
          VALUES ('tourn-xlri-2026', 'Dup', 2026, '2026-10-10', '2026-10-18')
        `);
      }).toThrow(/UNIQUE constraint failed: tournaments\.id/i);

      expect(() => {
        client.execute(`
          INSERT INTO cohorts (id, name, batch, color)
          VALUES ('cohort-seniors', 'Dup', '2026', '#000')
        `);
      }).toThrow(/UNIQUE constraint failed: cohorts\.id/i);
    });

    it('UQ-04: verifies DB-level constraint status for jersey numbers', () => {
      // Documenting empirical behavior: jersey_number has no UNIQUE constraint in SQLite schema
      let threw = false;
      try {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, jersey_number, primary_sport_id, status)
          VALUES ('ply-dup-jersey', 'cohort-seniors', 'Duplicate Jersey Player', '26BM999', 10, 'sport-football', 'ACTIVE')
        `);
      } catch {
        threw = true;
      }
      // Schema defines `jersey_number INTEGER` without UNIQUE constraint
      expect(threw).toBe(false);
    });

    it('CHK-01: enforces valid scoring_type in sports table', () => {
      expect(() => {
        client.execute(`
          INSERT INTO sports (id, name, category, rules_json, scoring_type)
          VALUES ('sport-bad', 'Bad Sport', 'Unknown', '{}', 'INVALID')
        `);
      }).toThrow(/CHECK constraint failed/i);
    });

    it('CHK-02: enforces valid roles in users table', () => {
      expect(() => {
        client.execute(`
          INSERT INTO users (id, name, email, role)
          VALUES ('usr-bad', 'Bad Role', 'bad@xlri.ac.in', 'SUPERADMIN')
        `);
      }).toThrow(/CHECK constraint failed/i);
    });

    it('CHK-03: enforces valid status in players table', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
          VALUES ('ply-bad', 'cohort-seniors', 'Bad Status', '26BM998', 'sport-football', 'BENCHED')
        `);
      }).toThrow(/CHECK constraint failed/i);
    });

    it('CHK-04: enforces valid status in matches table', () => {
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
          VALUES ('m-bad', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'INVALID_STATUS')
        `);
      }).toThrow(/CHECK constraint failed/i);
    });
  });

  describe('3. Transaction Rollbacks on Mid-Operation Throw', () => {
    it('TX-01: rolls back all inserted rows on explicit JS error', () => {
      const beforeCount = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM cohorts`)[0].count;

      expect(() => {
        client.transaction((tx) => {
          tx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-tx-1', 'Batch A', '2026', '#111')`);
          tx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-tx-2', 'Batch B', '2027', '#222')`);
          throw new Error('Simulated mid-operation crash');
        });
      }).toThrow('Simulated mid-operation crash');

      const afterCount = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM cohorts`)[0].count;
      expect(afterCount).toBe(beforeCount);
      expect(client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-tx-1'`)).toBeNull();
      expect(client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-tx-2'`)).toBeNull();
    });

    it('TX-02: rolls back preceding statements when a constraint violation throws mid-transaction', () => {
      client.execute(`INSERT INTO users (id, name, email, role) VALUES ('usr-orig', 'Original', 'orig@xlri.ac.in', 'SPECTATOR')`);
      const beforeUsers = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM users`)[0].count;

      expect(() => {
        client.transaction((tx) => {
          tx.execute(`INSERT INTO users (id, name, email, role) VALUES ('usr-temp-1', 'Temp 1', 'temp1@xlri.ac.in', 'REFEREE')`);
          // Conflict with usr-orig email
          tx.execute(`INSERT INTO users (id, name, email, role) VALUES ('usr-temp-2', 'Temp 2', 'orig@xlri.ac.in', 'REFEREE')`);
        });
      }).toThrow(/UNIQUE constraint failed/i);

      const afterUsers = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM users`)[0].count;
      expect(afterUsers).toBe(beforeUsers);
      expect(client.queryOne(`SELECT * FROM users WHERE id = 'usr-temp-1'`)).toBeNull();
    });

    it('TX-03: nested transactions: inner rollback does not abort outer transaction if caught', () => {
      client.transaction((outerTx) => {
        outerTx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-out', 'Outer', '2026', '#111')`);

        try {
          outerTx.transaction((innerTx) => {
            innerTx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-in-fail', 'Inner Fail', '2027', '#222')`);
            throw new Error('Inner error');
          });
        } catch {
          // Handled
        }

        outerTx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-out-commit', 'Outer Commit', '2028', '#333')`);
      });

      expect(client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-out'`)).not.toBeNull();
      expect(client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-in-fail'`)).toBeNull();
      expect(client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-out-commit'`)).not.toBeNull();
    });

    it('TX-04: nested transactions: outer rollback reverts inner transaction that previously committed', () => {
      expect(() => {
        client.transaction((outerTx) => {
          outerTx.execute(`INSERT INTO sports (id, name, category, scoring_type) VALUES ('sp-out', 'Sport Out', 'Cat', 'GENERIC')`);

          outerTx.transaction((innerTx) => {
            innerTx.execute(`INSERT INTO sports (id, name, category, scoring_type) VALUES ('sp-in', 'Sport In', 'Cat', 'GENERIC')`);
          });

          throw new Error('Outer failed');
        });
      }).toThrow('Outer failed');

      expect(client.queryOne(`SELECT * FROM sports WHERE id = 'sp-out'`)).toBeNull();
      expect(client.queryOne(`SELECT * FROM sports WHERE id = 'sp-in'`)).toBeNull();
    });
  });

  describe('4. Seed Idempotence & State Preservation', () => {
    it('SEED-01: seedDatabase can be executed multiple times without clean and causes zero errors', () => {
      expect(() => {
        seedDatabase(client, { clean: false });
        seedDatabase(client, { clean: false });
      }).not.toThrow();
    });

    it('SEED-02: seedDatabase preserves identical row counts across multiple runs', () => {
      const getCounts = (c: DatabaseClient) => ({
        tournaments: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM tournaments`)[0].count,
        cohorts: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM cohorts`)[0].count,
        sports: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM sports`)[0].count,
        users: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM users`)[0].count,
        players: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM players`)[0].count,
        matches: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM matches`)[0].count,
        match_events: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM match_events`)[0].count,
        standings: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM standings`)[0].count,
        audit_logs: c.query<{ count: number }>(`SELECT COUNT(*) as count FROM audit_logs`)[0].count,
      });

      const initial = getCounts(client);
      seedDatabase(client, { clean: false });
      const afterSecond = getCounts(client);
      seedDatabase(client, { clean: false });
      const afterThird = getCounts(client);

      expect(afterSecond).toEqual(initial);
      expect(afterThird).toEqual(initial);
    });

    it('SEED-03: seedDatabase preserves standing calculations across repeated executions', () => {
      seedDatabase(client, { clean: false });
      const seniors = client.queryOne<any>(`SELECT * FROM standings WHERE cohort_id = 'cohort-seniors'`);
      expect(seniors.played).toBe(4);
      expect(seniors.won).toBe(2);
      expect(seniors.drawn).toBe(1);
      expect(seniors.lost).toBe(1);
      expect(seniors.total_points).toBe(7);
    });

    it('SEED-04: seedDatabase with clean: true resets and reloads cleanly', () => {
      expect(() => {
        seedDatabase(client, { clean: true });
        seedDatabase(client, { clean: true });
      }).not.toThrow();

      const playersCount = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM players`)[0].count;
      expect(playersCount).toBe(154);
    });
  });

  describe('5. Persistent Database WAL Mode & Foreign Keys', () => {
    it('WAL-01: persistent database file enables WAL mode and foreign keys by default', () => {
      const testFile = path.resolve(process.cwd(), 'test_vitest_wal.db');
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

      const fileClient = new DatabaseClient(testFile);
      initSchema(fileClient);
      seedDatabase(fileClient);

      const jMode = fileClient.queryOne<{ journal_mode: string }>(`PRAGMA journal_mode;`)?.journal_mode;
      const fk = fileClient.queryOne<{ foreign_keys: number }>(`PRAGMA foreign_keys;`)?.foreign_keys;

      expect(jMode?.toLowerCase()).toBe('wal');
      expect(fk).toBe(1);

      fileClient.close();

      try {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
        if (fs.existsSync(testFile + '-wal')) fs.unlinkSync(testFile + '-wal');
        if (fs.existsSync(testFile + '-shm')) fs.unlinkSync(testFile + '-shm');
      } catch {}
    });
  });
});
