/**
 * Result Aggregator
 *
 * Combines results from all tracks into a unified MultiTrackResult.
 * Generates summary statistics and identifies cross-track patterns.
 */

import type { TrackResult, MultiTrackResult, ProcessingSummary, RaceAnalysisResult } from './types';

// ============================================================================
// RESULT AGGREGATOR CLASS
// ============================================================================

/**
 * Aggregates results from multiple tracks
 */
export class ResultAggregator {
  private jobId: string;
  private startedAt: string;
  private trackResults: TrackResult[] = [];
  private totalApiCalls = 0;
  private successfulApiCalls = 0;
  private failedApiCalls = 0;
  private retriesPerformed = 0;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.startedAt = new Date().toISOString();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Add a track result to the aggregation
   */
  addTrackResult(result: TrackResult): void {
    this.trackResults.push(result);
  }

  /**
   * Update API call statistics
   */
  updateApiStats(stats: {
    totalApiCalls?: number;
    successfulApiCalls?: number;
    failedApiCalls?: number;
    retriesPerformed?: number;
  }): void {
    if (stats.totalApiCalls !== undefined) {
      this.totalApiCalls += stats.totalApiCalls;
    }
    if (stats.successfulApiCalls !== undefined) {
      this.successfulApiCalls += stats.successfulApiCalls;
    }
    if (stats.failedApiCalls !== undefined) {
      this.failedApiCalls += stats.failedApiCalls;
    }
    if (stats.retriesPerformed !== undefined) {
      this.retriesPerformed += stats.retriesPerformed;
    }
  }

  /**
   * Generate the final MultiTrackResult
   */
  getResult(): MultiTrackResult {
    const completedAt = new Date().toISOString();
    const summary = this.generateSummary();

    return {
      tracks: this.trackResults,
      summary,
      jobId: this.jobId,
      startedAt: this.startedAt,
      completedAt,
    };
  }

  /**
   * Generate summary statistics
   */
  generateSummary(): ProcessingSummary {
    // Count races
    let totalRaces = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    let totalDuration = 0;

    // Count tracks
    let tracksComplete = 0;
    let tracksFailed = 0;
    let tracksCircuitBroken = 0;

    for (const track of this.trackResults) {
      totalRaces += track.results.length;
      totalDuration = Math.max(totalDuration, track.duration);

      // Count race statuses
      for (const race of track.results) {
        if (race.analysis !== null) {
          successful++;
        } else {
          // Check if skipped due to circuit breaker
          const isSkipped = race.errors.some((e) => e.code === 'CIRCUIT_BREAKER');
          if (isSkipped) {
            skipped++;
          } else {
            failed++;
          }
        }
      }

      // Count track statuses
      if (track.circuitBroken) {
        tracksCircuitBroken++;
      } else if (track.racesSuccessful === 0 && track.results.length > 0) {
        tracksFailed++;
      } else {
        tracksComplete++;
      }
    }

    // Calculate average time per race
    const avgTimePerRace = totalRaces > 0 ? Math.round(totalDuration / totalRaces) : 0;

    return {
      totalRaces,
      successful,
      failed,
      skipped,
      duration: totalDuration,
      totalApiCalls: this.totalApiCalls,
      successfulApiCalls: this.successfulApiCalls,
      failedApiCalls: this.failedApiCalls,
      retries: this.retriesPerformed,
      avgTimePerRace,
      tracksComplete,
      tracksFailed,
      tracksCircuitBroken,
    };
  }

  /**
   * Get all race results across all tracks
   */
  getAllRaceResults(): RaceAnalysisResult[] {
    return this.trackResults.flatMap((track) => track.results);
  }

  /**
   * Get successful race results only
   */
  getSuccessfulRaceResults(): RaceAnalysisResult[] {
    return this.getAllRaceResults().filter((race) => race.analysis !== null);
  }

  /**
   * Get failed race results only
   */
  getFailedRaceResults(): RaceAnalysisResult[] {
    return this.getAllRaceResults().filter((race) => race.analysis === null);
  }

  // ============================================================================
  // CROSS-TRACK PATTERN ANALYSIS (STUB)
  // ============================================================================

  /**
   * Identify cross-track patterns (stub for future implementation)
   *
   * This could include:
   * - Horses that appear across tracks
   * - Trainer/jockey patterns
   * - Value opportunities across tracks
   * - Correlated race outcomes
   */
  identifyCrossTrackPatterns(): CrossTrackPatterns {
    // Stub implementation - returns empty patterns
    return {
      multiTrackTrainers: [],
      multiTrackJockeys: [],
      correlatedRaces: [],
      valueOpportunities: [],
    };
  }

  /**
   * Get race results grouped by track
   */
  getResultsByTrack(): Map<string, RaceAnalysisResult[]> {
    const byTrack = new Map<string, RaceAnalysisResult[]>();
    for (const track of this.trackResults) {
      byTrack.set(track.trackCode, track.results);
    }
    return byTrack;
  }

  /**
   * Get top picks across all tracks
   */
  getTopPicks(): Array<{
    trackCode: string;
    raceNumber: number;
    topPick: number | null;
    confidence: string;
  }> {
    const topPicks: Array<{
      trackCode: string;
      raceNumber: number;
      topPick: number | null;
      confidence: string;
    }> = [];

    for (const track of this.trackResults) {
      for (const race of track.results) {
        if (race.analysis) {
          topPicks.push({
            trackCode: track.trackCode,
            raceNumber: race.raceNumber,
            topPick: race.analysis.topPick,
            confidence: race.analysis.confidence,
          });
        }
      }
    }

    return topPicks;
  }

  /**
   * Get high confidence races across all tracks
   */
  getHighConfidenceRaces(): RaceAnalysisResult[] {
    return this.getSuccessfulRaceResults().filter((race) => race.analysis?.confidence === 'HIGH');
  }

  /**
   * Get vulnerable favorites across all tracks
   */
  getVulnerableFavorites(): Array<{
    trackCode: string;
    raceNumber: number;
    analysis: RaceAnalysisResult;
  }> {
    const vulnerables: Array<{
      trackCode: string;
      raceNumber: number;
      analysis: RaceAnalysisResult;
    }> = [];

    for (const track of this.trackResults) {
      for (const race of track.results) {
        if (race.analysis?.vulnerableFavorite) {
          vulnerables.push({
            trackCode: track.trackCode,
            raceNumber: race.raceNumber,
            analysis: race,
          });
        }
      }
    }

    return vulnerables;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      tracksProcessed: this.trackResults.length,
      totalApiCalls: this.totalApiCalls,
      successfulApiCalls: this.successfulApiCalls,
      failedApiCalls: this.failedApiCalls,
      retriesPerformed: this.retriesPerformed,
      successRate:
        this.totalApiCalls > 0
          ? Math.round((this.successfulApiCalls / this.totalApiCalls) * 100)
          : 0,
    };
  }
}

// ============================================================================
// CROSS-TRACK PATTERN TYPES (STUB)
// ============================================================================

/**
 * Cross-track pattern analysis result (stub)
 */
export interface CrossTrackPatterns {
  /** Trainers with horses at multiple tracks */
  multiTrackTrainers: Array<{
    trainerName: string;
    tracks: string[];
    horses: Array<{ trackCode: string; raceNumber: number; horseName: string }>;
  }>;

  /** Jockeys riding at multiple tracks */
  multiTrackJockeys: Array<{
    jockeyName: string;
    tracks: string[];
    mounts: Array<{ trackCode: string; raceNumber: number; horseName: string }>;
  }>;

  /** Races that might have correlated outcomes */
  correlatedRaces: Array<{
    races: Array<{ trackCode: string; raceNumber: number }>;
    reason: string;
  }>;

  /** Value betting opportunities across tracks */
  valueOpportunities: Array<{
    trackCode: string;
    raceNumber: number;
    horse: number;
    reason: string;
  }>;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a result aggregator for a job
 */
export function createResultAggregator(jobId: string): ResultAggregator {
  return new ResultAggregator(jobId);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Merge multiple track results into summary statistics
 */
export function mergeTrackResults(results: TrackResult[]): ProcessingSummary {
  const aggregator = new ResultAggregator('merge');
  for (const result of results) {
    aggregator.addTrackResult(result);
  }
  return aggregator.generateSummary();
}

/**
 * Filter results to only include high-value races
 * High-value = HIGH confidence + bettable race
 */
export function filterHighValueRaces(
  result: MultiTrackResult
): Array<{ trackCode: string; race: RaceAnalysisResult }> {
  const highValue: Array<{ trackCode: string; race: RaceAnalysisResult }> = [];

  for (const track of result.tracks) {
    for (const race of track.results) {
      if (race.analysis?.confidence === 'HIGH' && race.analysis.bettableRace) {
        highValue.push({
          trackCode: track.trackCode,
          race,
        });
      }
    }
  }

  return highValue;
}

/**
 * Sort races by confidence level (HIGH first, then MEDIUM, then LOW)
 */
export function sortByConfidence(races: RaceAnalysisResult[]): RaceAnalysisResult[] {
  const confidenceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  return [...races].sort((a, b) => {
    const aConf = a.analysis?.confidence ?? 'LOW';
    const bConf = b.analysis?.confidence ?? 'LOW';
    return confidenceOrder[aConf] - confidenceOrder[bConf];
  });
}

export default createResultAggregator;
