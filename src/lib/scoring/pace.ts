/**
 * Pace Scoring Module
 * Analyzes pace scenarios and running style matchups
 *
 * Score Range: 0-35 points (Model B - reduced from 45)
 * 10.8% of 323 base score - High predictive value but reduced vs speed
 *
 * Integrates with paceAnalysis.ts for comprehensive pace detection:
 * - Running Style Classification (E, P, C, S)
 * - Pace Pressure Index (PPI) calculation
 * - Tactical advantage scoring based on pace scenario
 *
 * Pace Scenario Scoring (from tactical advantage, rescaled by 35/40 = 0.875):
 * - Perfect pace fit (e.g., lone speed in soft pace): 22+ pts base + bonuses
 * - Good pace fit (e.g., presser in hot pace): 16-21 pts
 * - Neutral fit: 11-15 pts
 * - Poor fit (e.g., closer in soft pace): 5-10 pts
 * - Terrible fit: 0-4 pts
 *
 * Model B: Pace reduced from 45 to 35 points to weight speed more heavily.
 * Pace is a situational factor; speed figures are intrinsic ability.
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import {
  getSpeedBias,
  isTrackIntelligenceAvailable,
  getSeasonalAdjustment,
  type SeasonalAdjustmentResult,
} from '../trackIntelligence';
import { calculateBeatenLengthsAdjustments } from './beatenLengths';
import {
  parseRunningStyle,
  analyzePaceScenario,
  calculateTacticalAdvantage,
  analyzePaceForHorse,
  formatStyleBreakdown,
  getPaceScenarioSummary,
  getRunningStyleBadge,
  // Pace figure analysis functions
  getAverageEarlyPace,
  getAverageLatePace,
  getFieldPacePressure,
  analyzePaceFigures,
  calculatePaceFigureAdjustment,
  // Types
  type RunningStyleCode,
  type RunningStyleProfile,
  type PaceScenarioType,
  type PaceScenarioAnalysis,
  type TacticalAdvantage,
  type PaceAnalysisResult,
  type PaceFigureAnalysis,
  type FieldPacePressureAnalysis,
  // Constants
  RUNNING_STYLE_NAMES,
  PACE_SCENARIO_LABELS,
  PACE_SCENARIO_COLORS,
  EP1_THRESHOLDS,
  LP_THRESHOLDS,
  FIELD_PACE_THRESHOLDS,
} from './paceAnalysis';

// Re-export all types and utilities from paceAnalysis
export {
  parseRunningStyle,
  analyzePaceScenario,
  calculateTacticalAdvantage,
  analyzePaceForHorse,
  formatStyleBreakdown,
  getPaceScenarioSummary,
  getRunningStyleBadge,
  // Pace figure analysis functions
  getAverageEarlyPace,
  getAverageLatePace,
  getFieldPacePressure,
  analyzePaceFigures,
  calculatePaceFigureAdjustment,
  // Types
  type RunningStyleCode,
  type RunningStyleProfile,
  type PaceScenarioType,
  type PaceScenarioAnalysis,
  type TacticalAdvantage,
  type PaceAnalysisResult,
  type PaceFigureAnalysis,
  type FieldPacePressureAnalysis,
  // Constants
  RUNNING_STYLE_NAMES,
  PACE_SCENARIO_LABELS,
  PACE_SCENARIO_COLORS,
  EP1_THRESHOLDS,
  LP_THRESHOLDS,
  FIELD_PACE_THRESHOLDS,
};

// Re-export seasonal adjustment types from trackIntelligence
export { type SeasonalAdjustmentResult } from '../trackIntelligence';

// ============================================================================
// LEGACY TYPES (for backwards compatibility)
// ============================================================================

export type RunningStyle = 'E' | 'EP' | 'P' | 'S' | 'C' | 'U'; // Keep for backwards compat

export type PaceScenario = 'lone_speed' | 'contested_speed' | 'honest' | 'slow' | 'unknown';

export interface PaceProfile {
  style: RunningStyle;
  styleName: string;
  earlySpeedRating: number;
  averageEarlyPosition: number;
  isConfirmedStyle: boolean;
}

export interface FieldPaceAnalysis {
  scenario: PaceScenario;
  scenarioDescription: string;
  speedCount: number;
  presserCount: number;
  closerCount: number;
  pacePressureIndex: number; // 0-100 scale
  expectedPace: 'fast' | 'moderate' | 'slow';
  // New fields from enhanced analysis
  paceScenarioType?: PaceScenarioType;
  styleBreakdown?: PaceScenarioAnalysis['styleBreakdown'];
  // EP1-based pace pressure analysis (when available)
  pacePressure?: FieldPacePressureAnalysis;
}

export interface PaceScoreResult {
  total: number;
  profile: PaceProfile;
  fieldAnalysis: FieldPaceAnalysis;
  paceFit: 'perfect' | 'good' | 'neutral' | 'poor' | 'terrible';
  trackSpeedBias: number | null;
  reasoning: string;
  // Enhanced analysis data
  detailedProfile?: RunningStyleProfile;
  tacticalAdvantage?: TacticalAdvantage;
  paceScenarioAnalysis?: PaceScenarioAnalysis;
  // Pace figure analysis (EP1/LP)
  paceFigures?: PaceFigureAnalysis;
  paceFigureAdjustment?: { points: number; reasoning: string };
  // Beaten lengths analysis
  beatenLengthsPaceAdjustment: number;
  beatenLengthsReasoning: string;
  // Seasonal track patterns (±2 pts refinement)
  seasonalAdjustment: SeasonalAdjustmentResult;
  /** Phase 2: Pace confidence info for data completeness */
  paceConfidence?: {
    /** Whether EP1/LP pace figures are available */
    hasEP1LP: boolean;
    /** Whether running style is confirmed (not unknown) */
    hasRunningStyle: boolean;
    /** Confidence multiplier applied (0.35-1.0) */
    multiplier: number;
    /** Maximum possible pace score given data availability */
    maxPossibleScore: number;
    /** Whether confidence penalty was applied */
    penaltyApplied: boolean;
  };
}

// ============================================================================
// LEGACY STYLE NAMES
// ============================================================================

/** @deprecated Use RUNNING_STYLE_NAMES instead */
export const LEGACY_STYLE_NAMES: Record<RunningStyle, string> = {
  E: 'Early Speed',
  EP: 'Early Presser',
  P: 'Presser',
  S: 'Stalker',
  C: 'Closer',
  U: 'Unknown',
};

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

/**
 * Convert new running style code to legacy format
 */
function toLegacyStyle(style: RunningStyleCode): RunningStyle {
  // Map new style codes to legacy ones
  switch (style) {
    case 'E':
      return 'E';
    case 'P':
      return 'P';
    case 'C':
      return 'C';
    case 'S':
      return 'S';
    case 'U':
      return 'U';
  }
}

/**
 * Convert new pace scenario type to legacy format
 */
function toLegacyScenario(scenario: PaceScenarioType): PaceScenario {
  switch (scenario) {
    case 'soft':
      return 'lone_speed';
    case 'moderate':
      return 'honest';
    case 'contested':
      return 'contested_speed';
    case 'speed_duel':
      return 'contested_speed';
    case 'unknown':
      return 'unknown';
  }
}

/**
 * Convert tactical advantage level to legacy pace fit
 */
function toLegacyPaceFit(level: TacticalAdvantage['level']): PaceScoreResult['paceFit'] {
  switch (level) {
    case 'excellent':
      return 'perfect';
    case 'good':
      return 'good';
    case 'neutral':
      return 'neutral';
    case 'poor':
      return 'poor';
    case 'terrible':
      return 'terrible';
  }
}

/**
 * Convert pace scenario to expected pace
 */
function toExpectedPace(scenario: PaceScenarioType): 'fast' | 'moderate' | 'slow' {
  switch (scenario) {
    case 'soft':
      return 'slow';
    case 'moderate':
      return 'moderate';
    case 'contested':
      return 'fast';
    case 'speed_duel':
      return 'fast';
    case 'unknown':
      return 'moderate';
  }
}

// ============================================================================
// PACE CONFIDENCE (DATA COMPLETENESS PENALTIES - Phase 2)
// ============================================================================

/**
 * Get pace confidence multiplier based on data availability
 *
 * PENALTY LOGIC (Phase 2 - Missing Data Penalties):
 * - Has EP1/LP AND confirmed running style → 100% confidence (full scoring)
 * - Has EP1/LP BUT unknown running style → 75% confidence
 * - No EP1/LP BUT has running style → 50% confidence
 * - Neither EP1/LP nor running style → 35% confidence (penalized for unknown)
 *
 * This ensures horses with incomplete pace data are penalized,
 * not given neutral scores that reward unknowns.
 */
export function getPaceConfidenceMultiplier(hasEP1LP: boolean, hasRunningStyle: boolean): number {
  if (hasEP1LP && hasRunningStyle) return 1.0; // Full confidence
  if (hasEP1LP && !hasRunningStyle) return 0.75; // 75% - have figures but no style
  if (!hasEP1LP && hasRunningStyle) return 0.5; // 50% - have style but no figures
  return 0.35; // 35% - neither present
}

/**
 * Check if horse has valid EP1/LP pace figures
 */
function hasPaceFigures(profile: RunningStyleProfile | undefined): boolean {
  if (!profile?.paceFigures) return false;
  const pf = profile.paceFigures;
  // Consider having pace figures if either early or late pace is available
  return pf.avgEarlyPace !== null || pf.avgLatePace !== null;
}

/**
 * Check if horse has confirmed (non-unknown) running style
 */
function hasConfirmedRunningStyle(profile: RunningStyleProfile | undefined): boolean {
  if (!profile) return false;
  // Style is confirmed if it's not unknown and has reasonable confidence
  return profile.style !== 'U' && profile.confidence >= 40;
}

// ============================================================================
// FIELD PACE ANALYSIS
// ============================================================================

/**
 * Analyze the pace scenario for the entire field
 * Uses the new enhanced pace analysis system
 */
export function analyzeFieldPace(horses: HorseEntry[]): FieldPaceAnalysis {
  const activeHorses = horses.filter((h) => !h.isScratched);

  // Use new analysis system
  const analysis = analyzePaceScenario(activeHorses);

  // Count runners by style for legacy compatibility
  const speedCount = analysis.styleBreakdown.earlySpeed.length;
  const presserCount =
    analysis.styleBreakdown.pressers.length + analysis.styleBreakdown.sustained.length;
  const closerCount = analysis.styleBreakdown.closers.length;

  // Map to legacy format
  return {
    scenario: toLegacyScenario(analysis.scenario),
    scenarioDescription: analysis.description,
    speedCount,
    presserCount,
    closerCount,
    pacePressureIndex: analysis.ppi,
    expectedPace: toExpectedPace(analysis.scenario),
    // Include new detailed data
    paceScenarioType: analysis.scenario,
    styleBreakdown: analysis.styleBreakdown,
    // EP1-based pace pressure analysis (when available)
    pacePressure: analysis.pacePressure,
  };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate pace score for a horse
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Race information
 * @param allHorses - All horses in the race for field analysis
 * @param preCalculatedFieldAnalysis - Optional pre-calculated field analysis for efficiency
 * @returns Detailed score breakdown
 */
export function calculatePaceScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  allHorses: HorseEntry[],
  preCalculatedFieldAnalysis?: FieldPaceAnalysis
): PaceScoreResult {
  // Get enhanced pace analysis
  const paceScenario = preCalculatedFieldAnalysis?.paceScenarioType
    ? analyzePaceScenario(allHorses)
    : analyzePaceScenario(allHorses);

  const paceResult = analyzePaceForHorse(horse, allHorses, paceScenario);

  // Get running style profile
  const detailedProfile = paceResult.profile;
  const tacticalAdvantage = paceResult.tactical;

  // Convert to legacy PaceProfile for backwards compatibility
  const profile: PaceProfile = {
    style: toLegacyStyle(detailedProfile.style),
    styleName: detailedProfile.styleName,
    earlySpeedRating:
      detailedProfile.stats.avgFirstCallPosition < 3
        ? 80
        : detailedProfile.stats.avgFirstCallPosition < 5
          ? 60
          : 40,
    averageEarlyPosition: detailedProfile.stats.avgFirstCallPosition,
    isConfirmedStyle: detailedProfile.confidence >= 70,
  };

  // Get field analysis in legacy format
  const fieldAnalysis = preCalculatedFieldAnalysis ?? analyzeFieldPace(allHorses);

  // Get track speed bias and pace advantage rating
  let trackSpeedBias: number | null = null;
  let paceAdvantageRating: number | null = null;
  if (isTrackIntelligenceAvailable(raceHeader.trackCode)) {
    const speedBiasData = getSpeedBias(raceHeader.trackCode, raceHeader.surface);
    if (speedBiasData) {
      trackSpeedBias = speedBiasData.earlySpeedWinRate;
      paceAdvantageRating = speedBiasData.paceAdvantageRating; // 1-10 scale
    }
  }

  // Apply track bias adjustments using paceAdvantageRating for granular scoring
  // Model B: Rescaled from 40 max to 35 max (scale factor: 35/40 = 0.875)
  let finalScore = Math.round(paceResult.totalScore * 0.875); // Scale base tactical score

  // Track bias bonus/penalty based on paceAdvantageRating (1-10 scale)
  // Rating 1-3: Closer-friendly, 4-6: Fair, 7-10: Speed-favoring
  if (paceAdvantageRating !== null) {
    if (paceAdvantageRating >= 8 && detailedProfile.style === 'E') {
      // Extreme speed track (8-10) - big bonus for early speed
      finalScore = Math.min(35, finalScore + 5); // cap at 35
    } else if (paceAdvantageRating >= 7 && detailedProfile.style === 'E') {
      // Strong speed track (7) - moderate bonus for early speed
      finalScore = Math.min(35, finalScore + 2);
    } else if (paceAdvantageRating >= 8 && detailedProfile.style === 'C') {
      // Extreme speed track penalizes closers
      finalScore = Math.max(4, finalScore - 2);
    } else if (paceAdvantageRating <= 3 && detailedProfile.style === 'C') {
      // Closer-friendly track (1-3) - bonus for closers
      finalScore = Math.min(35, finalScore + 4); // cap at 35
    } else if (paceAdvantageRating <= 3 && detailedProfile.style === 'E') {
      // Closer-friendly track penalizes pure speed
      finalScore = Math.max(4, finalScore - 2);
    }
    // Pressers and stalkers get smaller adjustments
    if (paceAdvantageRating >= 7 && detailedProfile.style === 'P') {
      finalScore = Math.min(35, finalScore + 2);
    } else if (paceAdvantageRating <= 4 && detailedProfile.style === 'S') {
      finalScore = Math.min(35, finalScore + 2);
    }
  } else if (trackSpeedBias !== null) {
    // Fallback to earlySpeedWinRate if paceAdvantageRating not available
    if (trackSpeedBias >= 55 && detailedProfile.style === 'E') {
      finalScore = Math.min(35, finalScore + 2);
    } else if (trackSpeedBias <= 45 && detailedProfile.style === 'C') {
      finalScore = Math.min(35, finalScore + 2);
    }
  }

  // Calculate beaten lengths pace adjustments
  const beatenLengthsAdjustments = calculateBeatenLengthsAdjustments(horse);
  finalScore += beatenLengthsAdjustments.pacePoints;

  // Calculate seasonal adjustment (±2 pts refinement based on track patterns)
  // Extract month from race date (format: "YYYYMMDD" or "YYYY-MM-DD" or similar)
  let raceMonth = new Date().getMonth() + 1; // Default to current month
  if (raceHeader.raceDate) {
    const dateStr = raceHeader.raceDate.replace(/[^\d]/g, ''); // Remove non-digits
    if (dateStr.length >= 6) {
      const month = parseInt(dateStr.substring(4, 6), 10);
      if (month >= 1 && month <= 12) {
        raceMonth = month;
      }
    }
  }

  const seasonalAdjustment = getSeasonalAdjustment(
    raceHeader.trackCode,
    raceMonth,
    detailedProfile.style
  );

  // Apply seasonal adjustment (±2 pts max, doesn't change category limits)
  finalScore += seasonalAdjustment.adjustment;

  // PHASE 2: Apply pace confidence multiplier for data completeness
  // Penalize horses with missing EP1/LP figures or unknown running style
  const hasEP1LP = hasPaceFigures(detailedProfile);
  const hasRunningStyle = hasConfirmedRunningStyle(detailedProfile);
  const paceConfidenceMultiplier = getPaceConfidenceMultiplier(hasEP1LP, hasRunningStyle);

  // Apply multiplier to penalize incomplete data
  if (paceConfidenceMultiplier < 1.0) {
    finalScore = Math.round(finalScore * paceConfidenceMultiplier);
  }

  // Build reasoning
  let reasoning = buildReasoning(
    detailedProfile,
    paceResult.scenario,
    tacticalAdvantage,
    trackSpeedBias,
    paceAdvantageRating
  );

  // Add beaten lengths reasoning if applicable
  if (beatenLengthsAdjustments.pacePoints !== 0) {
    reasoning += ` | ${beatenLengthsAdjustments.paceReasoning}`;
  }

  // Add seasonal adjustment reasoning if applicable
  if (seasonalAdjustment.adjustment !== 0) {
    reasoning += ` | ${seasonalAdjustment.reasoning}`;
  }

  // PHASE 2: Add confidence info to reasoning if penalized
  if (paceConfidenceMultiplier < 1.0) {
    const maxPossible = Math.round(35 * paceConfidenceMultiplier);
    const dataStatus =
      !hasEP1LP && !hasRunningStyle
        ? 'no EP1/LP or style'
        : !hasEP1LP
          ? 'no EP1/LP figures'
          : 'unknown style';
    reasoning += ` | Confidence: ${Math.round(paceConfidenceMultiplier * 100)}% (${dataStatus}, max ${maxPossible} pts)`;
  }

  // Calculate pace figure adjustment for the result
  let paceFigureAdjustment: { points: number; reasoning: string } | undefined;
  if (detailedProfile.paceFigures && paceResult.scenario.pacePressure) {
    paceFigureAdjustment = calculatePaceFigureAdjustment(
      detailedProfile.paceFigures,
      paceResult.scenario.pacePressure,
      detailedProfile.style
    );
  }

  // PHASE 2: Build pace confidence info for data completeness tracking
  const paceConfidence = {
    hasEP1LP,
    hasRunningStyle,
    multiplier: paceConfidenceMultiplier,
    maxPossibleScore: Math.round(35 * paceConfidenceMultiplier),
    penaltyApplied: paceConfidenceMultiplier < 1.0,
  };

  return {
    total: Math.max(4, Math.min(35, finalScore)), // Model B: cap at 35
    profile,
    fieldAnalysis,
    paceFit: toLegacyPaceFit(tacticalAdvantage.level),
    trackSpeedBias,
    reasoning,
    // Enhanced data
    detailedProfile,
    tacticalAdvantage,
    paceScenarioAnalysis: paceResult.scenario,
    // Pace figure analysis (EP1/LP)
    paceFigures: detailedProfile.paceFigures,
    paceFigureAdjustment,
    // Beaten lengths analysis
    beatenLengthsPaceAdjustment: beatenLengthsAdjustments.pacePoints,
    beatenLengthsReasoning: beatenLengthsAdjustments.paceReasoning,
    // Seasonal track patterns
    seasonalAdjustment,
    // Phase 2: Pace confidence info
    paceConfidence,
  };
}

/**
 * Build reasoning string for pace score
 */
function buildReasoning(
  profile: RunningStyleProfile,
  scenario: PaceScenarioAnalysis,
  tactical: TacticalAdvantage,
  trackSpeedBias: number | null,
  paceAdvantageRating: number | null
): string {
  const parts: string[] = [];

  // Running style with evidence
  parts.push(
    `${profile.styleName} (${profile.stats.timesOnLead}/${profile.stats.totalRaces} led early)`
  );

  // Pace figures if available
  if (profile.paceFigures) {
    const pf = profile.paceFigures;
    if (pf.avgEarlyPace !== null || pf.avgLatePace !== null) {
      const figParts: string[] = [];
      if (pf.avgEarlyPace !== null) {
        figParts.push(`EP1: ${pf.avgEarlyPace}`);
      }
      if (pf.avgLatePace !== null) {
        figParts.push(`LP: ${pf.avgLatePace}`);
      }
      if (pf.hasClosingKick) {
        figParts.push(`kick: +${pf.closingKickDifferential}`);
      }
      parts.push(figParts.join(', '));
    }
  }

  // Pace scenario
  parts.push(scenario.label);

  // Tactical fit
  parts.push(
    `${tactical.level.charAt(0).toUpperCase() + tactical.level.slice(1)} fit: +${tactical.points}pts`
  );

  // Track bias - use paceAdvantageRating for more specific descriptions
  if (paceAdvantageRating !== null) {
    if (paceAdvantageRating >= 9) {
      parts.push('Extreme speed bias');
    } else if (paceAdvantageRating >= 7) {
      parts.push('Strong speed bias');
    } else if (paceAdvantageRating <= 3) {
      parts.push('Closer-friendly track');
    } else if (paceAdvantageRating <= 4) {
      parts.push('Fair-to-closing track');
    }
  } else if (trackSpeedBias !== null) {
    // Fallback to earlySpeedWinRate description
    if (trackSpeedBias >= 55) {
      parts.push('Speed-favoring track');
    } else if (trackSpeedBias <= 45) {
      parts.push('Closer-friendly track');
    }
  }

  return parts.join(' | ');
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get pace summary for quick display
 */
export function getPaceSummary(
  horse: HorseEntry,
  allHorses: HorseEntry[]
): { style: string; scenario: string; fit: string } {
  const profile = parseRunningStyle(horse);
  const scenario = analyzePaceScenario(allHorses);
  const tactical = calculateTacticalAdvantage(profile.style, scenario.scenario);

  return {
    style: profile.styleName,
    scenario: PACE_SCENARIO_LABELS[scenario.scenario],
    fit: tactical.level,
  };
}

/**
 * Calculate pace scores for all horses efficiently
 * Shares field analysis calculation
 */
export function calculateRacePaceScores(
  horses: HorseEntry[],
  raceHeader: RaceHeader
): Map<number, PaceScoreResult> {
  // Pre-calculate field analysis once
  const fieldAnalysis = analyzeFieldPace(horses);

  const results = new Map<number, PaceScoreResult>();

  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i];
    if (horse) {
      results.set(i, calculatePaceScore(horse, raceHeader, horses, fieldAnalysis));
    }
  }

  return results;
}

/**
 * Get enhanced pace display data for UI
 */
export function getEnhancedPaceDisplay(
  horse: HorseEntry,
  allHorses: HorseEntry[]
): {
  runningStyle: {
    code: RunningStyleCode;
    name: string;
    color: string;
    confidence: number;
    description: string;
  };
  scenario: {
    type: PaceScenarioType;
    label: string;
    color: string;
    ppi: number;
    description: string;
    breakdown: string;
  };
  tactical: {
    points: number;
    level: string;
    fit: string;
    reasoning: string;
  };
} {
  const profile = parseRunningStyle(horse);
  const scenario = analyzePaceScenario(allHorses);
  const tactical = calculateTacticalAdvantage(profile.style, scenario.scenario);
  const badge = getRunningStyleBadge(profile);

  return {
    runningStyle: {
      code: profile.style,
      name: profile.styleName,
      color: badge.color,
      confidence: profile.confidence,
      description: profile.description,
    },
    scenario: {
      type: scenario.scenario,
      label: scenario.label,
      color: scenario.color,
      ppi: scenario.ppi,
      description: scenario.description,
      breakdown: formatStyleBreakdown(scenario.styleBreakdown),
    },
    tactical: {
      points: tactical.points,
      level: tactical.level,
      fit: tactical.fit,
      reasoning: tactical.reasoning,
    },
  };
}
