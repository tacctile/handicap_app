/**
 * Late-Breaking Information Module (Protocol 4)
 *
 * Analyzes late-breaking information that affects race dynamics:
 * - Scratch impact assessment
 * - Pace scenario recalculation
 * - Post position shifts
 * - Jockey change impact
 *
 * NOTE: This module works with static DRF data loaded at file parse time.
 * Real-time features (live odds updates, weather changes, race-day scratches
 * after file load) would require live data feeds (V2 feature).
 *
 * V2 Features (future):
 * - Live odds change detection
 * - Weather update handling
 * - Track condition change protocol
 * - Real-time scratch notifications
 *
 * @module lateBreaking
 */

export {
  analyzeLateBreakingInfo,
  getLateBreakingBonus,
  getLateBreakingReasons,
  benefitsFromScratches,
  getPaceImpactSummary,
  type ScratchImpact,
  type JockeyChangeAnalysis,
  type LateBreakingResult,
} from './lateBreakingAnalysis';
