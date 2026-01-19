/**
 * Prediction Logger Service
 *
 * Logs our model's predictions before race results are known.
 * Creates pending historical race records that are later completed
 * with actual results via the resultsRecorder.
 */

import type { ParsedRace } from '../../types/drf';
import type { ScoredHorse } from '../../lib/scoring/index';
import type { HistoricalRace, HistoricalEntry, SurfaceCode } from './schema';
import {
  generateRaceId,
  normalizeDate,
  toSurfaceCode,
  calculateImpliedProbability,
} from './schema';
import { saveHistoricalRace, getHistoricalRace, raceExists } from './storage';
import { logger } from '../logging';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Scoring result for a race (from the scoring engine)
 */
export interface RaceScoringResult {
  /** Scored horses sorted by rank */
  scoredHorses: ScoredHorse[];
  /** Field pace analysis if available */
  fieldPaceAnalysis?: {
    paceScenario: string;
    earlySpeedCount: number;
  };
}

/**
 * Result of logging predictions
 */
export interface PredictionLogResult {
  /** Generated race ID */
  raceId: string;
  /** Whether the race was newly created or updated */
  isNew: boolean;
  /** Number of entries logged */
  entriesLogged: number;
  /** Any warnings during logging */
  warnings: string[];
}

/**
 * Options for logging predictions
 */
export interface PredictionLogOptions {
  /** Custom track condition (default: 'fast') */
  trackCondition?: string;
  /** Whether to overwrite existing predictions (default: false) */
  overwriteExisting?: boolean;
  /** Custom notes to attach to the race */
  notes?: string;
}

// ============================================================================
// PROBABILITY CONVERSION
// ============================================================================

/**
 * Convert base score to win probability
 * Uses a logistic-style transformation based on empirical ranges
 *
 * Score ranges (323 max base):
 * - 265+ Elite: ~30-50% win prob
 * - 216-264 Strong: ~15-30% win prob
 * - 165-215 Contender: ~8-15% win prob
 * - 116-164 Fair: ~3-8% win prob
 * - <116 Weak: ~1-3% win prob
 */
export function scoreToProbability(baseScore: number, fieldSize: number): number {
  // Normalize score to 0-1 range (323 max base score)
  const normalizedScore = Math.min(baseScore, 323) / 323;

  // Apply logistic transformation
  // Steeper curve to differentiate top horses
  const logisticValue = 1 / (1 + Math.exp(-8 * (normalizedScore - 0.5)));

  // Adjust for field size (larger fields = lower win probability)
  const fieldAdjustment = 8 / fieldSize;

  // Combine and bound
  const rawProbability = logisticValue * fieldAdjustment;
  return Math.min(0.95, Math.max(0.01, rawProbability));
}

/**
 * Normalize probabilities to sum to 1 within a field
 */
export function normalizeProbabilities(probabilities: number[]): number[] {
  const total = probabilities.reduce((sum, p) => sum + p, 0);
  if (total === 0) return probabilities.map(() => 1 / probabilities.length);
  return probabilities.map((p) => p / total);
}

/**
 * Determine betting tier from score
 * Based on scoring thresholds and relative ranking
 */
export function determineTier(score: number, rank: number, topScore: number, odds: number): number {
  // Tier 1 (Chalk): Top-ranked horse with strong score and not longshot odds
  if (rank === 1 && score >= 200 && odds < 10) {
    return 1;
  }

  // Tier 2 (Alternative): Top 3 ranked with decent scores
  if (rank <= 3 && score >= 165) {
    return 2;
  }

  // Tier 3 (Value): Good score relative to odds (value play)
  const expectedOdds = 1 / scoreToProbability(score, 8) - 1; // Estimate
  if (odds > expectedOdds * 1.5 && score >= 140) {
    return 3;
  }

  // Pass (no bet)
  return 0;
}

// ============================================================================
// MAIN LOGGING FUNCTION
// ============================================================================

/**
 * Log predictions for a race before results are known
 *
 * @param race - Parsed race data
 * @param scoringResult - Result from the scoring engine
 * @param options - Optional logging configuration
 * @returns The race ID and logging stats
 */
export async function logPredictions(
  race: ParsedRace,
  scoringResult: RaceScoringResult,
  options: PredictionLogOptions = {}
): Promise<PredictionLogResult> {
  const { trackCondition = 'fast', overwriteExisting = false, notes } = options;
  const warnings: string[] = [];

  const header = race.header;

  // Generate race ID
  const raceId = generateRaceId(header.trackCode, header.raceDateRaw, header.raceNumber);

  // Check if race already exists
  const existing = await getHistoricalRace(raceId);
  if (existing && !overwriteExisting) {
    // Update predictions on existing record if it's pending
    if (existing.status === 'pending_result') {
      const updated = await updatePredictionsOnExisting(existing, scoringResult);
      return {
        raceId,
        isNew: false,
        entriesLogged: updated.entries.length,
        warnings: ['Updated existing pending race with new predictions'],
      };
    }
    return {
      raceId,
      isNew: false,
      entriesLogged: 0,
      warnings: ['Race already exists with results - skipping'],
    };
  }

  // Get active (non-scratched) horses
  const activeHorses = scoringResult.scoredHorses.filter((sh) => !sh.horse.isScratched);

  if (activeHorses.length === 0) {
    warnings.push('No active horses in race');
    return { raceId, isNew: false, entriesLogged: 0, warnings };
  }

  // Find top score for tier calculation
  const topScore = Math.max(...activeHorses.map((h) => h.score.baseScore));

  // Calculate raw probabilities from scores
  const rawProbabilities = activeHorses.map((h) =>
    scoreToProbability(h.score.baseScore, activeHorses.length)
  );

  // Normalize to sum to 1
  const normalizedProbabilities = normalizeProbabilities(rawProbabilities);

  // Create historical entries
  const entries: HistoricalEntry[] = activeHorses.map((sh, i) => {
    const horse = sh.horse;
    const score = sh.score;
    const rank = sh.rank;

    // Use morning line as default odds (will be updated with final odds later)
    const odds = horse.morningLineDecimal || 10;
    const predictedProb = normalizedProbabilities[i] ?? 0.1;
    const impliedProb = calculateImpliedProbability(odds);

    // Determine tier
    const tier = determineTier(score.baseScore, rank, topScore, odds);

    return {
      programNumber: horse.programNumber,
      finishPosition: 0, // Unknown until results recorded
      predictedProbability: predictedProb,
      impliedProbability: impliedProb,
      finalOdds: odds,
      baseScore: score.baseScore,
      finalScore: score.total,
      tier,
      wasWinner: false, // Unknown
      wasPlace: false,
      wasShow: false,
      horseName: horse.horseName,
      morningLineOdds: horse.morningLineDecimal,
    };
  });

  // Create the historical race record
  const historicalRace: HistoricalRace = {
    id: raceId,
    trackCode: header.trackCode,
    raceDate: normalizeDate(header.raceDateRaw),
    raceNumber: header.raceNumber,
    distance: header.distanceFurlongs,
    surface: toSurfaceCode(header.surface),
    fieldSize: activeHorses.length,
    entries,
    recordedAt: new Date(),
    source: 'bot_result',
    confidence: 'HIGH',
    trackCondition,
    classification: header.raceType,
    purse: header.purse,
    notes,
    status: 'pending_result',
  };

  // Save to database
  await saveHistoricalRace(historicalRace);

  logger.logInfo('[Prediction Logger] Logged predictions', {
    raceId,
    entries: entries.length,
    topScore,
  });

  return {
    raceId,
    isNew: true,
    entriesLogged: entries.length,
    warnings,
  };
}

/**
 * Update predictions on an existing pending race
 */
async function updatePredictionsOnExisting(
  existing: HistoricalRace,
  scoringResult: RaceScoringResult
): Promise<HistoricalRace> {
  const activeHorses = scoringResult.scoredHorses.filter((sh) => !sh.horse.isScratched);
  const topScore = Math.max(...activeHorses.map((h) => h.score.baseScore));

  // Map scores by program number
  const scoreMap = new Map<number, ScoredHorse>();
  activeHorses.forEach((sh) => scoreMap.set(sh.horse.programNumber, sh));

  // Calculate probabilities
  const rawProbs = activeHorses.map((h) =>
    scoreToProbability(h.score.baseScore, activeHorses.length)
  );
  const normalizedProbs = normalizeProbabilities(rawProbs);
  const probMap = new Map<number, number>();
  activeHorses.forEach((sh, i) => {
    probMap.set(sh.horse.programNumber, normalizedProbs[i] ?? 0.1);
  });

  // Update entries
  const updatedEntries = existing.entries.map((entry) => {
    const scored = scoreMap.get(entry.programNumber);
    if (!scored) return entry;

    const predictedProb = probMap.get(entry.programNumber) ?? entry.predictedProbability;
    const tier = determineTier(scored.score.baseScore, scored.rank, topScore, entry.finalOdds);

    return {
      ...entry,
      predictedProbability: predictedProb,
      baseScore: scored.score.baseScore,
      finalScore: scored.score.total,
      tier,
    };
  });

  const updated: HistoricalRace = {
    ...existing,
    entries: updatedEntries,
    fieldSize: activeHorses.length,
  };

  await saveHistoricalRace(updated);
  return updated;
}

// ============================================================================
// BATCH LOGGING
// ============================================================================

/**
 * Log predictions for multiple races
 */
export async function logMultiplePredictions(
  races: { race: ParsedRace; scoringResult: RaceScoringResult }[],
  options: PredictionLogOptions = {}
): Promise<{
  logged: number;
  skipped: number;
  results: PredictionLogResult[];
}> {
  const results: PredictionLogResult[] = [];
  let logged = 0;
  let skipped = 0;

  for (const { race, scoringResult } of races) {
    const result = await logPredictions(race, scoringResult, options);
    results.push(result);

    if (result.isNew || result.entriesLogged > 0) {
      logged++;
    } else {
      skipped++;
    }
  }

  return { logged, skipped, results };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if predictions have been logged for a race
 */
export async function hasPredictionsLogged(
  trackCode: string,
  raceDate: string,
  raceNumber: number
): Promise<boolean> {
  const raceId = generateRaceId(trackCode, raceDate, raceNumber);
  return raceExists(raceId);
}

/**
 * Get predictions for a race (if logged)
 */
export async function getPredictions(
  trackCode: string,
  raceDate: string,
  raceNumber: number
): Promise<HistoricalRace | null> {
  const raceId = generateRaceId(trackCode, raceDate, raceNumber);
  return getHistoricalRace(raceId);
}

/**
 * Log predictions from a simple score map (for testing or simplified use)
 */
export async function logSimplePredictions(
  trackCode: string,
  raceDate: string,
  raceNumber: number,
  distance: number,
  surface: SurfaceCode,
  entries: {
    programNumber: number;
    horseName: string;
    baseScore: number;
    finalScore: number;
    morningLine: number;
  }[]
): Promise<string> {
  const raceId = generateRaceId(trackCode, raceDate, raceNumber);

  // Calculate probabilities
  const rawProbs = entries.map((e) => scoreToProbability(e.baseScore, entries.length));
  const normalizedProbs = normalizeProbabilities(rawProbs);
  const topScore = Math.max(...entries.map((e) => e.baseScore));

  // Sort by score for ranking
  const sorted = [...entries].sort((a, b) => b.baseScore - a.baseScore);
  const rankMap = new Map<number, number>();
  sorted.forEach((e, i) => rankMap.set(e.programNumber, i + 1));

  const historicalEntries: HistoricalEntry[] = entries.map((e, i) => {
    const rank = rankMap.get(e.programNumber) ?? entries.length;
    const tier = determineTier(e.baseScore, rank, topScore, e.morningLine);

    return {
      programNumber: e.programNumber,
      finishPosition: 0,
      predictedProbability: normalizedProbs[i] ?? 0.1,
      impliedProbability: calculateImpliedProbability(e.morningLine),
      finalOdds: e.morningLine,
      baseScore: e.baseScore,
      finalScore: e.finalScore,
      tier,
      wasWinner: false,
      wasPlace: false,
      wasShow: false,
      horseName: e.horseName,
      morningLineOdds: e.morningLine,
    };
  });

  const race: HistoricalRace = {
    id: raceId,
    trackCode: trackCode.toUpperCase(),
    raceDate: normalizeDate(raceDate),
    raceNumber,
    distance,
    surface,
    fieldSize: entries.length,
    entries: historicalEntries,
    recordedAt: new Date(),
    source: 'bot_result',
    confidence: 'HIGH',
    status: 'pending_result',
  };

  await saveHistoricalRace(race);
  return raceId;
}
