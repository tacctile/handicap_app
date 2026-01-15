/**
 * Velocity Analysis Module
 *
 * Analyzes fractional times from past performances to quantify each horse's
 * late kick and energy distribution pattern. This improves pace prediction
 * accuracy by identifying:
 *
 * 1. Velocity Differential (VD): How much a horse accelerates/decelerates late
 *    - Positive VD = strong closer (accelerates in final fraction)
 *    - Negative VD = fader (decelerates in final fraction)
 *
 * 2. Late Kick Power (LKP): Final fraction speed vs expected field average
 *    - Identifies horses that close faster than pace suggests
 *
 * 3. Energy Distribution Pattern: How the horse distributes effort
 *    - Front-loaded (fast early, fades)
 *    - Even (consistent pace)
 *    - Back-loaded (saves energy, finishes strong)
 *
 * DRF Field Sources:
 * - Fields 866-875: Quarter times (2f)
 * - Fields 896-905: Half-mile times (4f)
 * - Fields 906-915: Six furlong times
 * - Fields 916-925: Mile times
 * - Fields 1006-1015: Final times
 */

import type { HorseEntry, PastPerformance } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Velocity differential analysis for a single past performance
 */
export interface PPVelocityAnalysis {
  /** PP index (0 = most recent) */
  ppIndex: number;
  /** Race date */
  date: string;
  /** Race distance in furlongs */
  distance: number;
  /** Early pace segment time (1st to 2nd call) in seconds */
  earlyPaceTime: number | null;
  /** Late pace segment time (last fraction to finish) in seconds */
  latePaceTime: number | null;
  /** Velocity differential: earlyPaceTime - latePaceTime
   *  Positive = accelerated late, Negative = decelerated late */
  velocityDiff: number | null;
  /** Per-furlong early pace rate (seconds per furlong) */
  earlyPaceRate: number | null;
  /** Per-furlong late pace rate (seconds per furlong) */
  latePaceRate: number | null;
  /** Surface (for normalization) */
  surface: string;
  /** Whether data is complete enough for analysis */
  isComplete: boolean;
}

/**
 * Aggregate velocity analysis for a horse
 */
export interface VelocityProfile {
  /** Average velocity differential across recent PPs */
  avgVelocityDiff: number | null;
  /** Number of PPs with valid velocity data */
  validPPCount: number;
  /** Minimum PPs required for reliable analysis */
  requiredPPCount: number;
  /** Whether analysis is reliable (enough data) */
  isReliable: boolean;
  /** Velocity differential trend (improving/declining/stable) */
  trend: 'improving' | 'declining' | 'stable' | 'unknown';
  /** Classification based on velocity differential */
  classification: 'strong_closer' | 'moderate_closer' | 'steady_pace' | 'fader' | 'unknown';
  /** Individual PP analyses */
  ppAnalyses: PPVelocityAnalysis[];
  /** Description for display */
  description: string;
}

/**
 * Late Kick Power analysis
 */
export interface LateKickPower {
  /** Average final fraction time */
  avgFinalFraction: number | null;
  /** Expected final fraction based on distance and surface */
  expectedFinalFraction: number | null;
  /** Late kick power ratio (avg/expected, <1.0 = faster than expected) */
  powerRatio: number | null;
  /** Power classification */
  classification: 'exceptional' | 'strong' | 'adequate' | 'weak' | 'unknown';
  /** Bonus points earned */
  bonusPoints: number;
  /** Description */
  description: string;
}

/**
 * Complete velocity scoring result
 */
export interface VelocityScoreResult {
  /** Velocity profile analysis */
  velocityProfile: VelocityProfile;
  /** Late kick power analysis */
  lateKickPower: LateKickPower;
  /** Total bonus points from velocity analysis (±5 pts max) */
  totalBonusPoints: number;
  /** Combined reasoning for display */
  reasoning: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Expected final fraction times by distance and surface (in seconds per furlong)
 * These are approximate par times for the final 2-furlong segment
 */
export const EXPECTED_FINAL_FRACTION_RATES: Record<string, Record<string, number>> = {
  // Dirt par rates (seconds per furlong for final 2f)
  dirt: {
    sprint: 12.8, // 6f and under
    route: 13.2, // 1 mile and over
  },
  // Turf par rates (typically slightly slower)
  turf: {
    sprint: 13.0,
    route: 13.4,
  },
  // Synthetic
  synthetic: {
    sprint: 12.9,
    route: 13.3,
  },
};

/**
 * Velocity differential thresholds for classification
 */
export const VELOCITY_DIFF_THRESHOLDS = {
  /** Strong closer: VD > +2.0 seconds (accelerates significantly in final fraction) */
  STRONG_CLOSER: 2.0,
  /** Moderate closer: VD +0.5 to +2.0 seconds */
  MODERATE_CLOSER: 0.5,
  /** Steady pace: VD -0.5 to +0.5 seconds */
  STEADY_UPPER: 0.5,
  STEADY_LOWER: -0.5,
  /** Fader: VD < -0.5 seconds (decelerates in final fraction) */
  FADER: -0.5,
};

/**
 * Late kick power thresholds
 */
export const LATE_KICK_POWER_THRESHOLDS = {
  /** Exceptional closer: closes 5%+ faster than expected */
  EXCEPTIONAL: 0.95,
  /** Strong closer: closes 2-5% faster than expected */
  STRONG: 0.98,
  /** Adequate closer: closes at or slightly faster than expected */
  ADEQUATE: 1.0,
};

/**
 * Scoring points for velocity differential bonuses
 */
export const VELOCITY_SCORE_POINTS = {
  STRONG_CLOSER: 4, // +4 pts for strong closer (VD > +2.0)
  MODERATE_CLOSER: 2, // +2 pts for moderate closer (VD +0.5 to +2.0)
  STEADY_PACE: 0, // 0 pts for steady pace
  FADER: -1, // -1 pt for fader (VD < -0.5)
  // Late Kick Power bonuses (for closers only)
  LKP_EXCEPTIONAL: 3, // +3 pts for exceptional closer
  LKP_STRONG: 2, // +2 pts for strong closer
  LKP_ADEQUATE: 1, // +1 pt for adequate closer
};

/**
 * Minimum segment length for reliable velocity calculations
 *
 * Segments shorter than this will be skipped to avoid division by small numbers
 * which produces unreliable extreme values.
 *
 * 1.5 furlongs = ~330 yards = reasonable minimum for pace rate calculation
 * This handles "about 1 mile" races (8.0-8.5f) where late segment would be too short
 */
export const MIN_SEGMENT_FURLONGS = 1.5;

// ============================================================================
// RUNNING STYLE CLASSIFICATION HELPERS
// ============================================================================

/**
 * Running style classification for velocity bonus eligibility
 *
 * Maps running style codes to their bonus eligibility category:
 * - 'early': E-type horses (E, E/P) - NO closer bonuses, they lead early
 * - 'presser': P-type horses (P, E-P) - 50% closer bonuses
 * - 'closer': C/S-type horses (C, S) - full closer bonuses
 * - 'unknown': Missing/invalid running style - 50% closer bonuses (conservative)
 */
export type RunningStyleCategory = 'early' | 'presser' | 'closer' | 'unknown';

/**
 * Classify a running style code for velocity bonus eligibility
 *
 * This function determines how much (if any) of the velocity-based closer
 * bonus a horse should receive based on their running style. E-type horses
 * should not receive closer bonuses even if their velocity data suggests
 * late acceleration, as they are front-runners by nature.
 *
 * @param runningStyle - Running style code (E, E-P, P, S, C, U, or undefined)
 * @returns Running style category for bonus calculation
 *
 * @example
 * classifyRunningStyle('E')   // 'early' - no closer bonus
 * classifyRunningStyle('C')   // 'closer' - full bonus
 * classifyRunningStyle('P')   // 'presser' - 50% bonus
 * classifyRunningStyle('')    // 'unknown' - 50% bonus (conservative)
 */
export function classifyRunningStyle(
  runningStyle: string | undefined | null
): RunningStyleCategory {
  const normalized = (runningStyle || '').toUpperCase().trim();

  // Early speed horses - lead the race, do NOT benefit from closer bonuses
  if (normalized === 'E' || normalized === 'E/P') {
    return 'early';
  }

  // Pressers - stalk the pace, get partial closer bonus
  if (normalized === 'E-P' || normalized === 'P') {
    return 'presser';
  }

  // Closers/Sustainers - come from behind, get full closer bonus
  if (normalized === 'S' || normalized === 'C') {
    return 'closer';
  }

  // Unknown or missing - apply conservative 50% bonus
  return 'unknown';
}

/**
 * Get the closer bonus multiplier for a running style
 *
 * @param runningStyle - Running style code
 * @returns Multiplier (0.0, 0.5, or 1.0) to apply to closer bonuses
 */
export function getCloserBonusMultiplier(runningStyle: string | undefined | null): number {
  const category = classifyRunningStyle(runningStyle);
  switch (category) {
    case 'closer':
      return 1.0;
    case 'presser':
    case 'unknown':
      return 0.5;
    case 'early':
      return 0.0;
  }
}

// ============================================================================
// VELOCITY DIFFERENTIAL CALCULATION
// ============================================================================

/**
 * Calculate velocity differential for a single past performance
 *
 * Velocity differential measures how much a horse accelerates or decelerates
 * between the early and late portions of a race.
 *
 * For sprints (6f and under):
 *   - Early pace = 2f to 4f segment (quarterTime to halfMileTime)
 *   - Late pace = 4f to finish (halfMileTime to finalTime)
 *
 * For routes (over 6f):
 *   - Early pace = 4f to 6f segment (halfMileTime to sixFurlongTime)
 *   - Late pace = Last 2f segment (calculated from finalTime - appropriate fraction)
 *
 * @param pp - Past performance to analyze
 * @param ppIndex - Index in the PP array (0 = most recent)
 * @returns Velocity analysis for this PP
 */
export function analyzePPVelocity(pp: PastPerformance, ppIndex: number): PPVelocityAnalysis {
  const result: PPVelocityAnalysis = {
    ppIndex,
    date: pp.date,
    distance: pp.distanceFurlongs,
    earlyPaceTime: null,
    latePaceTime: null,
    velocityDiff: null,
    earlyPaceRate: null,
    latePaceRate: null,
    surface: pp.surface,
    isComplete: false,
  };

  const distance = pp.distanceFurlongs;

  // Need final time for any calculation
  if (pp.finalTime === null || pp.finalTime <= 0) {
    return result;
  }

  // Sprint races (6f and under)
  if (distance <= 6) {
    return analyzeSprintVelocity(pp, result);
  }
  // Route races (over 6f)
  else {
    return analyzeRouteVelocity(pp, result);
  }
}

/**
 * Analyze velocity for sprint races (6f and under)
 */
function analyzeSprintVelocity(
  pp: PastPerformance,
  result: PPVelocityAnalysis
): PPVelocityAnalysis {
  const quarterTime = pp.quarterTime;
  const halfMileTime = pp.halfMileTime;
  const finalTime = pp.finalTime;

  // For sprints, try to calculate:
  // Early pace = quarter to half-mile segment (2f)
  // Late pace = half-mile to finish segment (remaining furlongs)

  if (quarterTime !== null && halfMileTime !== null && finalTime !== null) {
    // Early pace segment: 2f to 4f (2 furlongs)
    result.earlyPaceTime = halfMileTime - quarterTime;
    result.earlyPaceRate = result.earlyPaceTime / 2; // seconds per furlong

    // Late pace segment: 4f to finish
    const lateFurlongs = pp.distanceFurlongs - 4;
    // Only calculate if segment is long enough for reliable data
    if (lateFurlongs >= MIN_SEGMENT_FURLONGS) {
      result.latePaceTime = finalTime - halfMileTime;
      result.latePaceRate = result.latePaceTime / lateFurlongs;
    }
  } else if (halfMileTime !== null && finalTime !== null) {
    // Fallback: only half-mile and final available
    // Use opening half vs closing portion
    const closingFurlongs = pp.distanceFurlongs - 4;
    // Only calculate if segment is long enough for reliable data
    if (closingFurlongs >= MIN_SEGMENT_FURLONGS) {
      // Early pace = opening 4f (approximated as halfMileTime / 4 per furlong)
      result.earlyPaceRate = halfMileTime / 4;
      result.earlyPaceTime = halfMileTime;

      // Late pace = closing portion
      result.latePaceTime = finalTime - halfMileTime;
      result.latePaceRate = result.latePaceTime / closingFurlongs;
    }
  }

  // Calculate velocity differential if we have both segments
  if (result.earlyPaceRate !== null && result.latePaceRate !== null) {
    // VD = early rate - late rate (positive = accelerated late)
    result.velocityDiff = result.earlyPaceRate - result.latePaceRate;
    result.isComplete = true;
  }

  return result;
}

/**
 * Analyze velocity for route races (over 6f)
 *
 * Handles special cases:
 * - "About 1 mile" races (8.0-8.5f) where late segment is too short
 * - Uses MIN_SEGMENT_FURLONGS to avoid division by small numbers
 */
function analyzeRouteVelocity(pp: PastPerformance, result: PPVelocityAnalysis): PPVelocityAnalysis {
  const halfMileTime = pp.halfMileTime;
  const sixFurlongTime = pp.sixFurlongTime;
  const mileTime = pp.mileTime;
  const finalTime = pp.finalTime;
  const distance = pp.distanceFurlongs;

  // For routes, try to calculate using 6f and/or mile times

  // Best case: have 6f time for routes 7f-1m
  if (sixFurlongTime !== null && finalTime !== null && distance <= 8) {
    // Early pace: half-mile to 6f (2 furlongs) if available, else just use 6f time
    if (halfMileTime !== null) {
      result.earlyPaceTime = sixFurlongTime - halfMileTime;
      result.earlyPaceRate = result.earlyPaceTime / 2;
    } else {
      result.earlyPaceRate = sixFurlongTime / 6;
    }

    // Late pace: 6f to finish
    const lateFurlongs = distance - 6;
    // Only calculate if segment is long enough for reliable data
    if (lateFurlongs >= MIN_SEGMENT_FURLONGS) {
      result.latePaceTime = finalTime - sixFurlongTime;
      result.latePaceRate = result.latePaceTime / lateFurlongs;
    }
  }
  // For 1 mile+ routes with mile time
  else if (mileTime !== null && finalTime !== null && distance >= 8) {
    // Early pace: 6f to mile (2 furlongs) if 6f available
    if (sixFurlongTime !== null) {
      result.earlyPaceTime = mileTime - sixFurlongTime;
      result.earlyPaceRate = result.earlyPaceTime / 2;
    } else if (halfMileTime !== null) {
      // Use half to mile segment
      result.earlyPaceTime = mileTime - halfMileTime;
      result.earlyPaceRate = result.earlyPaceTime / 4;
    } else {
      result.earlyPaceRate = mileTime / 8;
    }

    // Late pace: mile to finish
    const lateFurlongs = distance - 8;
    // For "about 1 mile" races (8.0-8.5f), the late segment is too short
    // Only calculate if segment is long enough for reliable data
    if (lateFurlongs >= MIN_SEGMENT_FURLONGS) {
      result.latePaceTime = finalTime - mileTime;
      result.latePaceRate = result.latePaceTime / lateFurlongs;
    } else if (distance >= 8 && distance < 8 + MIN_SEGMENT_FURLONGS) {
      // "About 1 mile" races: use 6f to finish as late segment instead
      // This gives us a 2f segment which is reliable
      if (sixFurlongTime !== null) {
        result.latePaceTime = finalTime - sixFurlongTime;
        const actualLateFurlongs = distance - 6;
        if (actualLateFurlongs >= MIN_SEGMENT_FURLONGS) {
          result.latePaceRate = result.latePaceTime / actualLateFurlongs;
        }
      }
    }
  }
  // Fallback: use whatever fractions are available
  else if (halfMileTime !== null && finalTime !== null) {
    const closingFurlongs = distance - 4;
    // Only calculate if segment is long enough for reliable data
    if (closingFurlongs >= MIN_SEGMENT_FURLONGS) {
      result.earlyPaceRate = halfMileTime / 4;
      result.latePaceTime = finalTime - halfMileTime;
      result.latePaceRate = result.latePaceTime / closingFurlongs;
    }
  }

  // Calculate velocity differential if we have both segments
  if (result.earlyPaceRate !== null && result.latePaceRate !== null) {
    result.velocityDiff = result.earlyPaceRate - result.latePaceRate;
    result.isComplete = true;
  }

  return result;
}

// ============================================================================
// VELOCITY PROFILE BUILDING
// ============================================================================

/**
 * Build a velocity profile for a horse based on their recent past performances
 *
 * @param horse - Horse entry to analyze
 * @param maxPPs - Maximum number of past performances to analyze (default 5)
 * @returns Complete velocity profile
 */
export function buildVelocityProfile(horse: HorseEntry, maxPPs: number = 5): VelocityProfile {
  const recentPPs = horse.pastPerformances.slice(0, maxPPs);
  const ppAnalyses: PPVelocityAnalysis[] = [];

  // Analyze each PP
  for (let i = 0; i < recentPPs.length; i++) {
    const pp = recentPPs[i];
    if (pp) {
      ppAnalyses.push(analyzePPVelocity(pp, i));
    }
  }

  // Get PPs with valid velocity data
  const validPPs = ppAnalyses.filter((a) => a.isComplete && a.velocityDiff !== null);
  const validPPCount = validPPs.length;
  const requiredPPCount = 2; // Need at least 2 PPs for reliable analysis
  const isReliable = validPPCount >= requiredPPCount;

  // Calculate average velocity differential
  let avgVelocityDiff: number | null = null;
  if (validPPCount > 0) {
    const sum = validPPs.reduce((acc, pp) => acc + (pp.velocityDiff ?? 0), 0);
    avgVelocityDiff = Math.round((sum / validPPCount) * 100) / 100; // Round to 2 decimal places
  }

  // Determine trend (comparing recent vs older)
  let trend: VelocityProfile['trend'] = 'unknown';
  if (validPPCount >= 3) {
    const recent = validPPs.slice(0, 2);
    const older = validPPs.slice(2);
    if (recent.length >= 2 && older.length >= 1) {
      const recentAvg = recent.reduce((a, p) => a + (p.velocityDiff ?? 0), 0) / recent.length;
      const olderAvg = older.reduce((a, p) => a + (p.velocityDiff ?? 0), 0) / older.length;
      const diff = recentAvg - olderAvg;
      if (diff > 0.3) trend = 'improving';
      else if (diff < -0.3) trend = 'declining';
      else trend = 'stable';
    }
  }

  // Classify based on average velocity differential
  let classification: VelocityProfile['classification'] = 'unknown';
  if (avgVelocityDiff !== null && isReliable) {
    if (avgVelocityDiff >= VELOCITY_DIFF_THRESHOLDS.STRONG_CLOSER) {
      classification = 'strong_closer';
    } else if (avgVelocityDiff >= VELOCITY_DIFF_THRESHOLDS.MODERATE_CLOSER) {
      classification = 'moderate_closer';
    } else if (avgVelocityDiff >= VELOCITY_DIFF_THRESHOLDS.STEADY_LOWER) {
      classification = 'steady_pace';
    } else {
      classification = 'fader';
    }
  }

  // Generate description
  const description = generateVelocityDescription(
    classification,
    avgVelocityDiff,
    validPPCount,
    isReliable,
    trend
  );

  return {
    avgVelocityDiff,
    validPPCount,
    requiredPPCount,
    isReliable,
    trend,
    classification,
    ppAnalyses,
    description,
  };
}

/**
 * Generate human-readable description of velocity profile
 */
function generateVelocityDescription(
  classification: VelocityProfile['classification'],
  avgVD: number | null,
  ppCount: number,
  isReliable: boolean,
  trend: VelocityProfile['trend']
): string {
  if (!isReliable || avgVD === null) {
    return `Insufficient velocity data (${ppCount} PP${ppCount !== 1 ? 's' : ''} with valid fractional times)`;
  }

  const vdStr = avgVD >= 0 ? `+${avgVD.toFixed(2)}` : avgVD.toFixed(2);

  let classDesc: string;
  switch (classification) {
    case 'strong_closer':
      classDesc = 'Strong closer - accelerates significantly in final fraction';
      break;
    case 'moderate_closer':
      classDesc = 'Moderate closer - maintains or slightly accelerates late';
      break;
    case 'steady_pace':
      classDesc = 'Steady pacer - runs even pace throughout';
      break;
    case 'fader':
      classDesc = 'Fader - typically slows in final fraction';
      break;
    default:
      classDesc = 'Unknown velocity pattern';
  }

  let trendStr = '';
  if (trend === 'improving') {
    trendStr = ' (improving)';
  } else if (trend === 'declining') {
    trendStr = ' (declining)';
  }

  return `${classDesc} | Avg VD: ${vdStr} sec/f${trendStr} (${ppCount} PP${ppCount !== 1 ? 's' : ''})`;
}

// ============================================================================
// LATE KICK POWER CALCULATION
// ============================================================================

/**
 * Calculate Late Kick Power for a horse
 *
 * Late Kick Power measures how fast a horse's final fraction is
 * compared to the expected final fraction for that distance/surface.
 *
 * This is particularly useful for identifying closers that finish
 * faster than the pace suggests they should.
 *
 * @param horse - Horse entry to analyze
 * @param runningStyle - Horse's running style (E, P, S, C, U)
 * @returns Late Kick Power analysis
 */
export function calculateLateKickPower(horse: HorseEntry, runningStyle: string): LateKickPower {
  // Only calculate for closers and stalkers (running styles that benefit from late kick)
  // Early speed horses (E) don't rely on late kick
  const relevantStyles = ['C', 'S', 'P'];
  if (!relevantStyles.includes(runningStyle)) {
    return {
      avgFinalFraction: null,
      expectedFinalFraction: null,
      powerRatio: null,
      classification: 'unknown',
      bonusPoints: 0,
      description: 'Late kick power not applicable for early speed runners',
    };
  }

  const recentPPs = horse.pastPerformances.slice(0, 5);
  const validFractions: Array<{ rate: number; surface: string; distance: number }> = [];

  for (const pp of recentPPs) {
    const analysis = analyzePPVelocity(pp, 0);
    if (analysis.isComplete && analysis.latePaceRate !== null) {
      validFractions.push({
        rate: analysis.latePaceRate,
        surface: pp.surface,
        distance: pp.distanceFurlongs,
      });
    }
  }

  if (validFractions.length < 2) {
    return {
      avgFinalFraction: null,
      expectedFinalFraction: null,
      powerRatio: null,
      classification: 'unknown',
      bonusPoints: 0,
      description: 'Insufficient final fraction data for late kick analysis',
    };
  }

  // Calculate average final fraction rate
  const avgFinalFraction = validFractions.reduce((a, f) => a + f.rate, 0) / validFractions.length;

  // Get expected final fraction based on predominant surface and distance
  const surfaces = validFractions.map((f) => f.surface);
  const predominantSurface = getMostCommon(surfaces) || 'dirt';
  const avgDistance = validFractions.reduce((a, f) => a + f.distance, 0) / validFractions.length;
  const distanceType = avgDistance <= 6 ? 'sprint' : 'route';

  const surfaceRates =
    EXPECTED_FINAL_FRACTION_RATES[predominantSurface] || EXPECTED_FINAL_FRACTION_RATES['dirt'];
  const expectedFinalFraction = surfaceRates?.[distanceType] ?? 13.0;

  // Calculate power ratio (lower is better - faster than expected)
  const powerRatio = avgFinalFraction / expectedFinalFraction;

  // Classify and assign bonus points
  let classification: LateKickPower['classification'];
  let bonusPoints: number;

  if (powerRatio < LATE_KICK_POWER_THRESHOLDS.EXCEPTIONAL) {
    classification = 'exceptional';
    bonusPoints = VELOCITY_SCORE_POINTS.LKP_EXCEPTIONAL;
  } else if (powerRatio < LATE_KICK_POWER_THRESHOLDS.STRONG) {
    classification = 'strong';
    bonusPoints = VELOCITY_SCORE_POINTS.LKP_STRONG;
  } else if (powerRatio <= LATE_KICK_POWER_THRESHOLDS.ADEQUATE) {
    classification = 'adequate';
    bonusPoints = VELOCITY_SCORE_POINTS.LKP_ADEQUATE;
  } else {
    classification = 'weak';
    bonusPoints = 0;
  }

  // Generate description
  const pctFaster = ((1 - powerRatio) * 100).toFixed(1);
  let description: string;
  if (powerRatio < 1) {
    description = `${classification.charAt(0).toUpperCase() + classification.slice(1)} late kick - finishes ${pctFaster}% faster than expected`;
  } else {
    description = `Weak late kick - finishes ${Math.abs(parseFloat(pctFaster))}% slower than expected`;
  }

  return {
    avgFinalFraction: Math.round(avgFinalFraction * 100) / 100,
    expectedFinalFraction,
    powerRatio: Math.round(powerRatio * 1000) / 1000,
    classification,
    bonusPoints,
    description,
  };
}

/**
 * Get the most common value in an array
 */
function getMostCommon<T>(arr: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let maxCount = 0;
  let maxItem: T | undefined;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }
  return maxItem;
}

// ============================================================================
// VELOCITY SCORING
// ============================================================================

/**
 * Calculate velocity-based scoring adjustments for pace scoring
 *
 * This function combines velocity differential and late kick power
 * to produce bonus/penalty points for the pace scoring system.
 *
 * @param horse - Horse entry to analyze
 * @param runningStyle - Horse's running style code
 * @param paceScenario - Current pace scenario (soft, moderate, contested, speed_duel)
 * @returns Complete velocity score result
 */
export function calculateVelocityScore(
  horse: HorseEntry,
  runningStyle: string,
  paceScenario: string
): VelocityScoreResult {
  // Build velocity profile
  const velocityProfile = buildVelocityProfile(horse);

  // Calculate late kick power (for relevant running styles)
  const lateKickPower = calculateLateKickPower(horse, runningStyle);

  // Calculate base velocity differential points
  // IMPORTANT: Cross-reference running style to prevent E-type horses from receiving closer bonuses
  // Even if an E-type horse shows VD > +2.0, they are front-runners by nature, not closers
  let vdPoints = 0;
  if (velocityProfile.isReliable) {
    // Normalize running style - handle missing/undefined/empty values
    const normalizedStyle = (runningStyle || 'U').toUpperCase().trim();
    const isEarlySpeed = normalizedStyle.startsWith('E') && normalizedStyle !== 'E-P';
    const isPresser = normalizedStyle === 'E-P' || normalizedStyle === 'P';
    const isCloser = normalizedStyle === 'S' || normalizedStyle === 'C';

    switch (velocityProfile.classification) {
      case 'strong_closer':
        // E-type horses: NO closer bonus regardless of VD data
        // S/C (sustainer/closer): full closer bonus
        // E-P/P (presser): 50% closer bonus (rounded down)
        if (isCloser) {
          vdPoints = VELOCITY_SCORE_POINTS.STRONG_CLOSER;
        } else if (isPresser) {
          vdPoints = Math.floor(VELOCITY_SCORE_POINTS.STRONG_CLOSER * 0.5);
        } else if (isEarlySpeed) {
          vdPoints = 0; // E-type horses do not get closer bonus
        } else {
          // Unknown running style: apply reduced bonus
          vdPoints = Math.floor(VELOCITY_SCORE_POINTS.STRONG_CLOSER * 0.5);
        }
        break;
      case 'moderate_closer':
        // Same logic for moderate closer
        if (isCloser) {
          vdPoints = VELOCITY_SCORE_POINTS.MODERATE_CLOSER;
        } else if (isPresser) {
          vdPoints = Math.floor(VELOCITY_SCORE_POINTS.MODERATE_CLOSER * 0.5);
        } else if (isEarlySpeed) {
          vdPoints = 0;
        } else {
          vdPoints = Math.floor(VELOCITY_SCORE_POINTS.MODERATE_CLOSER * 0.5);
        }
        break;
      case 'steady_pace':
        vdPoints = VELOCITY_SCORE_POINTS.STEADY_PACE;
        break;
      case 'fader':
        vdPoints = VELOCITY_SCORE_POINTS.FADER;
        break;
    }
  }

  // Apply pace scenario multipliers
  // Hot pace benefits closers more, soft pace benefits speed
  // NOTE: Only apply extra closer bonus if running style is compatible (S/C/P, not E)
  const normalizedStyleForScenario = (runningStyle || 'U').toUpperCase().trim();
  const isCloserForScenario =
    normalizedStyleForScenario === 'S' ||
    normalizedStyleForScenario === 'C' ||
    normalizedStyleForScenario === 'P' ||
    normalizedStyleForScenario === 'E-P';

  if (paceScenario === 'speed_duel' || paceScenario === 'contested') {
    // Only give extra closer bonus to actual closers/stalkers, not E-type horses
    if (velocityProfile.classification === 'strong_closer' && isCloserForScenario) {
      vdPoints += 1; // Extra bonus for closers in hot pace
    } else if (velocityProfile.classification === 'fader') {
      vdPoints -= 1; // Extra penalty for faders in hot pace
    }
  } else if (paceScenario === 'soft') {
    if (velocityProfile.classification === 'strong_closer' && isCloserForScenario) {
      vdPoints -= 1; // Reduced benefit for closers in soft pace
    } else if (
      velocityProfile.classification === 'fader' &&
      normalizedStyleForScenario.startsWith('E') &&
      normalizedStyleForScenario !== 'E-P'
    ) {
      vdPoints += 1; // Fading front-runner in soft pace may still succeed
    }
  }

  // Calculate total bonus points
  const totalBonusPoints = Math.max(-5, Math.min(5, vdPoints + lateKickPower.bonusPoints));

  // Build reasoning string
  const reasoningParts: string[] = [];

  if (velocityProfile.isReliable && velocityProfile.avgVelocityDiff !== null) {
    const vdStr =
      velocityProfile.avgVelocityDiff >= 0
        ? `+${velocityProfile.avgVelocityDiff.toFixed(2)}`
        : velocityProfile.avgVelocityDiff.toFixed(2);
    reasoningParts.push(`VD: ${vdStr} (${velocityProfile.classification.replace('_', ' ')})`);
    if (vdPoints !== 0) {
      reasoningParts.push(`${vdPoints >= 0 ? '+' : ''}${vdPoints} pts`);
    }
  } else {
    reasoningParts.push('VD: insufficient data');
  }

  if (lateKickPower.bonusPoints > 0) {
    reasoningParts.push(`LKP: ${lateKickPower.classification} (+${lateKickPower.bonusPoints} pts)`);
  }

  if (totalBonusPoints !== 0) {
    reasoningParts.push(`Total: ${totalBonusPoints >= 0 ? '+' : ''}${totalBonusPoints} pts`);
  }

  return {
    velocityProfile,
    lateKickPower,
    totalBonusPoints,
    reasoning: reasoningParts.join(' | ') || 'No velocity adjustment',
  };
}

// ============================================================================
// EXPORTS FOR PACE SCORING INTEGRATION
// ============================================================================

/**
 * Quick check if a horse has velocity analysis data
 */
export function hasVelocityData(horse: HorseEntry): boolean {
  const recentPPs = horse.pastPerformances.slice(0, 5);
  let validCount = 0;

  for (const pp of recentPPs) {
    // Check if PP has any fractional time data
    if (
      pp.quarterTime !== null ||
      pp.halfMileTime !== null ||
      pp.sixFurlongTime !== null ||
      pp.mileTime !== null
    ) {
      validCount++;
    }
  }

  return validCount >= 2;
}

/**
 * Get a quick velocity summary for display
 */
export function getVelocitySummary(horse: HorseEntry): {
  hasData: boolean;
  classification: string;
  avgVD: number | null;
  trend: string;
} {
  if (!hasVelocityData(horse)) {
    return {
      hasData: false,
      classification: 'unknown',
      avgVD: null,
      trend: 'unknown',
    };
  }

  const profile = buildVelocityProfile(horse);
  return {
    hasData: profile.isReliable,
    classification: profile.classification,
    avgVD: profile.avgVelocityDiff,
    trend: profile.trend,
  };
}
