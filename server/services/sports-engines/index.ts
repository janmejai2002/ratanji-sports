/**
 * Sports Scoring Engines Registry & Factory
 * Ratanji Digital Sports Management & Scoring System
 */

import { FootballEngine } from './football.js';
import { CricketEngine } from './cricket.js';
import { BasketballEngine } from './basketball.js';
import { BadmintonEngine } from './badminton.js';
import { GenericEngine } from './generic.js';
import type { SportEngine } from './types.js';

export * from './types.js';
export * from './football.js';
export * from './cricket.js';
export * from './basketball.js';
export * from './badminton.js';
export * from './generic.js';

export const footballEngine = new FootballEngine();
export const cricketEngine = new CricketEngine();
export const basketballEngine = new BasketballEngine();
export const badmintonEngine = new BadmintonEngine();
export const genericEngine = new GenericEngine();

export function getEngineForSport(sportIdentifier: string): SportEngine {
  if (!sportIdentifier) return genericEngine;
  const clean = String(sportIdentifier).toUpperCase().replace(/^SPORT-/, '');

  if (clean.includes('FOOTBALL')) return footballEngine;
  if (clean.includes('CRICKET')) return cricketEngine;
  if (clean.includes('BASKETBALL')) return basketballEngine;
  if (clean.includes('BADMINTON')) return badmintonEngine;

  return genericEngine;
}
