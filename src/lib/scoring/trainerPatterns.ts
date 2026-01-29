/**
 * Trainer Patterns Scoring Module
 *
 * Uses parsed trainer category statistics (DRF Fields 1146-1221) to apply
 * situational bonuses when current race conditions match trainer's proven patterns.
 *
 * Score: 0-8 points (Model B - reduced from 10, stacking multiple patterns, capped)
 *
 * v4.0 CHANGES (Exacta Separation Enhancement):
 * - Increased minimum sample size for full credit from 5 to 15 starts
 * - Added tiered discount for small sample sizes:
 *   - 15+ starts: 100% credit (full points)
 *   - 10-14 starts: 70% credit
 *   - 5-9 starts: 40% credit
 *   - <5 starts: 0% credit (pattern not reliable)
 * - This prevents over-crediting patterns with statistically meaningless samples
 *
 * Model B CHANGES (Speed-Dominant Rebalance):
 * - Reduced from 10 to 8 pts to weight speed more heavily
 * - Scale factor: 0.8 (8/10)
 * - Individual pattern points proportionally reduced
 *
 * Pattern Categories:
 * - Equipment Patterns: First-time Lasix, First-time Blinkers, Blinkers Off
 * - Layoff Patterns: 2nd off layoff, various layoff durations
 * - Distance Patterns: Sprint to Route, Route to Sprint
 * - Surface Patterns: Turf, Wet Track, Dirt
 * - Class Patterns: Maiden Claiming, Stakes
 * - Acquisition Patterns: First Start for Trainer, After Claim
 */

import type { HorseEntry, RaceHeader, TrainerCategoryStat } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Individual matched pattern with scoring details
 */
export interface MatchedPattern {
  /** Pattern identifier (e.g., "firstTimeLasix") */
  pattern: string;
  /** Trainer win percentage for this pattern */
  trainerWinPercent: number;
  /** Trainer ROI for this pattern */
  trainerROI: number;
  /** Points awarded for this match */
  points: number;
  /** Human-readable explanation */
  reasoning: string;
}

/**
 * Result of trainer pattern scoring
 */
export interface TrainerPatternResult {
  /** Total points (0-8 max) */
  total: number;
  /** All matched patterns with details */
  matchedPatterns: MatchedPattern[];
  /** Summary reasoning strings */
  reasoning: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum total points from trainer patterns
 * Model B: Reduced from 10 to 8 pts per speed-dominant rebalance.
 * Scale factor: 0.8 (8/10)
 */
const MAX_TRAINER_PATTERN_POINTS = 8;

/**
 * Sample size tiers with credit percentages
 * v4.0: Tiered discount prevents overvaluing small samples
 *
 * | Starts | Credit | Rationale |
 * |--------|--------|-----------|
 * | 15+    | 100%   | Statistically meaningful sample |
 * | 10-14  | 70%    | Moderate confidence |
 * | 5-9    | 40%    | Low confidence, pattern emerging |
 * | <5     | 0%     | Not enough data, pattern unreliable |
 */
const SAMPLE_SIZE_TIERS = {
  FULL: { minStarts: 15, credit: 1.0 },
  MODERATE: { minStarts: 10, credit: 0.7 },
  LOW: { minStarts: 5, credit: 0.4 },
  NONE: { minStarts: 0, credit: 0.0 },
} as const;

/** Legacy constant for backward compatibility */
const MIN_SAMPLE_SIZE = 5;

/** Win percentage thresholds for equipment patterns */
const EQUIPMENT_THRESHOLDS = {
  ELITE: 25,
  GOOD: 18,
};

/** Win percentage thresholds for layoff patterns */
const LAYOFF_THRESHOLDS = {
  ELITE: 25,
  GOOD: 18,
};

/** Win percentage thresholds for distance patterns */
const DISTANCE_THRESHOLDS = {
  ELITE: 22,
  GOOD: 15,
};

/** Win percentage thresholds for surface patterns */
const SURFACE_THRESHOLDS = {
  ELITE: 25,
  GOOD: 18,
};

/** Win percentage thresholds for class patterns */
const CLASS_THRESHOLDS = {
  ELITE: 25,
  GOOD: 18,
};

/** Win percentage thresholds for acquisition patterns */
const ACQUISITION_THRESHOLDS = {
  ELITE: 25,
  GOOD: 18,
};

/** Days threshold for "layoff" determination */
const LAYOFF_DAYS_THRESHOLD = 45;

/** Sprint distance threshold in furlongs */
const SPRINT_THRESHOLD = 7.5;

// ============================================================================
// PATTERN DETECTION HELPERS
// ============================================================================

/**
 * Check if a pattern stat has enough data to be credible (minimum 5 starts)
 */
function hasCredibleData(stat: TrainerCategoryStat | undefined): boolean {
  if (!stat) return false;
  return stat.starts >= MIN_SAMPLE_SIZE;
}

/**
 * Calculate sample size credit multiplier based on number of starts
 *
 * v4.0: Tiered discount to prevent overvaluing small sample sizes
 *
 * @param starts - Number of starts for this pattern
 * @returns Credit multiplier (0.0 to 1.0)
 *
 * @example
 * getSampleSizeCredit(20)  // 1.0 (full credit)
 * getSampleSizeCredit(12)  // 0.7 (moderate confidence)
 * getSampleSizeCredit(7)   // 0.4 (low confidence)
 * getSampleSizeCredit(3)   // 0.0 (no credit - unreliable)
 */
function getSampleSizeCredit(starts: number): number {
  if (starts >= SAMPLE_SIZE_TIERS.FULL.minStarts) {
    return SAMPLE_SIZE_TIERS.FULL.credit;
  }
  if (starts >= SAMPLE_SIZE_TIERS.MODERATE.minStarts) {
    return SAMPLE_SIZE_TIERS.MODERATE.credit;
  }
  if (starts >= SAMPLE_SIZE_TIERS.LOW.minStarts) {
    return SAMPLE_SIZE_TIERS.LOW.credit;
  }
  return SAMPLE_SIZE_TIERS.NONE.credit;
}

/**
 * Get sample size tier label for display
 */
function getSampleSizeTierLabel(starts: number): string {
  if (starts >= SAMPLE_SIZE_TIERS.FULL.minStarts) {
    return 'full';
  }
  if (starts >= SAMPLE_SIZE_TIERS.MODERATE.minStarts) {
    return 'moderate';
  }
  if (starts >= SAMPLE_SIZE_TIERS.LOW.minStarts) {
    return 'low';
  }
  return 'insufficient';
}

/**
 * Check if horse is first-time Lasix
 */
function isFirstTimeLasix(horse: HorseEntry): boolean {
  // Check medication data
  if (horse.medication.lasixFirstTime) return true;

  // Also check if currently on Lasix but wasn't last race
  if (horse.medication.lasix && horse.pastPerformances.length > 0) {
    const lastRace = horse.pastPerformances[0];
    if (lastRace && !lastRace.medication.includes('L')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if horse is first-time Blinkers
 */
function isFirstTimeBlinkers(horse: HorseEntry): boolean {
  // Check equipment data
  if (horse.equipment.firstTimeEquipment.includes('blinkers')) return true;

  // Also check if currently has blinkers but didn't last race
  if (horse.equipment.blinkers && horse.pastPerformances.length > 0) {
    const lastRace = horse.pastPerformances[0];
    if (lastRace && !lastRace.equipment.includes('B')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if horse is blinkers off (removing blinkers)
 */
function isBlinkersOff(horse: HorseEntry): boolean {
  // Check equipment data
  if (horse.equipment.blinkersOff) return true;

  // Check if no blinkers today but had them last race
  if (!horse.equipment.blinkers && horse.pastPerformances.length > 0) {
    const lastRace = horse.pastPerformances[0];
    if (lastRace && lastRace.equipment.includes('B')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if this is horse's 2nd start off a layoff (45+ days)
 */
function isSecondOffLayoff(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length < 2) return false;

  // Check if there was a 45+ day gap before the last race
  const lastRace = horse.pastPerformances[0];
  const secondLastRace = horse.pastPerformances[1];

  if (!lastRace || !secondLastRace) return false;

  // If last race's daysSinceLast was 45+, then today is 2nd off layoff
  // daysSinceLast in PP represents days before that race
  if (lastRace.daysSinceLast !== null && lastRace.daysSinceLast >= LAYOFF_DAYS_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Get the layoff days category for today's race
 */
function getLayoffCategory(
  daysSinceLastRace: number | null
): 'days31to60' | 'days61to90' | 'days91to180' | 'days181plus' | null {
  if (daysSinceLastRace === null) return null;

  if (daysSinceLastRace >= 181) return 'days181plus';
  if (daysSinceLastRace >= 91) return 'days91to180';
  if (daysSinceLastRace >= 61) return 'days61to90';
  if (daysSinceLastRace >= 31) return 'days31to60';

  return null;
}

/**
 * Check if horse is stretching out (sprint to route)
 */
function isSprintToRoute(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  // Today's race is a route
  if (raceHeader.distanceFurlongs < SPRINT_THRESHOLD) return false;

  // Last race was a sprint
  if (horse.pastPerformances.length === 0) return false;

  const lastRace = horse.pastPerformances[0];
  if (!lastRace) return false;

  return lastRace.distanceFurlongs < SPRINT_THRESHOLD;
}

/**
 * Check if horse is cutting back (route to sprint)
 */
function isRouteToSprint(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  // Today's race is a sprint
  if (raceHeader.distanceFurlongs >= SPRINT_THRESHOLD) return false;

  // Last race was a route
  if (horse.pastPerformances.length === 0) return false;

  const lastRace = horse.pastPerformances[0];
  if (!lastRace) return false;

  return lastRace.distanceFurlongs >= SPRINT_THRESHOLD;
}

/**
 * Check if this is horse's first start for current trainer
 */
function isFirstStartForTrainer(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) {
    // First time starter - definitely first start for trainer
    return true;
  }

  // DRF PPs don't usually include trainer name per PP,
  // so we can't reliably detect barn changes from PP data alone.
  // For horses with past performances, we return false (conservative approach).
  // A more complete implementation would need explicit "trainer change" data.
  return false;
}

/**
 * Check if horse was just claimed (first start after being claimed)
 */
function isAfterClaim(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false;

  const lastRace = horse.pastPerformances[0];
  if (!lastRace) return false;

  // Check if horse was claimed in last race
  return lastRace.wasClaimed === true;
}

/**
 * Check if race is maiden claiming
 */
function isMaidenClaiming(raceHeader: RaceHeader): boolean {
  return raceHeader.classification === 'maiden-claiming';
}

/**
 * Check if race is stakes
 */
function isStakesRace(raceHeader: RaceHeader): boolean {
  return (
    raceHeader.classification === 'stakes' ||
    raceHeader.classification === 'stakes-listed' ||
    raceHeader.classification === 'stakes-graded-1' ||
    raceHeader.classification === 'stakes-graded-2' ||
    raceHeader.classification === 'stakes-graded-3'
  );
}

/**
 * Check if track is wet/off
 */
function isWetTrack(raceHeader: RaceHeader): boolean {
  const condition = raceHeader.trackCondition.toLowerCase();
  return (
    condition === 'muddy' ||
    condition === 'sloppy' ||
    condition === 'good' ||
    condition === 'yielding' ||
    condition === 'soft' ||
    condition === 'heavy'
  );
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Score equipment pattern match with sample size credit
 *
 * v4.0: Applies tiered discount for small sample sizes
 */
function scoreEquipmentPattern(
  stat: TrainerCategoryStat,
  patternName: string,
  maxPoints: number
): MatchedPattern | null {
  if (!hasCredibleData(stat)) return null;

  let basePoints = 0;
  let tier = '';

  if (stat.winPercent >= EQUIPMENT_THRESHOLDS.ELITE) {
    basePoints = maxPoints;
    tier = 'elite';
  } else if (stat.winPercent >= EQUIPMENT_THRESHOLDS.GOOD) {
    basePoints = Math.round(maxPoints * 0.5);
    tier = 'good';
  }

  if (basePoints === 0) return null;

  // v4.0: Apply sample size credit multiplier
  const sampleCredit = getSampleSizeCredit(stat.starts);
  const points = Math.round(basePoints * sampleCredit);

  if (points === 0) return null;

  const sampleTier = getSampleSizeTierLabel(stat.starts);
  const creditPct = Math.round(sampleCredit * 100);

  return {
    pattern: patternName,
    trainerWinPercent: stat.winPercent,
    trainerROI: stat.roi,
    points,
    reasoning: `Trainer ${stat.winPercent.toFixed(0)}% (${tier}) with ${patternName} (${stat.starts} starts, ${creditPct}% credit - ${sampleTier} sample)`,
  };
}

/**
 * Score layoff pattern match with sample size credit
 *
 * v4.0: Applies tiered discount for small sample sizes
 */
function scoreLayoffPattern(
  stat: TrainerCategoryStat,
  patternName: string,
  maxPoints: number
): MatchedPattern | null {
  if (!hasCredibleData(stat)) return null;

  let basePoints = 0;
  let tier = '';

  if (stat.winPercent >= LAYOFF_THRESHOLDS.ELITE) {
    basePoints = maxPoints;
    tier = 'elite';
  } else if (stat.winPercent >= LAYOFF_THRESHOLDS.GOOD) {
    basePoints = Math.round(maxPoints * 0.5);
    tier = 'good';
  }

  if (basePoints === 0) return null;

  // v4.0: Apply sample size credit multiplier
  const sampleCredit = getSampleSizeCredit(stat.starts);
  const points = Math.round(basePoints * sampleCredit);

  if (points === 0) return null;

  const sampleTier = getSampleSizeTierLabel(stat.starts);
  const creditPct = Math.round(sampleCredit * 100);

  return {
    pattern: patternName,
    trainerWinPercent: stat.winPercent,
    trainerROI: stat.roi,
    points,
    reasoning: `Trainer ${stat.winPercent.toFixed(0)}% (${tier}) ${patternName} (${stat.starts} starts, ${creditPct}% credit - ${sampleTier} sample)`,
  };
}

/**
 * Score distance pattern match with sample size credit
 *
 * v4.0: Applies tiered discount for small sample sizes
 */
function scoreDistancePattern(
  stat: TrainerCategoryStat,
  patternName: string,
  maxPoints: number
): MatchedPattern | null {
  if (!hasCredibleData(stat)) return null;

  let basePoints = 0;
  let tier = '';

  if (stat.winPercent >= DISTANCE_THRESHOLDS.ELITE) {
    basePoints = maxPoints;
    tier = 'elite';
  } else if (stat.winPercent >= DISTANCE_THRESHOLDS.GOOD) {
    basePoints = Math.round(maxPoints * 0.5);
    tier = 'good';
  }

  if (basePoints === 0) return null;

  // v4.0: Apply sample size credit multiplier
  const sampleCredit = getSampleSizeCredit(stat.starts);
  const points = Math.round(basePoints * sampleCredit);

  if (points === 0) return null;

  const sampleTier = getSampleSizeTierLabel(stat.starts);
  const creditPct = Math.round(sampleCredit * 100);

  return {
    pattern: patternName,
    trainerWinPercent: stat.winPercent,
    trainerROI: stat.roi,
    points,
    reasoning: `Trainer ${stat.winPercent.toFixed(0)}% (${tier}) ${patternName} (${stat.starts} starts, ${creditPct}% credit - ${sampleTier} sample)`,
  };
}

/**
 * Score surface pattern match with sample size credit
 *
 * v4.0: Applies tiered discount for small sample sizes
 */
function scoreSurfacePattern(
  stat: TrainerCategoryStat,
  patternName: string,
  maxPoints: number
): MatchedPattern | null {
  if (!hasCredibleData(stat)) return null;

  let basePoints = 0;

  if (stat.winPercent >= SURFACE_THRESHOLDS.ELITE) {
    basePoints = maxPoints;
  }

  if (basePoints === 0) return null;

  // v4.0: Apply sample size credit multiplier
  const sampleCredit = getSampleSizeCredit(stat.starts);
  const points = Math.round(basePoints * sampleCredit);

  if (points === 0) return null;

  const sampleTier = getSampleSizeTierLabel(stat.starts);
  const creditPct = Math.round(sampleCredit * 100);

  return {
    pattern: patternName,
    trainerWinPercent: stat.winPercent,
    trainerROI: stat.roi,
    points,
    reasoning: `Trainer ${stat.winPercent.toFixed(0)}% on ${patternName} (${stat.starts} starts, ${creditPct}% credit - ${sampleTier} sample)`,
  };
}

/**
 * Score class pattern match with sample size credit
 *
 * v4.0: Applies tiered discount for small sample sizes
 */
function scoreClassPattern(
  stat: TrainerCategoryStat,
  patternName: string,
  maxPoints: number
): MatchedPattern | null {
  if (!hasCredibleData(stat)) return null;

  let basePoints = 0;

  if (stat.winPercent >= CLASS_THRESHOLDS.ELITE) {
    basePoints = maxPoints;
  }

  if (basePoints === 0) return null;

  // v4.0: Apply sample size credit multiplier
  const sampleCredit = getSampleSizeCredit(stat.starts);
  const points = Math.round(basePoints * sampleCredit);

  if (points === 0) return null;

  const sampleTier = getSampleSizeTierLabel(stat.starts);
  const creditPct = Math.round(sampleCredit * 100);

  return {
    pattern: patternName,
    trainerWinPercent: stat.winPercent,
    trainerROI: stat.roi,
    points,
    reasoning: `Trainer ${stat.winPercent.toFixed(0)}% in ${patternName} (${stat.starts} starts, ${creditPct}% credit - ${sampleTier} sample)`,
  };
}

/**
 * Score acquisition pattern match with sample size credit
 *
 * v4.0: Applies tiered discount for small sample sizes
 */
function scoreAcquisitionPattern(
  stat: TrainerCategoryStat,
  patternName: string,
  maxPoints: number
): MatchedPattern | null {
  if (!hasCredibleData(stat)) return null;

  let basePoints = 0;
  let tier = '';

  if (stat.winPercent >= ACQUISITION_THRESHOLDS.ELITE) {
    basePoints = maxPoints;
    tier = 'elite';
  } else if (stat.winPercent >= ACQUISITION_THRESHOLDS.GOOD) {
    basePoints = Math.round(maxPoints * 0.5);
    tier = 'good';
  }

  if (basePoints === 0) return null;

  // v4.0: Apply sample size credit multiplier
  const sampleCredit = getSampleSizeCredit(stat.starts);
  const points = Math.round(basePoints * sampleCredit);

  if (points === 0) return null;

  const sampleTier = getSampleSizeTierLabel(stat.starts);
  const creditPct = Math.round(sampleCredit * 100);

  return {
    pattern: patternName,
    trainerWinPercent: stat.winPercent,
    trainerROI: stat.roi,
    points,
    reasoning: `Trainer ${stat.winPercent.toFixed(0)}% (${tier}) ${patternName} (${stat.starts} starts, ${creditPct}% credit - ${sampleTier} sample)`,
  };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate trainer pattern score based on DRF trainer category stats
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Current race header for context
 * @returns Trainer pattern score result (0-8 points max)
 *
 * Model B: All pattern points scaled by 0.8 (8/10)
 */
export function calculateTrainerPatternScore(
  horse: HorseEntry,
  raceHeader: RaceHeader
): TrainerPatternResult {
  const stats = horse.trainerCategoryStats;
  const matchedPatterns: MatchedPattern[] = [];
  const reasoning: string[] = [];

  // -------------------------------------------------------------------------
  // EQUIPMENT PATTERNS (Model B: scaled by 0.8)
  // -------------------------------------------------------------------------

  // First Time Lasix: 2 pts elite, 1 pt good (was 3/1.5)
  if (isFirstTimeLasix(horse)) {
    const pattern = scoreEquipmentPattern(stats.firstTimeLasix, 'firstTimeLasix', 2);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // First Time Blinkers: 2 pts elite, 1 pt good (was 2/1)
  if (isFirstTimeBlinkers(horse)) {
    const pattern = scoreEquipmentPattern(stats.firstTimeBlinkers, 'firstTimeBlinkers', 2);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // Blinkers Off: 1 pt elite only (unchanged)
  if (isBlinkersOff(horse)) {
    const pattern = scoreEquipmentPattern(stats.blinkersOff, 'blinkersOff', 1);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // -------------------------------------------------------------------------
  // LAYOFF PATTERNS (Model B: scaled by 0.8)
  // -------------------------------------------------------------------------

  // 2nd Off Layoff: 2 pts elite, 1 pt good (was 3/1.5)
  if (isSecondOffLayoff(horse)) {
    const pattern = scoreLayoffPattern(stats.secondOffLayoff, 'secondOffLayoff', 2);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // Layoff duration patterns: 2 pts each (unchanged)
  const layoffCategory = getLayoffCategory(horse.daysSinceLastRace);
  if (layoffCategory) {
    const layoffStat = stats[layoffCategory];
    const layoffPointsMap: Record<string, number> = {
      days31to60: 2,
      days61to90: 2,
      days91to180: 2,
      days181plus: 2,
    };
    const maxPoints = layoffPointsMap[layoffCategory] ?? 2;
    const pattern = scoreLayoffPattern(layoffStat, layoffCategory, maxPoints);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // -------------------------------------------------------------------------
  // DISTANCE PATTERNS (Model B: scaled by 0.8)
  // -------------------------------------------------------------------------

  // Sprint to Route: 2 pts elite, 1 pt good (unchanged)
  if (isSprintToRoute(horse, raceHeader)) {
    const pattern = scoreDistancePattern(stats.sprintToRoute, 'sprintToRoute', 2);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // Route to Sprint: 2 pts elite, 1 pt good (unchanged)
  if (isRouteToSprint(horse, raceHeader)) {
    const pattern = scoreDistancePattern(stats.routeToSprint, 'routeToSprint', 2);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // -------------------------------------------------------------------------
  // SURFACE PATTERNS (Model B: scaled by 0.8)
  // -------------------------------------------------------------------------

  // Turf races: Check if today is on turf - 1 pt elite (unchanged)
  if (raceHeader.surface === 'turf') {
    const isSprint = raceHeader.distanceFurlongs < SPRINT_THRESHOLD;
    const surfaceStat = isSprint ? stats.turfSprint : stats.turfRoute;
    const patternName = isSprint ? 'turfSprint' : 'turfRoute';
    const pattern = scoreSurfacePattern(surfaceStat, patternName, 1);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // Wet track: 1 pt elite (unchanged)
  if (isWetTrack(raceHeader)) {
    const pattern = scoreSurfacePattern(stats.wetTrack, 'wetTrack', 1);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // -------------------------------------------------------------------------
  // CLASS PATTERNS (Model B: scaled by 0.8)
  // -------------------------------------------------------------------------

  // Maiden Claiming: 1 pt elite (unchanged)
  if (isMaidenClaiming(raceHeader)) {
    const pattern = scoreClassPattern(stats.maidenClaiming, 'maidenClaiming', 1);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // Stakes: 1 pt elite (unchanged)
  if (isStakesRace(raceHeader)) {
    const pattern = scoreClassPattern(stats.stakes, 'stakes', 1);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // -------------------------------------------------------------------------
  // ACQUISITION PATTERNS (Model B: scaled by 0.8)
  // -------------------------------------------------------------------------

  // First Start for Trainer: 2 pts elite, 1 pt good (was 3/1.5)
  if (isFirstStartForTrainer(horse)) {
    const pattern = scoreAcquisitionPattern(stats.firstStartTrainer, 'firstStartTrainer', 2);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // After Claim: 2 pts elite, 1 pt good (was 3/1.5)
  if (isAfterClaim(horse)) {
    const pattern = scoreAcquisitionPattern(stats.afterClaim, 'afterClaim', 2);
    if (pattern) {
      matchedPatterns.push(pattern);
      reasoning.push(pattern.reasoning);
    }
  }

  // -------------------------------------------------------------------------
  // CALCULATE TOTAL (CAPPED)
  // -------------------------------------------------------------------------

  const rawTotal = matchedPatterns.reduce((sum, p) => sum + p.points, 0);
  const total = Math.min(rawTotal, MAX_TRAINER_PATTERN_POINTS);

  // Add summary if patterns matched
  if (matchedPatterns.length > 0 && rawTotal > MAX_TRAINER_PATTERN_POINTS) {
    reasoning.push(`Total capped at ${MAX_TRAINER_PATTERN_POINTS} pts (raw: ${rawTotal})`);
  }

  return {
    total,
    matchedPatterns,
    reasoning,
  };
}

/**
 * Check if any trainer pattern is matched for this horse
 */
export function hasMatchedTrainerPatterns(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  const result = calculateTrainerPatternScore(horse, raceHeader);
  return result.matchedPatterns.length > 0;
}

/**
 * Get a summary string for trainer patterns
 */
export function getTrainerPatternSummary(result: TrainerPatternResult): string {
  if (result.matchedPatterns.length === 0) {
    return 'No trainer patterns matched';
  }

  const patterns = result.matchedPatterns.map((p) => `${p.pattern}: +${p.points}`).join(', ');
  return `${result.total} pts from ${result.matchedPatterns.length} pattern(s): ${patterns}`;
}
