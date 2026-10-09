import { DatabaseClient, db as defaultDb } from '../db/client.js';

export interface CohortStanding {
  cohort_id: string;
  id: string;
  name: string;
  cohort_name: string;
  batch: string;
  color: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points_for: number;
  points_against: number;
  points_diff: number;
  points_difference: number;
  total_points: number;
  points: number;
  rank?: number;
}

export interface SportStandingBreakdown {
  sport_id: string;
  sport_name: string;
  category: string;
  scoring_type: string;
  matches_published: number;
  seniors_won: number;
  juniors_won: number;
  draws: number;
  seniors_points: number;
  juniors_points: number;
}

export class StandingsService {
  constructor(private db: DatabaseClient = defaultDb) {}

  /**
   * Recalculates and persists official tournament standings.
   * Considers only matches in 'PUBLISHED' status.
   * Completely idempotent across multiple executions.
   */
  public recalculate(tournamentId?: string): CohortStanding[] {
    const cohorts = this.db.query<{ id: string; name: string; batch: string; color: string }>(
      'SELECT id, name, batch, color FROM cohorts ORDER BY id ASC'
    );

    let matchSql = `
      SELECT id, tournament_id, sport_id, home_cohort_id, away_cohort_id,
             score_home, score_away, status
      FROM matches
      WHERE UPPER(status) = 'PUBLISHED'
    `;
    const params: any[] = [];
    if (tournamentId) {
      matchSql += ' AND tournament_id = ?';
      params.push(tournamentId);
    }

    const matches = this.db.query<any>(matchSql, params);

    const standingsMap = new Map<string, {
      cohort: { id: string; name: string; batch: string; color: string };
      played: number;
      won: number;
      drawn: number;
      lost: number;
      points_for: number;
      points_against: number;
    }>();

    for (const c of cohorts) {
      standingsMap.set(c.id, {
        cohort: c,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        points_for: 0,
        points_against: 0,
      });
    }

    for (const m of matches) {
      // Normalize cohort IDs
      const rawHome = m.home_cohort_id || '';
      const rawAway = m.away_cohort_id || '';

      const homeId = rawHome.startsWith('cohort-') ? rawHome : `cohort-${rawHome}`;
      const awayId = rawAway.startsWith('cohort-') ? rawAway : `cohort-${rawAway}`;

      const home = standingsMap.get(homeId) || standingsMap.get(rawHome);
      const away = standingsMap.get(awayId) || standingsMap.get(rawAway);

      const scoreHome = Number(m.score_home) || 0;
      const scoreAway = Number(m.score_away) || 0;

      if (home) {
        home.played += 1;
        home.points_for += scoreHome;
        home.points_against += scoreAway;
        if (scoreHome > scoreAway) {
          home.won += 1;
        } else if (scoreHome === scoreAway) {
          home.drawn += 1;
        } else {
          home.lost += 1;
        }
      }

      if (away) {
        away.played += 1;
        away.points_for += scoreAway;
        away.points_against += scoreHome;
        if (scoreAway > scoreHome) {
          away.won += 1;
        } else if (scoreAway === scoreHome) {
          away.drawn += 1;
        } else {
          away.lost += 1;
        }
      }
    }

    const results: CohortStanding[] = [];

    this.db.transaction(() => {
      for (const [cohortId, stat] of standingsMap.entries()) {
        const points_diff = stat.points_for - stat.points_against;
        const total_points = (stat.won * 3) + (stat.drawn * 1);

        this.db.execute(`
          INSERT OR REPLACE INTO standings (
            cohort_id, played, won, drawn, lost, points_for, points_against, points_diff, total_points, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          cohortId,
          stat.played,
          stat.won,
          stat.drawn,
          stat.lost,
          stat.points_for,
          stat.points_against,
          points_diff,
          total_points,
        ]);

        results.push({
          cohort_id: cohortId.replace(/^cohort-/, ''),
          id: cohortId,
          name: stat.cohort.name,
          cohort_name: stat.cohort.name,
          batch: stat.cohort.batch,
          color: stat.cohort.color,
          played: stat.played,
          won: stat.won,
          drawn: stat.drawn,
          lost: stat.lost,
          points_for: stat.points_for,
          points_against: stat.points_against,
          points_diff,
          points_difference: points_diff,
          total_points,
          points: total_points,
        });
      }
    });

    // Tie-breaker sort: total_points DESC > won DESC > points_diff DESC > points_for DESC > name ASC
    results.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.won !== a.won) return b.won - a.won;
      if (b.points_diff !== a.points_diff) return b.points_diff - a.points_diff;
      if (b.points_for !== a.points_for) return b.points_for - a.points_for;
      return a.name.localeCompare(b.name);
    });

    results.forEach((row, idx) => {
      row.rank = idx + 1;
    });

    return results;
  }

  /**
   * Retrieves current standings without forcing DB write.
   */
  public getStandings(tournamentId?: string): CohortStanding[] {
    return this.recalculate(tournamentId);
  }

  /**
   * Generates sport-wise outcome breakdown.
   */
  public getSportBreakdowns(): SportStandingBreakdown[] {
    const sports = this.db.query<any>('SELECT id, name, category, scoring_type FROM sports ORDER BY name ASC');
    const matches = this.db.query<any>(`
      SELECT sport_id, home_cohort_id, away_cohort_id, score_home, score_away
      FROM matches
      WHERE UPPER(status) = 'PUBLISHED'
    `);

    return sports.map((s) => {
      const sportMatches = matches.filter((m) => m.sport_id === s.id || m.sport_id === `sport-${s.id}`);
      let seniorsWon = 0;
      let juniorsWon = 0;
      let draws = 0;
      let seniorsPoints = 0;
      let juniorsPoints = 0;

      for (const m of sportMatches) {
        const isSeniorHome = String(m.home_cohort_id).includes('seniors');
        const sScore = isSeniorHome ? Number(m.score_home) || 0 : Number(m.score_away) || 0;
        const jScore = isSeniorHome ? Number(m.score_away) || 0 : Number(m.score_home) || 0;

        seniorsPoints += sScore;
        juniorsPoints += jScore;

        if (sScore > jScore) seniorsWon++;
        else if (jScore > sScore) juniorsWon++;
        else draws++;
      }

      return {
        sport_id: s.id,
        sport_name: s.name,
        category: s.category,
        scoring_type: s.scoring_type,
        matches_published: sportMatches.length,
        seniors_won: seniorsWon,
        juniors_won: juniorsWon,
        draws,
        seniors_points: seniorsPoints,
        juniors_points: juniorsPoints,
      };
    });
  }
}

export const standingsService = new StandingsService();
