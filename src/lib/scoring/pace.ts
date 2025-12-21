/**
 * Pace Scoring Module
 * Analyzes pace scenarios and running style matchups
 *
 * Score Range: 0-40 points
 *
 * Integrates with paceAnalysis.ts for comprehensive pace detection:
 * - Running Style Classification (E, P, C, S)
 * - Pace Pressure Index (PPI) calculation
 * - Tactical advantage scoring based on pace scenario
 *
 * Pace Scenario Scoring (from tactical advantage):
 * - Perfect pace fit (e.g., lone speed in soft pace): 25+ pts base + bonuses
 * - Good pace fit (e.g., presser in hot pace): 18-24 pts
 * - Neutral fit: 12-17 pts
 * - Poor fit (e.g., closer in soft pace): 5-11 pts
 * - Terrible fit: 0-4 pts
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import { getSpeedBias, isTrackIntelligenceAvailable } from '../trackIntelligence';
import {
  parseRunningStyle,
  analyzePaceScenario,
  calculateTacticalAdvantage,
  analyzePaceForHorse,
  formatStyleBreakdown,
  getPaceScenarioSummary,
  getRunningStyleBadge,
  type RunningStyleCode,
  type RunningStyleProfile,
  type PaceScenarioType,
  type PaceScenarioAnalysis,
  type TacticalAdvantage,
  type PaceAnalysisResult,
  RUNNING_STYLE_NAMES,
  PACE_SCENARIO_LABELS,
  PACE_SCENARIO_COLORS,
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
  type RunningStyleCode,
  type RunningStyleProfile,
  type PaceScenarioType,
  type PaceScenarioAnalysis,
  type TacticalAdvantage,
  type PaceAnalysisResult,
  RUNNING_STYLE_NAMES,
  PACE_SCENARIO_LABELS,
  PACE_SCENARIO_COLORS,
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

  // Get track speed bias
  let trackSpeedBias: number | null = null;
  if (isTrackIntelligenceAvailable(raceHeader.trackCode)) {
    const speedBiasData = getSpeedBias(raceHeader.trackCode, raceHeader.surface);
    if (speedBiasData) {
      trackSpeedBias = speedBiasData.earlySpeedWinRate;
    }
  }

  // Apply track bias adjustments
  let finalScore = paceResult.totalScore;

  // Track bias bonus/penalty
  if (trackSpeedBias !== null) {
    if (trackSpeedBias >= 55 && detailedProfile.style === 'E') {
      finalScore = Math.min(40, finalScore + 3); // Speed-favoring track bonus for speed
    } else if (trackSpeedBias <= 45 && detailedProfile.style === 'C') {
      finalScore = Math.min(40, finalScore + 3); // Closer-friendly track bonus
    }
  }

  // Build reasoning
  const reasoning = buildReasoning(
    detailedProfile,
    paceResult.scenario,
    tacticalAdvantage,
    trackSpeedBias
  );

  return {
    total: Math.max(5, Math.min(40, finalScore)),
    profile,
    fieldAnalysis,
    paceFit: toLegacyPaceFit(tacticalAdvantage.level),
    trackSpeedBias,
    reasoning,
    // Enhanced data
    detailedProfile,
    tacticalAdvantage,
    paceScenarioAnalysis: paceResult.scenario,
  };
}

/**
 * Build reasoning string for pace score
 */
function buildReasoning(
  profile: RunningStyleProfile,
  scenario: PaceScenarioAnalysis,
  tactical: TacticalAdvantage,
  trackSpeedBias: number | null
): string {
  const parts: string[] = [];

  // Running style with evidence
  parts.push(
    `${profile.styleName} (${profile.stats.timesOnLead}/${profile.stats.totalRaces} led early)`
  );

  // Pace scenario
  parts.push(scenario.label);

  // Tactical fit
  parts.push(
    `${tactical.level.charAt(0).toUpperCase() + tactical.level.slice(1)} fit: +${tactical.points}pts`
  );

  // Track bias
  if (trackSpeedBias !== null) {
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
    results.set(i, calculatePaceScore(horses[i], raceHeader, horses, fieldAnalysis));
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
