/**
 * Pace Scoring Module
 * Analyzes pace scenarios and running style matchups
 *
 * Score Range: 0-45 points (v2.0 - increased from 40)
 * 18.8% of 240 base score - High predictive value for race shape
 *
 * Integrates with paceAnalysis.ts for comprehensive pace detection:
 * - Running Style Classification (E, P, C, S)
 * - Pace Pressure Index (PPI) calculation
 * - Tactical advantage scoring based on pace scenario
 *
 * Pace Scenario Scoring (from tactical advantage, rescaled by 45/40 = 1.125):
 * - Perfect pace fit (e.g., lone speed in soft pace): 28+ pts base + bonuses
 * - Good pace fit (e.g., presser in hot pace): 20-27 pts
 * - Neutral fit: 14-19 pts
 * - Poor fit (e.g., closer in soft pace): 6-13 pts
 * - Terrible fit: 0-5 pts
 *
 * NOTE: Pace increased from 40 to 45 points to reflect industry research
 * showing high predictive value of pace scenario analysis.
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import { getSpeedBias, isTrackIntelligenceAvailable } from '../trackIntelligence';
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
  // Rescaled from 40 max to 45 max (scale factor: 45/40 = 1.125)
  let finalScore = Math.round(paceResult.totalScore * 1.125); // Scale base tactical score

  // Track bias bonus/penalty based on paceAdvantageRating (1-10 scale)
  // Rating 1-3: Closer-friendly, 4-6: Fair, 7-10: Speed-favoring
  if (paceAdvantageRating !== null) {
    if (paceAdvantageRating >= 8 && detailedProfile.style === 'E') {
      // Extreme speed track (8-10) - big bonus for early speed
      finalScore = Math.min(45, finalScore + 6); // was +5, cap at 45
    } else if (paceAdvantageRating >= 7 && detailedProfile.style === 'E') {
      // Strong speed track (7) - moderate bonus for early speed
      finalScore = Math.min(45, finalScore + 3);
    } else if (paceAdvantageRating >= 8 && detailedProfile.style === 'C') {
      // Extreme speed track penalizes closers
      finalScore = Math.max(5, finalScore - 3);
    } else if (paceAdvantageRating <= 3 && detailedProfile.style === 'C') {
      // Closer-friendly track (1-3) - bonus for closers
      finalScore = Math.min(45, finalScore + 5); // was +4, cap at 45
    } else if (paceAdvantageRating <= 3 && detailedProfile.style === 'E') {
      // Closer-friendly track penalizes pure speed
      finalScore = Math.max(5, finalScore - 2);
    }
    // Pressers and stalkers get smaller adjustments
    if (paceAdvantageRating >= 7 && detailedProfile.style === 'P') {
      finalScore = Math.min(45, finalScore + 2);
    } else if (paceAdvantageRating <= 4 && detailedProfile.style === 'S') {
      finalScore = Math.min(45, finalScore + 2);
    }
  } else if (trackSpeedBias !== null) {
    // Fallback to earlySpeedWinRate if paceAdvantageRating not available
    if (trackSpeedBias >= 55 && detailedProfile.style === 'E') {
      finalScore = Math.min(45, finalScore + 3);
    } else if (trackSpeedBias <= 45 && detailedProfile.style === 'C') {
      finalScore = Math.min(45, finalScore + 3);
    }
  }

  // Calculate beaten lengths pace adjustments
  const beatenLengthsAdjustments = calculateBeatenLengthsAdjustments(horse);
  finalScore += beatenLengthsAdjustments.pacePoints;

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

  // Calculate pace figure adjustment for the result
  let paceFigureAdjustment: { points: number; reasoning: string } | undefined;
  if (detailedProfile.paceFigures && paceResult.scenario.pacePressure) {
    paceFigureAdjustment = calculatePaceFigureAdjustment(
      detailedProfile.paceFigures,
      paceResult.scenario.pacePressure,
      detailedProfile.style
    );
  }

  return {
    total: Math.max(5, Math.min(45, finalScore)), // was 40
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
