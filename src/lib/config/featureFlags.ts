/**
 * Feature Flags Configuration
 *
 * Controls experimental features and provides rollback capability.
 * All flags should default to the safest option (existing behavior).
 *
 * Usage:
 *   import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
 *   if (FEATURE_FLAGS.useBoxSeparation) { ... }
 *
 * Rollback:
 *   Set flag to false to revert to previous behavior without code changes.
 *
 * @module config/featureFlags
 */

// ============================================================================
// FEATURE FLAG DEFINITIONS
// ============================================================================

export interface FeatureFlagConfig {
  /**
   * Box Separation for Exotic Bets
   *
   * When enabled, exotic box bets (exacta, trifecta, superfecta) will check
   * score separation between horses before including them in the box.
   *
   * Horses whose score is more than `boxSeparationThreshold` points below
   * the leader will be excluded from boxes.
   *
   * Example:
   *   Leader: 195 pts, threshold: 20
   *   Horse at 180 pts: INCLUDED (15 pts behind, within threshold)
   *   Horse at 170 pts: EXCLUDED (25 pts behind, exceeds threshold)
   *
   * Set to false to revert to previous behavior (always take top 4).
   */
  useBoxSeparation: boolean;

  /**
   * Box Separation Threshold (in points)
   *
   * The maximum score difference allowed between the leader and a horse
   * for that horse to be included in exotic box bets.
   *
   * Derivation:
   *   This value is derived from the tier classification system:
   *   - Tier 1: 180+ points
   *   - Tier 2: 160-179 points (20-point range)
   *   - Tier 3: 130-159 points (30-point range)
   *
   *   The overlay adjustment system (overlayAnalysis.ts:614-637) uses:
   *   - +20 points for strong overlay (80%+)
   *   - +10 points for good overlay (40%+)
   *
   *   20 points represents approximately one tier's worth of difference,
   *   which is considered a meaningful separation in horse quality.
   *
   * Tuning:
   *   - Lower threshold (15): More conservative, fewer horses in boxes
   *   - Higher threshold (30): More inclusive, larger boxes
   *   - Set to 999 to effectively disable (include all horses)
   */
  boxSeparationThreshold: number;

  /**
   * Odds Confidence Tracking
   *
   * When enabled, the system tracks the SOURCE of odds data (live, morning line,
   * or default fallback) and assigns confidence values to each source.
   *
   * This allows downstream systems (value detection, bet sizing) to adjust
   * calculations based on how reliable the odds data is.
   *
   * Confidence values:
   *   - Live (95): User-entered odds, reflects current market
   *   - Morning Line (60): DRF data, reasonable but can diverge
   *   - Default Fallback (20): No data available, using 5-1 default
   *
   * Set to false to disable confidence tracking and treat all odds equally.
   */
  useOddsConfidence: boolean;

  /**
   * Field-Relative Scoring
   *
   * When enabled, the system calculates field-relative metrics for each horse:
   * - Z-score (how many standard deviations from field average)
   * - Field percentile (position within this specific field)
   * - Standout detection (unique leader with significant gap)
   * - Advisory tier adjustments
   *
   * IMPORTANT: This produces ADVISORY adjustments only. Diamond detection
   * (120-139 raw score) is unaffected - always use raw scores for diamond
   * classification.
   *
   * Set to false to disable field-relative calculations.
   */
  useFieldRelativeScoring: boolean;

  /**
   * Field-Relative Standout Threshold (in points)
   *
   * The minimum gap from the leader to the second-place horse required
   * for the leader to be considered a "standout".
   *
   * Requirements for standout status:
   *   1. Horse must be the UNIQUE leader (no ties at top)
   *   2. Gap to #2 must meet or exceed this threshold
   *
   * Tuning:
   *   - Lower threshold (15): More horses qualify as standouts
   *   - Higher threshold (25): Only dominant leaders are standouts
   *   - Default (20): Balanced - requires meaningful separation
   */
  fieldRelativeStandoutThreshold: number;

  /**
   * Top Beyer Bonus (EXPERIMENTAL)
   *
   * When enabled, the horse with the highest Beyer figure in the field
   * receives a +15 point bonus IF they would otherwise rank 5th or worse.
   *
   * Rationale:
   *   In testing, horses with the highest Beyer sometimes rank poorly
   *   but still win. This bonus helps surface these "Top Beyer Threats"
   *   while not affecting horses that already rank well.
   *
   * When enabled:
   *   - Identifies the single horse with the highest Beyer in the field
   *   - If that horse ranks 5th or worse after normal scoring
   *   - Adds +15 points to their final score
   *   - Flags them as "Top Beyer Threat" in the UI
   *
   * Set to false (default) to disable this experimental feature.
   */
  topBeyerBonus: boolean;

  /**
   * Top Beyer Bonus Points
   *
   * The number of points to add when the top Beyer bonus is triggered.
   * Default: 15 points
   */
  topBeyerBonusPoints: number;

  /**
   * Top Beyer Bonus Rank Threshold
   *
   * The minimum rank (5th or worse) required for the bonus to apply.
   * A horse must rank at or below this position to receive the bonus.
   * Default: 5 (meaning 5th place or worse)
   */
  topBeyerBonusRankThreshold: number;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Active feature flags
 *
 * These values control runtime behavior. Modify here for quick rollback
 * without changing application logic.
 */
export const FEATURE_FLAGS: FeatureFlagConfig = {
  useBoxSeparation: true,
  boxSeparationThreshold: 20,
  useOddsConfidence: true,
  useFieldRelativeScoring: true,
  fieldRelativeStandoutThreshold: 20,
  // EXPERIMENTAL: Top Beyer Bonus (default OFF)
  topBeyerBonus: false,
  topBeyerBonusPoints: 15,
  topBeyerBonusRankThreshold: 5,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if box separation is enabled
 */
export function isBoxSeparationEnabled(): boolean {
  return FEATURE_FLAGS.useBoxSeparation;
}

/**
 * Get the current box separation threshold
 */
export function getBoxSeparationThreshold(): number {
  return FEATURE_FLAGS.boxSeparationThreshold;
}

/**
 * Check if odds confidence tracking is enabled
 */
export function isOddsConfidenceEnabled(): boolean {
  return FEATURE_FLAGS.useOddsConfidence;
}

/**
 * Check if field-relative scoring is enabled
 */
export function isFieldRelativeScoringEnabled(): boolean {
  return FEATURE_FLAGS.useFieldRelativeScoring;
}

/**
 * Get the current field-relative standout threshold
 */
export function getFieldRelativeStandoutThreshold(): number {
  return FEATURE_FLAGS.fieldRelativeStandoutThreshold;
}

/**
 * Check if Top Beyer Bonus is enabled (EXPERIMENTAL)
 */
export function isTopBeyerBonusEnabled(): boolean {
  return FEATURE_FLAGS.topBeyerBonus;
}

/**
 * Get the Top Beyer Bonus points value
 */
export function getTopBeyerBonusPoints(): number {
  return FEATURE_FLAGS.topBeyerBonusPoints;
}

/**
 * Get the Top Beyer Bonus rank threshold
 */
export function getTopBeyerBonusRankThreshold(): number {
  return FEATURE_FLAGS.topBeyerBonusRankThreshold;
}

/**
 * Override feature flags at runtime (useful for testing)
 *
 * @param overrides - Partial config to merge with defaults
 * @returns Previous config for restoration
 */
export function overrideFeatureFlags(overrides: Partial<FeatureFlagConfig>): FeatureFlagConfig {
  const previous = { ...FEATURE_FLAGS };

  if (overrides.useBoxSeparation !== undefined) {
    FEATURE_FLAGS.useBoxSeparation = overrides.useBoxSeparation;
  }
  if (overrides.boxSeparationThreshold !== undefined) {
    FEATURE_FLAGS.boxSeparationThreshold = overrides.boxSeparationThreshold;
  }
  if (overrides.useOddsConfidence !== undefined) {
    FEATURE_FLAGS.useOddsConfidence = overrides.useOddsConfidence;
  }
  if (overrides.useFieldRelativeScoring !== undefined) {
    FEATURE_FLAGS.useFieldRelativeScoring = overrides.useFieldRelativeScoring;
  }
  if (overrides.fieldRelativeStandoutThreshold !== undefined) {
    FEATURE_FLAGS.fieldRelativeStandoutThreshold = overrides.fieldRelativeStandoutThreshold;
  }
  if (overrides.topBeyerBonus !== undefined) {
    FEATURE_FLAGS.topBeyerBonus = overrides.topBeyerBonus;
  }
  if (overrides.topBeyerBonusPoints !== undefined) {
    FEATURE_FLAGS.topBeyerBonusPoints = overrides.topBeyerBonusPoints;
  }
  if (overrides.topBeyerBonusRankThreshold !== undefined) {
    FEATURE_FLAGS.topBeyerBonusRankThreshold = overrides.topBeyerBonusRankThreshold;
  }

  return previous;
}

/**
 * Reset feature flags to defaults
 */
export function resetFeatureFlags(): void {
  FEATURE_FLAGS.useBoxSeparation = true;
  FEATURE_FLAGS.boxSeparationThreshold = 20;
  FEATURE_FLAGS.useOddsConfidence = true;
  FEATURE_FLAGS.useFieldRelativeScoring = true;
  FEATURE_FLAGS.fieldRelativeStandoutThreshold = 20;
  FEATURE_FLAGS.topBeyerBonus = false;
  FEATURE_FLAGS.topBeyerBonusPoints = 15;
  FEATURE_FLAGS.topBeyerBonusRankThreshold = 5;
}
