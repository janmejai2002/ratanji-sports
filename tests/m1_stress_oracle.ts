import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { initSchema } from '../server/db/schema.js';
import { seedDatabase } from '../server/db/seed.js';
import { DatabaseClient } from '../server/db/client.js';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function record(category: string, name: string, passed: boolean, details?: any, error?: string) {
  results.push({ category, name, passed, details, error });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] [${category}] ${name}`);
  if (details) console.log(`       Details:`, typeof details === 'string' ? details : JSON.stringify(details));
  if (error) console.log(`       Error:`, error);
}

function expectThrow(category: string, name: string, fn: () => void, expectedPattern?: RegExp) {
  try {
    fn();
    record(category, name, false, 'Expected function to throw, but it succeeded without error');
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (expectedPattern && !expectedPattern.test(msg)) {
      record(category, name, false, `Threw error but did not match expected pattern ${expectedPattern}`, msg);
    } else {
      record(category, name, true, `Threw expected error: ${msg.split('\n')[0]}`);
    }
  }
}

function setupCleanDb(): DatabaseClient {
  const client = new DatabaseClient(':memory:');
  initSchema(client);
  return client;
}

function setupSeededDb(): DatabaseClient {
  const client = setupCleanDb();
  seedDatabase(client);
  return client;
}

console.log('===============================================================');
console.log('   RATANJI SPORTS - M1 EMPIRICAL STRESS TEST HARNESS & ORACLE  ');
console.log('===============================================================\n');

// ============================================================================
// SUITE 1: FOREIGN KEY VIOLATION REJECTION & CASCADE / RESTRICT BEHAVIOR
// ============================================================================
console.log('--- SUITE 1: Foreign Key Violation Rejection ---');
{
  const client = setupSeededDb();

  // FK 1.1: Player with non-existent cohort
  expectThrow(
    'FOREIGN_KEY',
    'Reject player with non-existent cohort_id',
    () => {
      client.execute(`
        INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
        VALUES ('ply-err-1', 'cohort-nonexistent', 'Ghost Player', '99BM001', 'sport-football', 'ACTIVE')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.2: Player with non-existent primary_sport_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject player with non-existent primary_sport_id',
    () => {
      client.execute(`
        INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
        VALUES ('ply-err-2', 'cohort-seniors', 'Ghost Player', '99BM002', 'sport-fake-99', 'ACTIVE')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.3: Player with non-existent secondary_sport_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject player with non-existent secondary_sport_id',
    () => {
      client.execute(`
        INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, secondary_sport_id, status)
        VALUES ('ply-err-3', 'cohort-seniors', 'Ghost Player', '99BM003', 'sport-football', 'sport-fake-99', 'ACTIVE')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.4: Match with non-existent tournament_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject match with non-existent tournament_id',
    () => {
      client.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
        VALUES ('m-err-1', 'tourn-fake', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.5: Match with non-existent sport_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject match with non-existent sport_id',
    () => {
      client.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
        VALUES ('m-err-2', 'tourn-xlri-2026', 'sport-invalid-sport', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.6: Match with non-existent home_cohort_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject match with non-existent home_cohort_id',
    () => {
      client.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
        VALUES ('m-err-3', 'tourn-xlri-2026', 'sport-football', 'cohort-fake-home', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.7: Match with non-existent away_cohort_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject match with non-existent away_cohort_id',
    () => {
      client.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
        VALUES ('m-err-4', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-fake-away', 'Ground', '2026-10-10', 'DRAFT')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.8: Match with non-existent referee_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject match with non-existent referee_id',
    () => {
      client.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, referee_id)
        VALUES ('m-err-5', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT', 'usr-ghost-ref')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.9: Match Event with non-existent match_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject match_event with non-existent match_id',
    () => {
      client.execute(`
        INSERT INTO match_events (id, match_id, event_type, minute, second)
        VALUES ('ev-err-1', 'match-ghost', 'GOAL', 10, 0)
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.10: Match Event with non-existent player_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject match_event with non-existent player_id',
    () => {
      client.execute(`
        INSERT INTO match_events (id, match_id, event_type, player_id, minute, second)
        VALUES ('ev-err-2', 'match-01', 'GOAL', 'ply-ghost', 10, 0)
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.11: Standings with non-existent cohort_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject standings with non-existent cohort_id',
    () => {
      client.execute(`
        INSERT INTO standings (cohort_id, played, won, drawn, lost, points_for, points_against, points_diff, total_points)
        VALUES ('cohort-ghost', 0, 0, 0, 0, 0, 0, 0, 0)
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.12: Audit Log with non-existent match_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject audit_log with non-existent match_id',
    () => {
      client.execute(`
        INSERT INTO audit_logs (id, match_id, action)
        VALUES ('aud-err-1', 'match-ghost', 'TEST_ACTION')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.13: Audit Log with non-existent user_id
  expectThrow(
    'FOREIGN_KEY',
    'Reject audit_log with non-existent user_id',
    () => {
      client.execute(`
        INSERT INTO audit_logs (id, user_id, action)
        VALUES ('aud-err-2', 'usr-ghost', 'TEST_ACTION')
      `);
    },
    /FOREIGN KEY/i
  );

  // FK 1.14: ON DELETE RESTRICT on sports (sport referenced by players/matches)
  expectThrow(
    'FOREIGN_KEY',
    'Reject DELETE from sports when referenced by active players and matches (RESTRICT)',
    () => {
      client.execute(`DELETE FROM sports WHERE id = 'sport-football'`);
    },
    /FOREIGN KEY/i
  );

  // FK 1.15: ON DELETE RESTRICT on cohorts (cohort referenced by matches)
  expectThrow(
    'FOREIGN_KEY',
    'Reject DELETE from cohorts when referenced by matches (RESTRICT)',
    () => {
      client.execute(`DELETE FROM cohorts WHERE id = 'cohort-seniors'`);
    },
    /FOREIGN KEY/i
  );

  // FK 1.16: ON DELETE CASCADE on matches -> match_events
  {
    const beforeEvents = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM match_events WHERE match_id = 'match-01'`)[0].count;
    client.execute(`DELETE FROM matches WHERE id = 'match-01'`);
    const afterEvents = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM match_events WHERE match_id = 'match-01'`)[0].count;
    const passed = beforeEvents > 0 && afterEvents === 0;
    record('FOREIGN_KEY', 'ON DELETE CASCADE removes match_events when parent match deleted', passed, { beforeEvents, afterEvents });
  }

  // FK 1.17: ON DELETE SET NULL on users -> matches.referee_id
  {
    // match-02 is refereed by usr-ref-1
    client.execute(`
      INSERT INTO users (id, name, email, role) VALUES ('usr-temp-ref', 'Temp Ref', 'temp@xlri.ac.in', 'REFEREE');
    `);
    client.execute(`
      INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status, referee_id)
      VALUES ('m-temp-ref', 'tourn-xlri-2026', 'sport-chess', 'cohort-seniors', 'cohort-juniors', 'Hall', '2026-10-10', 'DRAFT', 'usr-temp-ref');
    `);
    client.execute(`DELETE FROM users WHERE id = 'usr-temp-ref'`);
    const matchRow = client.queryOne<{ referee_id: string | null }>(`SELECT referee_id FROM matches WHERE id = 'm-temp-ref'`);
    const passed = matchRow !== null && matchRow.referee_id === null;
    record('FOREIGN_KEY', 'ON DELETE SET NULL clears referee_id on match when user deleted', passed, matchRow);
  }

  client.close();
}

// ============================================================================
// SUITE 2: UNIQUE CONSTRAINT ENFORCEMENT & ADVERSARIAL CASES
// ============================================================================
console.log('\n--- SUITE 2: Unique Constraint Enforcement ---');
{
  const client = setupSeededDb();

  // UQ 2.1: Duplicate user email
  expectThrow(
    'UNIQUE_CONSTRAINT',
    'Reject duplicate email in users table',
    () => {
      client.execute(`
        INSERT INTO users (id, name, email, role)
        VALUES ('usr-dup', 'Imposter Admin', 'admin@sports.xlridelhi.ac.in', 'ADMIN')
      `);
    },
    /UNIQUE constraint failed: users\.email/i
  );

  // UQ 2.2: Duplicate student_id in players table
  expectThrow(
    'UNIQUE_CONSTRAINT',
    'Reject duplicate student_id in players table',
    () => {
      client.execute(`
        INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
        VALUES ('ply-dup', 'cohort-juniors', 'Imposter Kabir', '26BM001', 'sport-football', 'ACTIVE')
      `);
    },
    /UNIQUE constraint failed: players\.student_id/i
  );

  // UQ 2.3: Duplicate tournament ID (primary key) without REPLACE
  expectThrow(
    'UNIQUE_CONSTRAINT',
    'Reject duplicate primary key in tournaments',
    () => {
      client.execute(`
        INSERT INTO tournaments (id, name, year, start_date, end_date)
        VALUES ('tourn-xlri-2026', 'Duplicate Tournament', 2026, '2026-10-10', '2026-10-18')
      `);
    },
    /UNIQUE constraint failed: tournaments\.id/i
  );

  // UQ 2.4: Duplicate standings cohort_id (primary key) without REPLACE
  expectThrow(
    'UNIQUE_CONSTRAINT',
    'Reject duplicate primary key in standings',
    () => {
      client.execute(`
        INSERT INTO standings (cohort_id, played, won, drawn, lost, points_for, points_against, points_diff, total_points)
        VALUES ('cohort-seniors', 0, 0, 0, 0, 0, 0, 0, 0)
      `);
    },
    /UNIQUE constraint failed: standings\.cohort_id/i
  );

  // UQ 2.5: Duplicate jersey numbers in cohort / sport
  // Does schema enforce UNIQUE(cohort_id, primary_sport_id, jersey_number)?
  {
    let duplicateJerseyThrew = false;
    let errMessage = '';
    try {
      client.execute(`
        INSERT INTO players (id, cohort_id, name, student_id, jersey_number, primary_sport_id, status)
        VALUES ('ply-dup-jersey', 'cohort-seniors', 'Duplicate Jersey Player', '26BM999', 10, 'sport-football', 'ACTIVE')
      `);
    } catch (err: any) {
      duplicateJerseyThrew = true;
      errMessage = err.message;
    }

    if (duplicateJerseyThrew) {
      record('UNIQUE_CONSTRAINT', 'Duplicate jersey number in same cohort and sport rejected by DB schema', true, errMessage);
    } else {
      record('UNIQUE_CONSTRAINT', 'Duplicate jersey number in same cohort and sport permitted by DB schema (No DB-level UNIQUE constraint on jersey_number)', false, {
        note: 'Schema defines jersey_number as unconstrained INTEGER. No UNIQUE(cohort_id, primary_sport_id, jersey_number) constraint exists in schema DDL.',
      });
    }
  }

  // UQ 2.6: CHECK constraint on scoring_type
  expectThrow(
    'CHECK_CONSTRAINT',
    'Reject invalid scoring_type in sports table',
    () => {
      client.execute(`
        INSERT INTO sports (id, name, category, rules_json, scoring_type)
        VALUES ('sport-invalid', 'Quidditch', 'Fantasy', '{}', 'INVALID_SCORING')
      `);
    },
    /CHECK constraint failed/i
  );

  // UQ 2.7: CHECK constraint on user role
  expectThrow(
    'CHECK_CONSTRAINT',
    'Reject invalid role in users table',
    () => {
      client.execute(`
        INSERT INTO users (id, name, email, role)
        VALUES ('usr-bad-role', 'Cheater', 'cheater@xlri.ac.in', 'SUPERADMIN')
      `);
    },
    /CHECK constraint failed/i
  );

  // UQ 2.8: CHECK constraint on player status
  expectThrow(
    'CHECK_CONSTRAINT',
    'Reject invalid status in players table',
    () => {
      client.execute(`
        INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
        VALUES ('ply-bad-status', 'cohort-seniors', 'Ghost', '26BM998', 'sport-football', 'BENCHED')
      `);
    },
    /CHECK constraint failed/i
  );

  // UQ 2.9: CHECK constraint on match status
  expectThrow(
    'CHECK_CONSTRAINT',
    'Reject invalid status in matches table',
    () => {
      client.execute(`
        INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
        VALUES ('m-bad-status', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'FORFEITED')
      `);
    },
    /CHECK constraint failed/i
  );

  // UQ 2.10: CHECK constraint on match event team
  expectThrow(
    'CHECK_CONSTRAINT',
    'Reject invalid team in match_events table',
    () => {
      client.execute(`
        INSERT INTO match_events (id, match_id, event_type, team, minute, second)
        VALUES ('ev-bad-team', 'match-02', 'POINT', 'NEUTRAL', 5, 0)
      `);
    },
    /CHECK constraint failed/i
  );

  client.close();
}

// ============================================================================
// SUITE 3: TRANSACTION ROLLBACK ON MID-OPERATION THROW
// ============================================================================
console.log('\n--- SUITE 3: Transaction Rollback on Mid-Operation Throw ---');
{
  const client = setupCleanDb();

  // TX 3.1: Basic rollback on explicit JavaScript throw
  {
    const beforeCount = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM cohorts`)[0].count;
    let didThrow = false;

    try {
      client.transaction((tx) => {
        tx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-tx-1', 'Batch A', '2026', '#111')`);
        tx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-tx-2', 'Batch B', '2027', '#222')`);
        // Mid-operation simulated failure
        throw new Error('Simulated mid-operation crash in transaction callback');
      });
    } catch (e: any) {
      didThrow = true;
    }

    const afterCount = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM cohorts`)[0].count;
    const c1 = client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-tx-1'`);
    const c2 = client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-tx-2'`);

    const passed = didThrow && beforeCount === afterCount && c1 === null && c2 === null;
    record('TRANSACTION_ROLLBACK', 'Rollback all inserted rows on mid-operation JS throw', passed, {
      beforeCount,
      afterCount,
      c1Exists: !!c1,
      c2Exists: !!c2,
    });
  }

  // TX 3.2: Rollback on mid-operation SQLite constraint violation
  {
    client.execute(`INSERT INTO users (id, name, email, role) VALUES ('usr-existing', 'Original', 'orig@xlri.ac.in', 'SPECTATOR')`);
    const beforeUsers = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM users`)[0].count;

    let didThrow = false;
    try {
      client.transaction((tx) => {
        tx.execute(`INSERT INTO users (id, name, email, role) VALUES ('usr-new-1', 'New One', 'new1@xlri.ac.in', 'REFEREE')`);
        // Duplicate email violation triggering SQLite error
        tx.execute(`INSERT INTO users (id, name, email, role) VALUES ('usr-new-2', 'New Two', 'orig@xlri.ac.in', 'REFEREE')`);
      });
    } catch (e: any) {
      didThrow = true;
    }

    const afterUsers = client.query<{ count: number }>(`SELECT COUNT(*) as count FROM users`)[0].count;
    const new1 = client.queryOne(`SELECT * FROM users WHERE id = 'usr-new-1'`);

    const passed = didThrow && beforeUsers === afterUsers && new1 === null;
    record('TRANSACTION_ROLLBACK', 'Rollback preceding rows when SQLite constraint violation occurs mid-transaction', passed, {
      beforeUsers,
      afterUsers,
      new1Exists: !!new1,
    });
  }

  // TX 3.3: Nested Transactions - Inner Rollback caught by Outer
  {
    client.execute(`INSERT INTO tournaments (id, name, year, start_date, end_date) VALUES ('t-nest', 'Fest', 2026, '2026-10-10', '2026-10-18')`);

    client.transaction((outerTx) => {
      outerTx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-outer', 'Outer Cohort', '2026', '#333')`);

      try {
        outerTx.transaction((innerTx) => {
          innerTx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-inner-failed', 'Inner Fail', '2027', '#444')`);
          throw new Error('Inner transaction failure');
        });
      } catch (innerErr) {
        // Outer tx handles inner failure gracefully
      }

      outerTx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-outer-commit', 'Outer Commit', '2028', '#555')`);
    });

    const cOuter = client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-outer'`);
    const cInner = client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-inner-failed'`);
    const cOuterCommit = client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-outer-commit'`);

    const passed = cOuter !== null && cInner === null && cOuterCommit !== null;
    record('TRANSACTION_ROLLBACK', 'Nested transaction: inner rollback does not abort outer transaction if caught', passed, {
      cOuter: !!cOuter,
      cInnerRolledBack: cInner === null,
      cOuterCommit: !!cOuterCommit,
    });
  }

  // TX 3.4: Nested Transactions - Outer Rollback rolls back committed inner transactions
  {
    let outerDidThrow = false;
    try {
      client.transaction((outerTx) => {
        outerTx.execute(`INSERT INTO sports (id, name, category, scoring_type) VALUES ('sp-out-1', 'Sport 1', 'Cat', 'GENERIC')`);

        // Inner transaction succeeds
        outerTx.transaction((innerTx) => {
          innerTx.execute(`INSERT INTO sports (id, name, category, scoring_type) VALUES ('sp-in-1', 'Sport Inner', 'Cat', 'GENERIC')`);
        });

        // Later, outer transaction fails
        throw new Error('Outer transaction failed after inner success');
      });
    } catch {
      outerDidThrow = true;
    }

    const spOut = client.queryOne(`SELECT * FROM sports WHERE id = 'sp-out-1'`);
    const spIn = client.queryOne(`SELECT * FROM sports WHERE id = 'sp-in-1'`);

    const passed = outerDidThrow && spOut === null && spIn === null;
    record('TRANSACTION_ROLLBACK', 'Nested transaction: outer rollback reverts inner transaction that previously completed', passed, {
      outerDidThrow,
      spOutRolledBack: spOut === null,
      spInRolledBack: spIn === null,
    });
  }

  client.close();
}

// ============================================================================
// SUITE 4: IDEMPOTENCE OF SEED.TS
// ============================================================================
console.log('\n--- SUITE 4: Idempotence of seed.ts ---');
{
  const client = setupCleanDb();

  // Run seed 1
  seedDatabase(client);

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

  const counts1 = getCounts(client);

  // Run seed 2 without clean
  let seed2Error: string | null = null;
  try {
    seedDatabase(client, { clean: false });
  } catch (err: any) {
    seed2Error = err.message || String(err);
  }

  const counts2 = getCounts(client);

  // Run seed 3 without clean
  let seed3Error: string | null = null;
  try {
    seedDatabase(client, { clean: false });
  } catch (err: any) {
    seed3Error = err.message || String(err);
  }

  const counts3 = getCounts(client);

  const noErrors = seed2Error === null && seed3Error === null;
  const countsIdentical = JSON.stringify(counts1) === JSON.stringify(counts2) && JSON.stringify(counts2) === JSON.stringify(counts3);

  record('SEED_IDEMPOTENCE', 'Executing seedDatabase multiple times (run 2 and 3 without clean) produces zero errors', noErrors, {
    seed2Error,
    seed3Error,
  });

  record('SEED_IDEMPOTENCE', 'Executing seedDatabase multiple times produces exact identical table row counts', countsIdentical, {
    run1: counts1,
    run2: counts2,
    run3: counts3,
  });

  // Verify that data integrity wasn't scrambled
  const seniorsStanding = client.queryOne<any>(`SELECT * FROM standings WHERE cohort_id = 'cohort-seniors'`);
  const standingPreserved = seniorsStanding?.played === 4 && seniorsStanding?.won === 2 && seniorsStanding?.total_points === 7;
  record('SEED_IDEMPOTENCE', 'Standings data integrity preserved across multiple seed executions', standingPreserved, seniorsStanding);

  // Test seedDatabase with { clean: true }
  let cleanSeedError: string | null = null;
  try {
    seedDatabase(client, { clean: true });
    seedDatabase(client, { clean: true });
  } catch (err: any) {
    cleanSeedError = err.message || String(err);
  }

  const countsClean = getCounts(client);
  const cleanPassed = cleanSeedError === null && JSON.stringify(countsClean) === JSON.stringify(counts1);
  record('SEED_IDEMPOTENCE', 'Executing seedDatabase({ clean: true }) multiple times is clean and idempotent', cleanPassed, {
    cleanSeedError,
    countsClean,
  });

  client.close();
}

// ============================================================================
// SUITE 5: PERSISTENT FILE DATABASE (WAL MODE) VERIFICATION
// ============================================================================
console.log('\n--- SUITE 5: Persistent SQLite File & WAL Mode Verification ---');
{
  const testDbFile = path.resolve(process.cwd(), 'test_ratanji_stress.db');
  if (fs.existsSync(testDbFile)) {
    fs.unlinkSync(testDbFile);
  }
  const testWalFile = testDbFile + '-wal';
  const testShmFile = testDbFile + '-shm';
  if (fs.existsSync(testWalFile)) fs.unlinkSync(testWalFile);
  if (fs.existsSync(testShmFile)) fs.unlinkSync(testShmFile);

  const fileClient = new DatabaseClient(testDbFile);
  initSchema(fileClient);
  seedDatabase(fileClient);

  // Check journal_mode
  const journalMode = fileClient.queryOne<{ journal_mode: string }>(`PRAGMA journal_mode;`)?.journal_mode;
  const fkMode = fileClient.queryOne<{ foreign_keys: number }>(`PRAGMA foreign_keys;`)?.foreign_keys;

  const walActive = journalMode?.toLowerCase() === 'wal';
  const fkActive = fkMode === 1;

  record('PERSISTENT_WAL', 'Persistent file database opens with PRAGMA journal_mode = WAL', walActive, { journalMode });
  record('PERSISTENT_WAL', 'Persistent file database opens with PRAGMA foreign_keys = ON (1)', fkActive, { fkMode });

  // Re-seed file client twice
  let fileReseedError: string | null = null;
  try {
    seedDatabase(fileClient, { clean: false });
  } catch (err: any) {
    fileReseedError = err.message;
  }
  record('PERSISTENT_WAL', 'Re-seeding persistent file database without clean executes cleanly', fileReseedError === null, { fileReseedError });

  fileClient.close();

  // Cleanup test db
  try {
    if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
    if (fs.existsSync(testWalFile)) fs.unlinkSync(testWalFile);
    if (fs.existsSync(testShmFile)) fs.unlinkSync(testShmFile);
  } catch {}
}

console.log('\n===============================================================');
console.log('                      TEST SUMMARY REPORT                      ');
console.log('===============================================================');
const passedCount = results.filter((r) => r.passed).length;
const failedCount = results.filter((r) => !r.passed).length;
console.log(`Total Tests Run: ${results.length}`);
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);

if (failedCount > 0) {
  console.log('\nFailed Tests:');
  for (const f of results.filter((r) => !r.passed)) {
    console.log(` - [${f.category}] ${f.name}`);
    if (f.details) console.log(`   ${JSON.stringify(f.details)}`);
  }
}
console.log('===============================================================\n');
