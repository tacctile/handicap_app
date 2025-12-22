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
   * When enabled, the system calculates how a horse's score compares to
   * the competition in its specific race field.
   *
   * This provides ADVISORY adjustments - the actual tier is still determined
   * by absolute score thresholds (180+, 160-179, 130-159).
   *
   * Key outputs:
   *   - z-score: How many standard deviations above/below field average
   *   - fieldPercentile: 0-100 ranking within this specific field
   *   - isStandout: True if 20+ points ahead of second-best
   *   - tierAdjustment: Suggested -1/0/+1 adjustment (advisory only)
   *
   * IMPORTANT: This does NOT affect diamond detection, which uses raw
   * scores in the 120-139 range. Diamond detection remains unchanged.
   *
   * Use cases:
   *   - UI can show field context ("standout in weak field")
   *   - Betting recommendations can factor in standout status
   *   - Works alongside overlay adjustments (tierClassification.ts:182)
   *
   * Set to false to disable field-relative calculations entirely.
   */
  useFieldRelativeScoring: boolean;

  /**
   * Field-Relative Standout Threshold (in points)
   *
   * The minimum point gap between the leader and second-best horse
   * for the leader to be considered a "standout" in the field.
   *
   * Derivation:
   *   - Tier 2 spans 20 points (160-179)
   *   - A 20-point lead represents approximately one full tier of separation
   *   - This is considered a significant competitive advantage
   *
   * Effects when horse is a standout:
   *   - isStandout = true in FieldRelativeResult
   *   - tierAdjustment may be +1 in weak/average fields
   *
   * Tuning:
   *   - Lower threshold (15): More horses qualify as standouts
   *   - Higher threshold (25): Only exceptional leads count as standouts
   *   - Very high (50+): Effectively disables standout detection
   */
  fieldRelativeStandoutThreshold: number;
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
 * Get the current standout threshold for field-relative scoring
 */
export function getFieldRelativeStandoutThreshold(): number {
  return FEATURE_FLAGS.fieldRelativeStandoutThreshold;
}

/**
 * Override feature flags at runtime (useful for testing)
 *
 * @param overrides - Partial config to merge with defaults
 * @returns Previous config for restoration
 */
export function overrideFeatureFlags(
  overrides: Partial<FeatureFlagConfig>
): FeatureFlagConfig {
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
}
