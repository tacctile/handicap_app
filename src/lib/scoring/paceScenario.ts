/**
 * PACE SCENARIO DETECTION
 *
 * @deprecated This module is deprecated as of the Consolidated Pace Module update.
 * Pace scenario adjustments are now integrated directly into pace.ts (0-45 pts).
 * This file is kept for backwards compatibility with types and display purposes,
 * but the getPaceAdjustmentForHorse() function should no longer be used for scoring.
 *
 * The adjustment logic is now in:
 * - pace.ts: calculateIntegratedScenarioAdjustment()
 * - pace.ts: determineIntegratedScenario()
 *
 * Types and analysis functions are still exported for informational display.
 *
 * --- ORIGINAL DOCUMENTATION ---
 *
 * Analyzes field composition to identify pace advantages/disadvantages.
 * This is a field-relative tactical layer that adjusts scores based on
 * who is in today's field, not just individual pace ability.
 *
 * Running Style Definitions:
 * E  = Early speed, wants the lead, EP1 >= 92
 * EP = Early presser, can press the pace, EP1 85-91
 * P  = Presser/Stalker, sits mid-pack, EP1 75-84
 * S  = Closer/Sustained, comes from behind, EP1 < 75
 *
 * Historical Win Rates by Scenario:
 * - Lone E (only speed): 35-40% win rate
 * - E in speed duel (2+ E types): 15-20% win rate
 * - Closer in speed duel: 25-30% win rate
 * - Closer with no pace: 10-15% win rate (no setup)
 *
 * This is a purely algorithmic, deterministic replacement for AI pace analysis.
 * Same inputs always produce same outputs.
 *
 * @module paceScenario
 */

import type { HorseEntry, PastPerformance } from '../../types/drf';
import {
  PACE_SCENARIO_CONFIG,
  PACE_SCENARIO_DEFINITIONS,
  RUNNING_STYLE_DEFINITIONS,
} from './constants/paceScenario';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Running style classification based on EP1 figures
 */
export type PaceRunningStyle = 'E' | 'EP' | 'P' | 'S' | 'UNKNOWN';

/**
 * Pace scenario classification
 */
export type PaceScenario =
  | 'LONE_SPEED' // One E type, huge advantage
  | 'SPEED_DUEL' // 2 E types, likely pace collapse
  | 'CONTESTED' // 2+ EP types pressuring
  | 'HONEST' // Normal pace, fair for all
  | 'SLOW' // No speed, closers disadvantaged
  | 'CHAOTIC'; // 3+ speed types, unpredictable

/**
 * Confidence level for pace scenario analysis
 */
export type PaceScenarioConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Horse with classified running style
 */
export interface HorseStyleData {
  programNumber: number;
  horseName: string;
  style: PaceRunningStyle;
  ep1Average: number | null;
}

/**
 * Beneficiary of the pace scenario
 */
export interface PaceBeneficiary {
  programNumber: number;
  horseName: string;
  advantage: string;
  adjustment: number; // Points to add
}

/**
 * Disadvantaged by the pace scenario
 */
export interface PaceDisadvantaged {
  programNumber: number;
  horseName: string;
  disadvantage: string;
  adjustment: number; // Points to subtract (negative)
}

/**
 * Complete pace scenario analysis result
 */
export interface PaceScenarioResult {
  scenario: PaceScenario;
  confidence: PaceScenarioConfidence;

  // Field composition
  earlySpeedCount: number; // E types
  presserCount: number; // EP types
  stalkerCount: number; // P types
  closerCount: number; // S types
  unknownCount: number;

  // Key horses
  likelyLeader: number | null; // Program number
  speedDuelParticipants: number[];

  // Beneficiaries and disadvantaged
  beneficiaries: PaceBeneficiary[];
  disadvantaged: PaceDisadvantaged[];

  // Horse style data for reference
  horseStyles: HorseStyleData[];

  reason: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate average EP1 (early pace figure) from recent past performances
 *
 * @param pastPerformances - Array of past performances
 * @returns Average EP1 or null if insufficient data
 */
export function getAverageEP1(pastPerformances: PastPerformance[]): number | null {
  const recentPPs = pastPerformances.slice(0, PACE_SCENARIO_CONFIG.RECENT_PP_COUNT);

  const ep1Values = recentPPs
    .map((pp) => pp.earlyPace1)
    .filter((v): v is number => v !== null && v !== undefined && v > 0);

  if (ep1Values.length === 0) return null;

  const sum = ep1Values.reduce((a, b) => a + b, 0);
  return Math.round((sum / ep1Values.length) * 10) / 10;
}

/**
 * Classify running style based on EP1 figure
 *
 * @param horse - The horse entry to classify
 * @returns Running style classification
 */
export function classifyRunningStyle(horse: HorseEntry): PaceRunningStyle {
  // Use EP1 (early pace figure) as primary indicator
  const ep1 = getAverageEP1(horse.pastPerformances);

  // Also check explicit running style if available in DRF
  const explicitStyle = horse.runningStyle;

  if (ep1 === null && !explicitStyle) return 'UNKNOWN';

  // EP1-based classification (takes priority)
  if (ep1 !== null) {
    if (ep1 >= PACE_SCENARIO_CONFIG.EP1_EARLY_SPEED) return 'E';
    if (ep1 >= PACE_SCENARIO_CONFIG.EP1_PRESSER) return 'EP';
    if (ep1 >= PACE_SCENARIO_CONFIG.EP1_STALKER) return 'P';
    return 'S';
  }

  // Fallback to explicit style from DRF
  if (explicitStyle) {
    const style = explicitStyle.toUpperCase();
    if (style === 'E' || style.includes('EARLY')) return 'E';
    if (style === 'EP' || style.includes('PRESS')) return 'EP';
    if (style === 'P' || style.includes('STALK')) return 'P';
    if (style === 'S' || style === 'C' || style.includes('CLOS')) return 'S';
  }

  return 'UNKNOWN';
}

/**
 * Determine the pace scenario based on field composition
 *
 * @param earlySpeed - Number of E types
 * @param pressers - Number of EP types
 * @param stalkers - Number of P types
 * @param closers - Number of S types
 * @returns Pace scenario classification
 */
export function determineScenario(
  earlySpeed: number,
  pressers: number,
  _stalkers: number,
  _closers: number
): PaceScenario {
  // Chaotic: 3+ early speed types
  if (earlySpeed >= 3) {
    return 'CHAOTIC';
  }

  // Speed duel: 2 E types
  if (earlySpeed === 2) {
    return 'SPEED_DUEL';
  }

  // Lone speed: exactly 1 E type, 0-1 EP types
  if (earlySpeed === 1 && pressers <= 1) {
    return 'LONE_SPEED';
  }

  // Contested: 1 E with 2+ EP, or 0 E with 3+ EP
  if ((earlySpeed === 1 && pressers >= 2) || (earlySpeed === 0 && pressers >= 3)) {
    return 'CONTESTED';
  }

  // Slow: no E types and 0-1 EP types
  if (earlySpeed === 0 && pressers <= 1) {
    return 'SLOW';
  }

  // Default: honest pace
  return 'HONEST';
}

/**
 * Calculate pace adjustments for all horses based on scenario
 *
 * @param horseStyles - Array of horses with their styles
 * @param scenario - The pace scenario
 * @returns Beneficiaries and disadvantaged horses
 */
export function calculatePaceAdjustments(
  horseStyles: HorseStyleData[],
  scenario: PaceScenario
): { beneficiaries: PaceBeneficiary[]; disadvantaged: PaceDisadvantaged[] } {
  const beneficiaries: PaceBeneficiary[] = [];
  const disadvantaged: PaceDisadvantaged[] = [];

  for (const { programNumber, horseName, style } of horseStyles) {
    let adjustment = 0;
    let reason = '';

    switch (scenario) {
      case 'LONE_SPEED':
        if (style === 'E') {
          adjustment = PACE_SCENARIO_CONFIG.LONE_SPEED_BONUS;
          reason = 'Lone speed, unchallenged lead';
          beneficiaries.push({
            programNumber,
            horseName,
            advantage: reason,
            adjustment,
          });
        } else if (style === 'S') {
          adjustment = PACE_SCENARIO_CONFIG.LONE_SPEED_CLOSER_PENALTY;
          reason = 'Closer with no pace setup';
          disadvantaged.push({
            programNumber,
            horseName,
            disadvantage: reason,
            adjustment,
          });
        }
        break;

      case 'SPEED_DUEL':
        if (style === 'E') {
          adjustment = PACE_SCENARIO_CONFIG.SPEED_DUEL_PENALTY;
          reason = 'Speed duel participant, likely to tire';
          disadvantaged.push({
            programNumber,
            horseName,
            disadvantage: reason,
            adjustment,
          });
        } else if (style === 'S' || style === 'P') {
          adjustment = PACE_SCENARIO_CONFIG.SPEED_DUEL_CLOSER_BONUS;
          reason = 'Benefits from pace collapse';
          beneficiaries.push({
            programNumber,
            horseName,
            advantage: reason,
            adjustment,
          });
        }
        break;

      case 'CHAOTIC':
        if (style === 'E') {
          adjustment = PACE_SCENARIO_CONFIG.CHAOTIC_SPEED_PENALTY;
          reason = 'Chaotic pace, 3+ speed types fighting';
          disadvantaged.push({
            programNumber,
            horseName,
            disadvantage: reason,
            adjustment,
          });
        } else if (style === 'S') {
          adjustment = PACE_SCENARIO_CONFIG.CHAOTIC_CLOSER_BONUS;
          reason = 'Chaotic pace benefits deep closers';
          beneficiaries.push({
            programNumber,
            horseName,
            advantage: reason,
            adjustment,
          });
        } else if (style === 'P') {
          adjustment = PACE_SCENARIO_CONFIG.CHAOTIC_STALKER_BONUS;
          reason = 'Stalker benefits from pace meltdown';
          beneficiaries.push({
            programNumber,
            horseName,
            advantage: reason,
            adjustment,
          });
        }
        break;

      case 'SLOW':
        if (style === 'EP' || style === 'P') {
          adjustment = PACE_SCENARIO_CONFIG.SLOW_PRESSER_BONUS;
          reason = 'Can control slow pace';
          beneficiaries.push({
            programNumber,
            horseName,
            advantage: reason,
            adjustment,
          });
        } else if (style === 'S') {
          adjustment = PACE_SCENARIO_CONFIG.SLOW_CLOSER_PENALTY;
          reason = 'No pace to close into';
          disadvantaged.push({
            programNumber,
            horseName,
            disadvantage: reason,
            adjustment,
          });
        }
        break;

      case 'CONTESTED':
        if (style === 'E') {
          adjustment = PACE_SCENARIO_CONFIG.CONTESTED_SPEED_PENALTY;
          reason = 'Pace will be contested';
          disadvantaged.push({
            programNumber,
            horseName,
            disadvantage: reason,
            adjustment,
          });
        } else if (style === 'P' || style === 'S') {
          adjustment = PACE_SCENARIO_CONFIG.CONTESTED_CLOSER_BONUS;
          reason = 'Should get honest pace';
          beneficiaries.push({
            programNumber,
            horseName,
            advantage: reason,
            adjustment,
          });
        }
        break;

      case 'HONEST':
        // No adjustments - fair pace for all
        break;
    }
  }

  return { beneficiaries, disadvantaged };
}

/**
 * Calculate confidence level based on data quality
 *
 * @param horseStyles - Array of horses with their styles
 * @param scenario - The pace scenario
 * @returns Confidence level
 */
export function calculatePaceConfidence(
  horseStyles: HorseStyleData[],
  scenario: PaceScenario
): PaceScenarioConfidence {
  const unknownCount = horseStyles.filter((h) => h.style === 'UNKNOWN').length;
  const totalHorses = horseStyles.length;

  if (totalHorses === 0) return 'LOW';

  const unknownPct = unknownCount / totalHorses;

  // Low confidence if too many unknowns
  if (unknownPct > PACE_SCENARIO_CONFIG.LOW_CONFIDENCE_MAX_UNKNOWN_PCT) return 'LOW';

  // High confidence for clear scenarios with good data
  if (scenario === 'LONE_SPEED' || scenario === 'CHAOTIC') {
    return unknownPct < PACE_SCENARIO_CONFIG.HIGH_CONFIDENCE_MAX_UNKNOWN_PCT ? 'HIGH' : 'MEDIUM';
  }

  // Medium confidence for most scenarios
  if (unknownPct < PACE_SCENARIO_CONFIG.MEDIUM_CONFIDENCE_MAX_UNKNOWN_PCT) return 'MEDIUM';

  return 'LOW';
}

/**
 * Generate human-readable reason for the pace scenario
 *
 * @param scenario - The pace scenario
 * @param earlySpeed - Number of E types
 * @param pressers - Number of EP types
 * @returns Reason string
 */
export function generatePaceReason(
  scenario: PaceScenario,
  earlySpeed: number,
  pressers: number
): string {
  switch (scenario) {
    case 'LONE_SPEED':
      return `Lone speed (1 E-type), unchallenged early`;
    case 'SPEED_DUEL':
      return `Speed duel (${earlySpeed} E-types), pace collapse likely`;
    case 'CHAOTIC':
      return `Chaotic pace (${earlySpeed} E-types), unpredictable`;
    case 'CONTESTED':
      return `Contested pace (${pressers} pressers), honest tempo`;
    case 'SLOW':
      return `Slow pace expected, no early speed`;
    case 'HONEST':
      return `Honest pace, fair for all running styles`;
    default:
      return 'Pace scenario unclear';
  }
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze pace scenario for a race field
 *
 * Examines the running style composition of all horses in the field
 * to identify tactical advantages and disadvantages.
 *
 * @param horses - Array of horse entries in the race
 * @returns Complete pace scenario analysis
 */
export function analyzePaceScenario(horses: HorseEntry[]): PaceScenarioResult {
  // Filter out scratched horses
  const activeHorses = horses.filter((h) => !h.isScratched);

  // Classify all horses
  const horseStyles: HorseStyleData[] = activeHorses.map((horse) => ({
    programNumber: horse.programNumber,
    horseName: horse.horseName,
    style: classifyRunningStyle(horse),
    ep1Average: getAverageEP1(horse.pastPerformances),
  }));

  // Count by style
  const earlySpeedCount = horseStyles.filter((h) => h.style === 'E').length;
  const presserCount = horseStyles.filter((h) => h.style === 'EP').length;
  const stalkerCount = horseStyles.filter((h) => h.style === 'P').length;
  const closerCount = horseStyles.filter((h) => h.style === 'S').length;
  const unknownCount = horseStyles.filter((h) => h.style === 'UNKNOWN').length;

  // Determine scenario
  const scenario = determineScenario(earlySpeedCount, presserCount, stalkerCount, closerCount);

  // Identify likely leader (highest EP1 among E/EP types)
  const speedHorses = horseStyles
    .filter((h) => h.style === 'E' || h.style === 'EP')
    .filter((h) => h.ep1Average !== null)
    .sort((a, b) => (b.ep1Average || 0) - (a.ep1Average || 0));
  const likelyLeader = speedHorses[0]?.programNumber ?? null;

  // Speed duel participants (all E types if 2+)
  const speedDuelParticipants =
    earlySpeedCount >= 2
      ? horseStyles.filter((h) => h.style === 'E').map((h) => h.programNumber)
      : [];

  // Calculate beneficiaries and disadvantaged
  const { beneficiaries, disadvantaged } = calculatePaceAdjustments(horseStyles, scenario);

  // Determine confidence
  const confidence = calculatePaceConfidence(horseStyles, scenario);

  // Generate reason
  const reason = generatePaceReason(scenario, earlySpeedCount, presserCount);

  return {
    scenario,
    confidence,
    earlySpeedCount,
    presserCount,
    stalkerCount,
    closerCount,
    unknownCount,
    likelyLeader,
    speedDuelParticipants,
    beneficiaries,
    disadvantaged,
    horseStyles,
    reason,
  };
}

/**
 * Get the pace adjustment for a specific horse
 *
 * @param result - Pace scenario result
 * @param programNumber - Horse's program number
 * @returns Adjustment points (positive or negative) or 0 if none
 */
export function getPaceAdjustmentForHorse(
  result: PaceScenarioResult,
  programNumber: number
): number {
  // Check beneficiaries first
  const beneficiary = result.beneficiaries.find((b) => b.programNumber === programNumber);
  if (beneficiary) return beneficiary.adjustment;

  // Check disadvantaged
  const disadvantagedHorse = result.disadvantaged.find((d) => d.programNumber === programNumber);
  if (disadvantagedHorse) return disadvantagedHorse.adjustment;

  return 0;
}

/**
 * Get running style for a specific horse
 *
 * @param result - Pace scenario result
 * @param programNumber - Horse's program number
 * @returns Running style or UNKNOWN if not found
 */
export function getHorseRunningStyle(
  result: PaceScenarioResult,
  programNumber: number
): PaceRunningStyle {
  const horse = result.horseStyles.find((h) => h.programNumber === programNumber);
  return horse?.style ?? 'UNKNOWN';
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Log pace scenario analysis for debugging
 *
 * @param result - Pace scenario result
 */
export function logPaceScenarioAnalysis(result: PaceScenarioResult): void {
  console.log('[PACE_SCENARIO] Field composition:');
  console.log(`  E (early speed): ${result.earlySpeedCount}`);
  console.log(`  EP (pressers): ${result.presserCount}`);
  console.log(`  P (stalkers): ${result.stalkerCount}`);
  console.log(`  S (closers): ${result.closerCount}`);
  console.log(`  Unknown: ${result.unknownCount}`);
  console.log(`[PACE_SCENARIO] ${result.scenario} (${result.confidence})`);
  console.log(`[PACE_SCENARIO] ${result.reason}`);

  if (result.likelyLeader !== null) {
    console.log(`[PACE_SCENARIO] Likely leader: #${result.likelyLeader}`);
  }

  if (result.speedDuelParticipants.length > 0) {
    console.log(
      `[PACE_SCENARIO] Speed duel participants: ${result.speedDuelParticipants.map((n) => `#${n}`).join(', ')}`
    );
  }

  for (const ben of result.beneficiaries) {
    console.log(`[PACE_SCENARIO] +${ben.adjustment} ${ben.horseName}: ${ben.advantage}`);
  }

  for (const dis of result.disadvantaged) {
    console.log(`[PACE_SCENARIO] ${dis.adjustment} ${dis.horseName}: ${dis.disadvantage}`);
  }
}

// ============================================================================
// DISPLAY UTILITIES
// ============================================================================

/**
 * Get scenario display info
 *
 * @param scenario - The pace scenario
 * @returns Display information
 */
export function getScenarioDisplayInfo(scenario: PaceScenario): {
  name: string;
  description: string;
  color: string;
} {
  const info = PACE_SCENARIO_DEFINITIONS[scenario];
  return {
    name: info.name,
    description: info.description,
    color: info.color,
  };
}

/**
 * Get running style display info
 *
 * @param style - The running style
 * @returns Display information
 */
export function getStyleDisplayInfo(style: PaceRunningStyle): {
  name: string;
  description: string;
  shortName: string;
} {
  const info = RUNNING_STYLE_DEFINITIONS[style];
  return {
    name: info.name,
    description: info.description,
    shortName: info.shortName,
  };
}

/**
 * Format pace scenario summary for UI display
 *
 * @param result - Pace scenario result
 * @returns Formatted summary string
 */
export function formatPaceScenarioSummary(result: PaceScenarioResult): string {
  const info = getScenarioDisplayInfo(result.scenario);
  const adjusted = result.beneficiaries.length + result.disadvantaged.length;
  return `${info.name}: ${result.reason} (${adjusted} horses affected)`;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { PACE_SCENARIO_CONFIG, PACE_SCENARIO_DEFINITIONS, RUNNING_STYLE_DEFINITIONS };
