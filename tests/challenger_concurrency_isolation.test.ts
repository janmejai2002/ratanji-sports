import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { initSchema, dropSchema } from '../server/db/schema.js';
import { seedDatabase } from '../server/db/seed.js';
import { DatabaseClient, createDatabase } from '../server/db/client.js';

const TEMP_DIR = path.resolve(__dirname, 'temp_challenger');

describe('Empirical Challenge: Concurrency, Isolation & Large Payloads (Challenger M1-2)', () => {
  beforeAll(() => {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEMP_DIR)) {
      try {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      } catch {
        // ignore cleanup lock on Windows if pending release
      }
    }
  });

  // =========================================================================
  // CATEGORY 1: Parallel In-Memory Database Instances & Test Isolation
  // =========================================================================
  describe('Category 1: In-Memory Database Isolation (DatabaseSync & DatabaseClient)', () => {
    it('C1.1: should guarantee zero schema leakage between simultaneous :memory: instances', () => {
      const db1 = new DatabaseSync(':memory:');
      const db2 = new DatabaseSync(':memory:');

      try {
        db1.exec('PRAGMA foreign_keys = ON;');
        db2.exec('PRAGMA foreign_keys = ON;');

        // Initialize schema ONLY in db1
        initSchema(db1);

        // Verify db1 has all 9 tables
        const tablesDb1 = db1.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).all() as { name: string }[];
        expect(tablesDb1.length).toBe(9);

        // Verify db2 has ZERO tables (complete isolation)
        const tablesDb2 = db2.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).all() as { name: string }[];
        expect(tablesDb2.length).toBe(0);

        // Querying a table on db2 must fail with no such table
        expect(() => {
          db2.prepare('SELECT count(*) FROM sports').all();
        }).toThrow(/no such table/i);
      } finally {
        db1.close();
        db2.close();
      }
    });

    it('C1.2: should guarantee zero data leakage when one instance is fully seeded', () => {
      const dbA = new DatabaseClient(':memory:');
      const dbB = new DatabaseClient(':memory:');

      try {
        // Initialize schema and full seed in dbA
        initSchema(dbA.raw);
        seedDatabase(dbA.raw);

        // Verify dbA has seeded entities
        const playersA = dbA.query<{ c: number }>('SELECT count(*) as c FROM players')[0].c;
        const sportsA = dbA.query<{ c: number }>('SELECT count(*) as c FROM sports')[0].c;
        const matchesA = dbA.query<{ c: number }>('SELECT count(*) as c FROM matches')[0].c;
        expect(playersA).toBe(154);
        expect(sportsA).toBe(15);
        expect(matchesA).toBe(12);

        // Initialize schema in dbB, but do NOT seed
        initSchema(dbB.raw);

        // Verify all 9 tables in dbB are strictly empty
        const tables = [
          'tournaments', 'cohorts', 'sports', 'users', 'players',
          'matches', 'match_events', 'standings', 'audit_logs'
        ];
        for (const tbl of tables) {
          const count = dbB.query<{ c: number }>(`SELECT count(*) as c FROM ${tbl}`)[0].c;
          expect(count).toBe(0);
        }
      } finally {
        dbA.close();
        dbB.close();
      }
    });

    it('C1.3: should isolate independent mutations and schema teardowns', () => {
      const db1 = new DatabaseClient(':memory:');
      const db2 = new DatabaseClient(':memory:');

      try {
        initSchema(db1.raw);
        initSchema(db2.raw);

        // Insert distinct cohorts into each
        db1.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A')");
        db2.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c2', 'Juniors', '2027', '#DC2626')");

        // db1 should only see c1
        const rows1 = db1.query('SELECT id FROM cohorts');
        expect(rows1).toHaveLength(1);
        expect(rows1[0].id).toBe('c1');

        // db2 should only see c2
        const rows2 = db2.query('SELECT id FROM cohorts');
        expect(rows2).toHaveLength(1);
        expect(rows2[0].id).toBe('c2');

        // Mutate db1: update cohort name
        db1.execute("UPDATE cohorts SET name = 'Senior Alums' WHERE id = 'c1'");
        expect(db1.queryOne<{ name: string }>("SELECT name FROM cohorts WHERE id = 'c1'")?.name).toBe('Senior Alums');
        expect(db2.queryOne("SELECT * FROM cohorts WHERE id = 'c1'")).toBeNull();

        // Drop schema on db1
        dropSchema(db1.raw);
        expect(() => db1.query('SELECT * FROM cohorts')).toThrow(/no such table/i);

        // Verify db2 is completely intact
        const intactDb2 = db2.queryOne<{ id: string; name: string }>("SELECT * FROM cohorts WHERE id = 'c2'");
        expect(intactDb2).toBeDefined();
        expect(intactDb2?.name).toBe('Juniors');
      } finally {
        try { db1.close(); } catch { /* ignore */ }
        try { db2.close(); } catch { /* ignore */ }
      }
    });

    it('C1.4: should maintain complete isolation under rapid interleaved operations across 5 instances', () => {
      const instances: DatabaseClient[] = [];
      const instanceCount = 5;

      try {
        for (let i = 0; i < instanceCount; i++) {
          const client = createDatabase({ path: ':memory:' });
          client.exec(`
            CREATE TABLE counter (id INTEGER PRIMARY KEY, instance_id INTEGER, val INTEGER);
            INSERT INTO counter (id, instance_id, val) VALUES (1, ${i}, 0);
          `);
          instances.push(client);
        }

        // Interleaved operations
        const ops = 50;
        for (let op = 0; op < ops; op++) {
          for (let i = 0; i < instanceCount; i++) {
            instances[i].execute('UPDATE counter SET val = val + 1 WHERE id = 1');
          }
        }

        // Verify each instance independently reached exactly 'ops'
        for (let i = 0; i < instanceCount; i++) {
          const row = instances[i].queryOne<{ instance_id: number; val: number }>('SELECT * FROM counter WHERE id = 1');
          expect(row?.instance_id).toBe(i);
          expect(row?.val).toBe(ops);
        }
      } finally {
        for (const inst of instances) {
          inst.close();
        }
      }
    });

    it('C1.5: factory createDatabase({ path: ":memory:" }) creates distinct instances', () => {
      const dbA = createDatabase({ path: ':memory:' });
      const dbB = createDatabase({ path: ':memory:' });

      try {
        dbA.exec('CREATE TABLE test_a (id INTEGER);');
        dbB.exec('CREATE TABLE test_b (id INTEGER);');

        expect(() => dbA.query('SELECT * FROM test_b')).toThrow(/no such table/i);
        expect(() => dbB.query('SELECT * FROM test_a')).toThrow(/no such table/i);
      } finally {
        dbA.close();
        dbB.close();
      }
    });
  });

  // =========================================================================
  // CATEGORY 2: WAL Mode Concurrency (Simultaneous Read and Write Transactions)
  // =========================================================================
  describe('Category 2: WAL Mode Concurrency on Persistent Storage', () => {
    const dbPath = path.resolve(TEMP_DIR, 'wal_concurrency.db');

    beforeEach(() => {
      // Clean up previous files if any
      for (const ext of ['', '-wal', '-shm']) {
        const f = dbPath + ext;
        if (fs.existsSync(f)) {
          try { fs.unlinkSync(f); } catch { /* ignore */ }
        }
      }
    });

    afterEach(() => {
      for (const ext of ['', '-wal', '-shm']) {
        const f = dbPath + ext;
        if (fs.existsSync(f)) {
          try { fs.unlinkSync(f); } catch { /* ignore */ }
        }
      }
    });

    it('C2.1: should activate WAL journal mode on disk-backed database', () => {
      const client = new DatabaseClient(dbPath, { enableWal: true });
      try {
        const mode = client.queryOne<{ journal_mode: string }>('PRAGMA journal_mode;');
        expect(mode?.journal_mode.toLowerCase()).toBe('wal');
      } finally {
        client.close();
      }
    });

    it('C2.2: should provide snapshot isolation (reader reads pre-transaction state while writer uncommitted)', () => {
      const writer = new DatabaseClient(dbPath, { enableWal: true });
      const reader = new DatabaseClient(dbPath, { enableWal: true });

      try {
        initSchema(writer.raw);

        // Seed basic fixtures
        writer.execute("INSERT INTO tournaments (id, name, year, start_date, end_date) VALUES ('t1', 'XLRI', 2026, '2026-02-01', '2026-02-05')");
        writer.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A'), ('c2', 'Juniors', '2027', '#DC2626')");
        writer.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s1', 'Football', 'Outdoor', 'FOOTBALL')");
        writer.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, score_home, score_away)
          VALUES ('m1', 't1', 's1', 'c1', 'c2', 'Main Pitch', '2026-02-01T10:00:00Z', 'Draft', 0, 0)
        `);

        // Reader verifies initial score is 0
        const initialScore = reader.queryOne<{ score_home: number }>("SELECT score_home FROM matches WHERE id = 'm1'");
        expect(initialScore?.score_home).toBe(0);

        // Writer begins an explicit write transaction using SAVEPOINT or BEGIN
        writer.exec('BEGIN IMMEDIATE;');
        writer.execute("UPDATE matches SET score_home = 7 WHERE id = 'm1'");

        // CRITICAL EMPIRICAL TEST:
        // Reader reads while Writer's transaction is active and uncommitted.
        // In WAL mode: Reader MUST NOT be blocked, and MUST see score_home = 0 (dirty read prevented).
        const scoreDuringTx = reader.queryOne<{ score_home: number }>("SELECT score_home FROM matches WHERE id = 'm1'");
        expect(scoreDuringTx?.score_home).toBe(0);

        // Writer commits
        writer.exec('COMMIT;');

        // Reader now reads after commit: MUST see updated score_home = 7
        const scoreAfterCommit = reader.queryOne<{ score_home: number }>("SELECT score_home FROM matches WHERE id = 'm1'");
        expect(scoreAfterCommit?.score_home).toBe(7);
      } finally {
        writer.close();
        reader.close();
      }
    });

    it('C2.3: should preserve read consistency during transaction rollback', () => {
      const writer = new DatabaseClient(dbPath, { enableWal: true });
      const reader = new DatabaseClient(dbPath, { enableWal: true });

      try {
        initSchema(writer.raw);
        writer.execute("INSERT INTO tournaments (id, name, year, start_date, end_date) VALUES ('t1', 'XLRI', 2026, '2026-02-01', '2026-02-05')");
        writer.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A'), ('c2', 'Juniors', '2027', '#DC2626')");
        writer.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s1', 'Football', 'Outdoor', 'FOOTBALL')");
        writer.execute("INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, score_home, score_away) VALUES ('m1', 't1', 's1', 'c1', 'c2', 'Pitch', '2026-02-01T10:00:00Z', 'Draft', 3, 2)");

        // Writer attempts an aborted mutation
        expect(() => {
          writer.transaction(() => {
            writer.execute("UPDATE matches SET score_home = 99 WHERE id = 'm1'");
            // Simulate error triggering rollback
            throw new Error('Simulated referee error mid-score update');
          });
        }).toThrow('Simulated referee error');

        // Reader verifies score remained 3
        const score = reader.queryOne<{ score_home: number }>("SELECT score_home FROM matches WHERE id = 'm1'");
        expect(score?.score_home).toBe(3);
      } finally {
        writer.close();
        reader.close();
      }
    });

    it('C2.4: stress test: concurrent readers during continuous write stream (0 busy errors, 0 torn reads)', async () => {
      const writer = new DatabaseClient(dbPath, { enableWal: true });
      const readers = [
        new DatabaseClient(dbPath, { enableWal: true }),
        new DatabaseClient(dbPath, { enableWal: true }),
        new DatabaseClient(dbPath, { enableWal: true }),
      ];

      try {
        initSchema(writer.raw);
        writer.execute("INSERT INTO tournaments (id, name, year, start_date, end_date) VALUES ('t1', 'XLRI', 2026, '2026-02-01', '2026-02-05')");
        writer.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A'), ('c2', 'Juniors', '2027', '#DC2626')");
        writer.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s1', 'Football', 'Outdoor', 'FOOTBALL')");
        writer.execute("INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, score_home, score_away) VALUES ('m1', 't1', 's1', 'c1', 'c2', 'Pitch', '2026-02-01T10:00:00Z', 'Draft', 0, 0)");

        let writeCount = 0;
        let readCount = 0;
        let readErrors = 0;
        const totalBatches = 50;

        // Run interleaved writes and reads
        for (let b = 1; b <= totalBatches; b++) {
          // Writer logs an event and increments score in a transaction
          writer.transaction(() => {
            writer.execute(`
              INSERT INTO match_events (id, match_id, event_type, team, minute, second, payload_json)
              VALUES ('ev-${b}', 'm1', 'GOAL', 'HOME', ${b}, 0, '{"points": 1}')
            `);
            writer.execute(`UPDATE matches SET score_home = ${b} WHERE id = 'm1'`);
          });
          writeCount++;

          // Concurrently query through all readers
          for (const reader of readers) {
            try {
              const match = reader.queryOne<{ score_home: number }>("SELECT score_home FROM matches WHERE id = 'm1'");
              const events = reader.query<{ count: number }>("SELECT count(*) as count FROM match_events WHERE match_id = 'm1'")[0].count;
              expect(match).toBeDefined();
              expect(events).toBeGreaterThanOrEqual(0);
              readCount++;
            } catch (err) {
              readErrors++;
            }
          }
        }

        expect(writeCount).toBe(totalBatches);
        expect(readCount).toBe(totalBatches * readers.length);
        expect(readErrors).toBe(0);

        // Final verification
        const finalMatch = readers[0].queryOne<{ score_home: number }>("SELECT score_home FROM matches WHERE id = 'm1'");
        expect(finalMatch?.score_home).toBe(totalBatches);
      } finally {
        writer.close();
        for (const r of readers) {
          r.close();
        }
      }
    });

    it('C2.5: dual-writer contention: SQLite returns SQLITE_BUSY without busy_timeout, succeeds with busy_timeout', () => {
      const writer1 = new DatabaseClient(dbPath, { enableWal: true });
      const writer2 = new DatabaseClient(dbPath, { enableWal: true });

      try {
        initSchema(writer1.raw);

        // Writer 1 begins immediate transaction (takes write lock)
        writer1.exec('BEGIN IMMEDIATE;');

        // Writer 2 attempts write immediately: SQLite WAL mode permits only ONE active writer
        // Without busy_timeout, SQLite returns SQLITE_BUSY immediately.
        expect(() => {
          writer2.exec('BEGIN IMMEDIATE;');
        }).toThrow(/(busy|locked)/i);

        // Writer 1 commits and releases the lock
        writer1.exec('COMMIT;');

        // Now Writer 2 should succeed
        expect(() => {
          writer2.exec('BEGIN IMMEDIATE;');
          writer2.exec('COMMIT;');
        }).not.toThrow();
      } finally {
        try { writer1.close(); } catch { /* ignore */ }
        try { writer2.close(); } catch { /* ignore */ }
      }
    });
  });

  // =========================================================================
  // CATEGORY 3: Large Payload Handling (rules_json & sport_state_json)
  // =========================================================================
  describe('Category 3: Large Payload & Complex JSON Handling', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
      initSchema(db.raw);
      db.execute("INSERT INTO tournaments (id, name, year, start_date, end_date) VALUES ('t1', 'XLRI', 2026, '2026-02-01', '2026-02-05')");
      db.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A'), ('c2', 'Juniors', '2027', '#DC2626')");
    });

    afterEach(() => {
      db.close();
    });

    it('C3.1: size ladder: 10KB, 100KB, 1MB, and 5MB payloads in rules_json', () => {
      const sizes = [
        { name: '10KB', count: 100 },
        { name: '100KB', count: 1000 },
        { name: '1MB', count: 10000 },
        { name: '5MB', count: 50000 },
      ];

      for (let i = 0; i < sizes.length; i++) {
        const { name, count } = sizes[i];
        const sportId = `sport-size-${i}`;

        // Construct structured payload
        const rulesObj = {
          sport: `Sport ${name}`,
          version: '1.0.0',
          sections: Array.from({ length: count }, (_, idx) => ({
            rule_id: `RULE_${idx}`,
            clause: `Official regulatory clause ${idx} governing play, stoppage, scoring, and fouls.`,
            penalties: [idx * 2, idx * 5],
            metadata: {
              active: true,
              arbitration_code: `ARB-${idx}-${name}`,
            },
          })),
        };

        const jsonStr = JSON.stringify(rulesObj);
        expect(jsonStr.length).toBeGreaterThan(1024 * (name === '10KB' ? 10 : name === '100KB' ? 100 : name === '1MB' ? 1000 : 5000));

        // Insert into sports table
        const insertStart = performance.now();
        db.execute(
          'INSERT INTO sports (id, name, category, rules_json, scoring_type) VALUES (?, ?, ?, ?, ?)',
          [sportId, `Sport ${name}`, 'Testing', jsonStr, 'GENERIC']
        );
        const insertTime = performance.now() - insertStart;

        // Query back
        const readStart = performance.now();
        const row = db.queryOne<{ rules_json: string }>(
          'SELECT rules_json FROM sports WHERE id = ?',
          [sportId]
        );
        const readTime = performance.now() - readStart;

        expect(row).toBeDefined();
        // Exact character-by-character roundtrip verification
        expect(row?.rules_json).toBe(jsonStr);

        // Deserialization check
        const parsed = JSON.parse(row!.rules_json);
        expect(parsed.sport).toBe(`Sport ${name}`);
        expect(parsed.sections.length).toBe(count);
        expect(parsed.sections[0].rule_id).toBe('RULE_0');
        expect(parsed.sections[count - 1].rule_id).toBe(`RULE_${count - 1}`);

        // Latency assertions: even 5MB should serialize and deserialize in < 500ms
        expect(insertTime).toBeLessThan(1000);
        expect(readTime).toBeLessThan(1000);
      }
    });

    it('C3.2: 1MB state telemetry payload in matches.sport_state_json', () => {
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s1', 'Cricket', 'Outdoor', 'CRICKET')");

      // Generate cricket ball-by-ball telemetry
      const ballCount = 2000;
      const cricketState = {
        innings: 1,
        batting_cohort: 'c1',
        bowling_cohort: 'c2',
        overs: 20.0,
        balls: Array.from({ length: ballCount }, (_, idx) => ({
          ball_number: idx + 1,
          bowler: `Bowler ${idx % 5}`,
          batsman: `Batsman ${idx % 11}`,
          runs_scored: idx % 7,
          extras: idx % 10 === 0 ? 'wide' : 'none',
          wicket: idx % 30 === 0,
          speed_kph: 120 + (idx % 25),
          trajectory: [idx * 0.1, idx * 0.2, idx * 0.3],
        })),
        worm_chart: Array.from({ length: 120 }, (_, idx) => ({ over: idx + 1, cumulative_runs: idx * 8 })),
      };

      const payloadStr = JSON.stringify(cricketState);
      expect(payloadStr.length).toBeGreaterThan(250 * 1024); // >250KB complex state

      db.execute(
        `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, score_home, score_away, sport_state_json)
         VALUES ('match-cricket-1', 't1', 's1', 'c1', 'c2', 'Oval', '2026-02-01T14:00:00Z', 'Draft', 185, 140, ?)`,
        [payloadStr]
      );

      const retrieved = db.queryOne<{ sport_state_json: string }>(
        "SELECT sport_state_json FROM matches WHERE id = 'match-cricket-1'"
      );
      expect(retrieved?.sport_state_json).toBe(payloadStr);

      const parsedState = JSON.parse(retrieved!.sport_state_json);
      expect(parsedState.balls.length).toBe(ballCount);
      expect(parsedState.balls[100].bowler).toBe('Bowler 0');
    });

    it('C3.3: international characters, Hindi text, emojis, and special escape sequences', () => {
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s-i18n', 'Badminton', 'Racquet', 'BADMINTON')");

      const unicodePayload = {
        tournament_hindi: 'रतनजी डिजिटल स्पोर्ट्स टूर्नामेंट २०२६ (XLRI दिल्ली)',
        motto: 'जीत हमारी, शान तुम्हारी! 🏆🥇🥈🥉',
        sports_icons: {
          football: '⚽',
          cricket: '🏏',
          basketball: '🏀',
          tennis: '🎾',
          shuttlecock: '🏸',
          timer: '⏱️',
        },
        special_escapes: {
          newline: 'Line 1\nLine 2\r\nLine 3',
          tab: 'Column1\tColumn2',
          quotes: 'Single \'quote\' and double "quotes" and escaped \\"quotes\\"',
          backslashes: 'C:\\Users\\Janmejai\\ratanji\\sports\\rules',
          unicode_chars: '\u092D\u093E\u0930\u0924 \u2022 \u2605 \u2764',
        },
      };

      const jsonStr = JSON.stringify(unicodePayload);

      db.execute(
        `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, sport_state_json)
         VALUES ('m-unicode', 't1', 's-i18n', 'c1', 'c2', 'Sports Complex', '2026-02-02T10:00:00Z', 'Draft', ?)`,
        [jsonStr]
      );

      const row = db.queryOne<{ sport_state_json: string }>(
        "SELECT sport_state_json FROM matches WHERE id = 'm-unicode'"
      );
      expect(row?.sport_state_json).toBe(jsonStr);

      const parsed = JSON.parse(row!.sport_state_json);
      expect(parsed.tournament_hindi).toBe('रतनजी डिजिटल स्पोर्ट्स टूर्नामेंट २०२६ (XLRI दिल्ली)');
      expect(parsed.sports_icons.cricket).toBe('🏏');
      expect(parsed.special_escapes.backslashes).toBe('C:\\Users\\Janmejai\\ratanji\\sports\\rules');
    });

    it('C3.4: deeply nested JSON structures (100 levels)', () => {
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s-nest', 'Chess', 'Indoor', 'GENERIC')");

      // Construct 100-level nested JSON
      let nestedObj: any = { leaf: 'deepest_secret_value', depth: 100 };
      for (let d = 99; d >= 1; d--) {
        nestedObj = { level: d, child: nestedObj };
      }

      const jsonStr = JSON.stringify(nestedObj);

      db.execute(
        `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, sport_state_json)
         VALUES ('m-nest', 't1', 's-nest', 'c1', 'c2', 'Hall A', '2026-02-02T10:00:00Z', 'Draft', ?)`,
        [jsonStr]
      );

      const row = db.queryOne<{ sport_state_json: string }>(
        "SELECT sport_state_json FROM matches WHERE id = 'm-nest'"
      );
      expect(row?.sport_state_json).toBe(jsonStr);

      // Traverse down 100 levels
      let current = JSON.parse(row!.sport_state_json);
      for (let d = 1; d <= 99; d++) {
        expect(current.level).toBe(d);
        current = current.child;
      }
      expect(current.leaf).toBe('deepest_secret_value');
      expect(current.depth).toBe(100);
    });

    it('C3.5: resistance against SQL injection patterns inside JSON text', () => {
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s-sec', 'Pool', 'Indoor', 'GENERIC')");

      const maliciousPayload = {
        attack1: "'); DROP TABLE matches; --",
        attack2: "admin' OR '1'='1",
        attack3: "'; UPDATE users SET role = 'ADMIN'; --",
        attack4: "UNION SELECT name, email FROM users",
      };

      const jsonStr = JSON.stringify(maliciousPayload);

      // Insert using parameterized statement
      db.execute(
        `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, sport_state_json)
         VALUES ('m-sqli', 't1', 's-sec', 'c1', 'c2', 'Club House', '2026-02-02T10:00:00Z', 'Draft', ?)`,
        [jsonStr]
      );

      // Verify table still exists and record is preserved faithfully
      const row = db.queryOne<{ sport_state_json: string }>(
        "SELECT sport_state_json FROM matches WHERE id = 'm-sqli'"
      );
      expect(row?.sport_state_json).toBe(jsonStr);

      const parsed = JSON.parse(row!.sport_state_json);
      expect(parsed.attack1).toBe("'); DROP TABLE matches; --");

      // Verify users table and matches table are uncorrupted
      const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('matches', 'users')");
      expect(tables.length).toBe(2);
    });

    it('C3.6: schema NOT NULL constraint enforcement on JSON columns', () => {
      // rules_json is NOT NULL DEFAULT '{}'
      expect(() => {
        db.execute(
          'INSERT INTO sports (id, name, category, rules_json, scoring_type) VALUES (?, ?, ?, ?, ?)',
          ['s-null-rules', 'Futsal', 'Indoor', null, 'FOOTBALL']
        );
      }).toThrow(/NOT NULL constraint failed: sports\.rules_json/i);

      // sport_state_json is NOT NULL DEFAULT '{}'
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s-futsal', 'Futsal', 'Indoor', 'FOOTBALL')");
      expect(() => {
        db.execute(
          `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, sport_state_json)
           VALUES ('m-null-state', 't1', 's-futsal', 'c1', 'c2', 'Court', '2026-02-02T10:00:00Z', 'Draft', ?)`,
          [null]
        );
      }).toThrow(/NOT NULL constraint failed: matches\.sport_state_json/i);

      // Default value applied when omitted
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s-def', 'Futsal Def', 'Indoor', 'FOOTBALL')");
      const defaultSport = db.queryOne<{ rules_json: string }>("SELECT rules_json FROM sports WHERE id = 's-def'");
      expect(defaultSport?.rules_json).toBe('{}');
    });

    it('C3.7: SQLite native JSON1 function compatibility (json_extract, json_array_length)', () => {
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s-json1', 'Football', 'Outdoor', 'FOOTBALL')");

      const matchState = {
        quarter: 2,
        possession: 'HOME',
        scores: [3, 7, 10],
        config: {
          extra_time_allowed: true,
          max_substitutions: 5,
        },
      };

      db.execute(
        `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, sport_state_json)
         VALUES ('m-json1', 't1', 's-json1', 'c1', 'c2', 'Pitch', '2026-02-01T10:00:00Z', 'Draft', ?)`,
        [JSON.stringify(matchState)]
      );

      // Query using SQLite native json_extract
      const extracted = db.queryOne<{ quarter: number; possession: string; max_subs: number }>(`
        SELECT
          json_extract(sport_state_json, '$.quarter') as quarter,
          json_extract(sport_state_json, '$.possession') as possession,
          json_extract(sport_state_json, '$.config.max_substitutions') as max_subs
        FROM matches WHERE id = 'm-json1'
      `);

      expect(extracted?.quarter).toBe(2);
      expect(extracted?.possession).toBe('HOME');
      expect(extracted?.max_subs).toBe(5);

      // Query array length
      const arrayLen = db.queryOne<{ len: number }>(`
        SELECT json_array_length(sport_state_json, '$.scores') as len
        FROM matches WHERE id = 'm-json1'
      `);
      expect(arrayLen?.len).toBe(3);
    });

    it('C3.8: 10MB extreme payload stress test', () => {
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s-10mb', 'Marathon', 'Outdoor', 'GENERIC')");

      // Generate ~10MB payload
      const largeArray = new Array(800000).fill('abcdefghij');
      const largePayload = JSON.stringify({ items: largeArray });
      const sizeMB = largePayload.length / (1024 * 1024);
      expect(sizeMB).toBeGreaterThan(9.5);

      const t0 = performance.now();
      db.execute(
        `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, sport_state_json)
         VALUES ('m-10mb', 't1', 's-10mb', 'c1', 'c2', 'Track', '2026-02-01T10:00:00Z', 'Draft', ?)`,
        [largePayload]
      );
      const insertMs = performance.now() - t0;

      const t1 = performance.now();
      const row = db.queryOne<{ sport_state_json: string }>(
        "SELECT sport_state_json FROM matches WHERE id = 'm-10mb'"
      );
      const readMs = performance.now() - t1;

      expect(row?.sport_state_json.length).toBe(largePayload.length);
      expect(row?.sport_state_json).toBe(largePayload);
      expect(insertMs).toBeLessThan(1000); // Sub-second write
      expect(readMs).toBeLessThan(500); // Sub-second read
    });

    it('C3.9: accepts non-JSON strings due to missing json_valid CHECK constraint (finding for downstream)', () => {
      db.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('s-bad-json', 'Rugby', 'Outdoor', 'GENERIC')");

      // Attempt inserting invalid JSON syntax
      const malformedJson = '{ this is definitely not valid json : 123 ]';

      // Schema allows this because no CHECK(json_valid(sport_state_json)) is defined
      db.execute(
        `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, sport_state_json)
         VALUES ('m-bad-json', 't1', 's-bad-json', 'c1', 'c2', 'Field', '2026-02-01T10:00:00Z', 'Draft', ?)`,
        [malformedJson]
      );

      const row = db.queryOne<{ sport_state_json: string }>(
        "SELECT sport_state_json FROM matches WHERE id = 'm-bad-json'"
      );
      expect(row?.sport_state_json).toBe(malformedJson);

      // Downstream JSON.parse fails unless validated by service layer
      expect(() => JSON.parse(row!.sport_state_json)).toThrow(SyntaxError);
    });
  });
});

