import { DatabaseClient } from './client.js';
import type { DatabaseSync } from 'node:sqlite';

// ==========================================
// TypeScript Interfaces for all 9 Models
// ==========================================

export interface Tournament {
  id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  created_at?: string;
}

export interface Cohort {
  id: string;
  name: string;
  batch: string;
  color: string;
  created_at?: string;
}

export type ScoringType = 'football' | 'cricket' | 'basketball' | 'badminton' | 'generic';

export interface Sport {
  id: string;
  name: string;
  category: string;
  rules_json: string;
  scoring_type: ScoringType | string;
  created_at?: string;
}

export type UserRole = 'ADMIN' | 'REFEREE' | 'SPECTATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export type PlayerStatus = 'ACTIVE' | 'INJURED' | 'RESERVE' | 'INACTIVE';

export interface Player {
  id: string;
  cohort_id: string;
  name: string;
  student_id: string;
  jersey_number?: number | null;
  primary_sport_id: string;
  secondary_sport_id?: string | null;
  position?: string | null;
  status: PlayerStatus;
  stats_json: string;
  created_at?: string;
}

export type MatchStatus = 'Scheduled' | 'Draft' | 'Submitted' | 'Verified' | 'Published' | 'Cancelled';

export interface Match {
  id: string;
  tournament_id: string;
  sport_id: string;
  home_cohort_id: string;
  away_cohort_id: string;
  venue: string;
  scheduled_at: string;
  referee_id?: string | null;
  status: MatchStatus;
  score_home: number;
  score_away: number;
  current_period: string;
  current_time_seconds: number;
  sport_state_json: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type EventTeam = 'HOME' | 'AWAY' | 'home' | 'away' | null;

export interface MatchEvent {
  id: string;
  match_id: string;
  event_type: string;
  team?: EventTeam;
  player_id?: string | null;
  minute: number;
  second: number;
  payload_json: string;
  created_at?: string;
}

export interface Standing {
  cohort_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points_for: number;
  points_against: number;
  points_diff: number;
  total_points: number;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  match_id?: string | null;
  user_id?: string | null;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  notes?: string | null;
  timestamp?: string;
}

// ==========================================
// Complete SQLite DDL Schema (All 9 Tables)
// ==========================================

export const SCHEMA_DDL = `
-- 1. Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2026,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Cohorts (Seniors vs Juniors)
CREATE TABLE IF NOT EXISTS cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  batch TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Sports (15 sports across collegiate categories)
CREATE TABLE IF NOT EXISTS sports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '{}',
  scoring_type TEXT NOT NULL CHECK(UPPER(scoring_type) IN ('FOOTBALL', 'CRICKET', 'BASKETBALL', 'BADMINTON', 'GENERIC')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Users (Authentication & RBAC: Admin, Referee, Spectator)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(UPPER(role) IN ('ADMIN', 'REFEREE', 'SPECTATOR')) DEFAULT 'SPECTATOR',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Players (Roster directory across 15 sports)
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  student_id TEXT NOT NULL UNIQUE,
  jersey_number INTEGER,
  primary_sport_id TEXT NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  secondary_sport_id TEXT REFERENCES sports(id) ON DELETE SET NULL,
  position TEXT,
  status TEXT NOT NULL CHECK(UPPER(status) IN ('ACTIVE', 'INJURED', 'RESERVE', 'INACTIVE')) DEFAULT 'ACTIVE',
  stats_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Matches (Fixtures & Live Scoreboards with 4-stage lifecycle)
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  sport_id TEXT NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  home_cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
  away_cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
  venue TEXT NOT NULL DEFAULT 'Main Arena',
  scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),
  referee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK(UPPER(status) IN ('SCHEDULED', 'DRAFT', 'SUBMITTED', 'VERIFIED', 'PUBLISHED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED')) DEFAULT 'Scheduled',
  score_home INTEGER NOT NULL DEFAULT 0,
  score_away INTEGER NOT NULL DEFAULT 0,
  current_period TEXT NOT NULL DEFAULT 'Scheduled',
  current_time_seconds INTEGER NOT NULL DEFAULT 0,
  sport_state_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Match Events (Immutable chronological audit event stream)
CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  team TEXT CHECK(UPPER(team) IN ('HOME', 'AWAY') OR team IS NULL),
  player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  minute INTEGER NOT NULL DEFAULT 0,
  second INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Standings (Aggregated cohort points & leaderboard)
CREATE TABLE IF NOT EXISTS standings (
  cohort_id TEXT PRIMARY KEY REFERENCES cohorts(id) ON DELETE CASCADE,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  points_for INTEGER NOT NULL DEFAULT 0,
  points_against INTEGER NOT NULL DEFAULT 0,
  points_diff INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. Audit Logs (Governance, state transitions, and dispute notes)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  notes TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for Query Performance & Lookups
CREATE INDEX IF NOT EXISTS idx_players_cohort ON players(cohort_id);
CREATE INDEX IF NOT EXISTS idx_players_primary_sport ON players(primary_sport_id);
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_sport ON matches(sport_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_referee ON matches(referee_id);
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_at ON matches(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_matches_cohorts ON matches(home_cohort_id, away_cohort_id);

CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_match_events_player ON match_events(player_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_match ON audit_logs(match_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
`;

export const DROP_SCHEMA_SQL = `
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS match_events;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS standings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS sports;
DROP TABLE IF EXISTS cohorts;
DROP TABLE IF EXISTS tournaments;
`;

/**
 * Initializes the full 9-table schema and indexes.
 */
export function initSchema(client: DatabaseClient | DatabaseSync | { exec(sql: string): void }): void {
  client.exec(SCHEMA_DDL);
}

/**
 * Drops all 9 tables in reverse dependency order (safe with foreign keys enabled).
 */
export function dropSchema(client: DatabaseClient | DatabaseSync | { exec(sql: string): void }): void {
  client.exec(DROP_SCHEMA_SQL);
}
