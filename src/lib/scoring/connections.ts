/**
 * Connections Scoring Module
 * Calculates trainer, jockey, and partnership scores based on DRF data
 *
 * Score Breakdown (v3.2 - Connections Reduction):
 * - Trainer Score: 0-14 points (based on track/surface/class-specific win rates)
 * - Jockey Score: 0-7 points (based on track/style-specific win rates)
 * - Partnership Bonus: 0-2 points (capped from 4)
 *
 * v3.2 Partnership Bonus Tiers (capped at 2 pts):
 * - Strong partnership (25%+ combo win rate, 5+ starts): 2 pts
 * - Regular partnership (15-24% combo win rate, 5+ starts): 1 pt
 * - New or weak partnership: 0 pts
 *
 * Total: 0-23 points (7.0% of 328 base)
 *
 * v3.2 CHANGES (Phase 7 - Connections Reduction):
 * - Reduced from 27 to 23 pts (8.2% → 7.0% of 328)
 * - Partnership bonus capped at 2 pts (was 4)
 * - Trainer max reduced from 16 to 14 pts
 *
 * Dynamic Pattern Features:
 * - Track-specific: "Trainer X at Churchill Downs: 18% win (45 starts)"
 * - Distance-specific: "Trainer X at 6F: 22% win (67 starts)"
 * - Surface-specific: "Trainer X on turf: 15% win (123 starts)"
 * - Class-specific: "Trainer X in $25K claimers: 28% win (89 starts)"
 * - Combo patterns: "Trainer X in turf routes at Saratoga: 31% win (26 starts)"
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import {
  type TrainerPatternResult,
  type JockeyPatternResult,
  type SynergyResult,
  calculateTrainerPatternScore,
  calculateJockeyPatternScore,
  getConnectionSynergy,
  getTrainerPatternDisplay,
  getJockeyPatternDisplay,
  getSynergyDisplay,
  hasSignificantPartnership,
} from '../patterns';

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectionStats {
  name: string;
  wins: number;
  starts: number;
  winRate: number;
  places: number;
  shows: number;
  itmRate: number; // In the money rate
  /** Source of stats: 'drf' (actual DRF data) or 'pp' (built from past performances) */
  source: 'drf' | 'pp';
}

export interface PartnershipStats {
  trainer: string;
  jockey: string;
  wins: number;
  starts: number;
  winRate: number;
}

/**
 * Enhanced trainer/jockey partnership analysis result
 */
export interface TrainerJockeyPartnershipAnalysis {
  /** Current jockey name */
  currentJockey: string;
  /** Current trainer name */
  currentTrainer: string;
  /** Number of starts this trainer/jockey have had together */
  startsWithCombo: number;
  /** Number of wins when they team up */
  winsWithCombo: number;
  /** Win rate when they team up (as percentage 0-100) */
  comboWinRate: number;
  /** Is this a regular partnership (5+ starts together)? */
  isRegularPartnership: boolean;
  /** Is this a winning partnership (25%+ win rate together)? */
  isWinningPartnership: boolean;
  /** Is this the first time this trainer is using this jockey for this horse? */
  isFirstTimeWithJockey: boolean;
  /** Partnership tier for scoring */
  partnershipTier: 'elite' | 'strong' | 'good' | 'regular' | 'new';
}

export interface ConnectionsDatabase {
  trainers: Map<string, ConnectionStats>;
  jockeys: Map<string, ConnectionStats>;
  partnerships: Map<string, PartnershipStats>; // Key: "trainer|jockey"
}

export interface ConnectionsScoreResult {
  total: number;
  trainer: number;
  jockey: number;
  partnershipBonus: number;
  trainerStats: ConnectionStats | null;
  jockeyStats: ConnectionStats | null;
  partnershipStats: PartnershipStats | null;
  reasoning: string;
}

// ============================================================================
// DATABASE BUILDING
// ============================================================================

/**
 * Normalize name for consistent matching
 * Handles "SMITH, J." vs "J. SMITH" vs "JOHN SMITH"
 */
function normalizeName(name: string): string {
  return name.toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Build a connections database from all horses' past performances
 * This creates a dynamic trainer/jockey database from the actual DRF data
 */
export function buildConnectionsDatabase(horses: HorseEntry[]): ConnectionsDatabase {
  const trainers = new Map<string, ConnectionStats>();
  const jockeys = new Map<string, ConnectionStats>();
  const partnerships = new Map<string, PartnershipStats>();

  // Process each horse's past performances
  for (const horse of horses) {
    // Add current race trainer/jockey to database (but don't count results yet)
    const currentTrainer = normalizeName(horse.trainerName);
    const currentJockey = normalizeName(horse.jockeyName);

    if (!trainers.has(currentTrainer)) {
      trainers.set(currentTrainer, {
        name: horse.trainerName,
        wins: 0,
        starts: 0,
        winRate: 0,
        places: 0,
        shows: 0,
        itmRate: 0,
        source: 'pp', // Database stats are built from PPs
      });
    }

    if (!jockeys.has(currentJockey)) {
      jockeys.set(currentJockey, {
        name: horse.jockeyName,
        wins: 0,
        starts: 0,
        winRate: 0,
        places: 0,
        shows: 0,
        itmRate: 0,
        source: 'pp', // Database stats are built from PPs
      });
    }

    // Process past performances for historical data
    for (const pp of horse.pastPerformances) {
      const ppJockey = normalizeName(pp.jockey);

      // Update jockey stats from past performances
      if (!jockeys.has(ppJockey)) {
        jockeys.set(ppJockey, {
          name: pp.jockey,
          wins: 0,
          starts: 0,
          winRate: 0,
          places: 0,
          shows: 0,
          itmRate: 0,
          source: 'pp', // Database stats are built from PPs
        });
      }

      const jockeyStats = jockeys.get(ppJockey);
      if (jockeyStats) {
        jockeyStats.starts++;
        if (pp.finishPosition === 1) jockeyStats.wins++;
        if (pp.finishPosition === 2) jockeyStats.places++;
        if (pp.finishPosition === 3) jockeyStats.shows++;
        jockeyStats.winRate = (jockeyStats.wins / jockeyStats.starts) * 100;
        jockeyStats.itmRate =
          ((jockeyStats.wins + jockeyStats.places + jockeyStats.shows) / jockeyStats.starts) * 100;
      }

      // Update trainer stats (use current trainer for this horse's PPs)
      const trainerStats = trainers.get(currentTrainer);
      if (trainerStats) {
        trainerStats.starts++;
        if (pp.finishPosition === 1) trainerStats.wins++;
        if (pp.finishPosition === 2) trainerStats.places++;
        if (pp.finishPosition === 3) trainerStats.shows++;
        trainerStats.winRate = (trainerStats.wins / trainerStats.starts) * 100;
        trainerStats.itmRate =
          ((trainerStats.wins + trainerStats.places + trainerStats.shows) / trainerStats.starts) *
          100;
      }

      // Track trainer/jockey partnerships
      const partnerKey = `${currentTrainer}|${ppJockey}`;
      if (!partnerships.has(partnerKey)) {
        partnerships.set(partnerKey, {
          trainer: horse.trainerName,
          jockey: pp.jockey,
          wins: 0,
          starts: 0,
          winRate: 0,
        });
      }

      const partnerStats = partnerships.get(partnerKey);
      if (partnerStats) {
        partnerStats.starts++;
        if (pp.finishPosition === 1) partnerStats.wins++;
        partnerStats.winRate = (partnerStats.wins / partnerStats.starts) * 100;
      }
    }
  }

  return { trainers, jockeys, partnerships };
}

// ============================================================================
// ENHANCED PARTNERSHIP ANALYSIS
// ============================================================================

/** Minimum starts for a regular partnership */
const REGULAR_PARTNERSHIP_MIN_STARTS = 5;

/** Partnership tier thresholds (win rate percentages) */
const PARTNERSHIP_TIERS = {
  elite: { minWinRate: 30, minStarts: 8 }, // 30%+ win rate, 8+ starts
  strong: { minWinRate: 25, minStarts: 5 }, // 25-29% win rate, 5+ starts
  good: { minWinRate: 20, minStarts: 5 }, // 20-24% win rate, 5+ starts
  regular: { minWinRate: 15, minStarts: 5 }, // 15-19% win rate, 5+ starts
} as const;

/**
 * Partnership bonus points by tier (v3.2: max 2 points, capped from 4)
 * - Strong partnership (25%+ combo win rate, 5+ starts): 2 pts
 * - Regular partnership (15-24% combo win rate, 5+ starts): 1 pt
 * - New or weak partnership: 0 pts
 */
const ENHANCED_PARTNERSHIP_POINTS = {
  elite: 2, // v3.2: capped from 4
  strong: 2, // v3.2: capped from 3
  good: 1, // v3.2: reduced from 2
  regular: 1, // unchanged
  new: 0,
} as const;

/** Maximum enhanced partnership bonus points (v3.2: capped at 2) */
export const MAX_ENHANCED_PARTNERSHIP_POINTS = 2;

/**
 * Analyze the trainer/jockey partnership by examining past performances
 *
 * Looks through a horse's past performances to find how many times
 * the current trainer/jockey combination has worked together and
 * their combined win rate.
 *
 * @param horse - The horse entry to analyze
 * @returns Detailed partnership analysis
 */
export function analyzeTrainerJockeyPartnership(
  horse: HorseEntry
): TrainerJockeyPartnershipAnalysis {
  const currentTrainer = horse.trainerName;
  const currentJockey = horse.jockeyName;
  const currentJockeyNorm = normalizeName(currentJockey);

  // Count starts and wins where trainer used this jockey
  let startsWithCombo = 0;
  let winsWithCombo = 0;

  // Track if we've ever seen this jockey with this horse before
  let hasUsedThisJockeyBefore = false;

  for (const pp of horse.pastPerformances) {
    if (!pp.jockey) continue;

    const ppJockeyNorm = normalizeName(pp.jockey);

    // Check if this PP has the same jockey as current race
    if (ppJockeyNorm === currentJockeyNorm) {
      hasUsedThisJockeyBefore = true;
      startsWithCombo++;

      if (pp.finishPosition === 1) {
        winsWithCombo++;
      }
    }
  }

  // Calculate combo win rate
  const comboWinRate = startsWithCombo > 0 ? (winsWithCombo / startsWithCombo) * 100 : 0;

  // Determine if this is a regular partnership (5+ starts together)
  const isRegularPartnership = startsWithCombo >= REGULAR_PARTNERSHIP_MIN_STARTS;

  // Determine if this is a winning partnership (25%+ win rate together)
  const isWinningPartnership =
    comboWinRate >= 25 && startsWithCombo >= REGULAR_PARTNERSHIP_MIN_STARTS;

  // Determine if this is the first time with this jockey
  const isFirstTimeWithJockey = !hasUsedThisJockeyBefore;

  // Determine partnership tier
  let partnershipTier: TrainerJockeyPartnershipAnalysis['partnershipTier'] = 'new';

  if (
    startsWithCombo >= PARTNERSHIP_TIERS.elite.minStarts &&
    comboWinRate >= PARTNERSHIP_TIERS.elite.minWinRate
  ) {
    partnershipTier = 'elite';
  } else if (
    startsWithCombo >= PARTNERSHIP_TIERS.strong.minStarts &&
    comboWinRate >= PARTNERSHIP_TIERS.strong.minWinRate
  ) {
    partnershipTier = 'strong';
  } else if (
    startsWithCombo >= PARTNERSHIP_TIERS.good.minStarts &&
    comboWinRate >= PARTNERSHIP_TIERS.good.minWinRate
  ) {
    partnershipTier = 'good';
  } else if (
    startsWithCombo >= PARTNERSHIP_TIERS.regular.minStarts &&
    comboWinRate >= PARTNERSHIP_TIERS.regular.minWinRate
  ) {
    partnershipTier = 'regular';
  }

  return {
    currentJockey,
    currentTrainer,
    startsWithCombo,
    winsWithCombo,
    comboWinRate,
    isRegularPartnership,
    isWinningPartnership,
    isFirstTimeWithJockey,
    partnershipTier,
  };
}

/**
 * Calculate enhanced partnership bonus based on tier (0-4 points)
 *
 * Scoring:
 * - Elite partnership (30%+ combo win rate, 8+ starts): 4 pts
 * - Strong partnership (25-29% combo win rate, 5+ starts): 3 pts
 * - Good partnership (20-24% combo win rate, 5+ starts): 2 pts
 * - Regular partnership (15-19% combo win rate, 5+ starts): 1 pt
 * - New or weak partnership: 0 pts
 */
function calculateEnhancedPartnershipBonus(analysis: TrainerJockeyPartnershipAnalysis): {
  bonus: number;
  reasoning: string;
} {
  const { partnershipTier, comboWinRate, startsWithCombo, winsWithCombo, isFirstTimeWithJockey } =
    analysis;

  const bonus = ENHANCED_PARTNERSHIP_POINTS[partnershipTier];

  // Build reasoning string
  let reasoning: string;

  if (isFirstTimeWithJockey) {
    reasoning = 'First time with this jockey';
  } else if (partnershipTier === 'elite') {
    reasoning = `Elite combo: ${comboWinRate.toFixed(0)}% win (${winsWithCombo}/${startsWithCombo}) → +${bonus}pts`;
  } else if (partnershipTier === 'strong') {
    reasoning = `Strong combo: ${comboWinRate.toFixed(0)}% win (${winsWithCombo}/${startsWithCombo}) → +${bonus}pts`;
  } else if (partnershipTier === 'good') {
    reasoning = `Good combo: ${comboWinRate.toFixed(0)}% win (${winsWithCombo}/${startsWithCombo}) → +${bonus}pts`;
  } else if (partnershipTier === 'regular') {
    reasoning = `Regular combo: ${comboWinRate.toFixed(0)}% win (${winsWithCombo}/${startsWithCombo}) → +${bonus}pt`;
  } else if (startsWithCombo > 0) {
    reasoning = `Limited combo: ${startsWithCombo} start${startsWithCombo === 1 ? '' : 's'} together`;
  } else {
    reasoning = 'New pairing';
  }

  return { bonus, reasoning };
}

/**
 * Extract trainer stats from horse entry data
 *
 * v2.5 (Shipper Fix): When trainer has 0 meet starts (shipping in),
 * use past performance stats as career proxy instead of penalizing.
 *
 * PRIORITY: Use actual DRF trainer stats (Fields 29-32) first
 * FALLBACK: Use PP-based stats for shippers (career approximation)
 */
function extractTrainerStatsFromHorse(horse: HorseEntry): ConnectionStats | null {
  // PRIORITY: Use actual DRF trainer stats from current meet (Fields 29-32)
  if (horse.trainerMeetStarts > 0) {
    const starts = horse.trainerMeetStarts;
    const wins = horse.trainerMeetWins;
    const places = horse.trainerMeetPlaces;
    const shows = horse.trainerMeetShows;

    return {
      name: horse.trainerName,
      wins,
      starts,
      winRate: (wins / starts) * 100,
      places,
      shows,
      itmRate: ((wins + places + shows) / starts) * 100,
      source: 'drf',
    };
  }

  // v2.5 SHIPPER FIX: Build from past performances as career proxy
  // This prevents penalizing top trainers who are shipping in
  const wins = horse.pastPerformances.filter((pp) => pp.finishPosition === 1).length;
  const starts = horse.pastPerformances.length;
  const places = horse.pastPerformances.filter((pp) => pp.finishPosition === 2).length;
  const shows = horse.pastPerformances.filter((pp) => pp.finishPosition === 3).length;

  if (starts === 0) return null;

  return {
    name: horse.trainerName,
    wins,
    starts,
    winRate: (wins / starts) * 100,
    places,
    shows,
    itmRate: ((wins + places + shows) / starts) * 100,
    source: 'pp', // Marked as PP-based (shipper/career stats)
  };
}

/**
 * Extract jockey stats from horse entry data
 *
 * v2.5 (Shipper Fix): When jockey has 0 meet starts (shipping in),
 * use past performance stats as career proxy instead of penalizing.
 *
 * PRIORITY: Use actual DRF jockey stats (Fields 35-38) first
 * FALLBACK: Use PP-based stats for shippers (career approximation)
 */
function extractJockeyStatsFromHorse(horse: HorseEntry): ConnectionStats | null {
  // PRIORITY: Use actual DRF jockey stats from current meet (Fields 35-38)
  if (horse.jockeyMeetStarts > 0) {
    const starts = horse.jockeyMeetStarts;
    const wins = horse.jockeyMeetWins;
    const places = horse.jockeyMeetPlaces;
    const shows = horse.jockeyMeetShows;

    return {
      name: horse.jockeyName,
      wins,
      starts,
      winRate: (wins / starts) * 100,
      places,
      shows,
      itmRate: ((wins + places + shows) / starts) * 100,
      source: 'drf',
    };
  }

  // v2.5 SHIPPER FIX: Build from past performances as career proxy
  // Get stats for jockeys from past performances where same jockey rode
  const jockeyNorm = normalizeName(horse.jockeyName);

  const jockeyPPs = horse.pastPerformances.filter((pp) => normalizeName(pp.jockey) === jockeyNorm);

  if (jockeyPPs.length === 0) {
    // First time with this jockey - check all PPs for any jockey data
    const wins = horse.pastPerformances.filter((pp) => pp.finishPosition === 1).length;
    const starts = horse.pastPerformances.length;
    const places = horse.pastPerformances.filter((pp) => pp.finishPosition === 2).length;
    const shows = horse.pastPerformances.filter((pp) => pp.finishPosition === 3).length;

    if (starts === 0) return null;

    return {
      name: horse.jockeyName,
      wins,
      starts,
      winRate: (wins / starts) * 100,
      places,
      shows,
      itmRate: ((wins + places + shows) / starts) * 100,
      source: 'pp',
    };
  }

  const wins = jockeyPPs.filter((pp) => pp.finishPosition === 1).length;
  const starts = jockeyPPs.length;
  const places = jockeyPPs.filter((pp) => pp.finishPosition === 2).length;
  const shows = jockeyPPs.filter((pp) => pp.finishPosition === 3).length;

  return {
    name: horse.jockeyName,
    wins,
    starts,
    winRate: (wins / starts) * 100,
    places,
    shows,
    itmRate: ((wins + places + shows) / starts) * 100,
    source: 'pp',
  };
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Phase 2: Connection scoring constants with data completeness penalties
 *
 * SCORING LOGIC:
 * - Trainer with meet stats → full scoring (0-16 pts)
 * - Trainer 0 meet starts BUT has career stats → use career, cap at 12 pts
 * - Trainer 0 meet starts AND no career stats → 4 pts (half baseline, penalized)
 *
 * - Jockey with meet stats → full scoring (0-7 pts)
 * - Jockey 0 meet starts BUT has career stats → use career, cap at 5 pts
 * - Jockey 0 meet starts AND no career stats → 2 pts (half baseline, penalized)
 */
const MIN_TRAINER_SCORE_WITH_CAREER = 8; // Baseline when career stats exist
const MIN_TRAINER_SCORE_NO_CAREER = 4; // Phase 2: Half baseline for unknowns

const MIN_JOCKEY_SCORE_WITH_CAREER = 4; // Baseline when career stats exist
const MIN_JOCKEY_SCORE_NO_CAREER = 2; // Phase 2: Half baseline for unknowns
const MAX_JOCKEY_SCORE_SHIPPER = 5; // Phase 2: Cap for career-only stats

// Keep old constants for backwards compatibility (exported for external use)
export const MIN_TRAINER_SCORE = MIN_TRAINER_SCORE_WITH_CAREER;
export const MIN_JOCKEY_SCORE = MIN_JOCKEY_SCORE_WITH_CAREER;

/**
 * Calculate trainer score (0-14 points)
 * Based on win rate thresholds
 * v3.2: Reduced from 16 to 14 max
 *
 * PHASE 2 - DATA COMPLETENESS PENALTIES:
 * - 0 meet starts AND no career stats → 4 pts (half baseline, penalized for unknown)
 * - 0 meet starts BUT has career stats → use career stats, cap at 11 pts
 * - Has meet stats → full scoring (0-14 pts)
 *
 * This ensures trainers with incomplete data are penalized,
 * not given neutral scores that reward unknowns.
 */
function calculateTrainerScore(stats: ConnectionStats | null): number {
  // No stats at all = penalized baseline (unknown trainer)
  if (!stats) {
    return MIN_TRAINER_SCORE_NO_CAREER; // Phase 2: 4 pts, not 7
  }

  // Insufficient data = penalized baseline
  if (stats.starts < 3) {
    // Phase 2: If source is PP (career stats), give half baseline
    // because we have some evidence but not enough
    return MIN_TRAINER_SCORE_NO_CAREER; // 4 pts
  }

  const winRate = stats.winRate;
  const isShipperStats = stats.source === 'pp'; // Career stats, not meet stats

  // v3.2: Calculate raw score based on win rate (max 14)
  let score: number;
  if (winRate >= 20)
    score = 14; // v3.2: reduced from 16
  else if (winRate >= 15)
    score = 11; // v3.2: reduced from 13
  else if (winRate >= 10)
    score = 8; // v3.2: reduced from 9
  else if (winRate >= 5)
    score = 7; // Average trainer (5-9%)
  else score = 7; // Below average gets baseline

  // Phase 2: Apply shipper cap when using career stats instead of meet stats
  // We trust meet stats more than career approximations
  if (isShipperStats) {
    score = Math.min(score, 11); // v3.2: cap at 11 pts (was 12)
  }

  return score;
}

/**
 * Calculate jockey score (0-7 points)
 * Same methodology as trainer but scaled
 *
 * PHASE 2 - DATA COMPLETENESS PENALTIES:
 * - 0 meet starts AND no career stats → 2 pts (half baseline, penalized for unknown)
 * - 0 meet starts BUT has career stats → use career stats, cap at 5 pts
 * - Has meet stats → full scoring (0-7 pts)
 */
function calculateJockeyScore(stats: ConnectionStats | null): number {
  // No stats at all = penalized baseline (unknown jockey)
  if (!stats) {
    return MIN_JOCKEY_SCORE_NO_CAREER; // Phase 2: 2 pts, not 4
  }

  // Insufficient data = penalized baseline
  if (stats.starts < 3) {
    return MIN_JOCKEY_SCORE_NO_CAREER; // 2 pts
  }

  const winRate = stats.winRate;
  const isShipperStats = stats.source === 'pp'; // Career stats, not meet stats

  // Calculate raw score based on win rate
  let score: number;
  if (winRate >= 20)
    score = 7; // Elite jockey
  else if (winRate >= 15)
    score = 6; // Very good jockey
  else if (winRate >= 10)
    score = MIN_JOCKEY_SCORE_WITH_CAREER; // Good jockey
  else if (winRate >= 5)
    score = MIN_JOCKEY_SCORE_WITH_CAREER; // Average jockey
  else score = MIN_JOCKEY_SCORE_WITH_CAREER; // Below average gets baseline

  // Phase 2: Apply shipper cap when using career stats instead of meet stats
  if (isShipperStats) {
    score = Math.min(score, MAX_JOCKEY_SCORE_SHIPPER); // Cap at 5 pts
  }

  return score;
}

/**
 * Calculate enhanced partnership bonus using tiered scoring (0-4 points)
 *
 * ENHANCED SCORING (v2.1):
 * - Elite partnership (30%+ combo win rate, 8+ starts): 4 pts
 * - Strong partnership (25-29% combo win rate, 5+ starts): 3 pts
 * - Good partnership (20-24% combo win rate, 5+ starts): 2 pts
 * - Regular partnership (15-19% combo win rate, 5+ starts): 1 pt
 * - New or weak partnership: 0 pts
 *
 * This uses the horse's past performances to directly analyze the trainer/jockey
 * combination, giving more accurate partnership data than database lookup.
 */
function calculatePartnershipBonus(horse: HorseEntry): {
  bonus: number;
  stats: PartnershipStats | null;
  analysis: TrainerJockeyPartnershipAnalysis;
  reasoning: string;
} {
  // Analyze the trainer/jockey partnership from past performances
  const analysis = analyzeTrainerJockeyPartnership(horse);

  // Calculate enhanced bonus based on tier
  const { bonus, reasoning } = calculateEnhancedPartnershipBonus(analysis);

  // Create partnership stats for compatibility
  const stats: PartnershipStats | null =
    analysis.startsWithCombo > 0
      ? {
          trainer: analysis.currentTrainer,
          jockey: analysis.currentJockey,
          wins: analysis.winsWithCombo,
          starts: analysis.startsWithCombo,
          winRate: analysis.comboWinRate,
        }
      : null;

  return { bonus, stats, analysis, reasoning };
}

/**
 * Build reasoning string for connections score
 * Includes source indicator (DRF=actual stats, PP=fallback from past performances)
 * and enhanced partnership analysis
 */
function buildReasoning(
  trainerStats: ConnectionStats | null,
  jockeyStats: ConnectionStats | null,
  partnershipReasoning: string
): string {
  const parts: string[] = [];

  if (trainerStats && trainerStats.starts >= 3) {
    const sourceTag = trainerStats.source === 'drf' ? '' : ' [PP]';
    parts.push(
      `T: ${trainerStats.winRate.toFixed(0)}% (${trainerStats.wins}/${trainerStats.starts})${sourceTag}`
    );
  } else {
    parts.push('T: Limited data');
  }

  if (jockeyStats && jockeyStats.starts >= 3) {
    const sourceTag = jockeyStats.source === 'drf' ? '' : ' [PP]';
    parts.push(
      `J: ${jockeyStats.winRate.toFixed(0)}% (${jockeyStats.wins}/${jockeyStats.starts})${sourceTag}`
    );
  } else {
    parts.push('J: Limited data');
  }

  // Add partnership reasoning if not just "New pairing"
  if (partnershipReasoning && partnershipReasoning !== 'New pairing') {
    parts.push(partnershipReasoning);
  }

  return parts.join(' | ');
}

/**
 * Dev-only logging for connections scoring comparison
 * Logs old (PP-based) vs new (DRF-based) calculation results
 */
function logConnectionsDebug(
  horse: HorseEntry,
  trainerStats: ConnectionStats | null,
  jockeyStats: ConnectionStats | null,
  trainerScore: number,
  jockeyScore: number
): void {
  // Only log in development mode
  // Use import.meta.env.DEV for Vite compatibility (works in both browser and test)
  if (typeof import.meta !== 'undefined' && !import.meta.env?.DEV) return;
  if (typeof import.meta === 'undefined') return; // Skip in non-Vite environments

  // Calculate what the old PP-based calculation would have produced
  const ppWins = horse.pastPerformances.filter((pp) => pp.finishPosition === 1).length;
  const ppStarts = horse.pastPerformances.length;
  const ppWinRate = ppStarts > 0 ? (ppWins / ppStarts) * 100 : 0;

  // Determine old trainer score (PP-based)
  let oldTrainerScore = 7; // neutral default
  if (ppStarts >= 3) {
    if (ppWinRate >= 20) oldTrainerScore = 16;
    else if (ppWinRate >= 15) oldTrainerScore = 13;
    else if (ppWinRate >= 10) oldTrainerScore = 9;
    else if (ppWinRate >= 5) oldTrainerScore = 5;
    else oldTrainerScore = 2;
  }

  // Only log if there's a significant difference
  const trainerDiff = Math.abs(trainerScore - oldTrainerScore);
  const usedDRF = trainerStats?.source === 'drf' || jockeyStats?.source === 'drf';

  if (usedDRF && trainerDiff >= 3) {
    console.log(
      `[Connections Debug] ${horse.horseName}: ` +
        `Trainer OLD (PP): ${ppWinRate.toFixed(0)}% → ${oldTrainerScore}pts | ` +
        `NEW (${trainerStats?.source?.toUpperCase() || 'null'}): ${trainerStats?.winRate.toFixed(0) || 0}% → ${trainerScore}pts | ` +
        `Jockey (${jockeyStats?.source?.toUpperCase() || 'null'}): ${jockeyStats?.winRate.toFixed(0) || 0}% → ${jockeyScore}pts`
    );
  }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate connections score for a horse
 *
 * @param horse - The horse entry to score
 * @param database - Optional pre-built connections database for efficiency
 * @returns Detailed score breakdown with stats
 */
export function calculateConnectionsScore(
  horse: HorseEntry,
  database: ConnectionsDatabase | null = null
): ConnectionsScoreResult {
  // Get trainer stats - PRIORITY: DRF stats > database PP stats
  // First try to get actual DRF trainer stats from the horse entry
  let trainerStats: ConnectionStats | null = extractTrainerStatsFromHorse(horse);

  // Only use database PP stats if DRF stats aren't available
  if (!trainerStats && database) {
    const dbTrainerStats = database.trainers.get(normalizeName(horse.trainerName));
    trainerStats = dbTrainerStats ?? null;
  }

  // Get jockey stats - PRIORITY: DRF stats > database PP stats
  // First try to get actual DRF jockey stats from the horse entry
  let jockeyStats: ConnectionStats | null = extractJockeyStatsFromHorse(horse);

  // Only use database PP stats if DRF stats aren't available
  if (!jockeyStats && database) {
    const dbJockeyStats = database.jockeys.get(normalizeName(horse.jockeyName));
    jockeyStats = dbJockeyStats ?? null;
  }

  // Calculate individual scores
  const trainerScore = calculateTrainerScore(trainerStats);
  const jockeyScore = calculateJockeyScore(jockeyStats);

  // Dev-only: Log comparison between old (PP-based) and new (DRF-based) calculations
  logConnectionsDebug(horse, trainerStats, jockeyStats, trainerScore, jockeyScore);

  // Check for enhanced partnership bonus (0-4 points based on tier)
  const {
    bonus: partnershipBonus,
    stats: partnershipStats,
    reasoning: partnershipReasoning,
  } = calculatePartnershipBonus(horse);

  // Build reasoning with enhanced partnership info
  const reasoning = buildReasoning(trainerStats, jockeyStats, partnershipReasoning);

  return {
    total: trainerScore + jockeyScore + partnershipBonus,
    trainer: trainerScore,
    jockey: jockeyScore,
    partnershipBonus,
    trainerStats,
    jockeyStats,
    partnershipStats,
    reasoning,
  };
}

/**
 * Calculate connections scores for all horses in a race
 * Builds a shared database for efficiency
 */
export function calculateRaceConnectionsScores(
  horses: HorseEntry[]
): Map<number, ConnectionsScoreResult> {
  // Build database from all horses' past performances
  const database = buildConnectionsDatabase(horses);

  // Calculate score for each horse
  const results = new Map<number, ConnectionsScoreResult>();

  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i];
    if (horse) {
      results.set(i, calculateConnectionsScore(horse, database));
    }
  }

  return results;
}

// ============================================================================
// DYNAMIC PATTERN SCORING (ENHANCED)
// ============================================================================

/** Maximum combined score for connections (v3.2: 14+7+2=23) */
const MAX_CONNECTIONS_SCORE = 23;

/**
 * Extended connections score result with pattern analysis
 */
export interface DynamicConnectionsScoreResult {
  /** Total connections score (0-50, capped) */
  total: number;
  /** Trainer pattern score (0-35) */
  trainerScore: number;
  /** Jockey pattern score (0-15) */
  jockeyScore: number;
  /** Synergy bonus (0-10) */
  synergyBonus: number;
  /** Trainer pattern analysis */
  trainerPattern: TrainerPatternResult;
  /** Jockey pattern analysis */
  jockeyPattern: JockeyPatternResult;
  /** Synergy analysis */
  synergy: SynergyResult;
  /** Combined reasoning string */
  reasoning: string;
  /** All evidence strings for display */
  evidence: string[];
  /** Summary for quick display */
  summary: string;
  /** Has significant partnership */
  hasEliteConnections: boolean;
}

/**
 * Calculate dynamic connections score using pattern analysis
 * This is the enhanced version that uses track/surface/class-specific patterns
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Current race header for context
 * @param allHorses - All horses in the race for database building
 * @returns Enhanced score with pattern analysis
 */
export function calculateDynamicConnectionsScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  allHorses: HorseEntry[]
): DynamicConnectionsScoreResult {
  // Calculate trainer pattern score
  const trainerPattern = calculateTrainerPatternScore(horse, raceHeader, allHorses);

  // Calculate jockey pattern score
  const jockeyPattern = calculateJockeyPatternScore(horse, raceHeader, allHorses);

  // Calculate synergy
  const synergy = getConnectionSynergy(horse, allHorses);

  // Calculate total (capped at 50)
  const rawTotal = trainerPattern.score + jockeyPattern.score + synergy.bonus;
  const total = Math.min(rawTotal, MAX_CONNECTIONS_SCORE);

  // Collect all evidence
  const evidence: string[] = [
    ...trainerPattern.evidence,
    ...jockeyPattern.evidence,
    ...synergy.evidence,
  ];

  // Build reasoning
  const reasoningParts: string[] = [];

  if (trainerPattern.relevantPattern) {
    reasoningParts.push(getTrainerPatternDisplay(trainerPattern));
  } else {
    reasoningParts.push('T: Limited data');
  }

  if (jockeyPattern.relevantPattern) {
    reasoningParts.push(getJockeyPatternDisplay(jockeyPattern));
  } else {
    reasoningParts.push('J: Limited data');
  }

  if (hasSignificantPartnership(synergy)) {
    reasoningParts.push(getSynergyDisplay(synergy));
  }

  const reasoning = reasoningParts.join(' | ');

  // Build summary
  const summaryParts: string[] = [];

  if (trainerPattern.relevantPattern) {
    summaryParts.push(`T: ${trainerPattern.relevantPattern.winRate.toFixed(0)}%`);
  }
  if (jockeyPattern.relevantPattern) {
    summaryParts.push(`J: ${jockeyPattern.relevantPattern.winRate.toFixed(0)}%`);
  }
  if (synergy.partnership && synergy.level !== 'none') {
    summaryParts.push(`Pair: ${synergy.partnership.winRate.toFixed(0)}%`);
  }

  const summary = summaryParts.length > 0 ? summaryParts.join(' | ') : 'Limited data';

  // Check for elite connections (score >= 30)
  const hasEliteConnections = total >= 30;

  return {
    total,
    trainerScore: trainerPattern.score,
    jockeyScore: jockeyPattern.score,
    synergyBonus: synergy.bonus,
    trainerPattern,
    jockeyPattern,
    synergy,
    reasoning,
    evidence,
    summary,
    hasEliteConnections,
  };
}

/**
 * Calculate dynamic connections scores for all horses in a race
 *
 * @param horses - All horses in the race
 * @param raceHeader - Race header for context
 * @returns Map of horse index to dynamic score result
 */
export function calculateRaceDynamicConnectionsScores(
  horses: HorseEntry[],
  raceHeader: RaceHeader
): Map<number, DynamicConnectionsScoreResult> {
  const results = new Map<number, DynamicConnectionsScoreResult>();

  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i];
    if (horse) {
      results.set(i, calculateDynamicConnectionsScore(horse, raceHeader, horses));
    }
  }

  return results;
}

/**
 * Get formatted display string for dynamic connections
 */
export function getDynamicConnectionsDisplay(result: DynamicConnectionsScoreResult): {
  trainer: string;
  jockey: string;
  partnership: string | null;
  total: string;
} {
  return {
    trainer: result.trainerPattern.relevantPattern
      ? `${result.trainerPattern.relevantPattern.winRate.toFixed(0)}% win (${result.trainerPattern.relevantPattern.starts} starts) ${result.trainerPattern.relevantPattern.description.toLowerCase()}`
      : 'Limited trainer data',
    jockey: result.jockeyPattern.relevantPattern
      ? `${result.jockeyPattern.relevantPattern.winRate.toFixed(0)}% win (${result.jockeyPattern.relevantPattern.starts} rides) ${result.jockeyPattern.relevantPattern.description.toLowerCase()}`
      : 'Limited jockey data',
    partnership:
      hasSignificantPartnership(result.synergy) && result.synergy.partnership
        ? `${result.synergy.partnership.winRate.toFixed(0)}% together (${result.synergy.partnership.starts} starts)`
        : null,
    total: `${result.total}/50 pts`,
  };
}

/**
 * Check if a horse has elite connections (30+ points)
 */
export function hasEliteConnections(result: DynamicConnectionsScoreResult): boolean {
  return result.hasEliteConnections;
}

/**
 * Get the tier label for connections score
 */
export function getConnectionsTier(score: number): 'elite' | 'strong' | 'average' | 'weak' {
  if (score >= 35) return 'elite';
  if (score >= 25) return 'strong';
  if (score >= 15) return 'average';
  return 'weak';
}

/**
 * Get the tier color for connections score
 */
export function getConnectionsTierColor(score: number): string {
  if (score >= 35) return '#22c55e'; // Green - elite
  if (score >= 25) return '#3b82f6'; // Blue - strong
  if (score >= 15) return '#f59e0b'; // Amber - average
  return '#6b7280'; // Gray - weak
}

// ============================================================================
// TRAINER SURFACE/DISTANCE SPECIALIZATION SCORING
// ============================================================================

/** Sprint distance threshold in furlongs */
const SPRINT_THRESHOLD_FURLONGS = 8;

/** Minimum starts required for credible trainer category data */
const MIN_TRAINER_CATEGORY_STARTS = 5;

/** Maximum points for trainer surface/distance bonus (4 surface + 4 wet = 6 max combined) */
export const MAX_TRAINER_SURFACE_DISTANCE_POINTS = 6;

/**
 * Neutral baseline for trainer surface/distance when data is missing (v2.5)
 * 50% of max (6) = 3 pts
 */
export const TRAINER_SURFACE_DISTANCE_NEUTRAL = 3;

/**
 * Trainer Surface/Distance Bonus Result
 */
export interface TrainerSurfaceDistanceBonusResult {
  /** Total bonus points (0-6 max when stacked with wet) */
  bonus: number;
  /** Surface/distance category matched (if any) */
  matchedCategory: string | null;
  /** Surface/distance trainer win percentage */
  trainerWinPercent: number;
  /** Wet track trainer win percentage (if applicable) */
  wetTrackWinPercent: number;
  /** Whether wet track bonus was applied */
  wetBonusApplied: boolean;
  /** Reasoning for the bonus */
  reasoning: string;
}

/**
 * Check if track condition is considered "wet" or "off"
 */
function isWetCondition(condition: string | undefined | null): boolean {
  if (!condition || typeof condition !== 'string') return false;
  const c = condition.toLowerCase();
  return (
    c === 'muddy' ||
    c === 'sloppy' ||
    c === 'heavy' ||
    c === 'yielding' ||
    c === 'soft' ||
    c === 'slow'
  );
}

/**
 * Calculate points from trainer win percentage
 *
 * Scoring tiers:
 * - 25%+ win rate: 4 pts
 * - 20-24% win rate: 3 pts
 * - 15-19% win rate: 2 pts
 * - 10-14% win rate: 1 pt
 * - <10% win rate: 0 pts
 */
function getTrainerSpecializationPoints(winPercent: number): number {
  if (winPercent >= 25) return 4;
  if (winPercent >= 20) return 3;
  if (winPercent >= 15) return 2;
  if (winPercent >= 10) return 1;
  return 0;
}

/**
 * Determine today's race category based on surface and distance
 */
function getRaceCategory(
  surface: string,
  distanceFurlongs: number
): 'turfSprint' | 'turfRoute' | 'dirtSprint' | 'dirtRoute' {
  const isTurf = surface === 'turf';
  const isSprint = distanceFurlongs < SPRINT_THRESHOLD_FURLONGS;

  if (isTurf) {
    return isSprint ? 'turfSprint' : 'turfRoute';
  } else {
    return isSprint ? 'dirtSprint' : 'dirtRoute';
  }
}

/**
 * Get readable category name
 */
function getCategoryDisplayName(
  category: 'turfSprint' | 'turfRoute' | 'dirtSprint' | 'dirtRoute'
): string {
  const names: Record<typeof category, string> = {
    turfSprint: 'turf sprints',
    turfRoute: 'turf routes',
    dirtSprint: 'dirt sprints',
    dirtRoute: 'dirt routes',
  };
  return names[category];
}

/**
 * Calculate trainer surface/distance specialization bonus
 *
 * Uses parsed trainer category stats (DRF Fields 1146-1221) to apply
 * bonuses when today's race matches trainer's proven strengths.
 *
 * Scoring:
 * - 25%+ win rate in category: 4 pts
 * - 20-24% win rate: 3 pts
 * - 15-19% win rate: 2 pts
 * - 10-14% win rate: 1 pt
 * - <10% win rate: 0 pts
 *
 * Wet track bonus stacks with surface/distance bonus (max combined: 6 pts)
 * Requires minimum 5 starts in category for credibility
 *
 * @param horse - The horse entry (contains trainer category stats)
 * @param raceHeader - Race information (surface, distance)
 * @param trackCondition - Optional track condition override for wet detection
 * @returns Trainer surface/distance bonus result
 */
export function calculateTrainerSurfaceDistanceBonus(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  trackCondition?: string | null
): TrainerSurfaceDistanceBonusResult {
  const stats = horse.trainerCategoryStats;
  const effectiveCondition = trackCondition ?? raceHeader.trackCondition ?? '';
  const isWet = isWetCondition(effectiveCondition);

  // Default result for no data - v2.5: use neutral baseline instead of 0
  const noBonus: TrainerSurfaceDistanceBonusResult = {
    bonus: TRAINER_SURFACE_DISTANCE_NEUTRAL, // v2.5: neutral baseline
    matchedCategory: null,
    trainerWinPercent: 0,
    wetTrackWinPercent: 0,
    wetBonusApplied: false,
    reasoning: `No trainer surface/distance data (neutral baseline: ${TRAINER_SURFACE_DISTANCE_NEUTRAL} pts)`,
  };

  // Guard against missing stats
  if (!stats) {
    return noBonus;
  }

  // Determine today's category
  const category = getRaceCategory(raceHeader.surface, raceHeader.distanceFurlongs);
  const categoryStat = stats[category];

  // Check for credible data in the matched category
  let surfaceDistancePoints = 0;
  let surfaceDistanceWinPercent = 0;
  const categoryName = getCategoryDisplayName(category);
  let hasCredibleSurfaceData = false;

  if (categoryStat && categoryStat.starts >= MIN_TRAINER_CATEGORY_STARTS) {
    hasCredibleSurfaceData = true;
    surfaceDistanceWinPercent = categoryStat.winPercent;
    surfaceDistancePoints = getTrainerSpecializationPoints(surfaceDistanceWinPercent);
  }

  // Check for wet track bonus (stacks with surface/distance)
  let wetPoints = 0;
  let wetWinPercent = 0;
  let wetApplied = false;

  if (isWet && stats.wetTrack && stats.wetTrack.starts >= MIN_TRAINER_CATEGORY_STARTS) {
    wetWinPercent = stats.wetTrack.winPercent;
    wetPoints = getTrainerSpecializationPoints(wetWinPercent);
    wetApplied = wetPoints > 0;
  }

  // Calculate total (capped at 6 points max)
  const rawTotal = surfaceDistancePoints + wetPoints;
  const cappedTotal = Math.min(rawTotal, MAX_TRAINER_SURFACE_DISTANCE_POINTS);

  // Build reasoning
  const reasoningParts: string[] = [];

  if (hasCredibleSurfaceData && surfaceDistancePoints > 0) {
    reasoningParts.push(
      `Trainer ${surfaceDistanceWinPercent.toFixed(0)}% with ${categoryName} → +${surfaceDistancePoints}pts`
    );
  } else if (hasCredibleSurfaceData && surfaceDistancePoints === 0) {
    reasoningParts.push(
      `Trainer ${surfaceDistanceWinPercent.toFixed(0)}% with ${categoryName} (below threshold)`
    );
  } else if (!hasCredibleSurfaceData && categoryStat) {
    reasoningParts.push(
      `Trainer ${categoryStat.starts} starts with ${categoryName} (need ${MIN_TRAINER_CATEGORY_STARTS}+)`
    );
  }

  if (isWet) {
    if (wetApplied) {
      reasoningParts.push(`Wet track: ${wetWinPercent.toFixed(0)}% → +${wetPoints}pts`);
    } else if (stats.wetTrack && stats.wetTrack.starts >= MIN_TRAINER_CATEGORY_STARTS) {
      reasoningParts.push(`Wet track: ${wetWinPercent.toFixed(0)}% (below threshold)`);
    }
  }

  if (rawTotal > cappedTotal) {
    reasoningParts.push(`(capped at ${MAX_TRAINER_SURFACE_DISTANCE_POINTS}pts)`);
  }

  // Return result - v2.5: only apply neutral baseline when NO credible data at all
  if (cappedTotal === 0) {
    // Only apply neutral baseline if we don't have credible surface data
    // If we have credible data but low performance, return 0 (evidence-based penalty)
    if (!hasCredibleSurfaceData) {
      // No credible data = neutral baseline
      const neutralResult: TrainerSurfaceDistanceBonusResult = {
        bonus: TRAINER_SURFACE_DISTANCE_NEUTRAL, // v2.5: neutral baseline
        matchedCategory: categoryName,
        trainerWinPercent: surfaceDistanceWinPercent,
        wetTrackWinPercent: wetWinPercent,
        wetBonusApplied: false,
        reasoning:
          reasoningParts.length > 0
            ? `${reasoningParts.join('; ')} (neutral baseline: ${TRAINER_SURFACE_DISTANCE_NEUTRAL} pts)`
            : `No specific trainer bonus (neutral baseline: ${TRAINER_SURFACE_DISTANCE_NEUTRAL} pts)`,
      };
      return neutralResult;
    }
    // Has credible data but low performance = return 0 (evidence-based)
    return {
      bonus: 0,
      matchedCategory: categoryName,
      trainerWinPercent: surfaceDistanceWinPercent,
      wetTrackWinPercent: wetWinPercent,
      wetBonusApplied: false,
      reasoning:
        reasoningParts.length > 0
          ? reasoningParts.join('; ')
          : `Trainer below threshold in ${categoryName}`,
    };
  }

  return {
    bonus: cappedTotal,
    matchedCategory: categoryName,
    trainerWinPercent: surfaceDistanceWinPercent,
    wetTrackWinPercent: wetWinPercent,
    wetBonusApplied: wetApplied,
    reasoning: reasoningParts.join('; '),
  };
}
