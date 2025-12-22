/**
 * Box Selection Module
 *
 * Determines which horses to include in exotic box bets (exacta, trifecta,
 * superfecta) based on score separation from the leader.
 *
 * Problem Solved:
 *   Previously, box bets always took the top 4 horses regardless of score
 *   separation. This could include a horse 40 points below the leader,
 *   wasting combinations on unlikely finishers.
 *
 * Solution:
 *   Check score separation before including horses. Only include horses
 *   whose score is within a configurable threshold of the leader's score.
 *
 * Threshold Derivation (20 points):
 *   The default threshold is derived from the tier classification system:
 *
 *   Tier boundaries (from tierClassification.ts:20-24):
 *   - Tier 1: 180+ points
 *   - Tier 2: 160-179 points (20-point range)
 *   - Tier 3: 130-159 points (30-point range)
 *
 *   Overlay adjustments (from overlayAnalysis.ts:614-637):
 *   - +20 points for strong overlay (80%+)
 *   - +10 points for good overlay (40%+)
 *
 *   20 points represents approximately one tier's worth of difference,
 *   meaning a horse more than 20 points behind the leader is likely
 *   in a lower competitive tier and less likely to hit in exotics.
 *
 * @module recommendations/boxSelection
 */

import type { ClassifiedHorse } from '../betting/tierClassification';
import {
  FEATURE_FLAGS,
  isBoxSeparationEnabled,
  getBoxSeparationThreshold,
} from '../config/featureFlags';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for box selection behavior
 */
export interface BoxSelectionConfig {
  /**
   * Maximum score difference from leader to include a horse.
   * Default: 20 (from FEATURE_FLAGS.boxSeparationThreshold)
   */
  maxScoreSeparation: number;

  /**
   * Maximum number of horses to include in the box.
   * For exacta: typically 4 (12 combinations)
   * For trifecta: typically 4 (24 combinations)
   * For superfecta: typically 4-5 (24-120 combinations)
   */
  maxHorses: number;

  /**
   * Minimum number of horses required for a valid box.
   * For exacta: 2
   * For trifecta: 3
   * For superfecta: 4
   */
  minHorses: number;
}

/**
 * Result of box selection, including exclusion details
 */
export interface BoxSelectionResult {
  /**
   * Horses selected for the box, in order by adjustedScore
   */
  selectedHorses: ClassifiedHorse[];

  /**
   * Horses that were excluded due to score separation
   */
  excludedHorses: ClassifiedHorse[];

  /**
   * Map of horseIndex to human-readable exclusion reason.
   * Format: "Score 155 is 40 points below leader (195). Threshold: 20 points."
   */
  exclusionReasons: Map<number, string>;

  /**
   * Recommended box size based on selection.
   * May be less than maxHorses if horses were excluded.
   */
  recommendedBoxSize: number;

  /**
   * Whether the box meets minimum requirements.
   * If false, the bet should not be generated.
   */
  isValidBox: boolean;

  /**
   * Summary message for display on bet card.
   * Example: "3-horse box (1 horse excluded: 35+ pts behind)"
   */
  summary: string;
}

/**
 * Exclusion details for a single horse
 */
export interface HorseExclusion {
  /** Horse index */
  horseIndex: number;

  /** Horse name for display */
  horseName: string;

  /** Program number */
  programNumber: number;

  /** Horse's adjusted score */
  score: number;

  /** Leader's adjusted score */
  leaderScore: number;

  /** Point difference from leader */
  pointsBehind: number;

  /** Threshold that was exceeded */
  threshold: number;

  /** Human-readable reason */
  reason: string;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default config for exacta box bets
 */
export const EXACTA_BOX_CONFIG: BoxSelectionConfig = {
  maxScoreSeparation: FEATURE_FLAGS.boxSeparationThreshold,
  maxHorses: 4,
  minHorses: 2,
};

/**
 * Default config for trifecta box bets
 */
export const TRIFECTA_BOX_CONFIG: BoxSelectionConfig = {
  maxScoreSeparation: FEATURE_FLAGS.boxSeparationThreshold,
  maxHorses: 4,
  minHorses: 3,
};

/**
 * Default config for superfecta box bets
 */
export const SUPERFECTA_BOX_CONFIG: BoxSelectionConfig = {
  maxScoreSeparation: FEATURE_FLAGS.boxSeparationThreshold,
  maxHorses: 5,
  minHorses: 4,
};

// ============================================================================
// MAIN SELECTION FUNCTION
// ============================================================================

/**
 * Select horses for an exotic box bet based on score separation.
 *
 * Algorithm:
 * 1. If feature flag disabled, return top N horses (legacy behavior)
 * 2. Use leader's adjustedScore as baseline
 * 3. Include horses whose score >= (leaderScore - threshold)
 * 4. Cap at maxHorses
 * 5. Check if result meets minHorses requirement
 *
 * @param candidates - Horses sorted by adjustedScore descending (leader first)
 * @param config - Selection configuration
 * @returns Selection result with included/excluded horses and reasons
 *
 * @example
 * ```typescript
 * const result = selectBoxHorses(allClassifiedHorses, EXACTA_BOX_CONFIG);
 * if (result.isValidBox) {
 *   // Use result.selectedHorses for the bet
 *   // Display result.summary on bet card
 * }
 * ```
 */
export function selectBoxHorses(
  candidates: ClassifiedHorse[],
  config: BoxSelectionConfig
): BoxSelectionResult {
  // Edge case: no candidates
  if (candidates.length === 0) {
    return {
      selectedHorses: [],
      excludedHorses: [],
      exclusionReasons: new Map(),
      recommendedBoxSize: 0,
      isValidBox: false,
      summary: 'No horses available for box',
    };
  }

  // Edge case: fewer candidates than minimum required
  if (candidates.length < config.minHorses) {
    return {
      selectedHorses: candidates,
      excludedHorses: [],
      exclusionReasons: new Map(),
      recommendedBoxSize: candidates.length,
      isValidBox: false,
      summary: `Only ${candidates.length} horse(s) available, need ${config.minHorses} for box`,
    };
  }

  // If feature flag is disabled, use legacy behavior (take top N)
  if (!isBoxSeparationEnabled()) {
    const selected = candidates.slice(0, config.maxHorses);
    return {
      selectedHorses: selected,
      excludedHorses: [],
      exclusionReasons: new Map(),
      recommendedBoxSize: selected.length,
      isValidBox: selected.length >= config.minHorses,
      summary: `${selected.length}-horse box`,
    };
  }

  // Get threshold from config or feature flags
  const threshold = config.maxScoreSeparation ?? getBoxSeparationThreshold();

  // Leader is first horse (candidates should be pre-sorted)
  const leader = candidates[0];
  if (!leader) {
    return {
      selectedHorses: [],
      excludedHorses: [],
      exclusionReasons: new Map(),
      recommendedBoxSize: 0,
      isValidBox: false,
      summary: 'No leader found',
    };
  }

  const leaderScore = leader.adjustedScore;
  const minimumScore = leaderScore - threshold;

  const selectedHorses: ClassifiedHorse[] = [];
  const excludedHorses: ClassifiedHorse[] = [];
  const exclusionReasons = new Map<number, string>();

  // Process each candidate
  for (const horse of candidates) {
    // Already have enough horses
    if (selectedHorses.length >= config.maxHorses) {
      // Remaining horses are excluded due to max cap, not score separation
      // We don't add them to excludedHorses or exclusionReasons since
      // they would have been excluded anyway
      break;
    }

    const pointsBehind = leaderScore - horse.adjustedScore;

    if (horse.adjustedScore >= minimumScore) {
      // Within threshold - include
      selectedHorses.push(horse);
    } else {
      // Below threshold - exclude
      excludedHorses.push(horse);

      const reason = formatExclusionReason(
        horse.horse.horseName,
        horse.adjustedScore,
        leaderScore,
        pointsBehind,
        threshold
      );
      exclusionReasons.set(horse.horseIndex, reason);
    }
  }

  // Check if we meet minimum requirements
  const isValidBox = selectedHorses.length >= config.minHorses;
  const summary = generateSummary(
    selectedHorses.length,
    excludedHorses.length,
    threshold,
    isValidBox,
    config.minHorses
  );

  return {
    selectedHorses,
    excludedHorses,
    exclusionReasons,
    recommendedBoxSize: selectedHorses.length,
    isValidBox,
    summary,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a human-readable exclusion reason for a horse.
 *
 * @example
 * "Speedster (155 pts) excluded: 40 points behind leader (195). Threshold: 20."
 */
function formatExclusionReason(
  horseName: string,
  horseScore: number,
  leaderScore: number,
  pointsBehind: number,
  threshold: number
): string {
  return (
    `${horseName} (${Math.round(horseScore)} pts) excluded: ` +
    `${Math.round(pointsBehind)} points behind leader (${Math.round(leaderScore)}). ` +
    `Threshold: ${threshold}.`
  );
}

/**
 * Generate a summary message for the bet card.
 */
function generateSummary(
  selectedCount: number,
  excludedCount: number,
  threshold: number,
  isValid: boolean,
  minRequired: number
): string {
  if (!isValid) {
    return (
      `Only ${selectedCount} horse(s) within ${threshold}-point threshold. ` +
      `Need ${minRequired} for valid box.`
    );
  }

  if (excludedCount === 0) {
    return `${selectedCount}-horse box`;
  }

  if (excludedCount === 1) {
    return `${selectedCount}-horse box (1 horse excluded: ${threshold}+ pts behind)`;
  }

  return `${selectedCount}-horse box (${excludedCount} horses excluded: ${threshold}+ pts behind)`;
}

/**
 * Get detailed exclusion information for display/logging.
 *
 * Use this when you need more than just the reason string.
 */
export function getExclusionDetails(
  result: BoxSelectionResult,
  leader: ClassifiedHorse | undefined
): HorseExclusion[] {
  if (!leader) return [];

  const threshold = getBoxSeparationThreshold();

  return result.excludedHorses.map((horse) => ({
    horseIndex: horse.horseIndex,
    horseName: horse.horse.horseName,
    programNumber: horse.horse.programNumber,
    score: horse.adjustedScore,
    leaderScore: leader.adjustedScore,
    pointsBehind: leader.adjustedScore - horse.adjustedScore,
    threshold,
    reason: result.exclusionReasons.get(horse.horseIndex) || 'Unknown reason',
  }));
}

/**
 * Check if a specific horse would be included in a box.
 *
 * Useful for UI to show "would be excluded" indicators.
 */
export function wouldBeIncluded(
  horse: ClassifiedHorse,
  leaderScore: number,
  threshold: number = getBoxSeparationThreshold()
): boolean {
  return horse.adjustedScore >= leaderScore - threshold;
}

/**
 * Calculate how many points a horse needs to gain to be included.
 *
 * Returns 0 if already included, positive number if excluded.
 */
export function pointsNeededForInclusion(
  horse: ClassifiedHorse,
  leaderScore: number,
  threshold: number = getBoxSeparationThreshold()
): number {
  const minimumScore = leaderScore - threshold;
  const deficit = minimumScore - horse.adjustedScore;
  return Math.max(0, Math.ceil(deficit));
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a custom box selection config.
 *
 * Use this when you need non-standard settings.
 *
 * @example
 * ```typescript
 * const conservativeConfig = createBoxConfig({
 *   maxScoreSeparation: 15,  // Tighter threshold
 *   maxHorses: 3,            // Smaller box
 *   minHorses: 2,
 * });
 * ```
 */
export function createBoxConfig(
  overrides: Partial<BoxSelectionConfig>
): BoxSelectionConfig {
  return {
    maxScoreSeparation: overrides.maxScoreSeparation ?? getBoxSeparationThreshold(),
    maxHorses: overrides.maxHorses ?? 4,
    minHorses: overrides.minHorses ?? 2,
  };
}

/**
 * Create configs for all exotic bet types with consistent threshold.
 *
 * Call this when threshold changes to get updated configs.
 */
export function createExoticConfigs(threshold?: number): {
  exacta: BoxSelectionConfig;
  trifecta: BoxSelectionConfig;
  superfecta: BoxSelectionConfig;
} {
  const separation = threshold ?? getBoxSeparationThreshold();

  return {
    exacta: {
      maxScoreSeparation: separation,
      maxHorses: 4,
      minHorses: 2,
    },
    trifecta: {
      maxScoreSeparation: separation,
      maxHorses: 4,
      minHorses: 3,
    },
    superfecta: {
      maxScoreSeparation: separation,
      maxHorses: 5,
      minHorses: 4,
    },
  };
}
