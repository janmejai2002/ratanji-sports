import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseClient, createDatabase, getDatabase, resetDatabase } from '../server/db/client.js';
import { initSchema, dropSchema } from '../server/db/schema.js';

const CHALLENGE_TEMP_DIR = path.resolve(__dirname, 'temp_empirical_m1_2');

describe('Milestone M1 Empirical Challenge (Challenger M1-2 Gen 2)', () => {
  beforeAll(() => {
    if (!fs.existsSync(CHALLENGE_TEMP_DIR)) {
      fs.mkdirSync(CHALLENGE_TEMP_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(CHALLENGE_TEMP_DIR)) {
      try {
        fs.rmSync(CHALLENGE_TEMP_DIR, { recursive: true, force: true });
      } catch {
        // Windows file handle release lag fallback
      }
    }
  });

  // =========================================================================
  // CATEGORY 1: Concurrency & Lock Contention with PRAGMA busy_timeout = 5000;
  // =========================================================================
  describe('Category 1: Concurrency & Lock Contention on Persistent Storage', () => {
    const dbFile = path.resolve(CHALLENGE_TEMP_DIR, 'concurrency_timeout.db');

    const cleanDbFiles = () => {
      for (const ext of ['', '-wal', '-shm']) {
        const target = dbFile + ext;
        if (fs.existsSync(target)) {
          try {
            fs.unlinkSync(target);
          } catch {
            // Ignore temporary locks
          }
        }
      }
    };

    beforeEach(() => {
      cleanDbFiles();
    });

    afterEach(() => {
      cleanDbFiles();
    });

    it('1.1: PRAGMA Verification: Default busy_timeout is 5000ms and honors custom options', () => {
      const defaultDb = new DatabaseClient(dbFile);
      try {
        const defaultTimeout = defaultDb.queryOne<{ timeout: number }>('PRAGMA busy_timeout;');
        expect(defaultTimeout?.timeout).toBe(5000);
      } finally {
        defaultDb.close();
      }

      cleanDbFiles();

      const customDb = new DatabaseClient(dbFile, { busyTimeout: 2500 });
      try {
        const customTimeout = customDb.queryOne<{ timeout: number }>('PRAGMA busy_timeout;');
        expect(customTimeout?.timeout).toBe(2500);
      } finally {
        customDb.close();
      }
    });

    it('1.2: Cross-process lock contention: busy_timeout = 5000 allows waiting connection to succeed once lock is freed', async () => {
      // Initialize schema on the persistent db file
      const initDb = new DatabaseClient(dbFile, { enableWal: true });
      try {
        initSchema(initDb.raw);
        initDb.execute(
          "INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A')"
        );
      } finally {
        initDb.close();
      }

      // We launch two independent child processes to simulate real multi-connection contention:
      // Process A: Acquires write lock with 'BEGIN IMMEDIATE;', signals via stdout, waits 600ms, then commits.
      const scriptA = `
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(${JSON.stringify(dbFile)});
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA busy_timeout = 5000;');
        db.exec('BEGIN IMMEDIATE;');
        console.log('PROC_A:LOCKED');
        setTimeout(() => {
          db.exec("UPDATE cohorts SET name = 'Seniors_Updated_A' WHERE id = 'c1';");
          db.exec('COMMIT;');
          db.close();
          console.log('PROC_A:COMMITTED');
          process.exit(0);
        }, 600);
      `;

      // Process B: Attempts 'BEGIN IMMEDIATE;' with busy_timeout = 5000.
      const scriptB = `
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(${JSON.stringify(dbFile)});
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA busy_timeout = 5000;');
        const startTime = Date.now();
        console.log('PROC_B:WAITING');
        db.exec('BEGIN IMMEDIATE;');
        const waitedMs = Date.now() - startTime;
        db.exec("UPDATE cohorts SET name = 'Seniors_Updated_B' WHERE id = 'c1';");
        db.exec('COMMIT;');
        db.close();
        console.log('PROC_B:COMMITTED:' + waitedMs);
        process.exit(0);
      `;

      // Spawn Process A and wait for it to signal that it holds the lock
      const childA = spawn(process.execPath, ['-e', scriptA], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdoutA = '';
      childA.stdout?.on('data', (d) => (stdoutA += d.toString()));

      await new Promise<void>((resolve, reject) => {
        const onData = (data: Buffer) => {
          if (data.toString().includes('PROC_A:LOCKED')) {
            childA.stdout?.off('data', onData);
            resolve();
          }
        };
        childA.stdout?.on('data', onData);
        childA.on('error', reject);
      });

      // Now Process A is GUARANTEED to hold the lock; spawn Process B
      const runProcB = (): Promise<{ stdout: string; code: number }> => {
        return new Promise((resolve, reject) => {
          const childB = spawn(process.execPath, ['-e', scriptB], {
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdoutB = '';
          let stderrB = '';
          childB.stdout?.on('data', (d) => (stdoutB += d.toString()));
          childB.stderr?.on('data', (d) => (stderrB += d.toString()));
          childB.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`Exit code ${code}: ${stderrB || stdoutB}`));
            } else {
              resolve({ stdout: stdoutB, code: code ?? 0 });
            }
          });
          childB.on('error', reject);
        });
      };

      const [resB] = await Promise.all([
        runProcB(),
        new Promise<void>((resolve) => childA.on('close', () => resolve())),
      ]);

      expect(stdoutA).toContain('PROC_A:COMMITTED');
      expect(resB.stdout).toContain('PROC_B:COMMITTED');

      // Verify that Process B actually waited for Process A
      const match = resB.stdout.match(/PROC_B:COMMITTED:(\d+)/);
      expect(match).not.toBeNull();
      const waitedMs = parseInt(match![1], 10);
      expect(waitedMs).toBeGreaterThanOrEqual(200); // Measurable wait for Proc A release

      // Verify final database state: Process B committed after Process A
      const verifyDb = new DatabaseClient(dbFile, { enableWal: true });
      try {
        const cohort = verifyDb.queryOne<{ name: string }>("SELECT name FROM cohorts WHERE id = 'c1'");
        expect(cohort?.name).toBe('Seniors_Updated_B');
      } finally {
        verifyDb.close();
      }
    });

    it('1.3: Negative timeout verification: busy_timeout expires when lock is held longer than timeout threshold', async () => {
      const initDb = new DatabaseClient(dbFile, { enableWal: true });
      try {
        initSchema(initDb.raw);
      } finally {
        initDb.close();
      }

      // Process A holds lock for 1200ms
      const scriptA = `
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(${JSON.stringify(dbFile)});
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA busy_timeout = 5000;');
        db.exec('BEGIN IMMEDIATE;');
        console.log('PROC_A:HOLDING');
        setTimeout(() => {
          db.exec('COMMIT;');
          db.close();
          process.exit(0);
        }, 1200);
      `;

      // Process B has low busy_timeout = 200ms, should throw SQLITE_BUSY
      const scriptB = `
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(${JSON.stringify(dbFile)});
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA busy_timeout = 200;');
        try {
          db.exec('BEGIN IMMEDIATE;');
          console.log('PROC_B:UNEXPECTED_SUCCESS');
          process.exit(0);
        } catch (err) {
          console.log('PROC_B:CAUGHT_BUSY:' + err.message);
          process.exit(42);
        }
      `;

      const childA = spawn(process.execPath, ['-e', scriptA], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Wait until Process A explicitly signals that it holds the lock
      await new Promise<void>((resolve, reject) => {
        const onData = (data: Buffer) => {
          if (data.toString().includes('PROC_A:HOLDING')) {
            childA.stdout?.off('data', onData);
            resolve();
          }
        };
        childA.stdout?.on('data', onData);
        childA.on('error', reject);
      });

      const runProcB = (): Promise<{ code: number; stdout: string }> => {
        return new Promise((resolve) => {
          const childB = spawn(process.execPath, ['-e', scriptB], {
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '';
          childB.stdout?.on('data', (d) => (stdout += d.toString()));
          childB.on('close', (code) => {
            resolve({ code: code ?? 0, stdout });
          });
        });
      };

      const resB = await runProcB();
      expect(resB.code).toBe(42);
      expect(resB.stdout).toMatch(/(busy|locked)/i);

      // Wait for child A to cleanly exit
      await new Promise((resolve) => childA.on('close', resolve));
    });

    it('1.4: Multi-connection sequential transactional writes maintain consistency under WAL mode', () => {
      const masterDb = new DatabaseClient(dbFile, { enableWal: true, busyTimeout: 5000 });
      try {
        initSchema(masterDb.raw);
        masterDb.execute(
          "INSERT INTO tournaments (id, name, year, start_date, end_date) VALUES ('t1', 'XLRI', 2026, '2026-02-01', '2026-02-05')"
        );
        masterDb.execute(
          "INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A'), ('c2', 'Juniors', '2027', '#DC2626')"
        );
        masterDb.execute(
          "INSERT INTO sports (id, name, category, scoring_type) VALUES ('s1', 'Football', 'Outdoor', 'FOOTBALL')"
        );
        masterDb.execute(
          "INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, score_home, score_away) VALUES ('m1', 't1', 's1', 'c1', 'c2', 'Main Field', '2026-02-01T10:00:00Z', 'Draft', 0, 0)"
        );

        // Open 3 separate DatabaseClient connections to the same file
        const conn1 = new DatabaseClient(dbFile, { enableWal: true, busyTimeout: 5000 });
        const conn2 = new DatabaseClient(dbFile, { enableWal: true, busyTimeout: 5000 });
        const conn3 = new DatabaseClient(dbFile, { enableWal: true, busyTimeout: 5000 });

        try {
          const iterations = 25;
          for (let i = 1; i <= iterations; i++) {
            conn1.transaction(() => {
              conn1.execute(
                `INSERT INTO match_events (id, match_id, event_type, team, minute, second, payload_json) VALUES ('ev-conn1-${i}', 'm1', 'GOAL', 'HOME', ${i}, 0, '{}')`
              );
              conn1.execute(`UPDATE matches SET score_home = score_home + 1 WHERE id = 'm1'`);
            });

            conn2.transaction(() => {
              conn2.execute(
                `INSERT INTO match_events (id, match_id, event_type, team, minute, second, payload_json) VALUES ('ev-conn2-${i}', 'm1', 'GOAL', 'AWAY', ${i}, 0, '{}')`
              );
              conn2.execute(`UPDATE matches SET score_away = score_away + 1 WHERE id = 'm1'`);
            });

            const currentScore = conn3.queryOne<{ score_home: number; score_away: number }>(
              "SELECT score_home, score_away FROM matches WHERE id = 'm1'"
            );
            expect(currentScore?.score_home).toBe(i);
            expect(currentScore?.score_away).toBe(i);
          }

          const finalEvents = masterDb.query<{ count: number }>(
            "SELECT count(*) as count FROM match_events WHERE match_id = 'm1'"
          )[0].count;
          expect(finalEvents).toBe(iterations * 2);
        } finally {
          conn1.close();
          conn2.close();
          conn3.close();
        }
      } finally {
        masterDb.close();
      }
    });

    it('1.5: Reader snapshot isolation: Readers never block or wait during active uncommitted writes', () => {
      const writer = new DatabaseClient(dbFile, { enableWal: true, busyTimeout: 5000 });
      const reader = new DatabaseClient(dbFile, { enableWal: true, busyTimeout: 5000 });

      try {
        initSchema(writer.raw);
        writer.execute(
          "INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A')"
        );

        writer.exec('BEGIN IMMEDIATE;');
        writer.execute("UPDATE cohorts SET name = 'Ghost State' WHERE id = 'c1'");

        // Reader should instantaneously read without waiting and see pre-transaction state
        const t0 = performance.now();
        const row = reader.queryOne<{ name: string }>("SELECT name FROM cohorts WHERE id = 'c1'");
        const readDuration = performance.now() - t0;

        expect(readDuration).toBeLessThan(50); // Instantaneous, not blocked by busy_timeout
        expect(row?.name).toBe('Seniors');

        writer.exec('COMMIT;');

        const committedRow = reader.queryOne<{ name: string }>("SELECT name FROM cohorts WHERE id = 'c1'");
        expect(committedRow?.name).toBe('Ghost State');
      } finally {
        writer.close();
        reader.close();
      }
    });
  });

  // =========================================================================
  // CATEGORY 2: Transaction Atomicity & Async Callback Guard
  // =========================================================================
  describe('Category 2: Transaction Atomicity & Async Callback Guard', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
      initSchema(db.raw);
      db.execute(
        "INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A')"
      );
    });

    afterEach(() => {
      db.close();
    });

    it('2.1: Async callback rejection throws synchronous Error with descriptive message', () => {
      expect(() => {
        db.transaction(async () => {
          // async callback returning Promise
        });
      }).toThrow(/Async callbacks are not supported\. Use synchronous callbacks to prevent premature commit\./i);
    });

    it('2.2: Atomicity: Statements executed prior to first await inside async callback are rolled back', () => {
      expect(() => {
        db.transaction((async () => {
          db.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c_async', 'Async Cohort', '2026', '#000')");
          // Statements before await run synchronously when the async function is invoked
          await new Promise((r) => setTimeout(r, 10));
        }) as any);
      }).toThrow(/Async callbacks are not supported/i);

      // Verify that the INSERT was rolled back by the catch block
      const row = db.queryOne("SELECT * FROM cohorts WHERE id = 'c_async'");
      expect(row).toBeNull();
    });

    it('2.3: Savepoint stack integrity: savepointDepth resets to 0 after async rejection', () => {
      expect((db as any).savepointDepth).toBe(0);

      expect(() => {
        db.transaction(async () => {});
      }).toThrow(/Async callbacks are not supported/i);

      // savepointDepth MUST be restored to 0
      expect((db as any).savepointDepth).toBe(0);

      // Immediate subsequent synchronous transaction must succeed without savepoint name conflict
      db.transaction((tx) => {
        expect((tx as any).savepointDepth).toBe(1);
        tx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c2', 'Juniors', '2027', '#DC2626')");
      });

      expect((db as any).savepointDepth).toBe(0);
      const row = db.queryOne("SELECT * FROM cohorts WHERE id = 'c2'");
      expect(row).not.toBeNull();
    });

    it('2.4: Nested transactions: Inner async rejection is isolated without corrupting outer transaction', () => {
      db.transaction((outerTx) => {
        expect((outerTx as any).savepointDepth).toBe(1);
        outerTx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c_outer1', 'Outer 1', '2026', '#111')");

        // Attempt an inner async transaction and catch the error
        let innerFailed = false;
        try {
          outerTx.transaction(async (innerTx) => {
            innerTx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c_inner', 'Inner Async', '2026', '#222')");
          });
        } catch (err: any) {
          innerFailed = true;
          expect(err.message).toMatch(/Async callbacks are not supported/i);
        }
        expect(innerFailed).toBe(true);

        // After inner failure, savepointDepth should have returned to outer depth (1)
        expect((outerTx as any).savepointDepth).toBe(1);

        // Outer transaction continues writing
        outerTx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c_outer2', 'Outer 2', '2026', '#333')");
      });

      // Verification after outer commit:
      expect((db as any).savepointDepth).toBe(0);
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'c_outer1'")).not.toBeNull();
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'c_outer2'")).not.toBeNull();
      // Inner insert must NOT have been committed
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'c_inner'")).toBeNull();
    });

    it('2.5: Nested transactions: Outer rollback aborts entire tree even if inner caught async error', () => {
      expect(() => {
        db.transaction((outerTx) => {
          outerTx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c_abort_outer', 'Outer Abort', '2026', '#111')");

          try {
            outerTx.transaction(async () => {});
          } catch {
            // caught inner async error
          }

          // Outer transaction intentionally fails
          throw new Error('Outer intentional rollback');
        });
      }).toThrow('Outer intentional rollback');

      expect((db as any).savepointDepth).toBe(0);
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'c_abort_outer'")).toBeNull();
    });

    it('2.6: Custom thenable object return triggers async guard and rolls back', () => {
      expect(() => {
        db.transaction(() => {
          db.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c_thenable', 'Thenable', '2026', '#444')");
          // Return a non-Promise thenable
          return {
            then: (onfulfilled: any) => {
              if (onfulfilled) onfulfilled();
            },
          } as any;
        });
      }).toThrow(/Async callbacks are not supported/i);

      expect((db as any).savepointDepth).toBe(0);
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'c_thenable'")).toBeNull();
    });

    it('2.7: Multi-level nested transactions (5 levels) maintain correct savepoint rollback boundaries', () => {
      db.transaction((tx1) => {
        tx1.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('lvl1', 'L1', '2026', '#1')");
        expect((tx1 as any).savepointDepth).toBe(1);

        tx1.transaction((tx2) => {
          tx2.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('lvl2', 'L2', '2026', '#2')");
          expect((tx2 as any).savepointDepth).toBe(2);

          try {
            tx2.transaction((tx3) => {
              tx3.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('lvl3', 'L3', '2026', '#3')");
              expect((tx3 as any).savepointDepth).toBe(3);

              // L3 throws
              throw new Error('Rollback Level 3');
            });
          } catch (err: any) {
            expect(err.message).toBe('Rollback Level 3');
          }

          expect((tx2 as any).savepointDepth).toBe(2);

          tx2.transaction((tx4) => {
            tx4.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('lvl4', 'L4', '2026', '#4')");
            expect((tx4 as any).savepointDepth).toBe(3);
          });

          expect((tx2 as any).savepointDepth).toBe(2);
        });

        expect((tx1 as any).savepointDepth).toBe(1);
      });

      expect((db as any).savepointDepth).toBe(0);

      // Verify outcomes:
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'lvl1'")).not.toBeNull();
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'lvl2'")).not.toBeNull();
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'lvl3'")).toBeNull(); // Rolled back
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'lvl4'")).not.toBeNull(); // Committed
    });

    it('2.8: Synchronous exception rolls back cleanly and restores depth to 0', () => {
      expect(() => {
        db.transaction((tx) => {
          tx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c_fail', 'Fail', '2026', '#999')");
          throw new Error('Sync error');
        });
      }).toThrow('Sync error');

      expect((db as any).savepointDepth).toBe(0);
      expect(db.queryOne("SELECT * FROM cohorts WHERE id = 'c_fail'")).toBeNull();
    });
  });

  // =========================================================================
  // CATEGORY 3: In-Memory Database Isolation Across Multiple Connections
  // =========================================================================
  describe('Category 3: In-Memory Database Isolation Across Multiple Connections', () => {
    it('3.1: Complete schema isolation between independent :memory: instances', () => {
      const client1 = new DatabaseClient(':memory:');
      const client2 = new DatabaseClient(':memory:');

      try {
        initSchema(client1.raw);

        // client1 has 9 schema tables
        const tables1 = client1.query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        expect(tables1.length).toBe(9);

        // client2 must have 0 tables
        const tables2 = client2.query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        expect(tables2.length).toBe(0);

        // Schema query on client2 must fail
        expect(() => client2.query('SELECT * FROM cohorts')).toThrow(/no such table/i);
      } finally {
        client1.close();
        client2.close();
      }
    });

    it('3.2: Mutation isolation: Data inserted and updated in one connection is invisible to others', () => {
      const connA = new DatabaseClient(':memory:');
      const connB = new DatabaseClient(':memory:');

      try {
        initSchema(connA.raw);
        initSchema(connB.raw);

        connA.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A')");
        connB.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c2', 'Juniors', '2027', '#DC2626')");

        expect(connA.queryOne("SELECT * FROM cohorts WHERE id = 'c1'")).not.toBeNull();
        expect(connA.queryOne("SELECT * FROM cohorts WHERE id = 'c2'")).toBeNull();

        expect(connB.queryOne("SELECT * FROM cohorts WHERE id = 'c1'")).toBeNull();
        expect(connB.queryOne("SELECT * FROM cohorts WHERE id = 'c2'")).not.toBeNull();

        // Dropping schema on connA has zero effect on connB
        dropSchema(connA.raw);
        expect(() => connA.query('SELECT * FROM cohorts')).toThrow(/no such table/i);
        expect(connB.queryOne("SELECT * FROM cohorts WHERE id = 'c2'")).not.toBeNull();
      } finally {
        try { connA.close(); } catch {}
        try { connB.close(); } catch {}
      }
    });

    it('3.3: 10-Instance high concurrency isolation stress test', () => {
      const instances: DatabaseClient[] = [];
      const count = 10;
      const opsPerInstance = 50;

      try {
        for (let i = 0; i < count; i++) {
          const client = createDatabase({ path: ':memory:' });
          client.exec(`
            CREATE TABLE session (id INTEGER PRIMARY KEY, conn_index INTEGER, counter INTEGER);
            INSERT INTO session (id, conn_index, counter) VALUES (1, ${i}, 0);
          `);
          instances.push(client);
        }

        // Interleaved operations across all 10 instances
        for (let op = 0; op < opsPerInstance; op++) {
          for (let i = 0; i < count; i++) {
            instances[i].execute('UPDATE session SET counter = counter + 1 WHERE id = 1');
          }
        }

        // Validate complete isolation for each instance
        for (let i = 0; i < count; i++) {
          const row = instances[i].queryOne<{ conn_index: number; counter: number }>(
            'SELECT conn_index, counter FROM session WHERE id = 1'
          );
          expect(row?.conn_index).toBe(i);
          expect(row?.counter).toBe(opsPerInstance);
        }
      } finally {
        for (const inst of instances) {
          try { inst.close(); } catch {}
        }
      }
    });

    it('3.4: Factory vs Singleton semantics: createDatabase creates fresh instances, getDatabase caches singleton', () => {
      // createDatabase returns new instances
      const inst1 = createDatabase({ path: ':memory:' });
      const inst2 = createDatabase({ path: ':memory:' });

      try {
        inst1.exec('CREATE TABLE unique_t1 (val INTEGER);');
        expect(() => inst2.query('SELECT * FROM unique_t1')).toThrow(/no such table/i);

        // getDatabase returns a singleton instance
        resetDatabase();
        const singleton1 = getDatabase({ path: ':memory:' });
        const singleton2 = getDatabase();
        expect(singleton1).toBe(singleton2);

        singleton1.exec('CREATE TABLE shared_singleton (val INTEGER);');
        expect(() => singleton2.query('SELECT * FROM shared_singleton')).not.toThrow();

        // resetDatabase clears singleton
        resetDatabase();
        const singleton3 = getDatabase({ path: ':memory:' });
        expect(singleton1.raw.isOpen).toBe(false);
        expect(singleton3 === singleton1).toBe(false);
        expect(() => singleton3.query('SELECT * FROM shared_singleton')).toThrow(/no such table/i);
      } finally {
        try { inst1.close(); } catch {}
        try { inst2.close(); } catch {}
        resetDatabase();
      }
    });

    it('3.5: Rapid creation and teardown cycle of 50 in-memory databases (no leaks or handle exhaustion)', () => {
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        const tempClient = createDatabase({ path: ':memory:' });
        initSchema(tempClient.raw);
        tempClient.execute(
          "INSERT INTO cohorts (id, name, batch, color) VALUES ('c1', 'Seniors', '2026', '#1E3A8A')"
        );
        const count = tempClient.queryOne<{ c: number }>('SELECT count(*) as c FROM cohorts');
        expect(count?.c).toBe(1);
        tempClient.close();
      }
    });
  });
});
