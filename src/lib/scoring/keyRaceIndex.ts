/**
 * Key Race Index Scoring Module
 *
 * Identifies "hidden form" by cross-referencing horses that have met before.
 * A horse that finished 3rd behind a future Grade 1 winner is more valuable
 * than one that finished 3rd behind claimers.
 *
 * DRF Fields used:
 * - Fields 406-415: PP Winner names (10 PPs)
 * - Fields 416-425: PP Second Place names (10 PPs)
 * - Fields 426-435: PP Third Place names (10 PPs)
 *
 * SCORING LOGIC:
 * When scoring Horse A, look at horses that beat Horse A (or that Horse A beat).
 * If those horses are in today's race card and are highly rated → Horse A's
 * form is more valuable.
 *
 * Key Race Index Bonus Points (within Form category):
 * For each past performance (up to last 5 races):
 *
 * If finished 2nd/3rd behind a horse that:
 *   - Is in today's card AND ranked top 2: +3 pts
 *   - Is in today's card AND ranked top 4: +2 pts
 *
 * If finished 4th/5th behind a quality horse:
 *   - Is in today's card AND ranked top 2: +1 pt
 *
 * Cap total Key Race Index bonus at +6 pts
 *
 * Expected improvement: +2-3% form accuracy
 */

import type { HorseEntry, PastPerformance } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Horse ranking entry for cross-referencing
 */
export interface HorseRanking {
  /** Horse name (normalized for matching) */
  name: string;
  /** Original horse name (for display) */
  originalName: string;
  /** Program number */
  programNumber: number;
  /** Rank within today's race (1 = top pick, etc.) */
  rank: number;
  /** Horse's total score */
  totalScore: number;
}

/**
 * Result of a key race match
 */
export interface KeyRaceMatch {
  /** Name of the matched horse */
  matchedHorse: string;
  /** Which PP index (0 = most recent) */
  ppIndex: number;
  /** This horse's finish position in that race */
  finishPosition: number;
  /** How the matched horse finished (winner, 2nd, 3rd) */
  matchedFinishPosition: 'winner' | 'second' | 'third';
  /** Matched horse's rank in today's race */
  matchedHorseRank: number;
  /** Points awarded for this match */
  pointsAwarded: number;
  /** Reasoning for the points */
  reasoning: string;
}

/**
 * Key Race Index calculation result
 */
export interface KeyRaceIndexResult {
  /** Total bonus points (capped at 6) */
  totalBonus: number;
  /** Raw bonus before cap */
  rawBonus: number;
  /** Whether cap was applied */
  capApplied: boolean;
  /** Individual matches found */
  matches: KeyRaceMatch[];
  /** Summary reasoning */
  reasoning: string;
  /** Whether any matches were found */
  hasMatches: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum Key Race Index bonus points */
export const MAX_KEY_RACE_BONUS = 6;

/** Number of past performances to analyze */
export const MAX_PP_TO_ANALYZE = 5;

/** Minimum rank to qualify for bonus (top 4) */
export const MIN_RANK_FOR_BONUS = 4;

/** Points for finishing 2nd/3rd behind a top 2 horse */
export const POINTS_BEHIND_TOP_2 = 3;

/** Points for finishing 2nd/3rd behind a top 4 horse */
export const POINTS_BEHIND_TOP_4 = 2;

/** Points for finishing 4th/5th behind a top 2 horse */
export const POINTS_4TH_5TH_BEHIND_TOP_2 = 1;

/** Negative penalty for losing to a poorly rated horse (optional) */
export const PENALTY_LOST_TO_WEAK = -1;

/** Minimum rank to apply penalty (bottom half of field) */
export const MIN_RANK_FOR_PENALTY = 0.6; // Bottom 40% of field

// ============================================================================
// NAME NORMALIZATION
// ============================================================================

/**
 * Normalize a horse name for matching
 *
 * Handles:
 * - Case normalization (uppercase)
 * - Trim whitespace
 * - Remove country suffixes like (GB), (IRE), (FR), etc.
 * - Remove common punctuation
 * - Handle empty/null names
 *
 * @param name - Raw horse name
 * @returns Normalized name for comparison
 */
export function normalizeHorseName(name: string | null | undefined): string {
  if (!name || name.trim() === '') {
    return '';
  }

  return (
    name
      .trim()
      .toUpperCase()
      // Remove country suffixes like (GB), (IRE), (FR), (AUS), etc.
      .replace(/\s*\([A-Z]{2,3}\)\s*$/i, '')
      // Remove trailing periods
      .replace(/\.\s*$/, '')
      // Normalize multiple spaces to single space
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// ============================================================================
// HORSE NAME MAP BUILDER
// ============================================================================

/**
 * Build a map of all horse names in today's race card for quick lookup
 *
 * @param horses - All horses in today's race
 * @param rankings - Rankings of horses (1 = best, etc.)
 * @returns Map of normalized name -> ranking info
 */
export function buildTodayHorseMap(
  horses: HorseEntry[],
  rankings: Map<number, number> // programNumber -> rank
): Map<string, HorseRanking> {
  const horseMap = new Map<string, HorseRanking>();

  for (const horse of horses) {
    const normalizedName = normalizeHorseName(horse.horseName);
    if (!normalizedName) continue;

    const rank = rankings.get(horse.programNumber) ?? horses.length;

    horseMap.set(normalizedName, {
      name: normalizedName,
      originalName: horse.horseName,
      programNumber: horse.programNumber,
      rank,
      totalScore: 0, // Will be populated by caller if needed
    });
  }

  return horseMap;
}

/**
 * Build rankings map from scored horses
 * Rankings are 1-indexed (1 = top pick)
 *
 * @param scoredHorses - Horses with their total scores, sorted by score descending
 * @returns Map of programNumber -> rank
 */
export function buildRankingsFromScores(
  scoredHorses: Array<{ programNumber: number; totalScore: number }>
): Map<number, number> {
  const rankings = new Map<number, number>();

  // Sort by score descending (highest score = rank 1)
  const sorted = [...scoredHorses].sort((a, b) => b.totalScore - a.totalScore);

  sorted.forEach((horse, index) => {
    rankings.set(horse.programNumber, index + 1); // 1-indexed
  });

  return rankings;
}

// ============================================================================
// KEY RACE INDEX CALCULATION
// ============================================================================

/**
 * Check if a horse name from PP matches any horse in today's race
 *
 * @param ppName - Name from past performance (winner, 2nd, or 3rd)
 * @param todayHorses - Map of today's horses
 * @param excludeName - Name to exclude (the horse being scored)
 * @returns Matching horse ranking or null
 */
function findMatchInTodayRace(
  ppName: string,
  todayHorses: Map<string, HorseRanking>,
  excludeName: string
): HorseRanking | null {
  const normalizedPP = normalizeHorseName(ppName);
  if (!normalizedPP || normalizedPP === excludeName) {
    return null;
  }

  return todayHorses.get(normalizedPP) ?? null;
}

/**
 * Analyze a single past performance for key race matches
 *
 * @param pp - Past performance record
 * @param ppIndex - Index of this PP (0 = most recent)
 * @param finishPosition - Horse's finish position in this race
 * @param todayHorses - Map of today's horses
 * @param excludeName - Name of horse being scored (to exclude self-matches)
 * @returns Array of key race matches found
 */
function analyzePPForKeyRaces(
  pp: PastPerformance,
  ppIndex: number,
  finishPosition: number,
  todayHorses: Map<string, HorseRanking>,
  excludeName: string
): KeyRaceMatch[] {
  const matches: KeyRaceMatch[] = [];

  // Only analyze if horse finished 2nd-5th (winner can't get key race bonus)
  if (finishPosition < 2 || finishPosition > 5) {
    return matches;
  }

  // Check winner of this race
  const winnerMatch = findMatchInTodayRace(pp.winner, todayHorses, excludeName);
  if (winnerMatch && winnerMatch.rank <= MIN_RANK_FOR_BONUS) {
    const points = calculateKeyRacePoints(finishPosition, winnerMatch.rank);
    if (points > 0) {
      matches.push({
        matchedHorse: winnerMatch.originalName,
        ppIndex,
        finishPosition,
        matchedFinishPosition: 'winner',
        matchedHorseRank: winnerMatch.rank,
        pointsAwarded: points,
        reasoning: `Finished ${ordinal(finishPosition)} behind ${winnerMatch.originalName} (ranked #${winnerMatch.rank} today)`,
      });
    }
  }

  // Check 2nd place of this race (only if horse finished 3rd or worse)
  if (finishPosition >= 3) {
    const secondMatch = findMatchInTodayRace(pp.secondPlace, todayHorses, excludeName);
    if (secondMatch && secondMatch.rank <= MIN_RANK_FOR_BONUS) {
      const points = calculateKeyRacePoints(finishPosition, secondMatch.rank);
      if (points > 0) {
        matches.push({
          matchedHorse: secondMatch.originalName,
          ppIndex,
          finishPosition,
          matchedFinishPosition: 'second',
          matchedHorseRank: secondMatch.rank,
          pointsAwarded: points,
          reasoning: `Finished ${ordinal(finishPosition)} behind ${secondMatch.originalName} (2nd, ranked #${secondMatch.rank} today)`,
        });
      }
    }
  }

  // Check 3rd place of this race (only if horse finished 4th or worse)
  if (finishPosition >= 4) {
    const thirdMatch = findMatchInTodayRace(pp.thirdPlace, todayHorses, excludeName);
    if (thirdMatch && thirdMatch.rank <= MIN_RANK_FOR_BONUS) {
      const points = calculateKeyRacePoints(finishPosition, thirdMatch.rank);
      if (points > 0) {
        matches.push({
          matchedHorse: thirdMatch.originalName,
          ppIndex,
          finishPosition,
          matchedFinishPosition: 'third',
          matchedHorseRank: thirdMatch.rank,
          pointsAwarded: points,
          reasoning: `Finished ${ordinal(finishPosition)} behind ${thirdMatch.originalName} (3rd, ranked #${thirdMatch.rank} today)`,
        });
      }
    }
  }

  return matches;
}

/**
 * Calculate points for a key race match based on finish position and matched horse rank
 *
 * @param finishPosition - Horse's finish position in the past race
 * @param matchedRank - Matched horse's rank in today's race
 * @returns Points to award
 */
function calculateKeyRacePoints(finishPosition: number, matchedRank: number): number {
  // Finished 2nd or 3rd
  if (finishPosition <= 3) {
    if (matchedRank <= 2) {
      return POINTS_BEHIND_TOP_2; // +3 for behind top 2
    }
    if (matchedRank <= 4) {
      return POINTS_BEHIND_TOP_4; // +2 for behind top 4
    }
  }

  // Finished 4th or 5th
  if (finishPosition <= 5) {
    if (matchedRank <= 2) {
      return POINTS_4TH_5TH_BEHIND_TOP_2; // +1 for 4th/5th behind top 2
    }
  }

  return 0;
}

/**
 * Calculate Key Race Index bonus for a horse
 *
 * This function analyzes a horse's past performances to find races where
 * they competed against horses that are also in today's race card.
 * If those horses are highly ranked today, it indicates the horse
 * has run against quality competition ("hidden form").
 *
 * @param horse - The horse to analyze
 * @param todayHorses - Map of all horses in today's race with rankings
 * @returns Key Race Index result with bonus points and reasoning
 */
export function calculateKeyRaceIndex(
  horse: HorseEntry,
  todayHorses: Map<string, HorseRanking>
): KeyRaceIndexResult {
  const excludeName = normalizeHorseName(horse.horseName);
  const pastPerformances = horse.pastPerformances;

  // Handle first-time starters
  if (pastPerformances.length === 0) {
    return {
      totalBonus: 0,
      rawBonus: 0,
      capApplied: false,
      matches: [],
      reasoning: 'First-time starter - no key race data',
      hasMatches: false,
    };
  }

  const allMatches: KeyRaceMatch[] = [];

  // Analyze up to MAX_PP_TO_ANALYZE past performances
  const ppsToAnalyze = Math.min(pastPerformances.length, MAX_PP_TO_ANALYZE);

  for (let i = 0; i < ppsToAnalyze; i++) {
    const pp = pastPerformances[i];
    if (!pp) continue;

    const matches = analyzePPForKeyRaces(pp, i, pp.finishPosition, todayHorses, excludeName);
    allMatches.push(...matches);
  }

  // Calculate total bonus
  let rawBonus = allMatches.reduce((sum, match) => sum + match.pointsAwarded, 0);

  // Apply cap
  const capApplied = rawBonus > MAX_KEY_RACE_BONUS;
  const totalBonus = Math.min(rawBonus, MAX_KEY_RACE_BONUS);

  // Build reasoning string
  let reasoning: string;
  if (allMatches.length === 0) {
    reasoning = 'No key race matches in today\'s field';
  } else {
    const matchSummaries = allMatches.map((m) => m.reasoning);
    reasoning = matchSummaries.join(' | ');
    if (capApplied) {
      reasoning += ` (capped at +${MAX_KEY_RACE_BONUS})`;
    }
  }

  return {
    totalBonus,
    rawBonus,
    capApplied,
    matches: allMatches,
    reasoning,
    hasMatches: allMatches.length > 0,
  };
}

/**
 * Calculate Key Race Index for all horses in a race
 *
 * This is a two-pass algorithm:
 * 1. First pass: Score all horses WITHOUT key race index
 * 2. Second pass: Calculate key race index using rankings from pass 1
 *
 * This avoids circular dependency issues where key race depends on rankings
 * which depend on key race.
 *
 * @param horses - All horses in the race
 * @param baseScores - Base scores for each horse (without key race index)
 * @returns Map of programNumber -> KeyRaceIndexResult
 */
export function calculateKeyRaceIndexForRace(
  horses: HorseEntry[],
  baseScores: Map<number, number> // programNumber -> base score
): Map<number, KeyRaceIndexResult> {
  const results = new Map<number, KeyRaceIndexResult>();

  // Build rankings from base scores
  const scoredHorses = horses.map((h) => ({
    programNumber: h.programNumber,
    totalScore: baseScores.get(h.programNumber) ?? 0,
  }));
  const rankings = buildRankingsFromScores(scoredHorses);

  // Build horse map with rankings
  const horseMap = buildTodayHorseMap(horses, rankings);

  // Update total scores in horse map
  for (const [name, ranking] of horseMap) {
    const score = baseScores.get(ranking.programNumber) ?? 0;
    horseMap.set(name, { ...ranking, totalScore: score });
  }

  // Calculate key race index for each horse
  for (const horse of horses) {
    const result = calculateKeyRaceIndex(horse, horseMap);
    results.set(horse.programNumber, result);
  }

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  const index1 = (v - 20) % 10;
  const suffix =
    (index1 >= 0 && index1 < s.length ? s[index1] : undefined) ??
    (v >= 0 && v < s.length ? s[v] : undefined) ??
    s[0];
  return n + (suffix ?? 'th');
}

/**
 * Check if a horse has any key race potential
 * (Quick check before full calculation)
 *
 * @param horse - Horse to check
 * @returns True if horse has PPs that might yield key race bonuses
 */
export function hasKeyRacePotential(horse: HorseEntry): boolean {
  // Need PPs to analyze
  if (horse.pastPerformances.length === 0) {
    return false;
  }

  // Check if any PPs have non-empty winner/place names
  const ppsToCheck = Math.min(horse.pastPerformances.length, MAX_PP_TO_ANALYZE);
  for (let i = 0; i < ppsToCheck; i++) {
    const pp = horse.pastPerformances[i];
    if (!pp) continue;

    // Must have finished 2nd-5th to benefit
    if (pp.finishPosition < 2 || pp.finishPosition > 5) {
      continue;
    }

    // Check if there are winner/place names
    if (pp.winner || pp.secondPlace || pp.thirdPlace) {
      return true;
    }
  }

  return false;
}

/**
 * Get a summary of key race analysis for display
 */
export function getKeyRaceSummary(result: KeyRaceIndexResult): {
  hasBonus: boolean;
  bonusText: string;
  emoji: string;
} {
  if (!result.hasMatches) {
    return {
      hasBonus: false,
      bonusText: '',
      emoji: '',
    };
  }

  if (result.totalBonus >= 5) {
    return {
      hasBonus: true,
      bonusText: `+${result.totalBonus} key race`,
      emoji: '🔑',
    };
  }

  if (result.totalBonus >= 3) {
    return {
      hasBonus: true,
      bonusText: `+${result.totalBonus} key race`,
      emoji: '🗝️',
    };
  }

  return {
    hasBonus: true,
    bonusText: `+${result.totalBonus} key race`,
    emoji: '',
  };
}
