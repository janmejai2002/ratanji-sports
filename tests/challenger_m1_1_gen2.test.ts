import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DatabaseClient, createDatabase } from '../server/db/client.js';
import { initSchema, dropSchema, SCHEMA_DDL } from '../server/db/schema.js';
import { seedDatabase } from '../server/db/seed.js';

describe('Challenger M1-1 Gen2 Empirical Challenge Suite', () => {
  let client: DatabaseClient;

  beforeEach(() => {
    client = new DatabaseClient(':memory:');
    initSchema(client);
    seedDatabase(client);
  });

  afterEach(() => {
    try {
      client.close();
    } catch {
      // ignore
    }
  });

  // =========================================================================
  // SECTION 1: Parameter Sanitization with Edge-Case Types (client.ts)
  // =========================================================================
  describe('1. Parameter Sanitization & Edge-Case Types', () => {
    it('PARAM-01: booleans coerce to 1 and 0 in positional parameters', () => {
      const res = client.query<{ valTrue: number; valFalse: number }>(
        'SELECT ? as valTrue, ? as valFalse',
        [true, false]
      );
      expect(res).toHaveLength(1);
      expect(res[0].valTrue).toBe(1);
      expect(res[0].valFalse).toBe(0);
    });

    it('PARAM-02: undefined coerces to null in positional parameters', () => {
      const res = client.query<{ val: any; is_null: number }>(
        'SELECT ? as val, (CASE WHEN ? IS NULL THEN 1 ELSE 0 END) as is_null',
        [undefined, undefined]
      );
      expect(res).toHaveLength(1);
      expect(res[0].val).toBeNull();
      expect(res[0].is_null).toBe(1);
    });

    it('PARAM-03: null binds correctly as NULL', () => {
      const res = client.query<{ val: any; is_null: number }>(
        'SELECT ? as val, (CASE WHEN ? IS NULL THEN 1 ELSE 0 END) as is_null',
        [null, null]
      );
      expect(res).toHaveLength(1);
      expect(res[0].val).toBeNull();
      expect(res[0].is_null).toBe(1);
    });

    it('PARAM-04: Date instances coerce to ISO-8601 strings', () => {
      const date = new Date('2026-10-15T14:30:00.000Z');
      const res = client.query<{ dt: string }>(
        'SELECT ? as dt',
        [date]
      );
      expect(res).toHaveLength(1);
      expect(res[0].dt).toBe('2026-10-15T14:30:00.000Z');
    });

    it('PARAM-05: handles named parameter dictionary with mixed edge types', () => {
      const date = new Date('2026-10-20T09:00:00.000Z');
      const res = client.query<{ b1: number; b2: number; u: any; n: any; d: string; num: number; str: string }>(
        'SELECT :b1 as b1, :b2 as b2, :u as u, :n as n, :d as d, :num as num, :str as str',
        {
          b1: true,
          b2: false,
          u: undefined,
          n: null,
          d: date,
          num: 42.5,
          str: 'xlri-sports',
        }
      );
      expect(res).toHaveLength(1);
      expect(res[0].b1).toBe(1);
      expect(res[0].b2).toBe(0);
      expect(res[0].u).toBeNull();
      expect(res[0].n).toBeNull();
      expect(res[0].d).toBe('2026-10-20T09:00:00.000Z');
      expect(res[0].num).toBe(42.5);
      expect(res[0].str).toBe('xlri-sports');
    });

    it('PARAM-06: queryOne and execute sanitize parameters consistently', () => {
      // test execute with boolean and undefined
      client.execute(
        `INSERT INTO audit_logs (id, match_id, user_id, action, notes) VALUES (?, ?, ?, ?, ?)`,
        ['aud-param-test', 'match-01', 'usr-admin-1', 'PARAM_TEST', undefined]
      );

      const log = client.queryOne<{ id: string; notes: string | null }>(
        'SELECT id, notes FROM audit_logs WHERE id = ?',
        ['aud-param-test']
      );
      expect(log).not.toBeNull();
      expect(log?.id).toBe('aud-param-test');
      expect(log?.notes).toBeNull();
    });

    it('PARAM-07: handles empty array and empty object parameters without throwing', () => {
      // empty array
      const resArr = client.query<{ val: number }>('SELECT 1 as val', []);
      expect(resArr).toHaveLength(1);
      expect(resArr[0].val).toBe(1);

      // empty object
      const resObj = client.query<{ val: number }>('SELECT 1 as val', {});
      expect(resObj).toHaveLength(1);
      expect(resObj[0].val).toBe(1);

      // undefined/null params
      const resUndef = client.query<{ val: number }>('SELECT 1 as val', undefined);
      expect(resUndef).toHaveLength(1);
      expect(resUndef[0].val).toBe(1);

      const resNull = client.query<{ val: number }>('SELECT 1 as val', null as any);
      expect(resNull).toHaveLength(1);
      expect(resNull[0].val).toBe(1);
    });

    it('PARAM-08: preserves special string values (SQL injection attempts, emojis, whitespace, quotes)', () => {
      const injectionAttempt = "'; DROP TABLE cohorts; --";
      const emojiString = "⚽ 🏏 🏀 🏸 🏆 XLRI Champions 2026";
      const multilineQuotes = "He said: 'It's a goal!'\nLine 2 with \t tabs.";

      client.execute(
        `INSERT INTO audit_logs (id, match_id, user_id, action, notes) VALUES (?, ?, ?, ?, ?)`,
        ['aud-inject-test', 'match-01', 'usr-admin-1', 'INJECT_TEST', injectionAttempt]
      );
      client.execute(
        `INSERT INTO audit_logs (id, match_id, user_id, action, notes) VALUES (?, ?, ?, ?, ?)`,
        ['aud-emoji-test', 'match-01', 'usr-admin-1', 'EMOJI_TEST', emojiString]
      );
      client.execute(
        `INSERT INTO audit_logs (id, match_id, user_id, action, notes) VALUES (?, ?, ?, ?, ?)`,
        ['aud-quote-test', 'match-01', 'usr-admin-1', 'QUOTE_TEST', multilineQuotes]
      );

      // Verify cohorts table was NOT dropped
      const cohorts = client.query('SELECT * FROM cohorts');
      expect(cohorts.length).toBe(2);

      const row1 = client.queryOne<{ notes: string }>('SELECT notes FROM audit_logs WHERE id = ?', ['aud-inject-test']);
      expect(row1?.notes).toBe(injectionAttempt);

      const row2 = client.queryOne<{ notes: string }>('SELECT notes FROM audit_logs WHERE id = ?', ['aud-emoji-test']);
      expect(row2?.notes).toBe(emojiString);

      const row3 = client.queryOne<{ notes: string }>('SELECT notes FROM audit_logs WHERE id = ?', ['aud-quote-test']);
      expect(row3?.notes).toBe(multilineQuotes);
    });
  });

  // =========================================================================
  // SECTION 2: Savepoint Rollbacks & Transaction Integrity (client.ts)
  // =========================================================================
  describe('2. Savepoint Rollbacks & Transaction Integrity', () => {
    it('TX-01: atomic commit persists all operations when callback completes successfully', () => {
      const result = client.transaction((tx) => {
        tx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-tx-commit', 'Test Cohort', '2028', '#ABC')");
        tx.execute("INSERT INTO audit_logs (id, action) VALUES ('aud-tx-commit', 'TX_SUCCESS')");
        return 'SUCCESS_TOKEN';
      });

      expect(result).toBe('SUCCESS_TOKEN');
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-tx-commit'")).not.toBeNull();
      expect(client.queryOne("SELECT * FROM audit_logs WHERE id = 'aud-tx-commit'")).not.toBeNull();
    });

    it('TX-02: explicit error completely rolls back all operations inside transaction', () => {
      expect(() => {
        client.transaction((tx) => {
          tx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-tx-abort', 'Abort Cohort', '2028', '#DEF')");
          throw new Error('Forced failure mid-transaction');
        });
      }).toThrow('Forced failure mid-transaction');

      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-tx-abort'")).toBeNull();
    });

    it('TX-03: rejects async callbacks with explicit error and rolls back writes', () => {
      expect(() => {
        client.transaction((async (tx: DatabaseClient) => {
          tx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-async-fail', 'Async Cohort', '2028', '#999')");
          return 'done';
        }) as any);
      }).toThrow(/Async callbacks are not supported/i);

      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-async-fail'")).toBeNull();
    });

    it('TX-04: nested savepoint isolation: inner rollback does not abort outer transaction', () => {
      client.transaction((outer) => {
        outer.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-outer-1', 'Outer 1', '2028', '#111')");

        // Inner transaction fails and is caught
        try {
          outer.transaction((inner) => {
            inner.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-inner-fail', 'Inner Fail', '2028', '#222')");
            throw new Error('Inner savepoint failed');
          });
        } catch (e: any) {
          expect(e.message).toBe('Inner savepoint failed');
        }

        // Outer proceeds with another insert
        outer.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-outer-2', 'Outer 2', '2028', '#333')");
      });

      // c-outer-1 and c-outer-2 should be committed; c-inner-fail must be rolled back
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-outer-1'")).not.toBeNull();
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-inner-fail'")).toBeNull();
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-outer-2'")).not.toBeNull();
    });

    it('TX-05: outer transaction failure rolls back both outer and previously committed inner savepoints', () => {
      expect(() => {
        client.transaction((outer) => {
          outer.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-outer-root', 'Outer Root', '2028', '#AAA')");

          outer.transaction((inner) => {
            inner.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-inner-saved', 'Inner Saved', '2028', '#BBB')");
          });

          // Both were inserted, now outer throws
          throw new Error('Outer crashed after inner finished');
        });
      }).toThrow('Outer crashed after inner finished');

      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-outer-root'")).toBeNull();
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-inner-saved'")).toBeNull();
    });

    it('TX-06: deep 4-level nested savepoints handle selective recovery cleanly', () => {
      client.transaction((l1) => {
        l1.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-l1', 'Level 1', '2028', '#001')");

        l1.transaction((l2) => {
          l2.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-l2', 'Level 2', '2028', '#002')");

          try {
            l2.transaction((l3) => {
              l3.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-l3', 'Level 3', '2028', '#003')");

              l3.transaction((l4) => {
                l4.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-l4', 'Level 4', '2028', '#004')");
                throw new Error('Level 4 boom');
              });
            });
          } catch (e: any) {
            expect(e.message).toBe('Level 4 boom');
          }

          l2.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-l2-after', 'Level 2 After', '2028', '#005')");
        });
      });

      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-l1'")).not.toBeNull();
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-l2'")).not.toBeNull();
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-l3'")).toBeNull();
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-l4'")).toBeNull();
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-l2-after'")).not.toBeNull();
    });

    it('TX-07: consecutive transaction failures do not leak savepoint depth or corrupt subsequent transactions', () => {
      for (let i = 1; i <= 10; i++) {
        expect(() => {
          client.transaction((tx) => {
            tx.execute(`INSERT INTO cohorts (id, name, batch, color) VALUES ('c-loop-${i}', 'Loop', '2028', '#000')`);
            throw new Error(`Failed run ${i}`);
          });
        }).toThrow(`Failed run ${i}`);
      }

      // 11th run must succeed cleanly
      const finalResult = client.transaction((tx) => {
        tx.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('c-final', 'Final Clean', '2028', '#FFF')");
        return 'CLEAN_PASS';
      });

      expect(finalResult).toBe('CLEAN_PASS');
      expect(client.queryOne("SELECT * FROM cohorts WHERE id = 'c-final'")).not.toBeNull();

      // None of the 10 failed inserts should exist
      for (let i = 1; i <= 10; i++) {
        expect(client.queryOne(`SELECT * FROM cohorts WHERE id = 'c-loop-${i}'`)).toBeNull();
      }
    });
  });

  // =========================================================================
  // SECTION 3: Foreign Key Constraints & Cascades (schema.ts)
  // =========================================================================
  describe('3. Foreign Key Constraints & Cascades', () => {
    it('FK-01: rejects player with invalid cohort_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
          VALUES ('ply-fk-cohort', 'cohort-nonexistent', 'No Cohort', '26BM991', 'sport-football', 'ACTIVE')
        `);
      }).toThrow(/FOREIGN KEY/i);
    });

    it('FK-02: rejects player with invalid primary_sport_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
          VALUES ('ply-fk-sport', 'cohort-seniors', 'No Sport', '26BM992', 'sport-nonexistent', 'ACTIVE')
        `);
      }).toThrow(/FOREIGN KEY/i);
    });

    it('FK-03: rejects player with invalid secondary_sport_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, secondary_sport_id, status)
          VALUES ('ply-fk-sec-sport', 'cohort-seniors', 'No Sec Sport', '26BM993', 'sport-football', 'sport-fake', 'ACTIVE')
        `);
      }).toThrow(/FOREIGN KEY/i);
    });

    it('FK-04: rejects match with invalid tournament_id, sport_id, or cohorts', () => {
      // Invalid tournament
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
          VALUES ('m-bad-tourn', 'tourn-fake', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT')
        `);
      }).toThrow(/FOREIGN KEY/i);

      // Invalid home cohort
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
          VALUES ('m-bad-home', 'tourn-xlri-2026', 'sport-football', 'cohort-fake', 'cohort-juniors', 'Ground', '2026-10-10', 'DRAFT')
        `);
      }).toThrow(/FOREIGN KEY/i);

      // Invalid away cohort
      expect(() => {
        client.execute(`
          INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status)
          VALUES ('m-bad-away', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-fake', 'Ground', '2026-10-10', 'DRAFT')
        `);
      }).toThrow(/FOREIGN KEY/i);
    });

    it('FK-05: rejects match_events with invalid match_id or player_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO match_events (id, match_id, event_type, minute, second)
          VALUES ('ev-bad-match', 'match-fake', 'GOAL', 10, 0)
        `);
      }).toThrow(/FOREIGN KEY/i);

      expect(() => {
        client.execute(`
          INSERT INTO match_events (id, match_id, event_type, player_id, minute, second)
          VALUES ('ev-bad-player', 'match-01', 'GOAL', 'ply-fake', 10, 0)
        `);
      }).toThrow(/FOREIGN KEY/i);
    });

    it('FK-06: rejects standings insert with invalid cohort_id', () => {
      expect(() => {
        client.execute(`
          INSERT INTO standings (cohort_id, played, won, drawn, lost, points_for, points_against, points_diff, total_points)
          VALUES ('cohort-ghost-standings', 1, 1, 0, 0, 10, 0, 10, 3)
        `);
      }).toThrow(/FOREIGN KEY/i);
    });

    it('FK-07: restricts deletion of sport referenced by players or matches (ON DELETE RESTRICT)', () => {
      expect(() => {
        client.execute("DELETE FROM sports WHERE id = 'sport-football'");
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('FK-08: cascades deletion of match to match_events (ON DELETE CASCADE)', () => {
      const initialEvents = client.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM match_events WHERE match_id = 'match-01'"
      )[0].count;
      expect(initialEvents).toBeGreaterThan(0);

      client.execute("DELETE FROM matches WHERE id = 'match-01'");

      const finalEvents = client.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM match_events WHERE match_id = 'match-01'"
      )[0].count;
      expect(finalEvents).toBe(0);
    });

    it('FK-09: sets player_id to NULL on match_events when player is deleted (ON DELETE SET NULL)', () => {
      // First ensure player ply-26bm003 has an event in match-01 (ev-04)
      const evBefore = client.queryOne<{ player_id: string }>(
        "SELECT player_id FROM match_events WHERE id = 'ev-04'"
      );
      expect(evBefore?.player_id).toBe('ply-26bm003');

      // Delete player ply-26bm003
      client.execute("DELETE FROM players WHERE id = 'ply-26bm003'");

      // Event should still exist with player_id = NULL
      const evAfter = client.queryOne<{ player_id: string | null }>(
        "SELECT player_id FROM match_events WHERE id = 'ev-04'"
      );
      expect(evAfter).not.toBeNull();
      expect(evAfter?.player_id).toBeNull();
    });

    it('FK-10: sets secondary_sport_id to NULL when secondary sport is deleted (ON DELETE SET NULL)', () => {
      // sport-pool is not used as primary sport by ply-26bm001, but let's assign sport-pool as secondary sport
      client.execute(
        "UPDATE players SET secondary_sport_id = 'sport-pool' WHERE id = 'ply-26bm003'"
      );
      expect(
        client.queryOne<{ secondary_sport_id: string }>(
          "SELECT secondary_sport_id FROM players WHERE id = 'ply-26bm003'"
        )?.secondary_sport_id
      ).toBe('sport-pool');

      // Now create a dummy sport that is only used as secondary
      client.execute(
        "INSERT INTO sports (id, name, category, rules_json, scoring_type) VALUES ('sport-dummy-sec', 'Dummy Sec', 'Temp', '{}', 'GENERIC')"
      );
      client.execute(
        "UPDATE players SET secondary_sport_id = 'sport-dummy-sec' WHERE id = 'ply-26bm002'"
      );

      // Delete sport-dummy-sec
      client.execute("DELETE FROM sports WHERE id = 'sport-dummy-sec'");

      const pAfter = client.queryOne<{ secondary_sport_id: string | null }>(
        "SELECT secondary_sport_id FROM players WHERE id = 'ply-26bm002'"
      );
      expect(pAfter?.secondary_sport_id).toBeNull();
    });
  });

  // =========================================================================
  // SECTION 4: Check & Unique Constraints (schema.ts)
  // =========================================================================
  describe('4. Check & Unique Constraints', () => {
    it('CHK-01: sports scoring_type check constraint enforces valid sports enum', () => {
      const validTypes = ['FOOTBALL', 'CRICKET', 'BASKETBALL', 'BADMINTON', 'GENERIC', 'football', 'Cricket'];
      for (const t of validTypes) {
        expect(() => {
          client.execute(
            `INSERT INTO sports (id, name, category, rules_json, scoring_type) VALUES ('sport-chk-${t}', 'Name', 'Cat', '{}', ?)`,
            [t]
          );
        }).not.toThrow();
      }

      const invalidTypes = ['RUGBY', 'TENNIS', 'HOCKEY', 'BASEBALL', '', 'NULL'];
      for (const t of invalidTypes) {
        expect(() => {
          client.execute(
            `INSERT INTO sports (id, name, category, rules_json, scoring_type) VALUES ('sport-chk-inv-${t}', 'Name', 'Cat', '{}', ?)`,
            [t]
          );
        }).toThrow(/CHECK constraint failed/i);
      }
    });

    it('CHK-02: users role check constraint enforces ADMIN, REFEREE, SPECTATOR', () => {
      const validRoles = ['ADMIN', 'REFEREE', 'SPECTATOR', 'admin', 'referee', 'spectator'];
      for (const r of validRoles) {
        expect(() => {
          client.execute(
            `INSERT INTO users (id, name, email, role) VALUES ('usr-chk-${r}', 'Name', 'email-${r}@xlri.ac.in', ?)`,
            [r]
          );
        }).not.toThrow();
      }

      const invalidRoles = ['SUPERADMIN', 'MODERATOR', 'PLAYER', 'COACH', '', 'GUEST'];
      for (const r of invalidRoles) {
        expect(() => {
          client.execute(
            `INSERT INTO users (id, name, email, role) VALUES ('usr-chk-inv-${r}', 'Name', 'email-inv-${r}@xlri.ac.in', ?)`,
            [r]
          );
        }).toThrow(/CHECK constraint failed/i);
      }
    });

    it('CHK-03: players status check constraint enforces ACTIVE, INJURED, RESERVE, INACTIVE', () => {
      const validStatuses = ['ACTIVE', 'INJURED', 'RESERVE', 'INACTIVE', 'active', 'injured'];
      for (const s of validStatuses) {
        expect(() => {
          client.execute(
            `INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status) VALUES ('ply-chk-${s}', 'cohort-seniors', 'P', 'STU-${s}', 'sport-football', ?)`,
            [s]
          );
        }).not.toThrow();
      }

      const invalidStatuses = ['SUSPENDED', 'BENCHED', 'RETIRED', '', 'UNAVAILABLE'];
      for (const s of invalidStatuses) {
        expect(() => {
          client.execute(
            `INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status) VALUES ('ply-chk-inv-${s}', 'cohort-seniors', 'P', 'STU-INV-${s}', 'sport-football', ?)`,
            [s]
          );
        }).toThrow(/CHECK constraint failed/i);
      }
    });

    it('CHK-04: matches status check constraint enforces valid tournament statuses', () => {
      const validStatuses = ['SCHEDULED', 'DRAFT', 'SUBMITTED', 'VERIFIED', 'PUBLISHED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED'];
      for (const s of validStatuses) {
        expect(() => {
          client.execute(
            `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status) VALUES ('m-chk-${s}', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', ?)`,
            [s]
          );
        }).not.toThrow();
      }

      const invalidStatuses = ['POSTPONED', 'PAUSED', 'PENDING', '', 'ABANDONED'];
      for (const s of invalidStatuses) {
        expect(() => {
          client.execute(
            `INSERT INTO matches (id, tournament_id, sport_id, home_cohort_id, away_cohort_id, venue, scheduled_at, status) VALUES ('m-chk-inv-${s}', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-juniors', 'Ground', '2026-10-10', ?)`,
            [s]
          );
        }).toThrow(/CHECK constraint failed/i);
      }
    });

    it('CHK-05: match_events team check constraint enforces HOME, AWAY or NULL', () => {
      expect(() => {
        client.execute(
          `INSERT INTO match_events (id, match_id, event_type, team, minute, second) VALUES ('ev-team-home', 'match-01', 'GOAL', 'HOME', 1, 0)`
        );
        client.execute(
          `INSERT INTO match_events (id, match_id, event_type, team, minute, second) VALUES ('ev-team-away', 'match-01', 'GOAL', 'AWAY', 2, 0)`
        );
        client.execute(
          `INSERT INTO match_events (id, match_id, event_type, team, minute, second) VALUES ('ev-team-null', 'match-01', 'WHISTLE', NULL, 3, 0)`
        );
      }).not.toThrow();

      expect(() => {
        client.execute(
          `INSERT INTO match_events (id, match_id, event_type, team, minute, second) VALUES ('ev-team-inv', 'match-01', 'GOAL', 'DRAW', 4, 0)`
        );
      }).toThrow(/CHECK constraint failed/i);
    });

    it('UQ-01: users email uniqueness is strictly enforced', () => {
      expect(() => {
        client.execute(`
          INSERT INTO users (id, name, email, role)
          VALUES ('usr-dup-1', 'Duplicate Admin', 'admin@sports.xlridelhi.ac.in', 'ADMIN')
        `);
      }).toThrow(/UNIQUE constraint failed: users\.email/i);
    });

    it('UQ-02: players student_id uniqueness is strictly enforced', () => {
      expect(() => {
        client.execute(`
          INSERT INTO players (id, cohort_id, name, student_id, primary_sport_id, status)
          VALUES ('ply-dup-1', 'cohort-juniors', 'Dup Student', '26BM001', 'sport-football', 'ACTIVE')
        `);
      }).toThrow(/UNIQUE constraint failed: players\.student_id/i);
    });

    it('UQ-03: primary key uniqueness is enforced across all tables', () => {
      expect(() => {
        client.execute("INSERT INTO cohorts (id, name, batch, color) VALUES ('cohort-seniors', 'Dup', '2026', '#000')");
      }).toThrow(/UNIQUE constraint failed: cohorts\.id/i);

      expect(() => {
        client.execute("INSERT INTO tournaments (id, name, start_date, end_date) VALUES ('tourn-xlri-2026', 'Dup', '2026-10-10', '2026-10-18')");
      }).toThrow(/UNIQUE constraint failed: tournaments\.id/i);

      expect(() => {
        client.execute("INSERT INTO sports (id, name, category, scoring_type) VALUES ('sport-football', 'Dup', 'Outdoor', 'FOOTBALL')");
      }).toThrow(/UNIQUE constraint failed: sports\.id/i);
    });
  });

  // =========================================================================
  // SECTION 5: 15-Sport Roster Parity & Distribution Verification (seed.ts)
  // =========================================================================
  describe('5. 15-Sport Roster Parity & Cohort Distribution', () => {
    it('SEED-ROSTER-01: all 15 sports have >= 2 players in both Seniors and Juniors cohorts', () => {
      const sports = client.query<{ id: string; name: string }>('SELECT id, name FROM sports ORDER BY name ASC');
      expect(sports).toHaveLength(15);

      const sportBreakdown = client.query<{
        id: string;
        name: string;
        total: number;
        seniors: number;
        juniors: number;
      }>(`
        SELECT 
          s.id,
          s.name,
          COUNT(p.id) as total,
          SUM(CASE WHEN p.cohort_id = 'cohort-seniors' THEN 1 ELSE 0 END) as seniors,
          SUM(CASE WHEN p.cohort_id = 'cohort-juniors' THEN 1 ELSE 0 END) as juniors
        FROM sports s
        LEFT JOIN players p ON p.primary_sport_id = s.id
        GROUP BY s.id
        ORDER BY s.name ASC
      `);

      expect(sportBreakdown).toHaveLength(15);

      for (const row of sportBreakdown) {
        expect(
          row.seniors,
          `Sport "${row.name}" (${row.id}) must have >= 2 senior players, found ${row.seniors}`
        ).toBeGreaterThanOrEqual(2);

        expect(
          row.juniors,
          `Sport "${row.name}" (${row.id}) must have >= 2 junior players, found ${row.juniors}`
        ).toBeGreaterThanOrEqual(2);

        expect(row.seniors + row.juniors).toBe(row.total);
      }
    });

    it('SEED-ROSTER-02: total player count is exactly 154 (77 Seniors, 77 Juniors)', () => {
      const totalPlayers = client.query<{ count: number }>('SELECT COUNT(*) as count FROM players')[0].count;
      expect(totalPlayers).toBe(154);

      const seniors = client.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM players WHERE cohort_id = 'cohort-seniors'"
      )[0].count;
      const juniors = client.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM players WHERE cohort_id = 'cohort-juniors'"
      )[0].count;

      expect(seniors).toBe(77);
      expect(juniors).toBe(77);
      expect(seniors + juniors).toBe(154);
    });

    it('SEED-ROSTER-03: player status breakdown is exactly 144 Active and 10 Injured (5 Seniors, 5 Juniors)', () => {
      const statusCounts = client.query<{ status: string; count: number }>(
        'SELECT status, COUNT(*) as count FROM players GROUP BY status'
      );

      const activeCount = statusCounts.find((s) => s.status.toUpperCase() === 'ACTIVE')?.count ?? 0;
      const injuredCount = statusCounts.find((s) => s.status.toUpperCase() === 'INJURED')?.count ?? 0;

      expect(activeCount).toBe(144);
      expect(injuredCount).toBe(10);
      expect(activeCount + injuredCount).toBe(154);

      const seniorInjured = client.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM players WHERE status = 'INJURED' AND cohort_id = 'cohort-seniors'"
      )[0].count;
      const juniorInjured = client.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM players WHERE status = 'INJURED' AND cohort_id = 'cohort-juniors'"
      )[0].count;

      expect(seniorInjured).toBe(5);
      expect(juniorInjured).toBe(5);
    });

    it('SEED-ROSTER-04: all 154 student IDs are unique, valid, and adhere to XLRI batch conventions', () => {
      const players = client.query<{ id: string; cohort_id: string; student_id: string }>('SELECT id, cohort_id, student_id FROM players');
      expect(players).toHaveLength(154);

      const studentIds = players.map((p) => p.student_id);
      expect(new Set(studentIds).size).toBe(154);

      for (const p of players) {
        if (p.cohort_id === 'cohort-seniors') {
          const validPrefix = p.student_id.startsWith('26BM') || p.student_id.startsWith('26HR');
          expect(validPrefix, `Senior player ${p.id} student ID ${p.student_id} must start with 26BM or 26HR`).toBe(true);
        } else if (p.cohort_id === 'cohort-juniors') {
          const validPrefix = p.student_id.startsWith('27BM') || p.student_id.startsWith('27HR');
          expect(validPrefix, `Junior player ${p.id} student ID ${p.student_id} must start with 27BM or 27HR`).toBe(true);
        }
      }
    });

    it('SEED-ROSTER-05: stats_json is valid JSON for all 154 players', () => {
      const players = client.query<{ id: string; name: string; stats_json: string }>('SELECT id, name, stats_json FROM players');
      expect(players).toHaveLength(154);

      for (const p of players) {
        expect(() => {
          const parsed = JSON.parse(p.stats_json);
          expect(typeof parsed).toBe('object');
          expect(parsed).not.toBeNull();
        }, `Player ${p.name} (${p.id}) has invalid stats_json: ${p.stats_json}`).not.toThrow();
      }
    });

    it('SEED-ROSTER-06: verification of newly supplemented sports (Chess, Pool, Throwball, Futsal, Track & Field)', () => {
      const chessSeniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-chess' AND cohort_id = 'cohort-seniors'");
      const chessJuniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-chess' AND cohort_id = 'cohort-juniors'");
      expect(chessSeniors.length).toBe(4);
      expect(chessJuniors.length).toBe(4);

      const poolSeniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-pool' AND cohort_id = 'cohort-seniors'");
      const poolJuniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-pool' AND cohort_id = 'cohort-juniors'");
      expect(poolSeniors.length).toBe(2);
      expect(poolJuniors.length).toBe(2);

      const throwballSeniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-throwball' AND cohort_id = 'cohort-seniors'");
      const throwballJuniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-throwball' AND cohort_id = 'cohort-juniors'");
      expect(throwballSeniors.length).toBe(7);
      expect(throwballJuniors.length).toBe(7);

      const futsalSeniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-futsal' AND cohort_id = 'cohort-seniors'");
      const futsalJuniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-futsal' AND cohort_id = 'cohort-juniors'");
      expect(futsalSeniors.length).toBe(5);
      expect(futsalJuniors.length).toBe(5);

      const tnfFSeniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-track-field-f' AND cohort_id = 'cohort-seniors'");
      const tnfFJuniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-track-field-f' AND cohort_id = 'cohort-juniors'");
      expect(tnfFSeniors.length).toBe(3);
      expect(tnfFJuniors.length).toBe(3);

      const tnfMSeniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-track-field-m' AND cohort_id = 'cohort-seniors'");
      const tnfMJuniors = client.query("SELECT * FROM players WHERE primary_sport_id = 'sport-track-field-m' AND cohort_id = 'cohort-juniors'");
      expect(tnfMSeniors.length).toBe(3);
      expect(tnfMJuniors.length).toBe(3);
    });
  });

  // =========================================================================
  // SECTION 6: Schema Lifecycle (initSchema & dropSchema)
  // =========================================================================
  describe('6. Schema Lifecycle & Idempotency', () => {
    it('SCHEMA-01: initSchema is strictly idempotent', () => {
      expect(() => {
        initSchema(client);
        initSchema(client);
      }).not.toThrow();

      const tables = client.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      );
      expect(tables).toHaveLength(9);
    });

    it('SCHEMA-02: dropSchema safely drops all tables in reverse dependency order', () => {
      expect(() => {
        dropSchema(client);
      }).not.toThrow();

      const remainingTables = client.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      );
      expect(remainingTables).toHaveLength(0);

      // Re-init after drop works cleanly
      expect(() => {
        initSchema(client);
        seedDatabase(client);
      }).not.toThrow();

      const playersCount = client.query<{ count: number }>('SELECT COUNT(*) as count FROM players')[0].count;
      expect(playersCount).toBe(154);
    });
  });
});
