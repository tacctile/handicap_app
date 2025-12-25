/**
 * Connections Scoring Module
 * Calculates trainer, jockey, and partnership scores based on DRF data
 *
 * Score Breakdown (v2.0 - Industry-Aligned Weights):
 * - Trainer Score: 0-16 points (based on track/surface/class-specific win rates)
 * - Jockey Score: 0-7 points (based on track/style-specific win rates)
 * - Partnership Bonus: 0-2 points (trainer-jockey partnership performance)
 *
 * Total: 0-25 points (10.4% of 240 base)
 *
 * NOTE: Connections reduced from 55 to 25 points to reflect industry research
 * showing this is a modifier rather than primary predictive factor.
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

/**
 * Extract trainer stats from horse entry data
 * PRIORITY: Use actual DRF trainer stats (Fields 29-32) first
 * FALLBACK: Only use PP-based stats if DRF stats are missing/zero
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

  // FALLBACK: Build from past performances (low confidence)
  // This should only happen if DRF data is missing
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
    source: 'pp',
  };
}

/**
 * Extract jockey stats from horse entry data
 * PRIORITY: Use actual DRF jockey stats (Fields 35-38) first
 * FALLBACK: Only use PP-based stats if DRF stats are missing/zero
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

  // FALLBACK: Build from past performances (low confidence)
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
 * Calculate trainer score (0-16 points)
 * Based on win rate thresholds
 * Rescaled from 35 max to 16 max (scale factor: 25/55 = 0.4545)
 */
function calculateTrainerScore(stats: ConnectionStats | null): number {
  if (!stats || stats.starts < 3) {
    // Insufficient data - return neutral score
    return 7;
  }

  const winRate = stats.winRate;

  if (winRate >= 20) return 16; // Elite trainer (20%+ win rate)
  if (winRate >= 15) return 13; // Very good trainer (15-19%)
  if (winRate >= 10) return 9; // Good trainer (10-14%)
  if (winRate >= 5) return 5; // Average trainer (5-9%)
  return 2; // Below average (<5%)
}

/**
 * Calculate jockey score (0-7 points)
 * Same methodology as trainer but scaled
 * Rescaled from 15 max to 7 max (scale factor: 25/55 = 0.4545)
 */
function calculateJockeyScore(stats: ConnectionStats | null): number {
  if (!stats || stats.starts < 3) {
    // Insufficient data - return neutral score
    return 3;
  }

  const winRate = stats.winRate;

  if (winRate >= 20) return 7; // Elite jockey
  if (winRate >= 15) return 6; // Very good jockey
  if (winRate >= 10) return 4; // Good jockey
  if (winRate >= 5) return 3; // Average jockey
  return 1; // Below average
}

/**
 * Detect elite partnerships and calculate bonus
 * Same trainer/jockey combo with 25%+ win rate = +5 bonus
 */
function calculatePartnershipBonus(
  trainerName: string,
  jockeyName: string,
  database: ConnectionsDatabase | null
): { bonus: number; stats: PartnershipStats | null } {
  if (!database) {
    return { bonus: 0, stats: null };
  }

  const trainerNorm = normalizeName(trainerName);
  const jockeyNorm = normalizeName(jockeyName);
  const partnerKey = `${trainerNorm}|${jockeyNorm}`;

  const stats = database.partnerships.get(partnerKey);

  if (!stats || stats.starts < 5) {
    return { bonus: 0, stats: null };
  }

  // Elite partnership: 25%+ win rate with at least 5 starts
  // Rescaled from 5 max to 2 max (scale factor: 25/55 = 0.4545)
  if (stats.winRate >= 25) {
    return { bonus: 2, stats };
  }

  return { bonus: 0, stats };
}

/**
 * Build reasoning string for connections score
 * Includes source indicator (DRF=actual stats, PP=fallback from past performances)
 */
function buildReasoning(
  trainerStats: ConnectionStats | null,
  jockeyStats: ConnectionStats | null,
  partnershipStats: PartnershipStats | null,
  partnershipBonus: number
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

  if (partnershipBonus > 0 && partnershipStats) {
    parts.push(`Elite combo: ${partnershipStats.winRate.toFixed(0)}% together`);
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

  // Check for elite partnership bonus
  const { bonus: partnershipBonus, stats: partnershipStats } = calculatePartnershipBonus(
    horse.trainerName,
    horse.jockeyName,
    database
  );

  // Build reasoning
  const reasoning = buildReasoning(trainerStats, jockeyStats, partnershipStats, partnershipBonus);

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

/** Maximum combined score for connections (v2.0 - reduced from 55 to 25) */
const MAX_CONNECTIONS_SCORE = 25;

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

  // Default result for no bonus
  const noBonus: TrainerSurfaceDistanceBonusResult = {
    bonus: 0,
    matchedCategory: null,
    trainerWinPercent: 0,
    wetTrackWinPercent: 0,
    wetBonusApplied: false,
    reasoning: 'No trainer surface/distance data',
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

  // Return result
  if (cappedTotal === 0) {
    if (reasoningParts.length > 0) {
      return {
        ...noBonus,
        matchedCategory: categoryName,
        trainerWinPercent: surfaceDistanceWinPercent,
        wetTrackWinPercent: wetWinPercent,
        reasoning: reasoningParts.join('; '),
      };
    }
    return noBonus;
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
