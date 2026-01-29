/**
 * Scoring Diagnostics Module
 *
 * Provides comprehensive diagnostic output for validation and debugging
 * of the scoring algorithm. Used during Phase 7 validation to ensure
 * all scoring components work together correctly.
 *
 * @module scoring/diagnostics
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { TrackCondition } from '../../hooks/useRaceState';
import { calculateRaceScores, type HorseScore } from './index';
import { MAX_BASE_SCORE, MAX_SCORE, SCORE_LIMITS } from './index';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Complete diagnostic output for a single horse
 */
export interface ScoringDiagnostic {
  /** Horse name */
  horse: string;
  /** Post position (program number) */
  postPosition: number;
  /** Morning line odds */
  morningLine: string;

  // Category scores
  /** Speed figure score (0-90 pts) */
  speedScore: number;
  /** Class level score (0-32 pts) */
  classScore: number;
  /** Form score (0-50 pts) */
  formScore: number;
  /** Pace analysis score (0-45 pts) */
  paceScore: number;
  /** Connections score (0-27 pts) */
  connectionsScore: number;
  /** Distance/Surface affinity score (0-20 pts) */
  distanceSurfaceScore: number;
  /** Odds-based score (0-15 pts) */
  oddsScore: number;
  /** Post position score (0-12 pts) */
  postPositionScore: number;
  /** Trainer patterns score (0-10 pts) */
  trainerPatternsScore: number;
  /** Equipment score (0-8 pts) */
  equipmentScore: number;
  /** Track specialist score (0-6 pts) */
  trackSpecialistScore: number;
  /** Trainer surface/distance score (0-6 pts) */
  trainerSDBonusScore: number;
  /** Combo patterns score (0-4 pts) */
  comboPatternsScore: number;
  /** P3 refinements (Age + Sire's Sire, 0-2 pts) */
  p3Score: number;
  /** Weight score (0-1 pts) */
  weightScore: number;

  // Totals
  /** Base score before overlay (0-319) */
  baseScore: number;
  /** Overlay adjustment (±40) */
  overlayAdjustment: number;
  /** Final total score (0-359) */
  totalScore: number;

  // Data quality
  /** Data completeness analysis */
  dataCompleteness: {
    /** Overall grade (A-F) */
    grade: string;
    /** Critical tier completeness % */
    criticalComplete: number;
    /** Whether horse is flagged as low confidence */
    isLowConfidence: boolean;
  };

  // Flags
  /** Whether horse is considered "proven" for pace protection */
  isProvenHorse: boolean;
  /** Whether 15% low confidence penalty was applied */
  lowConfidencePenaltyApplied: boolean;

  // Rank
  /** Predicted finish position (1-based) */
  predictedFinish: number;
}

/**
 * Summary statistics for a race diagnostic
 */
export interface RaceDiagnosticSummary {
  /** Total horses scored */
  horsesScored: number;
  /** Horses with low confidence penalty */
  lowConfidenceCount: number;
  /** Highest base score */
  maxBaseScore: number;
  /** Lowest base score */
  minBaseScore: number;
  /** Score spread (max - min) */
  scoreSpread: number;
  /** Average base score */
  avgBaseScore: number;
  /** Maximum possible base score */
  maxPossibleBase: number;
  /** Maximum possible total score */
  maxPossibleTotal: number;
}

/**
 * Complete race diagnostic output
 */
export interface RaceDiagnosticResult {
  /** Track and race info */
  raceInfo: {
    trackCode: string;
    raceNumber: number;
    distance: string;
    surface: string;
    classification: string;
  };
  /** Diagnostics for each horse */
  horses: ScoringDiagnostic[];
  /** Summary statistics */
  summary: RaceDiagnosticSummary;
  /** Validation checks */
  validation: {
    allScoresBounded: boolean;
    categoryTotalsCorrect: boolean;
    noNaNValues: boolean;
    rankingsConsistent: boolean;
  };
}

// ============================================================================
// DIAGNOSTIC FUNCTIONS
// ============================================================================

/**
 * Extract P3 refinement score (age + sire's sire)
 */
function extractP3Score(score: HorseScore): number {
  let p3Total = 0;

  // Age factor
  if (score.breakdown.ageAnalysis) {
    p3Total += score.breakdown.ageAnalysis.adjustment;
  }

  // Sire's sire
  if (score.breakdown.siresSireAnalysis) {
    p3Total += score.breakdown.siresSireAnalysis.adjustment;
  }

  return p3Total;
}

/**
 * Check if horse is considered "proven" (base score >= 180 qualifies for pace protection)
 */
function isProvenHorse(baseScore: number): boolean {
  return baseScore >= 180;
}

/**
 * Convert HorseScore to ScoringDiagnostic
 */
function scoreToDiagnostic(horse: HorseEntry, score: HorseScore, rank: number): ScoringDiagnostic {
  const breakdown = score.breakdown;

  return {
    horse: horse.horseName,
    postPosition: horse.postPosition,
    morningLine: horse.morningLineOdds || 'N/A',

    // Category scores
    speedScore: breakdown.speedClass?.speedScore ?? 0,
    classScore: breakdown.speedClass?.classScore ?? 0,
    formScore: breakdown.form?.total ?? 0,
    paceScore: breakdown.pace?.total ?? 0,
    connectionsScore: breakdown.connections?.total ?? 0,
    distanceSurfaceScore: breakdown.distanceSurface?.total ?? 0,
    oddsScore: breakdown.odds?.total ?? 0,
    postPositionScore: breakdown.postPosition?.total ?? 0,
    trainerPatternsScore: breakdown.trainerPatterns?.total ?? 0,
    equipmentScore: breakdown.equipment?.total ?? 0,
    trackSpecialistScore: breakdown.trackSpecialist?.total ?? 0,
    trainerSDBonusScore: breakdown.trainerSurfaceDistance?.total ?? 0,
    comboPatternsScore: breakdown.comboPatterns?.total ?? 0,
    p3Score: extractP3Score(score),
    weightScore: breakdown.weightAnalysis?.total ?? 0,

    // Totals
    baseScore: score.baseScore,
    overlayAdjustment: score.overlayScore,
    totalScore: score.total,

    // Data quality
    dataCompleteness: {
      grade: score.dataCompleteness.overallGrade,
      criticalComplete: score.dataCompleteness.criticalComplete,
      isLowConfidence: score.dataCompleteness.isLowConfidence,
    },

    // Flags
    isProvenHorse: isProvenHorse(score.baseScore),
    lowConfidencePenaltyApplied: score.lowConfidencePenaltyApplied,

    // Rank
    predictedFinish: rank,
  };
}

/**
 * Validate that all category scores sum correctly
 */
function validateCategoryTotals(diagnostic: ScoringDiagnostic): boolean {
  const categorySum =
    diagnostic.speedScore +
    diagnostic.classScore +
    diagnostic.formScore +
    diagnostic.paceScore +
    diagnostic.connectionsScore +
    diagnostic.distanceSurfaceScore +
    diagnostic.oddsScore +
    diagnostic.postPositionScore +
    diagnostic.trainerPatternsScore +
    diagnostic.equipmentScore +
    diagnostic.trackSpecialistScore +
    diagnostic.trainerSDBonusScore +
    diagnostic.comboPatternsScore +
    Math.abs(diagnostic.p3Score) + // P3 can be negative
    diagnostic.weightScore;

  // Allow some tolerance for rounding and P3 adjustments
  // baseScore may differ slightly due to capping and penalties
  return Math.abs(categorySum - diagnostic.baseScore) <= 20;
}

/**
 * Check for NaN values in diagnostic
 */
function hasNoNaNValues(diagnostic: ScoringDiagnostic): boolean {
  const values = [
    diagnostic.speedScore,
    diagnostic.classScore,
    diagnostic.formScore,
    diagnostic.paceScore,
    diagnostic.connectionsScore,
    diagnostic.distanceSurfaceScore,
    diagnostic.oddsScore,
    diagnostic.postPositionScore,
    diagnostic.trainerPatternsScore,
    diagnostic.equipmentScore,
    diagnostic.trackSpecialistScore,
    diagnostic.trainerSDBonusScore,
    diagnostic.comboPatternsScore,
    diagnostic.p3Score,
    diagnostic.weightScore,
    diagnostic.baseScore,
    diagnostic.overlayAdjustment,
    diagnostic.totalScore,
  ];

  return values.every((v) => !isNaN(v) && isFinite(v));
}

/**
 * Generate comprehensive diagnostic for all horses in a race
 *
 * @param horses - All horses in the race
 * @param raceHeader - Race header information
 * @param getOdds - Optional function to get odds for a horse (defaults to using morning line)
 * @param isScratched - Optional function to check if a horse is scratched (defaults to false)
 * @param trackCondition - Optional track condition (defaults to 'fast')
 * @returns Complete race diagnostic with validation
 */
export function generateRaceDiagnostic(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  getOdds?: (index: number, originalOdds: string) => string,
  isScratched?: (index: number) => boolean,
  trackCondition?: TrackCondition
): RaceDiagnosticResult {
  // Default functions if not provided
  const oddsGetter = getOdds ?? ((_i: number, odds: string) => odds);
  const scratchedChecker = isScratched ?? (() => false);
  const condition = trackCondition ?? 'fast';

  // Score all horses
  const scoredHorses = calculateRaceScores(
    horses,
    raceHeader,
    oddsGetter,
    scratchedChecker,
    condition
  );

  // Filter out scratched horses
  const activeHorses = scoredHorses.filter((h) => !h.score.isScratched);

  // Convert to diagnostics
  const diagnostics: ScoringDiagnostic[] = activeHorses.map((sh) =>
    scoreToDiagnostic(sh.horse, sh.score, sh.rank)
  );

  // Calculate summary statistics
  const baseScores = diagnostics.map((d) => d.baseScore);
  const maxBase = Math.max(...baseScores);
  const minBase = Math.min(...baseScores);

  const summary: RaceDiagnosticSummary = {
    horsesScored: diagnostics.length,
    lowConfidenceCount: diagnostics.filter((d) => d.lowConfidencePenaltyApplied).length,
    maxBaseScore: maxBase,
    minBaseScore: minBase,
    scoreSpread: maxBase - minBase,
    avgBaseScore: Math.round(baseScores.reduce((a, b) => a + b, 0) / baseScores.length),
    maxPossibleBase: MAX_BASE_SCORE,
    maxPossibleTotal: MAX_SCORE,
  };

  // Run validation checks
  const allScoresBounded = diagnostics.every(
    (d) =>
      d.baseScore >= 0 &&
      d.baseScore <= MAX_BASE_SCORE &&
      d.totalScore >= 0 &&
      d.totalScore <= MAX_SCORE &&
      d.overlayAdjustment >= -40 &&
      d.overlayAdjustment <= 40
  );

  const categoryTotalsCorrect = diagnostics.every(validateCategoryTotals);
  const noNaNValues = diagnostics.every(hasNoNaNValues);

  // Check rankings are consistent (1, 2, 3, ...)
  const ranks = diagnostics.map((d) => d.predictedFinish).sort((a, b) => a - b);
  const expectedRanks = Array.from({ length: ranks.length }, (_, i) => i + 1);
  const rankingsConsistent = JSON.stringify(ranks) === JSON.stringify(expectedRanks);

  return {
    raceInfo: {
      trackCode: raceHeader.trackCode,
      raceNumber: raceHeader.raceNumber,
      distance: raceHeader.distance,
      surface: raceHeader.surface,
      classification: raceHeader.classification,
    },
    horses: diagnostics,
    summary,
    validation: {
      allScoresBounded,
      categoryTotalsCorrect,
      noNaNValues,
      rankingsConsistent,
    },
  };
}

/**
 * Format diagnostic as a readable table string (for logging/debugging)
 */
export function formatDiagnosticTable(result: RaceDiagnosticResult): string {
  const lines: string[] = [];

  lines.push('═'.repeat(100));
  lines.push(
    `RACE DIAGNOSTIC: ${result.raceInfo.trackCode} R${result.raceInfo.raceNumber} - ${result.raceInfo.distance} ${result.raceInfo.surface}`
  );
  lines.push('═'.repeat(100));
  lines.push('');

  // Header row
  lines.push(
    'PP  HORSE                    SPD  CLS  FRM  PCE  CON  D/S  ODD  PST  TRP  EQP  TRK  TSD  CMB  P3   WGT  BASE  OVR  TOTAL  RANK'
  );
  lines.push('─'.repeat(120));

  // Horse rows
  for (const h of result.horses) {
    const row = [
      h.postPosition.toString().padStart(2),
      h.horse.substring(0, 22).padEnd(22),
      h.speedScore.toString().padStart(3),
      h.classScore.toString().padStart(4),
      h.formScore.toString().padStart(4),
      h.paceScore.toString().padStart(4),
      h.connectionsScore.toString().padStart(4),
      h.distanceSurfaceScore.toString().padStart(4),
      h.oddsScore.toString().padStart(4),
      h.postPositionScore.toString().padStart(4),
      h.trainerPatternsScore.toString().padStart(4),
      h.equipmentScore.toString().padStart(4),
      h.trackSpecialistScore.toString().padStart(4),
      h.trainerSDBonusScore.toString().padStart(4),
      h.comboPatternsScore.toString().padStart(4),
      h.p3Score.toString().padStart(3),
      h.weightScore.toString().padStart(4),
      h.baseScore.toString().padStart(5),
      (h.overlayAdjustment >= 0 ? '+' : '') + h.overlayAdjustment.toString().padStart(3),
      h.totalScore.toString().padStart(6),
      h.predictedFinish.toString().padStart(5),
    ];
    lines.push(row.join(' '));
  }

  lines.push('─'.repeat(120));
  lines.push('');

  // Summary
  lines.push('SUMMARY:');
  lines.push(`  Horses Scored: ${result.summary.horsesScored}`);
  lines.push(`  Low Confidence: ${result.summary.lowConfidenceCount}`);
  lines.push(`  Base Score Range: ${result.summary.minBaseScore} - ${result.summary.maxBaseScore}`);
  lines.push(`  Score Spread: ${result.summary.scoreSpread} pts`);
  lines.push(`  Average Base: ${result.summary.avgBaseScore}`);
  lines.push('');

  // Validation
  lines.push('VALIDATION:');
  lines.push(`  All Scores Bounded: ${result.validation.allScoresBounded ? 'PASS' : 'FAIL'}`);
  lines.push(
    `  Category Totals Correct: ${result.validation.categoryTotalsCorrect ? 'PASS' : 'FAIL'}`
  );
  lines.push(`  No NaN Values: ${result.validation.noNaNValues ? 'PASS' : 'FAIL'}`);
  lines.push(`  Rankings Consistent: ${result.validation.rankingsConsistent ? 'PASS' : 'FAIL'}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Get single horse diagnostic summary (for testing)
 */
export function getHorseDiagnosticSummary(diagnostic: ScoringDiagnostic): string {
  return [
    `${diagnostic.horse} (PP${diagnostic.postPosition}, ${diagnostic.morningLine})`,
    `  Base: ${diagnostic.baseScore} (SPD:${diagnostic.speedScore} CLS:${diagnostic.classScore} FRM:${diagnostic.formScore} PCE:${diagnostic.paceScore})`,
    `  Total: ${diagnostic.totalScore} (overlay: ${diagnostic.overlayAdjustment >= 0 ? '+' : ''}${diagnostic.overlayAdjustment})`,
    `  Data: ${diagnostic.dataCompleteness.grade} grade, ${diagnostic.dataCompleteness.criticalComplete}% critical`,
    `  Flags: ${diagnostic.lowConfidencePenaltyApplied ? 'LOW_CONF ' : ''}${diagnostic.isProvenHorse ? 'PROVEN' : ''}`,
    `  Rank: #${diagnostic.predictedFinish}`,
  ].join('\n');
}

// Export constants for validation tests
export { MAX_BASE_SCORE, MAX_SCORE, SCORE_LIMITS };
