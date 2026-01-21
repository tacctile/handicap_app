/**
 * AI Metrics Calculator
 *
 * Calculates performance metrics from decision records.
 * Compares AI performance against algorithm baseline.
 */

import type { AIDecisionRecord, AIPerformanceMetrics } from './types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safe division that returns 0 on division by zero
 */
function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate percentage with safe division
 */
function toPercentage(numerator: number, denominator: number): number {
  return safeDivide(numerator, denominator) * 100;
}

/**
 * Check if an array contains all elements of another array (in any order)
 * Used for exacta/trifecta box detection
 */
function containsAll(candidates: number[], actual: number[]): boolean {
  return actual.every((num) => candidates.includes(num));
}

/**
 * Check if first N elements of candidates match actual exacta
 */
function checkExactaBox(candidates: number[], actual: [number, number], boxSize: number): boolean {
  const boxCandidates = candidates.slice(0, boxSize);
  return containsAll(boxCandidates, actual);
}

/**
 * Check if first N elements of candidates match actual trifecta
 */
function checkTrifectaBox(
  candidates: number[],
  actual: [number, number, number],
  boxSize: number
): boolean {
  const boxCandidates = candidates.slice(0, boxSize);
  return containsAll(boxCandidates, actual);
}

// ============================================================================
// METRICS CALCULATOR
// ============================================================================

/**
 * Calculate performance metrics from decision records
 *
 * Only includes records where resultRecorded === true
 *
 * @param records - Array of AI decision records
 * @returns Aggregated performance metrics
 */
export function calculatePerformanceMetrics(records: AIDecisionRecord[]): AIPerformanceMetrics {
  // Filter to only records with results
  const completedRecords = records.filter((r) => r.resultRecorded);

  // Initialize all metrics to zero
  const metrics: AIPerformanceMetrics = {
    // Sample size
    totalRaces: records.length,
    racesWithResults: completedRecords.length,

    // Win rate comparison
    algorithmWins: 0,
    algorithmWinRate: 0,
    aiWins: 0,
    aiWinRate: 0,

    // Top-3 comparison
    algorithmTop3Hits: 0,
    algorithmTop3Rate: 0,
    aiTop3Hits: 0,
    aiTop3Rate: 0,

    // Override tracking
    totalOverrides: 0,
    overrideRate: 0,
    overrideWins: 0,
    overrideWinRate: 0,
    confirmWins: 0,
    confirmWinRate: 0,

    // Exotic tracking
    exactaBox2Hits: 0,
    exactaBox3Hits: 0,
    exactaBox4Hits: 0,
    trifectaBox3Hits: 0,
    trifectaBox4Hits: 0,
    trifectaBox5Hits: 0,

    // Value play tracking
    valuePlaysIdentified: 0,
    valuePlayWins: 0,
    valuePlayWinRate: 0,
    valuePlayAvgOdds: 0,

    // Confidence calibration
    highConfidenceRaces: 0,
    highConfidenceWinRate: 0,
    mediumConfidenceRaces: 0,
    mediumConfidenceWinRate: 0,
    lowConfidenceRaces: 0,
    lowConfidenceWinRate: 0,

    // Bot effectiveness
    tripTroubleBoostWinRate: 0,
    paceAdvantageWinRate: 0,
    vulnerableFavoriteFadeRate: 0,

    // Field type performance
    dominantFieldWinRate: 0,
    competitiveFieldWinRate: 0,
    wideOpenFieldWinRate: 0,
  };

  // Return early if no completed records
  if (completedRecords.length === 0) {
    return metrics;
  }

  // Count overrides from all records (not just completed)
  metrics.totalOverrides = records.filter((r) => r.isOverride).length;
  metrics.overrideRate = toPercentage(metrics.totalOverrides, records.length);

  // Count value plays identified from all records
  metrics.valuePlaysIdentified = records.filter((r) => r.aiValuePlay !== null).length;

  // ============================================================================
  // WIN RATE CALCULATIONS
  // ============================================================================

  let overrideRacesWithResults = 0;
  let confirmRacesWithResults = 0;

  for (const record of completedRecords) {
    const winner = record.actualWinner;
    if (winner === null) continue;

    // Algorithm wins
    if (record.algorithmTopPick === winner) {
      metrics.algorithmWins++;
    }

    // AI wins
    if (record.aiTopPick === winner) {
      metrics.aiWins++;
    }

    // Algorithm top-3 hits
    if (record.algorithmTop3.includes(winner)) {
      metrics.algorithmTop3Hits++;
    }

    // AI top-3 hits
    if (record.aiTop3.includes(winner)) {
      metrics.aiTop3Hits++;
    }

    // Override tracking
    if (record.isOverride) {
      overrideRacesWithResults++;
      if (record.aiTopPick === winner) {
        metrics.overrideWins++;
      }
    } else {
      confirmRacesWithResults++;
      if (record.aiTopPick === winner) {
        metrics.confirmWins++;
      }
    }
  }

  metrics.algorithmWinRate = toPercentage(metrics.algorithmWins, completedRecords.length);
  metrics.aiWinRate = toPercentage(metrics.aiWins, completedRecords.length);
  metrics.algorithmTop3Rate = toPercentage(metrics.algorithmTop3Hits, completedRecords.length);
  metrics.aiTop3Rate = toPercentage(metrics.aiTop3Hits, completedRecords.length);
  metrics.overrideWinRate = toPercentage(metrics.overrideWins, overrideRacesWithResults);
  metrics.confirmWinRate = toPercentage(metrics.confirmWins, confirmRacesWithResults);

  // ============================================================================
  // EXOTIC CALCULATIONS
  // ============================================================================

  for (const record of completedRecords) {
    const exacta = record.actualExacta;
    const trifecta = record.actualTrifecta;

    // Use AI's exacta/trifecta horses, or fall back to top picks
    const exactaHorses =
      record.exactaHorses.length > 0 ? record.exactaHorses : record.aiTop3.slice(0, 4);
    const trifectaHorses =
      record.trifectaHorses.length > 0 ? record.trifectaHorses : record.aiTop3.slice(0, 5);

    // Exacta box hits
    if (exacta) {
      if (checkExactaBox(exactaHorses, exacta, 2)) {
        metrics.exactaBox2Hits++;
      }
      if (checkExactaBox(exactaHorses, exacta, 3)) {
        metrics.exactaBox3Hits++;
      }
      if (checkExactaBox(exactaHorses, exacta, 4)) {
        metrics.exactaBox4Hits++;
      }
    }

    // Trifecta box hits
    if (trifecta) {
      if (checkTrifectaBox(trifectaHorses, trifecta, 3)) {
        metrics.trifectaBox3Hits++;
      }
      if (checkTrifectaBox(trifectaHorses, trifecta, 4)) {
        metrics.trifectaBox4Hits++;
      }
      if (checkTrifectaBox(trifectaHorses, trifecta, 5)) {
        metrics.trifectaBox5Hits++;
      }
    }
  }

  // ============================================================================
  // VALUE PLAY CALCULATIONS
  // ============================================================================

  const valuePlayRecords = completedRecords.filter((r) => r.aiValuePlay !== null);
  let valuePlayWinOddsSum = 0;
  let valuePlayWinCount = 0;

  for (const record of valuePlayRecords) {
    if (record.actualWinner === record.aiValuePlay) {
      metrics.valuePlayWins++;
      valuePlayWinCount++;
      // We don't have odds stored, so we'll set a placeholder
      // In a real implementation, we'd need to store ML odds for value plays
      valuePlayWinOddsSum += 5; // Placeholder average
    }
  }

  metrics.valuePlayWinRate = toPercentage(metrics.valuePlayWins, valuePlayRecords.length);
  metrics.valuePlayAvgOdds = safeDivide(valuePlayWinOddsSum, valuePlayWinCount);

  // ============================================================================
  // CONFIDENCE CALIBRATION
  // ============================================================================

  const highConfidenceRecords = completedRecords.filter((r) => r.aiConfidence === 'HIGH');
  const mediumConfidenceRecords = completedRecords.filter((r) => r.aiConfidence === 'MEDIUM');
  const lowConfidenceRecords = completedRecords.filter((r) => r.aiConfidence === 'LOW');

  metrics.highConfidenceRaces = highConfidenceRecords.length;
  metrics.mediumConfidenceRaces = mediumConfidenceRecords.length;
  metrics.lowConfidenceRaces = lowConfidenceRecords.length;

  const highConfidenceWins = highConfidenceRecords.filter(
    (r) => r.actualWinner === r.aiTopPick
  ).length;
  const mediumConfidenceWins = mediumConfidenceRecords.filter(
    (r) => r.actualWinner === r.aiTopPick
  ).length;
  const lowConfidenceWins = lowConfidenceRecords.filter(
    (r) => r.actualWinner === r.aiTopPick
  ).length;

  metrics.highConfidenceWinRate = toPercentage(highConfidenceWins, highConfidenceRecords.length);
  metrics.mediumConfidenceWinRate = toPercentage(
    mediumConfidenceWins,
    mediumConfidenceRecords.length
  );
  metrics.lowConfidenceWinRate = toPercentage(lowConfidenceWins, lowConfidenceRecords.length);

  // ============================================================================
  // BOT EFFECTIVENESS
  // ============================================================================

  // Trip trouble boost effectiveness
  const tripTroubleRecords = completedRecords.filter((r) => r.tripTroubleHorses.length > 0);
  const tripTroubleWins = tripTroubleRecords.filter(
    (r) => r.actualWinner !== null && r.tripTroubleHorses.includes(r.actualWinner)
  ).length;
  metrics.tripTroubleBoostWinRate = toPercentage(tripTroubleWins, tripTroubleRecords.length);

  // Pace advantage effectiveness
  const paceAdvantageRecords = completedRecords.filter((r) => r.paceAdvantageHorses.length > 0);
  const paceAdvantageWins = paceAdvantageRecords.filter(
    (r) => r.actualWinner !== null && r.paceAdvantageHorses.includes(r.actualWinner)
  ).length;
  metrics.paceAdvantageWinRate = toPercentage(paceAdvantageWins, paceAdvantageRecords.length);

  // Vulnerable favorite fade rate
  // When we flagged favorite as vulnerable, how often did they actually lose?
  const vulnerableFavoriteRecords = completedRecords.filter((r) => r.vulnerableFavorite);
  const vulnerableFavoriteLosses = vulnerableFavoriteRecords.filter(
    (r) => r.actualWinner !== null && r.actualWinner !== r.algorithmTopPick
  ).length;
  metrics.vulnerableFavoriteFadeRate = toPercentage(
    vulnerableFavoriteLosses,
    vulnerableFavoriteRecords.length
  );

  // ============================================================================
  // FIELD TYPE PERFORMANCE
  // ============================================================================

  const dominantRecords = completedRecords.filter((r) => r.fieldType === 'DOMINANT');
  const competitiveRecords = completedRecords.filter((r) => r.fieldType === 'COMPETITIVE');
  const wideOpenRecords = completedRecords.filter((r) => r.fieldType === 'WIDE_OPEN');

  const dominantWins = dominantRecords.filter((r) => r.actualWinner === r.aiTopPick).length;
  const competitiveWins = competitiveRecords.filter((r) => r.actualWinner === r.aiTopPick).length;
  const wideOpenWins = wideOpenRecords.filter((r) => r.actualWinner === r.aiTopPick).length;

  metrics.dominantFieldWinRate = toPercentage(dominantWins, dominantRecords.length);
  metrics.competitiveFieldWinRate = toPercentage(competitiveWins, competitiveRecords.length);
  metrics.wideOpenFieldWinRate = toPercentage(wideOpenWins, wideOpenRecords.length);

  return metrics;
}

/**
 * Calculate quick summary metrics for dashboard display
 */
export function calculateQuickSummary(records: AIDecisionRecord[]): {
  totalRaces: number;
  aiWinRate: number;
  overrideRate: number;
  avgConfidence: string;
} {
  const completedRecords = records.filter((r) => r.resultRecorded);

  const aiWins = completedRecords.filter((r) => r.actualWinner === r.aiTopPick).length;
  const overrides = records.filter((r) => r.isOverride).length;

  const confidenceCounts = {
    HIGH: records.filter((r) => r.aiConfidence === 'HIGH').length,
    MEDIUM: records.filter((r) => r.aiConfidence === 'MEDIUM').length,
    LOW: records.filter((r) => r.aiConfidence === 'LOW').length,
  };

  const avgConfidence =
    confidenceCounts.HIGH >= confidenceCounts.MEDIUM &&
    confidenceCounts.HIGH >= confidenceCounts.LOW
      ? 'HIGH'
      : confidenceCounts.MEDIUM >= confidenceCounts.LOW
        ? 'MEDIUM'
        : 'LOW';

  return {
    totalRaces: records.length,
    aiWinRate: toPercentage(aiWins, completedRecords.length),
    overrideRate: toPercentage(overrides, records.length),
    avgConfidence,
  };
}

/**
 * Compare AI performance to algorithm baseline
 */
export function compareToBaseline(metrics: AIPerformanceMetrics): {
  winRateDiff: number;
  top3RateDiff: number;
  exactaBox4Diff: number;
  trifectaBox5Diff: number;
  isOutperforming: boolean;
} {
  // Algorithm baseline from requirements
  const BASELINE = {
    winRate: 16.2,
    top3Rate: 48.6,
    exactaBox4Rate: 33.3,
    trifectaBox5Rate: 37.8,
  };

  const exactaBox4Rate = toPercentage(metrics.exactaBox4Hits, metrics.racesWithResults);
  const trifectaBox5Rate = toPercentage(metrics.trifectaBox5Hits, metrics.racesWithResults);

  const winRateDiff = metrics.aiWinRate - BASELINE.winRate;
  const top3RateDiff = metrics.aiTop3Rate - BASELINE.top3Rate;
  const exactaBox4Diff = exactaBox4Rate - BASELINE.exactaBox4Rate;
  const trifectaBox5Diff = trifectaBox5Rate - BASELINE.trifectaBox5Rate;

  // AI is outperforming if majority of metrics are positive
  const positiveDiffs = [winRateDiff, top3RateDiff, exactaBox4Diff, trifectaBox5Diff].filter(
    (d) => d > 0
  ).length;
  const isOutperforming = positiveDiffs >= 3;

  return {
    winRateDiff,
    top3RateDiff,
    exactaBox4Diff,
    trifectaBox5Diff,
    isOutperforming,
  };
}
