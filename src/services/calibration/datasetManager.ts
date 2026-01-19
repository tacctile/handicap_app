/**
 * Dataset Manager Service
 *
 * Manages the calibration dataset, providing utilities for querying,
 * filtering, and analyzing historical race data.
 *
 * Target: 500+ races for Platt scaling calibration.
 */

import {
  getAllHistoricalRaces,
  getHistoricalRaceCount,
  getHistoricalRacesByTrack,
  getHistoricalRacesByDateRange,
  getCalibrationDataset,
} from './storage';
import type { HistoricalRace, HistoricalEntry, CalibrationDataset, SurfaceCode } from './schema';
import type { CalibrationFilterOptions } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum number of races required for reliable calibration */
export const CALIBRATION_THRESHOLD = 500;

/** Minimum races for partial calibration analysis */
export const MINIMUM_CALIBRATION_RACES = 100;

// ============================================================================
// DATASET STATS
// ============================================================================

/**
 * Get current dataset statistics
 */
export async function getDatasetStats(): Promise<CalibrationDataset> {
  return getCalibrationDataset();
}

/**
 * Check if the dataset has enough races for full calibration
 * Requires 500+ completed races with predictions
 */
export async function isCalibrationReady(): Promise<boolean> {
  const count = await getHistoricalRaceCount();
  return count >= CALIBRATION_THRESHOLD;
}

/**
 * Check if dataset has minimum for partial analysis
 */
export async function hasMinimumData(): Promise<boolean> {
  const count = await getHistoricalRaceCount();
  return count >= MINIMUM_CALIBRATION_RACES;
}

/**
 * Get the number of races still needed for calibration
 */
export async function getRacesNeeded(): Promise<number> {
  const count = await getHistoricalRaceCount();
  return Math.max(0, CALIBRATION_THRESHOLD - count);
}

// ============================================================================
// FILTERING & QUERYING
// ============================================================================

/**
 * Get races by track code
 */
export async function getRacesByTrack(trackCode: string): Promise<HistoricalRace[]> {
  return getHistoricalRacesByTrack(trackCode);
}

/**
 * Get races within a date range
 */
export async function getRacesByDateRange(start: Date, end: Date): Promise<HistoricalRace[]> {
  return getHistoricalRacesByDateRange(start, end);
}

/**
 * Get filtered races based on criteria
 */
export async function getFilteredRaces(
  filters: CalibrationFilterOptions
): Promise<HistoricalRace[]> {
  let races = await getAllHistoricalRaces();

  // Filter by track codes
  if (filters.trackCodes && filters.trackCodes.length > 0) {
    const trackSet = new Set(filters.trackCodes.map((t) => t.toUpperCase()));
    races = races.filter((r) => trackSet.has(r.trackCode));
  }

  // Filter by date range
  if (filters.dateRange) {
    const startStr = filters.dateRange.start.toISOString().split('T')[0] ?? '';
    const endStr = filters.dateRange.end.toISOString().split('T')[0] ?? '';
    races = races.filter((r) => r.raceDate >= startStr && r.raceDate <= endStr);
  }

  // Filter by surface
  if (filters.surface) {
    races = races.filter((r) => r.surface === filters.surface);
  }

  // Filter by distance range
  if (filters.distanceRange) {
    races = races.filter(
      (r) =>
        filters.distanceRange &&
        r.distance >= filters.distanceRange.min &&
        r.distance <= filters.distanceRange.max
    );
  }

  // Filter by field size
  if (filters.fieldSizeRange) {
    races = races.filter(
      (r) =>
        filters.fieldSizeRange &&
        r.fieldSize >= filters.fieldSizeRange.min &&
        r.fieldSize <= filters.fieldSizeRange.max
    );
  }

  // Filter by source
  if (filters.source) {
    races = races.filter((r) => r.source === filters.source);
  }

  return races;
}

// ============================================================================
// ENTRY GROUPING
// ============================================================================

/**
 * Get all entries from completed races
 * (Excludes pending results)
 */
export async function getAllCompletedEntries(): Promise<HistoricalEntry[]> {
  const races = await getAllHistoricalRaces();
  const completedRaces = races.filter((r) => r.status !== 'pending_result');

  return completedRaces.flatMap((r) => r.entries.filter((e) => e.finishPosition > 0));
}

/**
 * Get entries grouped by predicted probability buckets
 *
 * @param bucketSize - Size of each bucket (default 0.1 = 10%)
 * @returns Map where key is bucket label (e.g., "0.10-0.20"), value is entries
 */
export async function getEntriesByProbabilityBucket(
  bucketSize: number = 0.1
): Promise<Map<string, HistoricalEntry[]>> {
  const entries = await getAllCompletedEntries();
  const buckets = new Map<string, HistoricalEntry[]>();

  // Initialize buckets
  for (let start = 0; start < 1; start += bucketSize) {
    const end = Math.min(start + bucketSize, 1);
    const key = `${start.toFixed(2)}-${end.toFixed(2)}`;
    buckets.set(key, []);
  }

  // Place entries in buckets
  for (const entry of entries) {
    const prob = entry.predictedProbability;
    // Find the right bucket
    for (let start = 0; start < 1; start += bucketSize) {
      const end = Math.min(start + bucketSize, 1);
      if (prob >= start && (prob < end || (prob === 1 && end === 1))) {
        const key = `${start.toFixed(2)}-${end.toFixed(2)}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(entry);
        break;
      }
    }
  }

  return buckets;
}

/**
 * Get entries grouped by score buckets
 *
 * @param bucketSize - Size of each bucket (default 20 points)
 * @returns Map where key is bucket label (e.g., "200-220"), value is entries
 */
export async function getEntriesByScoreBucket(
  bucketSize: number = 20
): Promise<Map<string, HistoricalEntry[]>> {
  const entries = await getAllCompletedEntries();
  const buckets = new Map<string, HistoricalEntry[]>();

  // Score range is typically 0-370 (base + overlay)
  const maxScore = 380;

  // Initialize buckets
  for (let start = 0; start < maxScore; start += bucketSize) {
    const end = start + bucketSize;
    const key = `${start}-${end}`;
    buckets.set(key, []);
  }

  // Place entries in buckets
  for (const entry of entries) {
    const score = entry.finalScore;
    const bucketStart = Math.floor(score / bucketSize) * bucketSize;
    const key = `${bucketStart}-${bucketStart + bucketSize}`;

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(entry);
  }

  return buckets;
}

/**
 * Get entries grouped by tier
 */
export async function getEntriesByTier(): Promise<Map<number, HistoricalEntry[]>> {
  const entries = await getAllCompletedEntries();
  const buckets = new Map<number, HistoricalEntry[]>();

  // Initialize tiers
  for (let tier = 0; tier <= 3; tier++) {
    buckets.set(tier, []);
  }

  // Group entries
  for (const entry of entries) {
    const tier = entry.tier;
    if (!buckets.has(tier)) {
      buckets.set(tier, []);
    }
    buckets.get(tier)!.push(entry);
  }

  return buckets;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Calculate basic win rate statistics by probability bucket
 */
export async function calculateBucketWinRates(bucketSize: number = 0.1): Promise<
  {
    bucket: string;
    predicted: number;
    actual: number;
    count: number;
    wins: number;
  }[]
> {
  const buckets = await getEntriesByProbabilityBucket(bucketSize);
  const results: {
    bucket: string;
    predicted: number;
    actual: number;
    count: number;
    wins: number;
  }[] = [];

  for (const [key, entries] of buckets) {
    if (entries.length === 0) continue;

    const wins = entries.filter((e) => e.wasWinner).length;
    const avgPredicted =
      entries.reduce((sum, e) => sum + e.predictedProbability, 0) / entries.length;
    const actualRate = wins / entries.length;

    results.push({
      bucket: key,
      predicted: avgPredicted,
      actual: actualRate,
      count: entries.length,
      wins,
    });
  }

  return results.sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/**
 * Calculate tier performance statistics
 */
export async function calculateTierStats(): Promise<
  {
    tier: number;
    count: number;
    wins: number;
    winRate: number;
    avgScore: number;
    avgOdds: number;
    roi: number; // Assuming $1 flat bets
  }[]
> {
  const buckets = await getEntriesByTier();
  const results: {
    tier: number;
    count: number;
    wins: number;
    winRate: number;
    avgScore: number;
    avgOdds: number;
    roi: number;
  }[] = [];

  for (const [tier, entries] of buckets) {
    if (entries.length === 0) continue;

    const wins = entries.filter((e) => e.wasWinner).length;
    const avgScore = entries.reduce((sum, e) => sum + e.finalScore, 0) / entries.length;
    const avgOdds = entries.reduce((sum, e) => sum + e.finalOdds, 0) / entries.length;

    // Calculate ROI: (total returned - total bet) / total bet
    const totalBet = entries.length;
    const totalReturned = entries
      .filter((e) => e.wasWinner)
      .reduce((sum, e) => sum + (e.finalOdds + 1), 0); // decimal odds + stake
    const roi = ((totalReturned - totalBet) / totalBet) * 100;

    results.push({
      tier,
      count: entries.length,
      wins,
      winRate: wins / entries.length,
      avgScore,
      avgOdds,
      roi,
    });
  }

  return results.sort((a, b) => a.tier - b.tier);
}

/**
 * Get surface-specific statistics
 */
export async function getSurfaceStats(): Promise<
  Map<
    SurfaceCode,
    {
      raceCount: number;
      entryCount: number;
      avgFieldSize: number;
      avgWinningOdds: number;
    }
  >
> {
  const races = await getAllHistoricalRaces();
  const stats = new Map<
    SurfaceCode,
    {
      raceCount: number;
      entryCount: number;
      totalFieldSize: number;
      winningOddsSum: number;
      winCount: number;
    }
  >();

  // Initialize
  (['D', 'T', 'S'] as SurfaceCode[]).forEach((s) => {
    stats.set(s, {
      raceCount: 0,
      entryCount: 0,
      totalFieldSize: 0,
      winningOddsSum: 0,
      winCount: 0,
    });
  });

  // Aggregate
  for (const race of races) {
    if (race.status === 'pending_result') continue;

    const surfaceStats = stats.get(race.surface);
    if (!surfaceStats) continue;

    surfaceStats.raceCount++;
    surfaceStats.entryCount += race.entries.length;
    surfaceStats.totalFieldSize += race.fieldSize;

    const winner = race.entries.find((e) => e.wasWinner);
    if (winner) {
      surfaceStats.winningOddsSum += winner.finalOdds;
      surfaceStats.winCount++;
    }
  }

  // Convert to final format
  const result = new Map<
    SurfaceCode,
    {
      raceCount: number;
      entryCount: number;
      avgFieldSize: number;
      avgWinningOdds: number;
    }
  >();

  for (const [surface, data] of stats) {
    if (data.raceCount === 0) continue;

    result.set(surface, {
      raceCount: data.raceCount,
      entryCount: data.entryCount,
      avgFieldSize: data.totalFieldSize / data.raceCount,
      avgWinningOdds: data.winCount > 0 ? data.winningOddsSum / data.winCount : 0,
    });
  }

  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get summary of dataset quality
 */
export async function getDataQualitySummary(): Promise<{
  totalRaces: number;
  completedRaces: number;
  pendingRaces: number;
  racesWithPredictions: number;
  racesWithOdds: number;
  avgConfidence: number;
  isReady: boolean;
  readinessPercentage: number;
}> {
  const races = await getAllHistoricalRaces();

  const completed = races.filter((r) => r.status !== 'pending_result');
  const pending = races.filter((r) => r.status === 'pending_result');
  const withPredictions = races.filter((r) => r.entries.some((e) => e.predictedProbability > 0));
  const withOdds = races.filter((r) => r.entries.some((e) => e.finalOdds > 0));

  // Calculate average confidence
  const confidenceScores = races.map((r) => {
    switch (r.confidence) {
      case 'HIGH':
        return 1;
      case 'MEDIUM':
        return 0.5;
      case 'LOW':
        return 0.25;
      default:
        return 0.5;
    }
  });
  const avgConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

  const isReady = completed.length >= CALIBRATION_THRESHOLD;
  const readinessPercentage = Math.min(100, (completed.length / CALIBRATION_THRESHOLD) * 100);

  return {
    totalRaces: races.length,
    completedRaces: completed.length,
    pendingRaces: pending.length,
    racesWithPredictions: withPredictions.length,
    racesWithOdds: withOdds.length,
    avgConfidence,
    isReady,
    readinessPercentage,
  };
}

/**
 * Get a sampling of races for quick validation
 */
export async function getRandomSample(count: number = 10): Promise<HistoricalRace[]> {
  const races = await getAllHistoricalRaces();
  const completed = races.filter((r) => r.status !== 'pending_result');

  if (completed.length <= count) return completed;

  // Fisher-Yates shuffle and take first N
  const shuffled = [...completed];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    const swapTarget = shuffled[j];
    if (temp && swapTarget) {
      shuffled[i] = swapTarget;
      shuffled[j] = temp;
    }
  }

  return shuffled.slice(0, count);
}

/**
 * Validate dataset integrity
 * Checks for common data issues
 */
export async function validateDataset(): Promise<{
  isValid: boolean;
  issues: string[];
  warnings: string[];
}> {
  const races = await getAllHistoricalRaces();
  const issues: string[] = [];
  const warnings: string[] = [];

  for (const race of races) {
    // Check for duplicate program numbers
    const programNumbers = race.entries.map((e) => e.programNumber);
    const uniquePN = new Set(programNumbers);
    if (uniquePN.size !== programNumbers.length) {
      issues.push(`Race ${race.id}: Duplicate program numbers`);
    }

    // Check completed races have exactly one winner
    if (race.status !== 'pending_result') {
      const winners = race.entries.filter((e) => e.wasWinner);
      if (winners.length !== 1) {
        issues.push(`Race ${race.id}: Has ${winners.length} winners (expected 1)`);
      }
    }

    // Check probability sums
    const totalProb = race.entries.reduce((sum, e) => sum + e.predictedProbability, 0);
    if (Math.abs(totalProb - 1) > 0.1) {
      warnings.push(
        `Race ${race.id}: Probabilities sum to ${totalProb.toFixed(2)} (expected ~1.0)`
      );
    }

    // Check for missing data
    if (race.entries.every((e) => e.predictedProbability === 0)) {
      warnings.push(`Race ${race.id}: No predictions logged`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
  };
}
