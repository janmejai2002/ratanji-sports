/**
 * Types & Interfaces for Sport Scoring Engines
 * Ratanji Digital Sports Management & Scoring System
 */

export interface BaseMatchEvent {
  id?: string;
  match_id?: string;
  event_type: string;
  team?: 'home' | 'away' | string | null;
  player_id?: string | null;
  minute?: number;
  second?: number;
  payload_json?: any;
  created_at?: string;
}

export interface EngineResult {
  score_home: number;
  score_away: number;
  sport_state: any;
  current_period?: string;
}

export interface SportEngine {
  readonly scoringType: string;
  recalculate(events: BaseMatchEvent[], initialRules?: any): EngineResult;
}
