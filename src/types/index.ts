export type UserRole = 'ADMIN' | 'REFEREE' | 'SPECTATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

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
