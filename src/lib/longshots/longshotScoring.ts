/**
 * Longshot Scoring Module
 *
 * Calculates nuclear longshot viability by combining:
 * - Base score (must be 100+ to not be complete trash)
 * - Odds (must be 25/1+)
 * - Upset angles (must have 2+ angles = 60+ points)
 *
 * Classifications:
 * - NUCLEAR (100+ angle pts): Serious upset candidate, bet
 * - LIVE (60-99 angle pts): Playable longshot, small bet
 * - LOTTERY (40-59 angle pts): Low probability, pass unless massive field
 * - DEAD (0-39 angle pts): No chance, ignore
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { HorseScore } from '../scoring';
import {
  type LongshotAnalysisResult,
  type LongshotClassification,
  type DetectedUpsetAngle,
  MIN_BASE_SCORE,
  MIN_LONGSHOT_ODDS_DECIMAL,
  LONGSHOT_CLASSIFICATION_META,
  parseOddsToDecimal,
  formatOddsDisplay,
  getClassificationFromPoints,
  calculateUpsetProbability,
  calculateExpectedValue,
} from './longshotTypes';
import { detectAllUpsetAngles } from './longshotDetector';
import {
  analyzePaceScenario,
  parseRunningStyle,
  type PaceScenarioAnalysis,
} from '../scoring/paceAnalysis';
import { calculateClassScore } from '../class/classScoring';
import { calculateEquipmentImpactScore } from '../equipment/equipmentScoring';
import { logger } from '../../services/logging';

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate total angle points from detected angles
 */
export function calculateTotalAnglePoints(angles: DetectedUpsetAngle[]): number {
  return angles.reduce((sum, angle) => sum + angle.points, 0);
}

/**
 * Generate summary description based on angles
 */
function generateSummary(
  angles: DetectedUpsetAngle[],
  classification: LongshotClassification,
  oddsDisplay: string
): string {
  if (angles.length === 0) {
    return `No upset angles at ${oddsDisplay} - just a longshot`;
  }

  const angleNames = angles.map((a) => a.name).join(' + ');

  switch (classification) {
    case 'nuclear':
      return `NUCLEAR VALUE at ${oddsDisplay}: ${angleNames}`;
    case 'live':
      return `Live longshot at ${oddsDisplay}: ${angleNames}`;
    case 'lottery':
      return `Lottery ticket at ${oddsDisplay}: ${angleNames}`;
    case 'dead':
      return `No real angle at ${oddsDisplay}`;
  }
}

/**
 * Generate detailed reasoning for display
 */
function generateReasoning(
  angles: DetectedUpsetAngle[],
  baseScore: number,
  classification: LongshotClassification
): string[] {
  const reasoning: string[] = [];

  if (baseScore < MIN_BASE_SCORE) {
    reasoning.push(`Base score ${baseScore} below minimum ${MIN_BASE_SCORE}`);
  } else {
    reasoning.push(`Base score ${baseScore} meets minimum threshold`);
  }

  if (angles.length === 0) {
    reasoning.push('No upset angles detected');
    return reasoning;
  }

  reasoning.push(`${angles.length} upset angle(s) detected:`);

  for (const angle of angles) {
    reasoning.push(`• ${angle.name} (+${angle.points} pts): ${angle.evidence}`);
  }

  const totalPoints = calculateTotalAnglePoints(angles);
  reasoning.push(`Total angle points: ${totalPoints}`);
  reasoning.push(`Classification: ${LONGSHOT_CLASSIFICATION_META[classification].name}`);
  reasoning.push(LONGSHOT_CLASSIFICATION_META[classification].recommendation);

  return reasoning;
}

/**
 * Get bet recommendation based on analysis
 */
function getBetRecommendation(
  classification: LongshotClassification,
  angles: DetectedUpsetAngle[],
  oddsDisplay: string,
  ev: number
): string | null {
  if (classification === 'dead' || classification === 'lottery') {
    return null;
  }

  const angleNames = angles
    .slice(0, 2)
    .map((a) => a.name)
    .join(' + ');

  if (classification === 'nuclear') {
    return `VALUE BOMB: $5 Win at ${oddsDisplay}. ${angleNames}. EV: ${ev.toFixed(2)}x`;
  }

  if (classification === 'live') {
    return `Small play: $2 Win at ${oddsDisplay}. ${angleNames}. EV: ${ev.toFixed(2)}x`;
  }

  return null;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a single horse for longshot potential
 */
export function analyzeLongshot(
  horse: HorseEntry,
  allHorses: HorseEntry[],
  raceHeader: RaceHeader,
  score: HorseScore,
  paceScenario?: PaceScenarioAnalysis
): LongshotAnalysisResult {
  try {
    // Parse odds
    const oddsDecimal = parseOddsToDecimal(horse.morningLineOdds);
    const oddsDisplay = horse.morningLineOdds || formatOddsDisplay(oddsDecimal);

    // Check if qualifies as longshot
    const isLongshot = oddsDecimal >= MIN_LONGSHOT_ODDS_DECIMAL;
    const meetsBaseScoreMinimum = score.total >= MIN_BASE_SCORE;

    // If not a longshot, return early
    if (!isLongshot) {
      return {
        programNumber: horse.programNumber,
        horseName: horse.horseName,
        oddsDecimal,
        oddsDisplay,
        isLongshot: false,
        baseScore: score.total,
        meetsBaseScoreMinimum,
        detectedAngles: [],
        totalAnglePoints: 0,
        angleCount: 0,
        classification: 'dead',
        classificationMeta: LONGSHOT_CLASSIFICATION_META.dead,
        upsetProbability: 0,
        expectedValue: -1,
        roiMultiplier: 0,
        summary: 'Not a longshot (odds below 25/1)',
        reasoning: ['Odds below 25/1 threshold'],
        shouldFlag: false,
        betRecommendation: null,
      };
    }

    // Get or calculate pace scenario
    const scenario = paceScenario || analyzePaceScenario(allHorses);

    // Get running style
    const runningStyle = parseRunningStyle(horse);

    // Calculate class and equipment scores
    const classScore = calculateClassScore(horse, raceHeader);
    const equipmentScore = calculateEquipmentImpactScore(horse, raceHeader);

    // Detect all upset angles
    const detectedAngles = detectAllUpsetAngles(
      horse,
      allHorses,
      raceHeader,
      scenario,
      runningStyle,
      classScore,
      equipmentScore
    );

    // Calculate totals
    const totalAnglePoints = calculateTotalAnglePoints(detectedAngles);
    const angleCount = detectedAngles.length;

    // Determine classification
    const classification = getClassificationFromPoints(totalAnglePoints);
    const classificationMeta = LONGSHOT_CLASSIFICATION_META[classification];

    // Calculate probabilities
    const upsetProbability = calculateUpsetProbability(totalAnglePoints);
    const expectedValue = calculateExpectedValue(oddsDecimal, upsetProbability);
    const roiMultiplier = oddsDecimal * upsetProbability;

    // Generate outputs
    const summary = generateSummary(detectedAngles, classification, oddsDisplay);
    const reasoning = generateReasoning(detectedAngles, score.total, classification);

    // Determine if should flag
    const shouldFlag =
      classification === 'nuclear' || (classification === 'live' && expectedValue > 0);

    // Get bet recommendation
    const betRecommendation = getBetRecommendation(
      classification,
      detectedAngles,
      oddsDisplay,
      expectedValue
    );

    // Log nuclear detections
    if (classification === 'nuclear') {
      logger.logInfo('Nuclear longshot detected', {
        component: 'longshotScoring',
        horseName: horse.horseName,
        programNumber: horse.programNumber,
        totalAnglePoints,
        angleCount,
      });
    }

    return {
      programNumber: horse.programNumber,
      horseName: horse.horseName,
      oddsDecimal,
      oddsDisplay,
      isLongshot: true,
      baseScore: score.total,
      meetsBaseScoreMinimum,
      detectedAngles,
      totalAnglePoints,
      angleCount,
      classification,
      classificationMeta,
      upsetProbability,
      expectedValue,
      roiMultiplier,
      summary,
      reasoning,
      shouldFlag,
      betRecommendation,
    };
  } catch (error) {
    logger.logWarning('Error analyzing longshot', {
      component: 'longshotScoring',
      horseName: horse.horseName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return safe default
    return {
      programNumber: horse.programNumber,
      horseName: horse.horseName,
      oddsDecimal: 0,
      oddsDisplay: horse.morningLineOdds || 'N/A',
      isLongshot: false,
      baseScore: score.total,
      meetsBaseScoreMinimum: false,
      detectedAngles: [],
      totalAnglePoints: 0,
      angleCount: 0,
      classification: 'dead',
      classificationMeta: LONGSHOT_CLASSIFICATION_META.dead,
      upsetProbability: 0,
      expectedValue: -1,
      roiMultiplier: 0,
      summary: 'Analysis error',
      reasoning: ['Error during longshot analysis'],
      shouldFlag: false,
      betRecommendation: null,
    };
  }
}

// ============================================================================
// RACE-LEVEL ANALYSIS
// ============================================================================

/**
 * Race-level longshot summary
 */
export interface RaceLongshotSummary {
  /** Total longshots in race (25/1+) */
  longshotCount: number;
  /** Nuclear longshots (serious upset candidates) */
  nuclearLongshots: LongshotAnalysisResult[];
  /** Live longshots (playable) */
  liveLongshots: LongshotAnalysisResult[];
  /** All longshot analyses */
  allLongshots: LongshotAnalysisResult[];
  /** Whether any nuclear longshots exist */
  hasNuclear: boolean;
  /** Whether any live longshots exist */
  hasLive: boolean;
  /** Summary for display */
  summary: string;
  /** Alert level for UI */
  alertLevel: 'nuclear' | 'live' | 'none';
}

/**
 * Analyze all horses in a race for longshot potential
 */
export function analyzeRaceLongshots(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  scores: Map<number, HorseScore>
): RaceLongshotSummary {
  // Calculate pace scenario once
  const paceScenario = analyzePaceScenario(horses);

  // Analyze each horse
  const allLongshots: LongshotAnalysisResult[] = [];

  for (const horse of horses) {
    if (horse.isScratched) continue;

    const score = scores.get(horse.programNumber);
    if (!score) continue;

    const analysis = analyzeLongshot(horse, horses, raceHeader, score, paceScenario);

    if (analysis.isLongshot) {
      allLongshots.push(analysis);
    }
  }

  // Categorize
  const nuclearLongshots = allLongshots.filter((l) => l.classification === 'nuclear');
  const liveLongshots = allLongshots.filter((l) => l.classification === 'live');

  // Determine alert level
  let alertLevel: 'nuclear' | 'live' | 'none' = 'none';
  if (nuclearLongshots.length > 0) {
    alertLevel = 'nuclear';
  } else if (liveLongshots.length > 0) {
    alertLevel = 'live';
  }

  // Generate summary
  let summary = '';
  if (nuclearLongshots.length > 0) {
    summary = `${nuclearLongshots.length} NUCLEAR longshot(s) detected!`;
  } else if (liveLongshots.length > 0) {
    summary = `${liveLongshots.length} live longshot(s) worth consideration`;
  } else if (allLongshots.length > 0) {
    summary = `${allLongshots.length} longshot(s) without strong angles`;
  } else {
    summary = 'No qualifying longshots (25/1+)';
  }

  return {
    longshotCount: allLongshots.length,
    nuclearLongshots,
    liveLongshots,
    allLongshots,
    hasNuclear: nuclearLongshots.length > 0,
    hasLive: liveLongshots.length > 0,
    summary,
    alertLevel,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the best upset angle for a longshot
 */
export function getBestAngle(analysis: LongshotAnalysisResult): DetectedUpsetAngle | null {
  if (analysis.detectedAngles.length === 0) return null;

  return analysis.detectedAngles.reduce((best, current) =>
    current.points > best.points ? current : best
  );
}

/**
 * Format EV for display
 */
export function formatExpectedValue(ev: number): string {
  if (ev <= 0) return 'Negative EV';
  return `${ev.toFixed(2)}x EV`;
}

/**
 * Format upset probability for display
 */
export function formatUpsetProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}% chance`;
}

/**
 * Format ROI potential for display
 */
export function formatROIPotential(odds: number, probability: number): string {
  const roiMultiplier = odds * probability;
  if (roiMultiplier <= 1) return 'Below breakeven';
  return `${roiMultiplier.toFixed(2)}x ROI potential`;
}

/**
 * Get display color based on classification
 */
export function getClassificationDisplayColor(classification: LongshotClassification): {
  bg: string;
  text: string;
  border: string;
} {
  switch (classification) {
    case 'nuclear':
      return { bg: '#fef2f2', text: '#dc2626', border: '#ef4444' };
    case 'live':
      return { bg: '#fffbeb', text: '#d97706', border: '#f59e0b' };
    case 'lottery':
      return { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' };
    case 'dead':
      return { bg: '#f9fafb', text: '#374151', border: '#d1d5db' };
  }
}

/**
 * Sort longshots by quality (nuclear first, then by EV)
 */
export function sortLongshotsByQuality(
  longshots: LongshotAnalysisResult[]
): LongshotAnalysisResult[] {
  return [...longshots].sort((a, b) => {
    // Classification priority
    const classOrder: Record<LongshotClassification, number> = {
      nuclear: 0,
      live: 1,
      lottery: 2,
      dead: 3,
    };

    if (classOrder[a.classification] !== classOrder[b.classification]) {
      return classOrder[a.classification] - classOrder[b.classification];
    }

    // Then by expected value
    return b.expectedValue - a.expectedValue;
  });
}
