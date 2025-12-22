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

  return previous;
}

/**
 * Reset feature flags to defaults
 */
export function resetFeatureFlags(): void {
  FEATURE_FLAGS.useBoxSeparation = true;
  FEATURE_FLAGS.boxSeparationThreshold = 20;
}
