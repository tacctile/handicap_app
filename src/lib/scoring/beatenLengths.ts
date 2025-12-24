/**
 * Beaten Lengths Analysis Module
 *
 * Analyzes beaten lengths at each call from past performances to provide
 * insights into a horse's running style and form patterns.
 *
 * Key metrics:
 * - Closing Velocity: Lengths gained from first call to finish
 * - Early Position: Classification based on lengths behind at first call
 * - Late Gain: Lengths gained from stretch to finish
 * - Troubled Finish: Detection of horses that led but lost
 *
 * This data enhances form and pace scoring by providing concrete evidence
 * of a horse's running style and tactical ability.
 */

import type { PastPerformance, HorseEntry, RunningLine } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Early position classification based on lengths behind at first call
 */
export type EarlyPositionType = 'leading' | 'close' | 'mid' | 'back';

/**
 * Analysis result for a single past performance
 */
export interface BeatenLengthsAnalysis {
  /** Lengths gained from first call to finish (positive = gained, negative = lost) */
  closingVelocity: number | null;
  /** Classification of early position */
  earlyPosition: EarlyPositionType;
  /** Lengths gained from stretch to finish (positive = gained, negative = lost) */
  lateGain: number | null;
  /** Whether horse led at stretch but lost */
  hadTroubledFinish: boolean;
  /** Whether horse gained ground throughout the race */
  improvedThroughout: boolean;
  /** Raw data availability */
  hasCompleteData: boolean;
}

/**
 * Summary of beaten lengths patterns across multiple races
 */
export interface BeatenLengthsProfile {
  /** Average closing velocity across races */
  avgClosingVelocity: number | null;
  /** Number of races where horse gained 3+ lengths in stretch */
  strongLateGainCount: number;
  /** Number of races where horse led at stretch but lost */
  troubledFinishCount: number;
  /** Number of races with consistent ground-gaining pattern */
  consistentCloserCount: number;
  /** Number of races where horse gave up lead in stretch */
  gaveUpLeadCount: number;
  /** Number of races with complete data */
  racesWithData: number;
  /** Whether this is a confirmed closer (consistent pattern) */
  isConfirmedCloser: boolean;
  /** Whether this is a confirmed front-runner (consistent pattern) */
  isConfirmedFrontRunner: boolean;
  /** Summary reasoning */
  summary: string;
}

/**
 * Scoring adjustments based on beaten lengths analysis
 */
export interface BeatenLengthsScoreAdjustment {
  /** Points to add/subtract from form score */
  formPoints: number;
  /** Reasoning for form adjustment */
  formReasoning: string;
  /** Points to add/subtract from pace score */
  pacePoints: number;
  /** Reasoning for pace adjustment */
  paceReasoning: string;
}

// ============================================================================
// THRESHOLDS
// ============================================================================

/** Thresholds for early position classification (lengths behind at 1st call) */
const EARLY_POSITION_THRESHOLDS = {
  /** Leading or within half a length = leading */
  LEADING: 0.5,
  /** Within 3 lengths = close (stalking) */
  CLOSE: 3,
  /** Within 7 lengths = mid-pack */
  MID: 7,
  /** 7+ lengths = back (closer) */
  BACK: 7,
};

/** Thresholds for scoring adjustments */
const SCORING_THRESHOLDS = {
  /** Strong late gain: 3+ lengths in stretch */
  STRONG_LATE_GAIN: 3,
  /** Minimum races for consistent closer pattern */
  CONSISTENT_CLOSER_MIN_RACES: 3,
  /** Minimum closing velocity to count as closing race */
  CLOSING_RACE_MIN: 2,
  /** Confirmed early speed: leading by 3+ at first call */
  CONFIRMED_E_LEADING: -3,
  /** Confirmed closer: 10+ back at first call */
  CONFIRMED_CLOSER_BACK: 10,
};

// ============================================================================
// CORE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Get the first call lengths behind value from a running line.
 * Uses quarterMileLengths for sprints or the first available call.
 *
 * Negative values indicate leading by that many lengths.
 * Zero means on the lead.
 * Positive values indicate lengths behind.
 */
function getFirstCallLengths(runningLine: RunningLine): number | null {
  // Priority: quarterMile (1st call) > halfMile (2nd call)
  if (runningLine.quarterMileLengths !== null) {
    return runningLine.quarterMileLengths;
  }
  if (runningLine.halfMileLengths !== null) {
    return runningLine.halfMileLengths;
  }
  return null;
}

/**
 * Get the stretch lengths behind from a running line.
 */
function getStretchLengths(runningLine: RunningLine): number | null {
  return runningLine.stretchLengths ?? null;
}

/**
 * Get the finish lengths behind from a running line.
 * A value of 0 means the horse won.
 */
function getFinishLengths(runningLine: RunningLine): number | null {
  return runningLine.finishLengths ?? null;
}

/**
 * Calculate closing velocity: lengths gained from first call to finish.
 * Positive = gained ground, negative = lost ground.
 *
 * Example: 10 lengths back at 1st call, 2 lengths back at finish = +8 velocity
 */
export function calculateClosingVelocity(pp: PastPerformance): number | null {
  const firstCallLengths = getFirstCallLengths(pp.runningLine);
  const finishLengths = getFinishLengths(pp.runningLine);

  if (firstCallLengths === null || finishLengths === null) {
    return null;
  }

  // Positive result = gained ground (was further back, now closer)
  // Negative result = lost ground (was closer, now further back)
  return firstCallLengths - finishLengths;
}

/**
 * Classify early position based on lengths behind at first call.
 * Uses first call data when available, falls back to position data.
 */
export function calculateEarlyPosition(pp: PastPerformance): EarlyPositionType {
  const firstCallLengths = getFirstCallLengths(pp.runningLine);

  // If we have lengths data
  if (firstCallLengths !== null) {
    // Leading (negative = ahead) or on the lead
    if (firstCallLengths <= EARLY_POSITION_THRESHOLDS.LEADING) {
      return 'leading';
    }
    if (firstCallLengths <= EARLY_POSITION_THRESHOLDS.CLOSE) {
      return 'close';
    }
    if (firstCallLengths <= EARLY_POSITION_THRESHOLDS.MID) {
      return 'mid';
    }
    return 'back';
  }

  // Fallback: use position data if lengths not available
  const firstCallPosition = pp.runningLine.quarterMile ?? pp.runningLine.halfMile;
  const fieldSize = pp.fieldSize;

  if (firstCallPosition !== null && fieldSize > 0) {
    // Leading
    if (firstCallPosition <= 1) {
      return 'leading';
    }
    // Close (top 25%)
    if (firstCallPosition <= Math.ceil(fieldSize * 0.25)) {
      return 'close';
    }
    // Mid (25-60%)
    if (firstCallPosition <= Math.ceil(fieldSize * 0.6)) {
      return 'mid';
    }
    return 'back';
  }

  // Default to mid if no data available
  return 'mid';
}

/**
 * Calculate late gain: lengths gained from stretch call to finish.
 * Positive = gained ground in stretch, negative = lost ground.
 */
export function calculateLateGain(pp: PastPerformance): number | null {
  const stretchLengths = getStretchLengths(pp.runningLine);
  const finishLengths = getFinishLengths(pp.runningLine);

  if (stretchLengths === null || finishLengths === null) {
    return null;
  }

  return stretchLengths - finishLengths;
}

/**
 * Detect if horse had a troubled finish: led at stretch but lost.
 * This could indicate stamina issues or a troubled trip.
 */
export function hadTroubledFinish(pp: PastPerformance): boolean {
  const stretchPosition = pp.runningLine.stretch;
  const finishPosition = pp.finishPosition;
  const stretchLengths = getStretchLengths(pp.runningLine);

  // Led or was tied at stretch (position 1 or within half length lead)
  const wasLeadingAtStretch =
    stretchPosition === 1 || (stretchLengths !== null && stretchLengths <= 0);

  // But didn't win
  const didNotWin = finishPosition > 1;

  return wasLeadingAtStretch && didNotWin;
}

/**
 * Check if horse improved position throughout the race.
 * Looks for consistent ground-gaining from call to call.
 */
function improvedThroughout(pp: PastPerformance): boolean {
  const firstLengths = getFirstCallLengths(pp.runningLine);
  const secondLengths = pp.runningLine.halfMileLengths;
  const stretchLengths = getStretchLengths(pp.runningLine);
  const finishLengths = getFinishLengths(pp.runningLine);

  // Need at least first and finish to analyze
  if (firstLengths === null || finishLengths === null) {
    return false;
  }

  // Must have gained ground overall
  if (finishLengths >= firstLengths) {
    return false;
  }

  // If we have intermediate data, check for consistent improvement
  let improved = true;
  let lastLengths = firstLengths;

  if (secondLengths !== null) {
    if (secondLengths > lastLengths + 0.5) {
      // Lost more than half length
      improved = false;
    }
    lastLengths = secondLengths;
  }

  if (stretchLengths !== null && improved) {
    if (stretchLengths > lastLengths + 0.5) {
      improved = false;
    }
  }

  return improved;
}

/**
 * Analyze beaten lengths for a single past performance.
 */
export function analyzeBeatenLengths(pp: PastPerformance): BeatenLengthsAnalysis {
  const closingVelocity = calculateClosingVelocity(pp);
  const earlyPosition = calculateEarlyPosition(pp);
  const lateGain = calculateLateGain(pp);
  const troubled = hadTroubledFinish(pp);
  const improvedThrough = improvedThroughout(pp);

  // Check if we have complete data
  const hasCompleteData =
    getFirstCallLengths(pp.runningLine) !== null &&
    getFinishLengths(pp.runningLine) !== null &&
    getStretchLengths(pp.runningLine) !== null;

  return {
    closingVelocity,
    earlyPosition,
    lateGain,
    hadTroubledFinish: troubled,
    improvedThroughout: improvedThrough,
    hasCompleteData,
  };
}

// ============================================================================
// PROFILE ANALYSIS (Multiple Races)
// ============================================================================

/**
 * Build a beaten lengths profile from multiple past performances.
 * Provides aggregate patterns and identifies consistent running styles.
 */
export function buildBeatenLengthsProfile(
  pastPerformances: PastPerformance[]
): BeatenLengthsProfile {
  if (pastPerformances.length === 0) {
    return {
      avgClosingVelocity: null,
      strongLateGainCount: 0,
      troubledFinishCount: 0,
      consistentCloserCount: 0,
      gaveUpLeadCount: 0,
      racesWithData: 0,
      isConfirmedCloser: false,
      isConfirmedFrontRunner: false,
      summary: 'No past performances available',
    };
  }

  let closingVelocitySum = 0;
  let closingVelocityCount = 0;
  let strongLateGainCount = 0;
  let troubledFinishCount = 0;
  let consistentCloserCount = 0;
  let gaveUpLeadCount = 0;
  let racesWithData = 0;
  let frontRunnerCount = 0;

  for (const pp of pastPerformances) {
    const analysis = analyzeBeatenLengths(pp);

    if (analysis.hasCompleteData) {
      racesWithData++;
    }

    // Closing velocity
    if (analysis.closingVelocity !== null) {
      closingVelocitySum += analysis.closingVelocity;
      closingVelocityCount++;

      // Count consistent closers (gained 2+ lengths)
      if (analysis.closingVelocity >= SCORING_THRESHOLDS.CLOSING_RACE_MIN) {
        consistentCloserCount++;
      }
    }

    // Strong late gain (3+ lengths in stretch)
    if (analysis.lateGain !== null && analysis.lateGain >= SCORING_THRESHOLDS.STRONG_LATE_GAIN) {
      strongLateGainCount++;
    }

    // Troubled finish (led at stretch, lost)
    if (analysis.hadTroubledFinish) {
      troubledFinishCount++;
    }

    // Check for gave up lead
    const stretchLengths = getStretchLengths(pp.runningLine);
    if (stretchLengths !== null && stretchLengths <= 0 && pp.finishPosition > 1) {
      // Was leading at stretch, didn't win, and lost ground
      const finishLengths = getFinishLengths(pp.runningLine);
      if (finishLengths !== null && finishLengths > 1) {
        gaveUpLeadCount++;
      }
    }

    // Track early position patterns
    if (analysis.earlyPosition === 'leading') {
      frontRunnerCount++;
    }
  }

  const avgClosingVelocity =
    closingVelocityCount > 0 ? closingVelocitySum / closingVelocityCount : null;

  // Determine confirmed running style
  const minRacesForConfirmation = Math.min(3, pastPerformances.length);
  const isConfirmedCloser =
    consistentCloserCount >= minRacesForConfirmation &&
    consistentCloserCount / pastPerformances.length >= 0.6;
  const isConfirmedFrontRunner =
    frontRunnerCount >= minRacesForConfirmation &&
    frontRunnerCount / pastPerformances.length >= 0.6;

  // Build summary
  const summaryParts: string[] = [];
  if (avgClosingVelocity !== null) {
    if (avgClosingVelocity >= 3) {
      summaryParts.push(`Strong closer (avg +${avgClosingVelocity.toFixed(1)}L)`);
    } else if (avgClosingVelocity >= 1) {
      summaryParts.push(`Gains ground (+${avgClosingVelocity.toFixed(1)}L avg)`);
    } else if (avgClosingVelocity <= -2) {
      summaryParts.push(`Fades late (${avgClosingVelocity.toFixed(1)}L avg)`);
    }
  }
  if (strongLateGainCount >= 2) {
    summaryParts.push(`${strongLateGainCount} strong stretch runs`);
  }
  if (troubledFinishCount >= 2) {
    summaryParts.push(`${troubledFinishCount} troubled finishes`);
  }

  return {
    avgClosingVelocity,
    strongLateGainCount,
    troubledFinishCount,
    consistentCloserCount,
    gaveUpLeadCount,
    racesWithData,
    isConfirmedCloser,
    isConfirmedFrontRunner,
    summary: summaryParts.length > 0 ? summaryParts.join(' | ') : 'Standard running pattern',
  };
}

// ============================================================================
// SCORING ADJUSTMENTS
// ============================================================================

/**
 * Calculate form and pace score adjustments based on beaten lengths analysis.
 *
 * Form Adjustments:
 * - Consistent closer (gains ground every race): +2-3 pts
 * - Strong late gain (3+ lengths in stretch): +1-2 pts
 * - Gave up lead late (possible stamina issue): -1-2 pts
 * - Improved position throughout (professional trip): +1 pt
 *
 * Pace Adjustments:
 * - Horse that leads by 3+ at first call = confirmed E type: affects fit score
 * - Horse that's 10+ back at first call = confirmed closer: affects fit score
 */
export function calculateBeatenLengthsAdjustments(horse: HorseEntry): BeatenLengthsScoreAdjustment {
  const profile = buildBeatenLengthsProfile(horse.pastPerformances);

  let formPoints = 0;
  const formReasons: string[] = [];
  let pacePoints = 0;
  const paceReasons: string[] = [];

  // No data = no adjustments
  if (profile.racesWithData === 0) {
    return {
      formPoints: 0,
      formReasoning: 'No beaten lengths data available',
      pacePoints: 0,
      paceReasoning: 'No beaten lengths data available',
    };
  }

  // =========================================================================
  // FORM ADJUSTMENTS
  // =========================================================================

  // Consistent closer bonus (+2-3 pts)
  if (profile.isConfirmedCloser) {
    formPoints += 3;
    formReasons.push('Consistent closer pattern (+3)');
  } else if (
    profile.consistentCloserCount >= 2 &&
    profile.avgClosingVelocity !== null &&
    profile.avgClosingVelocity >= 2
  ) {
    formPoints += 2;
    formReasons.push('Regular ground gainer (+2)');
  }

  // Strong late gain bonus (+1-2 pts)
  if (profile.strongLateGainCount >= 3) {
    formPoints += 2;
    formReasons.push(`${profile.strongLateGainCount} strong stretch runs (+2)`);
  } else if (profile.strongLateGainCount >= 1) {
    formPoints += 1;
    formReasons.push('Shows late kick (+1)');
  }

  // Gave up lead penalty (-1-2 pts)
  if (profile.gaveUpLeadCount >= 2) {
    formPoints -= 2;
    formReasons.push(`Gave up lead ${profile.gaveUpLeadCount}x (possible stamina issue) (-2)`);
  } else if (profile.gaveUpLeadCount === 1 && profile.troubledFinishCount >= 1) {
    formPoints -= 1;
    formReasons.push('Gave up lead once (-1)');
  }

  // Check most recent race for improved throughout bonus
  if (horse.pastPerformances.length > 0) {
    const lastRace = horse.pastPerformances[0];
    if (lastRace) {
      const lastAnalysis = analyzeBeatenLengths(lastRace);
      if (lastAnalysis.improvedThroughout && lastAnalysis.closingVelocity !== null) {
        formPoints += 1;
        formReasons.push('Professional trip last out (+1)');
      }
    }
  }

  // =========================================================================
  // PACE ADJUSTMENTS
  // =========================================================================

  // Confirmed running style validation
  if (profile.isConfirmedFrontRunner) {
    pacePoints += 1;
    paceReasons.push('Confirmed front-runner from lengths data');
  } else if (profile.isConfirmedCloser) {
    pacePoints += 1;
    paceReasons.push('Confirmed closer from lengths data');
  }

  // Check if declared style matches actual running pattern
  const declaredStyle = horse.runningStyle?.toUpperCase() ?? 'U';

  if (declaredStyle === 'E' && !profile.isConfirmedFrontRunner && profile.racesWithData >= 3) {
    // Listed as E but doesn't run on the lead
    pacePoints -= 1;
    paceReasons.push('Listed as E but not confirming on lead (-1)');
  }

  if (declaredStyle === 'C' && !profile.isConfirmedCloser && profile.racesWithData >= 3) {
    // Listed as C but doesn't close well
    if (profile.avgClosingVelocity !== null && profile.avgClosingVelocity < 1) {
      pacePoints -= 1;
      paceReasons.push('Listed as C but not closing effectively (-1)');
    }
  }

  return {
    formPoints: Math.max(-5, Math.min(5, formPoints)), // Cap at ±5
    formReasoning: formReasons.length > 0 ? formReasons.join(' | ') : 'No form adjustments',
    pacePoints: Math.max(-3, Math.min(3, pacePoints)), // Cap at ±3
    paceReasoning: paceReasons.length > 0 ? paceReasons.join(' | ') : 'No pace adjustments',
  };
}

// ============================================================================
// PACE VALIDATION UTILITIES
// ============================================================================

/**
 * Get the actual early speed evidence from past performances.
 * Returns average lengths behind/ahead at first call.
 *
 * Negative = leading by X lengths average
 * Positive = behind by X lengths average
 */
export function getActualEarlySpeedPosition(pastPerformances: PastPerformance[]): number | null {
  let sum = 0;
  let count = 0;

  for (const pp of pastPerformances) {
    const firstCallLengths = getFirstCallLengths(pp.runningLine);
    if (firstCallLengths !== null) {
      sum += firstCallLengths;
      count++;
    }
  }

  return count > 0 ? sum / count : null;
}

/**
 * Validate running style using beaten lengths data.
 * Returns true if the horse's actual running pattern matches the declared style.
 */
export function validateRunningStyleWithLengths(horse: HorseEntry): {
  isValid: boolean;
  actualPattern: 'E' | 'P' | 'S' | 'C' | 'U';
  confidence: number;
  reasoning: string;
} {
  const avgFirstCallLengths = getActualEarlySpeedPosition(horse.pastPerformances);
  const profile = buildBeatenLengthsProfile(horse.pastPerformances);

  if (avgFirstCallLengths === null || profile.racesWithData < 2) {
    return {
      isValid: true, // Can't invalidate without data
      actualPattern: 'U',
      confidence: 0,
      reasoning: 'Insufficient lengths data for validation',
    };
  }

  let actualPattern: 'E' | 'P' | 'S' | 'C' | 'U' = 'U';
  let confidence = 0;

  // Determine actual pattern from data
  // Use same threshold as early position classification (0.5 = leading)
  if (avgFirstCallLengths <= EARLY_POSITION_THRESHOLDS.LEADING) {
    // On the lead or within half length - definitely E
    actualPattern = 'E';
    confidence = Math.min(100, 70 + (EARLY_POSITION_THRESHOLDS.LEADING - avgFirstCallLengths) * 20);
  } else if (avgFirstCallLengths <= EARLY_POSITION_THRESHOLDS.CLOSE) {
    // Close stalker (within 3 lengths)
    actualPattern =
      profile.avgClosingVelocity !== null && profile.avgClosingVelocity > 1 ? 'S' : 'P';
    confidence = 70;
  } else if (avgFirstCallLengths <= EARLY_POSITION_THRESHOLDS.MID) {
    // Mid-pack (3-7 lengths)
    actualPattern =
      profile.avgClosingVelocity !== null && profile.avgClosingVelocity > 2 ? 'S' : 'P';
    confidence = 60;
  } else {
    // Back runner (7+ lengths)
    actualPattern = 'C';
    confidence = Math.min(100, 50 + avgFirstCallLengths * 3);
  }

  const declaredStyle = horse.runningStyle?.toUpperCase() ?? 'U';

  // Check if declared matches actual
  const styleMatch =
    declaredStyle === actualPattern ||
    (declaredStyle === 'E' && actualPattern === 'P') ||
    (declaredStyle === 'P' && (actualPattern === 'E' || actualPattern === 'S')) ||
    (declaredStyle === 'S' && (actualPattern === 'P' || actualPattern === 'C')) ||
    (declaredStyle === 'C' && actualPattern === 'S');

  return {
    isValid: styleMatch || declaredStyle === 'U',
    actualPattern,
    confidence,
    reasoning: styleMatch
      ? `Declared ${declaredStyle} matches actual pattern`
      : `Declared ${declaredStyle} but runs as ${actualPattern} (avg ${avgFirstCallLengths.toFixed(1)}L at 1st call)`,
  };
}

// ============================================================================
// DISPLAY UTILITIES
// ============================================================================

/**
 * Format closing velocity for display.
 */
export function formatClosingVelocity(velocity: number | null): string {
  if (velocity === null) return 'N/A';
  if (velocity > 0) return `+${velocity.toFixed(1)}L`;
  if (velocity < 0) return `${velocity.toFixed(1)}L`;
  return '0L';
}

/**
 * Get a color indicator for closing velocity.
 */
export function getClosingVelocityColor(velocity: number | null): string {
  if (velocity === null) return '#888888';
  if (velocity >= 4) return '#10b981'; // Strong closer - green
  if (velocity >= 2) return '#19abb5'; // Good closer - primary
  if (velocity >= 0) return '#888888'; // Neutral - gray
  if (velocity >= -2) return '#f59e0b'; // Slight fade - warning
  return '#ef4444'; // Fading - error
}

/**
 * Get badge data for early position display.
 */
export function getEarlyPositionBadge(position: EarlyPositionType): {
  label: string;
  color: string;
  description: string;
} {
  switch (position) {
    case 'leading':
      return {
        label: 'E',
        color: '#ef4444',
        description: 'On or near the lead',
      };
    case 'close':
      return {
        label: 'P',
        color: '#f59e0b',
        description: 'Close stalker (within 3L)',
      };
    case 'mid':
      return {
        label: 'S',
        color: '#19abb5',
        description: 'Mid-pack (3-7L)',
      };
    case 'back':
      return {
        label: 'C',
        color: '#10b981',
        description: 'Far back (7+L)',
      };
  }
}
