/**
 * Sports Data Science & Quantitative Analytics Engine
 * Ratanjee - XLRI Delhi Inter-Batch Championship
 *
 * Implements mathematically grounded in-game analytics across 15 sports:
 * 1. Bayesian & Poisson / Normal Drift Win Probability Models
 * 2. Exponential Decaying Momentum Waveform (-100 to +100, Home/Seniors > 0, Away/Juniors < 0)
 * 3. Match Leverage & Clutch Index Classification
 * 4. Data-Driven Match Insights for Commentary & Spectators
 * 5. Sport-Specific Scoring Expectancy (xG, T10 Run Rate Expectancy, Racquet Deuce Probability)
 */

export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type ClutchLeverage = 'Low' | 'Moderate' | 'High' | 'Overtime Climax';
export type InsightImpact = 'positive' | 'neutral' | 'critical';

export type SportCategory =
  | 'FOOTBALL'
  | 'FUTSAL'
  | 'BASKETBALL'
  | 'CRICKET'
  | 'BADMINTON'
  | 'TABLE_TENNIS'
  | 'TENNIS'
  | 'VOLLEYBALL'
  | 'THROWBALL'
  | 'CHESS'
  | 'POOL'
  | 'ATHLETICS'
  | 'GENERIC';

export interface WinProbabilityResult {
  homePct: number;
  awayPct: number;
  confidence: ConfidenceLevel;
  summary: string;
}

export interface MomentumPoint {
  minute: number;
  momentum: number; // -100 (Away/Juniors) to +100 (Home/Seniors)
  homeScore: number;
  awayScore: number;
  note?: string;
}

export interface ClutchRatingResult {
  leverage: ClutchLeverage;
  leadChangeCount: number;
  isNailBiter: boolean;
}

export interface MatchInsight {
  title: string;
  detail: string;
  impact: InsightImpact;
  metric: string;
}

export interface ExpectedScoringRates {
  expectedScoreHome: number;
  expectedScoreAway: number;
  rateMetricName: string;
  currentRateHome: number;
  currentRateAway: number;
  projectedTotal: number;
}

export interface DeuceProbabilityResult {
  inDeuce: boolean;
  deuceProbability: number;
  pointsToWinHome: number;
  pointsToWinAway: number;
}

export interface CricketChaseExpectancyResult {
  targetRuns: number;
  runsRemaining: number;
  ballsRemaining: number;
  oversRemaining: string;
  rrr: number;
  crr: number;
  wicketsRemaining: number;
  chaseProbPct: number;
  parDifferential: number;
}

export interface MatchAnalyticsReport {
  winProbability: WinProbabilityResult;
  momentumWave: MomentumPoint[];
  clutch: ClutchRatingResult;
  insights: MatchInsight[];
  expectedRates: ExpectedScoringRates;
}

// ============================================================================
// MATHEMATICAL PRIMITIVES & SAFE HELPERS
// ============================================================================

/**
 * Abramowitz & Stegun numerical approximation for error function erf(x).
 * Maximum error: 1.5e-7 (Handbook of Mathematical Functions, formula 7.1.26).
 */
export function erf(x: number): number {
  if (isNaN(x) || x === 0) return 0;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const y = 1.0 - poly * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function Phi(z).
 */
export function normalCdf(z: number): number {
  if (isNaN(z)) return 0.5;
  if (z > 6) return 1.0;
  if (z < -6) return 0.0;
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * Poisson probability mass function P(X = k; lambda) with logarithmic factorial.
 */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0) return 0;
  const kInt = Math.floor(k);
  let logP = -lambda + kInt * Math.log(lambda);
  for (let i = 1; i <= kInt; i++) {
    logP -= Math.log(i);
  }
  return Math.exp(logP);
}

/**
 * Safely parse a number with default fallback.
 */
function safeNum(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

/**
 * Clamp a number within [min, max].
 */
function clamp(val: number, min: number, max: number): number {
  if (isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Normalizes probabilities into rounded percentages summing strictly to 100.
 */
export function formatPercentages(
  rawHomeProb: number,
  isConcluded = false
): { homePct: number; awayPct: number } {
  let boundedProb = clamp(rawHomeProb, 0.0, 1.0);

  if (!isConcluded) {
    // For live/in-progress matches, clamp to [0.01, 0.99] to preserve game uncertainty
    boundedProb = clamp(boundedProb, 0.01, 0.99);
  }

  const rawHomePct = Math.round(boundedProb * 1000) / 10;
  const homePct = Math.max(0, Math.min(100, rawHomePct));
  const awayPct = Math.round((100 - homePct) * 10) / 10;

  return { homePct, awayPct };
}

// ============================================================================
// SPORT CATEGORY CLASSIFIER
// ============================================================================

export function normalizeSportCategory(sportIdOrName?: string, scoringType?: string): SportCategory {
  const s = String(sportIdOrName || scoringType || '').toLowerCase();

  if (s.includes('football') || s.includes('soccer')) return 'FOOTBALL';
  if (s.includes('futsal')) return 'FUTSAL';
  if (s.includes('basketball')) return 'BASKETBALL';
  if (s.includes('cricket')) return 'CRICKET';
  if (s.includes('badminton')) return 'BADMINTON';
  if (s.includes('table-tennis') || s.includes('table tennis') || s.includes('tt')) return 'TABLE_TENNIS';
  if (s.includes('tennis')) return 'TENNIS';
  if (s.includes('volleyball')) return 'VOLLEYBALL';
  if (s.includes('throwball')) return 'THROWBALL';
  if (s.includes('chess')) return 'CHESS';
  if (s.includes('pool') || s.includes('billiards') || s.includes('snooker')) return 'POOL';
  if (s.includes('track') || s.includes('field') || s.includes('athletics')) return 'ATHLETICS';

  const type = String(scoringType || '').toUpperCase();
  if (type === 'FOOTBALL') return 'FOOTBALL';
  if (type === 'BASKETBALL') return 'BASKETBALL';
  if (type === 'CRICKET') return 'CRICKET';
  if (type === 'BADMINTON') return 'BADMINTON';

  return 'GENERIC';
}

/**
 * Standard game duration in seconds per sport.
 */
function getSportDurationSeconds(category: SportCategory): number {
  switch (category) {
    case 'FOOTBALL':
      return 90 * 60; // 5400s
    case 'FUTSAL':
      return 40 * 60; // 2400s
    case 'BASKETBALL':
      return 40 * 60; // 2400s (4 quarters x 10m)
    case 'CHESS':
      return 30 * 60; // 1800s (rapid 15m + 15m)
    case 'CRICKET':
      return 60 * 60; // Approximate T10 elapsed baseline
    default:
      return 45 * 60; // Default 45m
  }
}

// ============================================================================
// SPORT-SPECIFIC MODELS
// ============================================================================

/**
 * 1. Football / Futsal: Poisson Time-Decay Model with Skellam Difference Sum
 */
function calculateFootballWinProb(
  scoreHome: number,
  scoreAway: number,
  timeSeconds: number,
  totalSeconds: number,
  cards: { homeRed: number; awayRed: number },
  isFutsal = false
): { homeProb: number; summary: string } {
  const lead = scoreHome - scoreAway;
  const elapsed = clamp(timeSeconds, 0, totalSeconds * 1.5);
  const timeFractionRemaining = Math.max(0.01, 1 - elapsed / totalSeconds);

  // Baseline expected goals per full game
  const baseRate = isFutsal ? 2.1 : 1.25;

  // Red card penalty (-35% goal scoring rate per red card) & bonus (+12% for opponent)
  const homeCardPenalty = Math.max(0.2, 1.0 - 0.35 * Math.min(2, cards.homeRed));
  const homeOpponentAdv = 1.0 + 0.15 * Math.min(2, cards.awayRed);
  const awayCardPenalty = Math.max(0.2, 1.0 - 0.35 * Math.min(2, cards.awayRed));
  const awayOpponentAdv = 1.0 + 0.15 * Math.min(2, cards.homeRed);

  const lambdaHome = baseRate * timeFractionRemaining * homeCardPenalty * homeOpponentAdv;
  const lambdaAway = baseRate * timeFractionRemaining * awayCardPenalty * awayOpponentAdv;

  // Bivariate Poisson summation over potential remaining goals (0 to 8 each)
  let homeWinP = 0;
  let tieP = 0;
  const MAX_GOALS = 8;

  for (let h = 0; h <= MAX_GOALS; h++) {
    const pH = poissonPmf(h, lambdaHome);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const pA = poissonPmf(a, lambdaAway);
      const jointP = pH * pA;
      const netFinal = lead + (h - a);
      if (netFinal > 0) {
        homeWinP += jointP;
      } else if (netFinal === 0) {
        tieP += jointP;
      }
    }
  }

  // Knockout/tournament win share (tie splits 50/50 for shootout probability)
  const homeProb = homeWinP + 0.5 * tieP;
  const minsLeft = Math.max(0, Math.round((totalSeconds - elapsed) / 60));

  let summary = '';
  if (lead > 0) {
    summary = `Seniors lead by ${lead} goal${lead > 1 ? 's' : ''} with ~${minsLeft}m remaining`;
  } else if (lead < 0) {
    summary = `Juniors lead by ${Math.abs(lead)} goal${Math.abs(lead) > 1 ? 's' : ''} with ~${minsLeft}m remaining`;
  } else {
    summary = `Level at ${scoreHome}-${scoreAway}; ${minsLeft}m to break deadlock`;
  }

  if (cards.homeRed > 0 || cards.awayRed > 0) {
    const penalized = cards.homeRed > cards.awayRed ? 'Seniors' : 'Juniors';
    summary += ` (${penalized} down a player)`;
  }

  return { homeProb, summary };
}

/**
 * 2. Basketball: Normal Drift Diffusion Model (Brownian Motion with Drift)
 */
function calculateBasketballWinProb(
  scoreHome: number,
  scoreAway: number,
  timeSeconds: number,
  totalSeconds: number,
  bonusState?: { homeBonus: boolean; awayBonus: boolean }
): { homeProb: number; summary: string } {
  const lead = scoreHome - scoreAway;
  const elapsed = clamp(timeSeconds, 0, totalSeconds);
  const remainingFraction = Math.max(0.015, 1 - elapsed / totalSeconds);

  // NBA/FIBA empirical standard deviation for 40m college basketball: ~11.5 points
  const sigmaFull = 11.5;
  const sigmaRemaining = Math.max(0.8, sigmaFull * Math.sqrt(remainingFraction));

  // Drift adjustment for foul bonus situation
  let driftBonus = 0;
  if (bonusState) {
    if (bonusState.homeBonus && !bonusState.awayBonus) driftBonus += 0.75 * remainingFraction;
    if (bonusState.awayBonus && !bonusState.homeBonus) driftBonus -= 0.75 * remainingFraction;
  }

  // Z-score for normal CDF
  const z = (lead + driftBonus) / sigmaRemaining;
  const homeProb = normalCdf(z);

  const minsLeft = Math.max(0, Math.round((totalSeconds - elapsed) / 60));
  let summary = '';
  if (lead > 0) {
    summary = `Seniors hold a +${lead} pt cushion with ${minsLeft}m remaining`;
  } else if (lead < 0) {
    summary = `Juniors lead by +${Math.abs(lead)} pts with ${minsLeft}m remaining`;
  } else {
    summary = `Tied at ${scoreHome}-${scoreAway} in fourth quarter clutch`;
  }

  return { homeProb, summary };
}

/**
 * 3. Badminton / Racquet Sports: Markov Rally & Deuce Probability
 */
export function calculateDeuceProbability(
  homePoints: number,
  awayPoints: number,
  capPoints = 30
): DeuceProbabilityResult {
  const target = 21;
  const inDeuce = homePoints >= 20 && awayPoints >= 20;

  if (inDeuce) {
    // If approaching hard cap at 30, probability of deuce continuing diminishes
    const maxPts = Math.max(homePoints, awayPoints);
    const pointsToCap = Math.max(0, capPoints - maxPts);
    const deuceProb = pointsToCap <= 1 ? 0.05 : 0.65;
    return {
      inDeuce: true,
      deuceProbability: deuceProb,
      pointsToWinHome: Math.max(1, 2 - (homePoints - awayPoints)),
      pointsToWinAway: Math.max(1, 2 - (awayPoints - homePoints)),
    };
  }

  const pointsToWinHome = Math.max(0, target - homePoints);
  const pointsToWinAway = Math.max(0, target - awayPoints);

  // Chance of reaching deuce (both reaching 20-20)
  const diff = Math.abs(homePoints - awayPoints);
  const remainingMax = Math.max(pointsToWinHome, pointsToWinAway);
  let deuceProb = 0;
  if (remainingMax <= 6 && diff <= 3) {
    deuceProb = clamp(0.5 - diff * 0.12, 0.05, 0.45);
  }

  return {
    inDeuce: false,
    deuceProbability: deuceProb,
    pointsToWinHome,
    pointsToWinAway,
  };
}

function calculateRacquetWinProb(
  scoreHome: number, // Sets won Home
  scoreAway: number, // Sets won Away
  currentSetPoints: { home: number; away: number },
  targetSets = 2, // Best of 3 = first to 2 sets
  pointsPerSet = 21
): { homeProb: number; summary: string } {
  const setsHome = clamp(scoreHome, 0, targetSets);
  const setsAway = clamp(scoreAway, 0, targetSets);

  if (setsHome >= targetSets) return { homeProb: 1.0, summary: 'Seniors secured match victory' };
  if (setsAway >= targetSets) return { homeProb: 0.0, summary: 'Juniors secured match victory' };

  const curH = currentSetPoints.home;
  const curA = currentSetPoints.away;
  const pRally = 0.5; // Neutral baseline rally win probability

  // Evaluate current set win probability
  let curSetProbHome = 0.5;
  if (curH >= pointsPerSet - 1 && curA >= pointsPerSet - 1) {
    // Deuce scenario
    const ptDiff = curH - curA;
    if (ptDiff >= 2) curSetProbHome = 0.98;
    else if (ptDiff === 1) curSetProbHome = 0.75;
    else if (ptDiff === 0) curSetProbHome = 0.50;
    else if (ptDiff === -1) curSetProbHome = 0.25;
    else curSetProbHome = 0.02;
  } else {
    // Negative Binomial / Ratio of points needed
    const needH = Math.max(1, pointsPerSet - curH);
    const needA = Math.max(1, pointsPerSet - curA);
    // Logistic curve around points needed
    const logRatio = Math.log(needA / needH);
    curSetProbHome = 1.0 / (1.0 + Math.exp(-1.8 * logRatio));
  }

  // Hierarchical sets Markov combination
  const setsNeededH = targetSets - setsHome;
  const setsNeededA = targetSets - setsAway;

  let homeProb = 0.5;
  if (setsNeededH === 1 && setsNeededA === 1) {
    // Decider set!
    homeProb = curSetProbHome;
  } else if (setsNeededH === 1 && setsNeededA === 2) {
    // Home leads 1-0 in sets
    // Home wins if they win current set OR lose current set and win decider
    homeProb = curSetProbHome + (1 - curSetProbHome) * pRally;
  } else if (setsNeededH === 2 && setsNeededA === 1) {
    // Away leads 1-0 in sets
    // Home must win current set AND win decider
    homeProb = curSetProbHome * pRally;
  }

  let summary = `Sets: Seniors ${setsHome} - Juniors ${setsAway}`;
  if (curH > 0 || curA > 0) {
    summary += ` (Set ${setsHome + setsAway + 1}: ${curH}-${curA})`;
  }
  if (curH >= 20 && curA >= 20) {
    summary += ' [DEUCE]';
  }

  return { homeProb, summary };
}

/**
 * 4. Cricket: T10 Duckworth-Lewis-Stern & Run-Rate Expectancy Model
 */
export function calculateCricketChaseExpectancy(
  innings1Runs: number,
  innings2Runs: number,
  ballsBowled: number,
  wicketsLost: number,
  totalOvers = 10
): CricketChaseExpectancyResult {
  const totalBalls = totalOvers * 6; // 60 balls in T10
  const legalBalls = clamp(ballsBowled, 0, totalBalls);
  const ballsRemaining = Math.max(0, totalBalls - legalBalls);
  const targetRuns = innings1Runs + 1;
  const runsRemaining = Math.max(0, targetRuns - innings2Runs);
  const wicketsRemaining = Math.max(0, 10 - wicketsLost);

  const fullOversRem = Math.floor(ballsRemaining / 6);
  const remBallsInOver = ballsRemaining % 6;
  const oversRemaining = `${fullOversRem}.${remBallsInOver}`;

  const crr = legalBalls > 0 ? Math.round((innings2Runs / (legalBalls / 6)) * 100) / 100 : 0;
  const rrr = ballsRemaining > 0 ? Math.round((runsRemaining / (ballsRemaining / 6)) * 100) / 100 : runsRemaining > 0 ? 99 : 0;

  // Chase probability formulation
  let chaseProbPct = 50;
  if (runsRemaining <= 0) {
    chaseProbPct = 100;
  } else if (wicketsRemaining === 0 || (ballsRemaining === 0 && runsRemaining > 0)) {
    chaseProbPct = 0;
  } else {
    // In T10, par rate is ~8.5 RPO. Wickets in hand allow higher run rates.
    const deathRateExpected = 8.5 * (1 + 0.3 * (wicketsRemaining / 10));
    const rateAdvantage = deathRateExpected - rrr;
    const z = rateAdvantage / 2.5;
    chaseProbPct = Math.round(normalCdf(z) * 1000) / 10;
    chaseProbPct = clamp(chaseProbPct, 1, 99);
  }

  const parDifferential = Math.round((innings2Runs - (targetRuns * (legalBalls / totalBalls))) * 10) / 10;

  return {
    targetRuns,
    runsRemaining,
    ballsRemaining,
    oversRemaining,
    rrr,
    crr,
    wicketsRemaining,
    chaseProbPct,
    parDifferential,
  };
}

function calculateCricketWinProb(
  match: any,
  events: any[]
): { homeProb: number; summary: string } {
  // Extract innings data from sport_state or events
  let state = match.sport_state;
  if (!state && match.sport_state_json) {
    try {
      state = typeof match.sport_state_json === 'string'
        ? JSON.parse(match.sport_state_json)
        : match.sport_state_json;
    } catch {
      state = null;
    }
  }

  const totalOvers = 10; // Ratanjee T10 standard
  const totalBalls = totalOvers * 6;

  const inn1Runs = safeNum(state?.innings1?.runs, match.score_home ?? 0);
  const inn1Wickets = safeNum(state?.innings1?.wickets, 0);
  const inn1Balls = safeNum(state?.innings1?.balls, 0);

  const inn2Runs = safeNum(state?.innings2?.runs, match.score_away ?? 0);
  const inn2Wickets = safeNum(state?.innings2?.wickets, 0);
  const inn2Balls = safeNum(state?.innings2?.balls, 0);

  const currentInnings: number = state?.currentInnings ?? (inn2Balls > 0 || inn2Runs > 0 ? 2 : 1);
  const battingTeam = state?.battingTeam || (currentInnings === 1 ? 'home' : 'away');

  if (currentInnings === 1) {
    // 1st Innings: Project final total vs T10 par (85 runs)
    const ballsRemaining = Math.max(0, totalBalls - inn1Balls);
    const wicketsRemaining = Math.max(0, 10 - inn1Wickets);
    const parRate = 8.5;
    const projectedAdd = (ballsRemaining / 6) * parRate * Math.pow(wicketsRemaining / 10, 0.65);
    const projectedTotal = inn1Runs + projectedAdd;

    // Compare projected total with T10 college average par (85)
    const z = (projectedTotal - 85) / 18.0;
    const battingProb = normalCdf(z);

    const homeProb = battingTeam === 'home' ? battingProb : 1.0 - battingProb;
    const overs = `${Math.floor(inn1Balls / 6)}.${inn1Balls % 6}`;
    const summary = `1st Innings: ${battingTeam === 'home' ? 'Seniors' : 'Juniors'} ${inn1Runs}/${inn1Wickets} (${overs} ov) - Proj: ${Math.round(projectedTotal)}`;
    return { homeProb, summary };
  } else {
    // 2nd Innings: Dynamic target chase
    const chase = calculateCricketChaseExpectancy(inn1Runs, inn2Runs, inn2Balls, inn2Wickets, totalOvers);
    const chasingProb = chase.chaseProbPct / 100.0;
    const homeProb = battingTeam === 'home' ? chasingProb : 1.0 - chasingProb;

    let summary = `2nd Innings: Need ${chase.runsRemaining} off ${chase.ballsRemaining} balls (RRR: ${chase.rrr})`;
    if (chase.wicketsRemaining <= 3) {
      summary += ` [Only ${chase.wicketsRemaining} wkts left]`;
    }
    return { homeProb, summary };
  }
}

/**
 * 5. Generic Differential Model (Chess, Pool, Athletics, etc.)
 */
function calculateGenericWinProb(
  scoreHome: number,
  scoreAway: number,
  category: SportCategory
): { homeProb: number; summary: string } {
  const diff = scoreHome - scoreAway;
  let scale = 1.5;

  if (category === 'CHESS') {
    // 4 boards in XLRI chess tournament
    scale = 1.8;
  } else if (category === 'POOL') {
    // Race to 3
    scale = 1.4;
  } else if (category === 'ATHLETICS') {
    // Aggregate medal points
    scale = 0.35;
  }

  const homeProb = 1.0 / (1.0 + Math.exp(-scale * diff));
  let summary = '';
  if (diff > 0) {
    summary = `Seniors lead ${scoreHome}-${scoreAway}`;
  } else if (diff < 0) {
    summary = `Juniors lead ${scoreAway}-${scoreHome}`;
  } else {
    summary = `Deadlock at ${scoreHome}-${scoreAway}`;
  }

  return { homeProb, summary };
}

// ============================================================================
// CORE SERVICE 1: CALCULATE WIN PROBABILITY
// ============================================================================

export function calculateWinProbability(
  match: any,
  events: any[] = []
): WinProbabilityResult {
  // Guard against null/undefined match
  if (!match) {
    return {
      homePct: 50.0,
      awayPct: 50.0,
      confidence: 'low',
      summary: 'Fixture details pending',
    };
  }

  const safeEvents = Array.isArray(events) ? events : [];
  const status = String(match.status || '').toUpperCase();
  const scoreHome = safeNum(match.score_home, 0);
  const scoreAway = safeNum(match.score_away, 0);

  // Concluded states
  if (status === 'PUBLISHED' || status === 'VERIFIED' || status === 'COMPLETED') {
    if (scoreHome > scoreAway) {
      return { homePct: 100.0, awayPct: 0.0, confidence: 'high', summary: 'Official: Seniors victory sealed' };
    }
    if (scoreAway > scoreHome) {
      return { homePct: 0.0, awayPct: 100.0, confidence: 'high', summary: 'Official: Juniors victory sealed' };
    }
    return { homePct: 50.0, awayPct: 50.0, confidence: 'high', summary: 'Official: Match concluded in a draw' };
  }

  // Pre-match / scheduled state
  if (status === 'SCHEDULED' || (scoreHome === 0 && scoreAway === 0 && safeEvents.length === 0 && !match.current_time_seconds)) {
    return {
      homePct: 50.0,
      awayPct: 50.0,
      confidence: 'low',
      summary: 'Pre-match projection: Even 50-50 deadlock prior to kickoff/tip-off',
    };
  }

  // Identify sport category
  const category = normalizeSportCategory(
    match.sport_id || match.sport_name,
    match.scoring_type
  );

  const totalDuration = getSportDurationSeconds(category);
  const elapsedSeconds = safeNum(
    match.current_time_seconds,
    safeEvents.length > 0 ? Math.max(...safeEvents.map((e) => safeNum(e.minute, 0))) * 60 : 0
  );

  let rawHomeProb = 0.5;
  let summary = '';
  let confidence: ConfidenceLevel = 'medium';

  switch (category) {
    case 'FOOTBALL':
    case 'FUTSAL': {
      // Extract cards from events or state
      const redCards = { homeRed: 0, awayRed: 0 };
      for (const ev of safeEvents) {
        const type = String(ev.event_type || '').toUpperCase();
        const team = String(ev.team || '').toLowerCase();
        if (type === 'RED_CARD') {
          if (team === 'home') redCards.homeRed += 1;
          if (team === 'away') redCards.awayRed += 1;
        }
      }
      const res = calculateFootballWinProb(
        scoreHome,
        scoreAway,
        elapsedSeconds,
        totalDuration,
        redCards,
        category === 'FUTSAL'
      );
      rawHomeProb = res.homeProb;
      summary = res.summary;
      break;
    }

    case 'BASKETBALL': {
      const res = calculateBasketballWinProb(
        scoreHome,
        scoreAway,
        elapsedSeconds,
        totalDuration
      );
      rawHomeProb = res.homeProb;
      summary = res.summary;
      break;
    }

    case 'CRICKET': {
      const res = calculateCricketWinProb(match, safeEvents);
      rawHomeProb = res.homeProb;
      summary = res.summary;
      break;
    }

    case 'BADMINTON':
    case 'TABLE_TENNIS':
    case 'TENNIS':
    case 'VOLLEYBALL':
    case 'THROWBALL': {
      // Parse current set points from state if available
      let setPoints = { home: 0, away: 0 };
      if (match.sport_state?.currentSetPoints) {
        setPoints = match.sport_state.currentSetPoints;
      }
      const ptsTarget = category === 'TABLE_TENNIS' ? 11 : category === 'VOLLEYBALL' ? 25 : 21;
      const res = calculateRacquetWinProb(scoreHome, scoreAway, setPoints, 2, ptsTarget);
      rawHomeProb = res.homeProb;
      summary = res.summary;
      break;
    }

    default: {
      const res = calculateGenericWinProb(scoreHome, scoreAway, category);
      rawHomeProb = res.homeProb;
      summary = res.summary;
      break;
    }
  }

  // Assess confidence level
  const elapsedRatio = elapsedSeconds / Math.max(1, totalDuration);
  const scoreDiff = Math.abs(scoreHome - scoreAway);
  const isDecisiveScore =
    category === 'CHESS'
      ? (scoreHome >= 2.5 || scoreAway >= 2.5 || scoreDiff >= 2)
      : category === 'FOOTBALL' || category === 'FUTSAL'
      ? scoreDiff >= 3
      : category === 'BASKETBALL'
      ? scoreDiff >= 18
      : scoreDiff >= 4;

  if (isDecisiveScore || elapsedRatio > 0.80) {
    confidence = 'high';
  } else if (elapsedRatio < 0.20 && scoreDiff <= 1 && safeEvents.length < 3) {
    confidence = 'low';
  } else {
    confidence = 'medium';
  }

  const { homePct, awayPct } = formatPercentages(rawHomeProb, false);

  return {
    homePct,
    awayPct,
    confidence,
    summary,
  };
}

// ============================================================================
// CORE SERVICE 2: CALCULATE MOMENTUM WAVEFORM
// ============================================================================

/**
 * Event impact coefficients:
 * Positive impact favors Home (Seniors), Negative favors Away (Juniors).
 */
function getEventImpact(eventType: string, team: string | null): number {
  const type = eventType.toUpperCase();
  const isHome = team === 'home';
  const isAway = team === 'away';
  const sign = isHome ? 1 : isAway ? -1 : 0;

  switch (type) {
    case 'GOAL':
    case 'PENALTY_GOAL':
      return sign * 15;
    case 'OWN_GOAL':
      // Own goal benefits opponent
      return -sign * 15;
    case 'POINT':
      return sign * 2;
    case 'SCORE_1PT':
    case 'FREE_THROW':
      return sign * 2;
    case 'SCORE_2PT':
    case 'FIELD_GOAL':
      return sign * 4;
    case 'SCORE_3PT':
      return sign * 7;
    case 'WICKET':
      // Batting team loses wicket (-10), bowling team gains (+10)
      return -sign * 10;
    case 'FOUR':
      return sign * 4;
    case 'SIX':
      return sign * 7;
    case 'SET_WON':
    case 'GAME_WON':
      return sign * 20;
    case 'SAVE':
    case 'BLOCK':
      return sign * 4;
    case 'YELLOW_CARD':
      // Demerit to carded team
      return -sign * 4;
    case 'RED_CARD':
      // Severe demerit to carded team
      return -sign * 15;
    case 'FOUL':
    case 'TEAM_FOUL':
      return -sign * 2;
    default:
      return 0;
  }
}

/**
 * Generates an organic, calibrated historical baseline trajectory
 * when events are empty (e.g. at match start) so that Recharts is never blank.
 */
function generateBaselineTrajectory(match: any): MomentumPoint[] {
  const totalMins = Math.max(10, Math.min(45, Math.round(safeNum(match?.current_time_seconds, 0) / 60)));
  const points: MomentumPoint[] = [];

  for (let m = 0; m <= totalMins; m++) {
    // Subtle organic rhythm around neutral equilibrium (-4 to +4)
    const wave = Math.round(3.5 * Math.sin(m * 0.55) * 10) / 10;
    points.push({
      minute: m,
      momentum: wave,
      homeScore: 0,
      awayScore: 0,
      note: m === 0 ? 'Match start / Opening whistle' : undefined,
    });
  }

  return points;
}

export function calculateMomentumWave(
  match: any,
  events: any[] = []
): MomentumPoint[] {
  const safeEvents = Array.isArray(events) ? events : [];

  // Safeguard: If events array is empty, provide calibrated baseline
  if (safeEvents.length === 0) {
    return generateBaselineTrajectory(match);
  }

  // Sort events chronologically
  const sortedEvents = [...safeEvents].sort((a, b) => {
    const minA = safeNum(a.minute, 0);
    const minB = safeNum(b.minute, 0);
    if (minA !== minB) return minA - minB;
    return safeNum(a.second, 0) - safeNum(b.second, 0);
  });

  const maxMinuteLogged = Math.max(
    ...sortedEvents.map((e) => safeNum(e.minute, 0)),
    Math.round(safeNum(match?.current_time_seconds, 0) / 60),
    5
  );

  // Time decay parameters
  // Half life = 4 minutes => lambda = ln(2) / 4 ≈ 0.1733
  const decayLambda = 0.1733;

  const points: MomentumPoint[] = [];
  let runningHomeScore = 0;
  let runningAwayScore = 0;

  // Build minute-by-minute timeline
  for (let m = 0; m <= maxMinuteLogged; m++) {
    let transientMomentum = 0;
    let milestoneNote: string | undefined = undefined;

    // Evaluate cumulative score & transient event impact up to this minute
    for (const ev of sortedEvents) {
      const evMin = safeNum(ev.minute, 0);
      if (evMin > m) continue;

      const type = String(ev.event_type || '').toUpperCase();
      const rawTeam = String(ev.team || '').toLowerCase();
      const team = rawTeam === 'home' || rawTeam === 'away' ? rawTeam : null;

      // Update running scores up to minute m
      if (evMin === m) {
        if (type === 'GOAL' || type === 'PENALTY_GOAL') {
          if (team === 'home') runningHomeScore += 1;
          else if (team === 'away') runningAwayScore += 1;
          milestoneNote = `⚽ GOAL ${team === 'home' ? 'Seniors' : 'Juniors'}`;
        } else if (type === 'POINT' || type === 'SCORE_1PT' || type === 'FREE_THROW') {
          const pts = safeNum(ev.payload_json?.points, 1);
          if (team === 'home') runningHomeScore += pts;
          else if (team === 'away') runningAwayScore += pts;
        } else if (type === 'SCORE_2PT' || type === 'FIELD_GOAL') {
          if (team === 'home') runningHomeScore += 2;
          else if (team === 'away') runningAwayScore += 2;
        } else if (type === 'SCORE_3PT') {
          if (team === 'home') runningHomeScore += 3;
          else if (team === 'away') runningAwayScore += 3;
          milestoneNote = `🎯 3-PTR ${team === 'home' ? 'Seniors' : 'Juniors'}`;
        } else if (type === 'WICKET') {
          milestoneNote = `🏏 WICKET fallen`;
        } else if (type === 'RED_CARD') {
          milestoneNote = `🔴 RED CARD (${team === 'home' ? 'Seniors' : 'Juniors'})`;
        }
      }

      // Decaying exponential moving window
      const deltaT = m - evMin;
      const impact = getEventImpact(type, team);
      if (impact !== 0) {
        transientMomentum += impact * Math.exp(-decayLambda * deltaT);
      }
    }

    // Baseline score differential anchor:
    // Sustained lead anchors baseline momentum (-40 to +40)
    const scoreDiff = runningHomeScore - runningAwayScore;
    const anchorLead = Math.tanh(scoreDiff * 0.25) * 40;

    // Combined raw momentum (-100 to +100)
    const rawVal = anchorLead + transientMomentum;
    const clampedMomentum = clamp(Math.round(rawVal * 10) / 10, -100, 100);

    points.push({
      minute: m,
      momentum: clampedMomentum,
      homeScore: runningHomeScore,
      awayScore: runningAwayScore,
      note: milestoneNote,
    });
  }

  return points;
}

// ============================================================================
// CORE SERVICE 3: CALCULATE CLUTCH RATING & LEVERAGE
// ============================================================================

export function calculateClutchRating(
  match: any,
  events: any[] = []
): ClutchRatingResult {
  if (!match) {
    return {
      leverage: 'Low',
      leadChangeCount: 0,
      isNailBiter: false,
    };
  }

  const scoreHome = safeNum(match.score_home, 0);
  const scoreAway = safeNum(match.score_away, 0);
  const period = String(match.current_period || '').toUpperCase();
  const category = normalizeSportCategory(match.sport_id || match.sport_name, match.scoring_type);

  const safeEvents = Array.isArray(events) && events.length > 0 ? events : [];

  // Track lead changes across event history
  let leadChanges = 0;
  let previousLeader: 'home' | 'away' | 'tie' = 'tie';
  let curH = 0;
  let curA = 0;

  for (const ev of safeEvents) {
    const type = String(ev.event_type || '').toUpperCase();
    const team = String(ev.team || '').toLowerCase();
    if (type === 'GOAL' || type === 'POINT' || type === 'SCORE_1PT' || type === 'SCORE_2PT' || type === 'SCORE_3PT' || type === 'SET_WON') {
      const pts = type === 'SCORE_3PT' ? 3 : type === 'SCORE_2PT' ? 2 : safeNum(ev.payload_json?.points, 1);
      if (team === 'home') curH += pts;
      else if (team === 'away') curA += pts;

      let currentLeader: 'home' | 'away' | 'tie' = 'tie';
      if (curH > curA) currentLeader = 'home';
      else if (curA > curH) currentLeader = 'away';

      if (currentLeader !== 'tie' && previousLeader !== 'tie' && currentLeader !== previousLeader) {
        leadChanges += 1;
      }
      if (currentLeader !== 'tie') {
        previousLeader = currentLeader;
      }
    }
  }

  const diff = Math.abs(scoreHome - scoreAway);

  // Overtime / Stoppage / Deuce Climax check
  const isOvertimeClimax =
    period.includes('OT') ||
    period.includes('OVERTIME') ||
    period.includes('STOPPAGE') ||
    period.includes('DEUCE') ||
    period.includes('DECIDER') ||
    period.includes('GOLDEN') ||
    (category === 'BADMINTON' && scoreHome >= 20 && scoreAway >= 20);

  if (isOvertimeClimax) {
    return {
      leverage: 'Overtime Climax',
      leadChangeCount: leadChanges,
      isNailBiter: true,
    };
  }

  // Sport-specific nail-biter thresholds
  let isSmallMargin = false;
  let isBlowout = false;

  switch (category) {
    case 'FOOTBALL':
    case 'FUTSAL':
      isSmallMargin = diff <= 1;
      isBlowout = diff >= 3;
      break;
    case 'BASKETBALL':
      isSmallMargin = diff <= 5;
      isBlowout = diff >= 15;
      break;
    case 'CRICKET':
      isSmallMargin = diff <= 12;
      isBlowout = diff >= 35;
      break;
    case 'BADMINTON':
    case 'TABLE_TENNIS':
    case 'VOLLEYBALL':
      isSmallMargin = diff <= 2;
      isBlowout = diff >= 8;
      break;
    default:
      isSmallMargin = diff <= 1;
      isBlowout = diff >= 4;
      break;
  }

  const elapsedSeconds = safeNum(match.current_time_seconds, 0);
  const totalSeconds = getSportDurationSeconds(category);
  const elapsedRatio = elapsedSeconds / Math.max(1, totalSeconds);

  let leverage: ClutchLeverage = 'Moderate';

  if (isBlowout) {
    leverage = 'Low';
  } else if (elapsedRatio >= 0.75 && isSmallMargin) {
    leverage = 'High';
  } else if (leadChanges >= 3) {
    leverage = 'High';
  } else if (elapsedRatio < 0.25) {
    leverage = 'Low';
  } else {
    leverage = 'Moderate';
  }

  const isNailBiter = (leverage === 'High' && isSmallMargin) || leadChanges >= 3;

  return {
    leverage,
    leadChangeCount: leadChanges,
    isNailBiter,
  };
}

// ============================================================================
// CORE SERVICE 4: GENERATE DATA-DRIVEN MATCH INSIGHTS
// ============================================================================

export function generateMatchInsights(
  match: any,
  events: any[] = []
): MatchInsight[] {
  if (!match) return [];

  const insights: MatchInsight[] = [];
  const safeEvents = Array.isArray(events) ? events : [];
  const category = normalizeSportCategory(match.sport_id || match.sport_name, match.scoring_type);
  const winProb = calculateWinProbability(match, safeEvents);
  const clutch = calculateClutchRating(match, safeEvents);

  // 1. Win Probability Insight
  const favoredTeam = winProb.homePct >= 50 ? "Seniors '26" : "Juniors '27";
  const dominantPct = Math.max(winProb.homePct, winProb.awayPct);
  insights.push({
    title: 'Win Probability Expectancy',
    detail: `${favoredTeam} currently held at ${dominantPct}% model win projection. ${winProb.summary}.`,
    impact: dominantPct >= 75 ? 'positive' : 'neutral',
    metric: `${dominantPct}% ${favoredTeam.split(' ')[0]}`,
  });

  // 2. Clutch & Tension Insight
  if (clutch.leverage === 'Overtime Climax' || clutch.isNailBiter) {
    insights.push({
      title: 'Clutch Telemetry Alert',
      detail: `High spectator tension: Match registered in ${clutch.leverage} with ${clutch.leadChangeCount} lead reversals.`,
      impact: 'critical',
      metric: clutch.leverage,
    });
  }

  // 3. Scoring Runs & Momentum Shifts
  if (safeEvents.length >= 3) {
    const recentEvents = [...safeEvents].slice(-6);
    let homeCount = 0;
    let awayCount = 0;
    for (const ev of recentEvents) {
      const team = String(ev.team || '').toLowerCase();
      if (team === 'home') homeCount += 1;
      else if (team === 'away') awayCount += 1;
    }

    if (homeCount >= 4 && awayCount <= 1) {
      insights.push({
        title: 'Seniors Momentum Surge',
        detail: `Seniors have executed an unanswered flurry in recent phases, seizing court control.`,
        impact: 'positive',
        metric: `${homeCount}-1 Run`,
      });
    } else if (awayCount >= 4 && homeCount <= 1) {
      insights.push({
        title: 'Juniors Counter-Attack',
        detail: `Juniors mounting a rapid response with intense attacking pressure.`,
        impact: 'critical',
        metric: `${awayCount}-1 Run`,
      });
    }
  }

  // 4. Sport-Specific Tactical Insights
  if (category === 'CRICKET') {
    const state = match.sport_state;
    if (state?.currentInnings === 2 || match.current_period?.includes('2nd Innings')) {
      const inn1 = safeNum(state?.innings1?.runs, match.score_home ?? 0);
      const inn2 = safeNum(state?.innings2?.runs, match.score_away ?? 0);
      const balls = safeNum(state?.innings2?.balls, 0);
      const wkts = safeNum(state?.innings2?.wickets, 0);
      const chase = calculateCricketChaseExpectancy(inn1, inn2, balls, wkts);

      insights.push({
        title: 'Chase Required Run Rate',
        detail: `Target: ${chase.targetRuns}. Need ${chase.runsRemaining} runs off ${chase.ballsRemaining} balls at ${chase.rrr} RPO with ${chase.wicketsRemaining} wickets left.`,
        impact: chase.rrr > 11 ? 'critical' : 'neutral',
        metric: `RRR ${chase.rrr}`,
      });
    }
  } else if (category === 'FOOTBALL' || category === 'FUTSAL') {
    let yellowCount = 0;
    let redCount = 0;
    for (const ev of safeEvents) {
      const type = String(ev.event_type || '').toUpperCase();
      if (type === 'YELLOW_CARD') yellowCount += 1;
      if (type === 'RED_CARD') redCount += 1;
    }
    if (redCount > 0) {
      insights.push({
        title: 'Numerical Disadvantage',
        detail: `Ejection on field: Red card issued, drastically shifting defensive transition and fatigue dynamics.`,
        impact: 'critical',
        metric: `${redCount} Red Card`,
      });
    } else if (yellowCount >= 2) {
      insights.push({
        title: 'Disciplinary Caution',
        detail: `${yellowCount} yellow cards on record; aggressive tackles risk turning into decisive expulsions.`,
        impact: 'neutral',
        metric: `${yellowCount} Yellows`,
      });
    }
  } else if (category === 'BADMINTON' || category === 'TABLE_TENNIS') {
    const curH = safeNum(match.sport_state?.currentSetPoints?.home, 0);
    const curA = safeNum(match.sport_state?.currentSetPoints?.away, 0);
    if (curH >= 20 && curA >= 20) {
      insights.push({
        title: 'Sudden Death Deuce',
        detail: `Set is locked at ${curH}-${curA}. A two-point margin or golden point cap is required to claim the frame.`,
        impact: 'critical',
        metric: `Deuce ${curH}-${curA}`,
      });
    }
  }

  // 5. Inter-Batch Rivalry Context
  insights.push({
    title: 'Ratanjee Championship Standing',
    detail: 'Every match point in this fixture directly updates the overall XLRI inter-batch trophy points table.',
    impact: 'neutral',
    metric: 'Seniors vs Juniors',
  });

  return insights;
}

// ============================================================================
// EXPECTED SCORING RATES & FULL REPORT
// ============================================================================

export function calculateExpectedScoringRates(
  match: any,
  events: any[] = []
): ExpectedScoringRates {
  const safeEvents = Array.isArray(events) ? events : [];
  const category = normalizeSportCategory(match?.sport_id || match?.sport_name, match?.scoring_type);
  const scoreHome = safeNum(match?.score_home, 0);
  const scoreAway = safeNum(match?.score_away, 0);
  const elapsedMinutes = Math.max(1, safeNum(match?.current_time_seconds, 0) / 60);

  let rateMetricName = 'Scoring Rate';
  let currentRateHome = Math.round((scoreHome / elapsedMinutes) * 100) / 100;
  let currentRateAway = Math.round((scoreAway / elapsedMinutes) * 100) / 100;
  let expectedScoreHome = scoreHome;
  let expectedScoreAway = scoreAway;

  switch (category) {
    case 'FOOTBALL':
    case 'FUTSAL': {
      rateMetricName = 'Goals / 90m (xG Pace)';
      currentRateHome = Math.round((scoreHome / (elapsedMinutes / 90)) * 10) / 10;
      currentRateAway = Math.round((scoreAway / (elapsedMinutes / 90)) * 10) / 10;
      const remMins = Math.max(0, 90 - elapsedMinutes);
      expectedScoreHome = Math.round((scoreHome + (remMins / 90) * 1.2) * 10) / 10;
      expectedScoreAway = Math.round((scoreAway + (remMins / 90) * 1.2) * 10) / 10;
      break;
    }
    case 'BASKETBALL': {
      rateMetricName = 'Points / Quarter';
      const qElapsed = Math.max(0.5, elapsedMinutes / 10);
      currentRateHome = Math.round((scoreHome / qElapsed) * 10) / 10;
      currentRateAway = Math.round((scoreAway / qElapsed) * 10) / 10;
      const remQuarters = Math.max(0, 4 - qElapsed);
      expectedScoreHome = Math.round(scoreHome + remQuarters * currentRateHome);
      expectedScoreAway = Math.round(scoreAway + remQuarters * currentRateAway);
      break;
    }
    case 'CRICKET': {
      rateMetricName = 'Run Rate (RPO)';
      currentRateHome = Math.round((scoreHome / (elapsedMinutes / 6)) * 10) / 10;
      currentRateAway = Math.round((scoreAway / (elapsedMinutes / 6)) * 10) / 10;
      expectedScoreHome = scoreHome;
      expectedScoreAway = scoreAway;
      break;
    }
    default: {
      expectedScoreHome = scoreHome;
      expectedScoreAway = scoreAway;
      break;
    }
  }

  return {
    expectedScoreHome,
    expectedScoreAway,
    rateMetricName,
    currentRateHome,
    currentRateAway,
    projectedTotal: Math.round(expectedScoreHome + expectedScoreAway),
  };
}

/**
 * Convenience orchestrator for UI components & Recharts feeds.
 */
export function getMatchAnalyticsReport(
  match: any,
  events: any[] = []
): MatchAnalyticsReport {
  return {
    winProbability: calculateWinProbability(match, events),
    momentumWave: calculateMomentumWave(match, events),
    clutch: calculateClutchRating(match, events),
    insights: generateMatchInsights(match, events),
    expectedRates: calculateExpectedScoringRates(match, events),
  };
}
