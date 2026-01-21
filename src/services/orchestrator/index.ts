/**
 * Multi-Track Orchestration Service
 *
 * Main entry point for the orchestration layer that enables
 * parallel processing of multiple tracks with 4 AI bots per race.
 *
 * Features:
 * - Process up to 6 tracks in parallel (configurable concurrency)
 * - 4-bot AI analysis per race via existing AI service
 * - Rate limiting and adaptive throttling
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern per track
 * - Progress callbacks and event emission
 * - Graceful degradation on partial failures
 */

import type { ParsedRace } from '../../types/drf';
import type { RaceScoringResult, HorseScoreForAI, RaceAnalysis } from '../../types/scoring';
import { calculateRaceScores } from '../../lib/scoring';
import {
  resetConcurrencyManager,
  createConcurrencyManager,
  type ConcurrencyManager,
} from './concurrencyManager';
import { createProgressEmitter, type ProgressEmitter } from './progressEmitter';
import { createTrackProcessor } from './trackProcessor';
import { createResultAggregator, type ResultAggregator } from './resultAggregator';
import type {
  TrackJob,
  TrackResult,
  MultiTrackResult,
  ProcessingStatus,
  OrchestratorConfig,
  ProgressCallback,
  ProgressCallbacks,
} from './types';

// Re-export types
export type {
  TrackJob,
  TrackResult,
  MultiTrackResult,
  ProcessingStatus,
  ProcessingSummary,
  ProcessingState,
  OrchestratorConfig,
  ProgressCallback,
  ProgressCallbacks,
  RaceAnalysisResult,
  RaceError,
  TrackError,
  SlotAcquisitionResult,
  ConcurrencyStats,
  AnalyzeTracksRequest,
  AnalyzeTracksResponse,
  JobStatusResponse,
  JobEntry,
  AnyProgressEvent,
} from './types';

// Re-export utilities
export {
  getConcurrencyManager,
  resetConcurrencyManager,
  createConcurrencyManager,
} from './concurrencyManager';
export { createProgressEmitter, createLoggingProgressEmitter } from './progressEmitter';
export { createTrackProcessor } from './trackProcessor';
export {
  createResultAggregator,
  mergeTrackResults,
  filterHighValueRaces,
  sortByConfidence,
} from './resultAggregator';

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

/**
 * Multi-track orchestration service
 *
 * Coordinates processing of multiple tracks with concurrency control,
 * rate limiting, retry logic, and progress tracking.
 */
export class Orchestrator {
  private config: OrchestratorConfig;
  private concurrencyManager: ConcurrencyManager;
  private progressEmitter: ProgressEmitter | null = null;
  private status: ProcessingStatus;
  private abortController: AbortController | null = null;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      maxConcurrentTracks: config?.maxConcurrentTracks ?? 2,
      maxConcurrentApiCalls: config?.maxConcurrentApiCalls ?? 6,
      maxRetries: config?.maxRetries ?? 3,
      retryDelays: config?.retryDelays ?? [1000, 2000, 4000],
      circuitBreakerThreshold: config?.circuitBreakerThreshold ?? 5,
      rateLimitPerMinute: config?.rateLimitPerMinute ?? 120,
      adaptiveThrottling: config?.adaptiveThrottling ?? true,
      raceTimeoutMs: config?.raceTimeoutMs ?? 60000,
      jobTimeoutMs: config?.jobTimeoutMs ?? 600000,
    };

    this.concurrencyManager = createConcurrencyManager({
      maxConcurrentTracks: this.config.maxConcurrentTracks,
      maxConcurrentApiCalls: this.config.maxConcurrentApiCalls,
      rateLimitPerMinute: this.config.rateLimitPerMinute,
      adaptiveThrottling: this.config.adaptiveThrottling,
    });

    this.status = {
      active: false,
      state: 'idle',
      tracksComplete: 0,
      tracksTotal: 0,
      racesProcessed: 0,
      racesTotal: 0,
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Process multiple tracks in parallel
   *
   * @param tracks - Array of track jobs to process
   * @param callbacks - Optional progress callbacks
   * @returns MultiTrackResult with all analyses
   */
  async processMultipleTracks(
    tracks: TrackJob[],
    callbacks?: ProgressCallbacks
  ): Promise<MultiTrackResult> {
    // Generate job ID
    const jobId = this.generateJobId();

    // Create progress emitter
    this.progressEmitter = createProgressEmitter(jobId);
    if (callbacks) {
      this.progressEmitter.setCallbacks(callbacks);
    }

    // Create abort controller
    this.abortController = new AbortController();

    // Initialize status
    const totalRaces = tracks.reduce((sum, t) => sum + t.races.length, 0);
    this.status = {
      active: true,
      state: 'starting',
      tracksComplete: 0,
      tracksTotal: tracks.length,
      racesProcessed: 0,
      racesTotal: totalRaces,
      startedAt: new Date().toISOString(),
      jobId,
    };

    // Create result aggregator
    const aggregator = createResultAggregator(jobId);

    // Emit job start
    this.progressEmitter.emitJobStart(tracks.length, totalRaces);

    // Sort tracks by priority (lower number = higher priority)
    const sortedTracks = [...tracks].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

    try {
      this.status.state = 'processing';

      // Process tracks with concurrency limit
      const trackPromises: Promise<void>[] = [];
      const trackQueue = [...sortedTracks];

      const processNextTrack = async (): Promise<void> => {
        while (trackQueue.length > 0) {
          // Check for cancellation
          if (this.abortController?.signal.aborted) {
            return;
          }

          // Acquire track slot
          const slotResult = await this.concurrencyManager.acquireTrackSlot(
            trackQueue[0]?.trackCode ?? 'unknown',
            this.config.jobTimeoutMs
          );

          if (!slotResult.acquired) {
            // Could not acquire slot - wait and retry
            await this.delay(1000);
            continue;
          }

          const track = trackQueue.shift();
          if (!track) {
            this.concurrencyManager.releaseTrackSlot(slotResult.slotId!);
            return;
          }

          try {
            const result = await this.processSingleTrackInternal(
              track,
              aggregator,
              slotResult.slotId!
            );
            aggregator.addTrackResult(result);

            // Update status
            this.status.tracksComplete++;
            this.status.currentTrack = undefined;
          } finally {
            this.concurrencyManager.releaseTrackSlot(slotResult.slotId!);
          }
        }
      };

      // Start multiple track processing workers (up to maxConcurrentTracks)
      const workerCount = Math.min(this.config.maxConcurrentTracks, sortedTracks.length);
      for (let i = 0; i < workerCount; i++) {
        trackPromises.push(processNextTrack());
      }

      // Wait for all track processing to complete
      await Promise.all(trackPromises);

      // Emit job complete
      this.status.state = 'completing';
      const result = aggregator.getResult();
      this.progressEmitter.emitJobComplete(result);

      this.status.state = 'completed';
      this.status.active = false;

      return result;
    } catch (error) {
      this.status.state = 'failed';
      this.status.active = false;

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.progressEmitter?.emitError(error instanceof Error ? error : new Error(errorMessage));

      // Return partial results if available
      return aggregator.getResult();
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Process a single track (convenience method)
   *
   * @param track - Track job to process
   * @param callbacks - Optional progress callbacks
   * @returns TrackResult
   */
  async processSingleTrack(track: TrackJob, callbacks?: ProgressCallbacks): Promise<TrackResult> {
    const result = await this.processMultipleTracks([track], callbacks);
    return result.tracks[0]!;
  }

  /**
   * Get current processing status
   */
  getProcessingStatus(): ProcessingStatus {
    return { ...this.status };
  }

  /**
   * Cancel ongoing processing
   */
  cancelProcessing(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.status.state = 'cancelled';
      this.status.active = false;
    }
  }

  /**
   * Subscribe to progress events
   *
   * @param callback - Function to call for each event
   * @returns Unsubscribe function
   */
  subscribeToProgress(callback: ProgressCallback): () => void {
    if (this.progressEmitter) {
      return this.progressEmitter.subscribe(callback);
    }
    // Return no-op if no emitter active
    return () => {};
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<OrchestratorConfig>): void {
    Object.assign(this.config, config);
    this.concurrencyManager.updateConfig({
      maxConcurrentTracks: config.maxConcurrentTracks,
      maxConcurrentApiCalls: config.maxConcurrentApiCalls,
      rateLimitPerMinute: config.rateLimitPerMinute,
      adaptiveThrottling: config.adaptiveThrottling,
    });
  }

  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.cancelProcessing();
    this.concurrencyManager.reset();
    this.status = {
      active: false,
      state: 'idle',
      tracksComplete: 0,
      tracksTotal: 0,
      racesProcessed: 0,
      racesTotal: 0,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Process a single track internally
   */
  private async processSingleTrackInternal(
    track: TrackJob,
    aggregator: ResultAggregator,
    _slotId: string
  ): Promise<TrackResult> {
    // Update status
    this.status.currentTrack = track.trackCode;

    // Create track processor
    const processor = createTrackProcessor({
      config: this.config,
      concurrencyManager: this.concurrencyManager,
      progressEmitter: this.progressEmitter ?? undefined,
      getScoringResult: (race: ParsedRace) => this.getScoringResult(race),
      abortSignal: this.abortController?.signal,
    });

    // Process the track
    const result = await processor.processTrack(track);

    // Update aggregator stats
    const stats = processor.getStats();
    aggregator.updateApiStats({
      totalApiCalls: stats.totalApiCalls,
      successfulApiCalls: stats.successfulApiCalls,
      failedApiCalls: stats.failedApiCalls,
      retriesPerformed: stats.retriesPerformed,
    });

    // Update races processed count
    this.status.racesProcessed += result.results.length;

    return result;
  }

  /**
   * Get scoring result for a race
   * Uses the existing scoring algorithm
   */
  private getScoringResult(race: ParsedRace): RaceScoringResult {
    // Calculate scores using existing algorithm
    const getOdds = (_i: number, odds: string) => odds;
    const isScratched = () => false;
    const scoredHorses = calculateRaceScores(
      race.horses,
      race.header,
      getOdds,
      isScratched,
      'fast'
    );

    // Convert to HorseScoreForAI format
    const horseScores: HorseScoreForAI[] = scoredHorses.map((scored, index) => {
      // Extract breakdown values from the score
      const breakdown = scored.score.breakdown;
      const horse = scored.horse;
      const classScoreValue =
        typeof scored.score.classScore === 'number'
          ? scored.score.classScore
          : (scored.score.classScore?.total ?? breakdown.speedClass.classScore);

      // Helper to calculate safe win rate
      const safeWinRate = (wins: number, starts: number): number => {
        if (starts === 0 || !Number.isFinite(starts)) return 0;
        const rate = wins / starts;
        return Number.isFinite(rate) ? rate : 0;
      };

      // Default trainer category stat
      const defaultStat = { starts: 0, wins: 0, winPercent: 0, roi: 0 };

      // Transform trainer category stat
      const transformStat = (stat?: {
        starts: number;
        wins: number;
        winPercent: number;
        roi: number;
      }) =>
        stat
          ? {
              starts: stat.starts ?? 0,
              wins: stat.wins ?? 0,
              winPercent: stat.winPercent ?? 0,
              roi: stat.roi ?? 0,
            }
          : defaultStat;

      // Get trainer category stats with defaults
      const tcs = horse.trainerCategoryStats;

      return {
        programNumber: horse.programNumber,
        horseName: horse.horseName,
        rank: scored.rank || index + 1,
        finalScore: scored.score.total,
        confidenceTier: this.mapConfidenceTier(scored.score.dataCompleteness?.overallGrade),
        breakdown: {
          speedScore: breakdown.speedClass.speedScore,
          classScore: classScoreValue,
          formScore: breakdown.form.total,
          paceScore: breakdown.pace.total,
          connectionScore: breakdown.connections.total,
        },
        positiveFactors: [],
        negativeFactors: [],
        isScratched: scored.score.isScratched ?? false,
        // Past performances (last 3)
        pastPerformances: (horse.pastPerformances ?? []).slice(0, 3).map((pp) => ({
          date: pp.date ?? '',
          track: pp.track ?? '',
          distance: pp.distanceFurlongs ?? 0,
          surface: pp.surface ?? 'dirt',
          trackCondition: pp.trackCondition ?? 'fast',
          finishPosition: pp.finishPosition ?? 0,
          fieldSize: pp.fieldSize ?? 0,
          lengthsBehind: pp.lengthsBehind ?? 0,
          beyer: pp.speedFigures?.beyer ?? null,
          earlyPace1: pp.earlyPace1 ?? null,
          latePace: pp.latePace ?? null,
          tripComment: pp.tripComment ?? '',
          odds: pp.odds ?? null,
          favoriteRank: pp.favoriteRank ?? null,
          runningLine: {
            start: pp.runningLine?.start ?? null,
            stretch: pp.runningLine?.stretch ?? null,
            finish: pp.runningLine?.finish ?? null,
          },
        })),
        // Workouts (last 3)
        workouts: (horse.workouts ?? []).slice(0, 3).map((w) => ({
          date: w.date ?? '',
          track: w.track ?? '',
          distanceFurlongs: w.distanceFurlongs ?? 0,
          timeSeconds: w.timeSeconds ?? 0,
          type: w.type ?? 'unknown',
          isBullet: w.isBullet ?? false,
          rankNumber: w.rankNumber ?? null,
          totalWorks: w.totalWorks ?? null,
        })),
        // Trainer patterns (all 19 categories)
        trainerPatterns: {
          firstTimeLasix: transformStat(tcs?.firstTimeLasix),
          firstTimeBlinkers: transformStat(tcs?.firstTimeBlinkers),
          blinkersOff: transformStat(tcs?.blinkersOff),
          secondOffLayoff: transformStat(tcs?.secondOffLayoff),
          days31to60: transformStat(tcs?.days31to60),
          days61to90: transformStat(tcs?.days61to90),
          days91to180: transformStat(tcs?.days91to180),
          days181plus: transformStat(tcs?.days181plus),
          sprintToRoute: transformStat(tcs?.sprintToRoute),
          routeToSprint: transformStat(tcs?.routeToSprint),
          turfSprint: transformStat(tcs?.turfSprint),
          turfRoute: transformStat(tcs?.turfRoute),
          wetTrack: transformStat(tcs?.wetTrack),
          dirtSprint: transformStat(tcs?.dirtSprint),
          dirtRoute: transformStat(tcs?.dirtRoute),
          maidenClaiming: transformStat(tcs?.maidenClaiming),
          stakes: transformStat(tcs?.stakes),
          firstStartTrainer: transformStat(tcs?.firstStartTrainer),
          afterClaim: transformStat(tcs?.afterClaim),
        },
        // Equipment
        equipment: {
          blinkers: horse.equipment?.blinkers ?? false,
          blinkersOff: horse.equipment?.blinkersOff ?? false,
          frontBandages: horse.equipment?.frontBandages ?? false,
          tongueTie: horse.equipment?.tongueTie ?? false,
          nasalStrip: horse.equipment?.nasalStrip ?? false,
          shadowRoll: horse.equipment?.shadowRoll ?? false,
          barShoes: horse.equipment?.barShoes ?? false,
          mudCaulks: horse.equipment?.mudCaulks ?? false,
          firstTimeEquipment: horse.equipment?.firstTimeEquipment ?? [],
          equipmentChanges: horse.equipment?.equipmentChanges ?? [],
        },
        // Breeding
        breeding: {
          sire: horse.breeding?.sire ?? '',
          damSire: horse.breeding?.damSire ?? '',
          whereBred: horse.breeding?.whereBred ?? '',
        },
        // Distance/Surface stats
        distanceSurfaceStats: {
          distanceStarts: horse.distanceStarts ?? 0,
          distanceWins: horse.distanceWins ?? 0,
          distanceWinRate: safeWinRate(horse.distanceWins ?? 0, horse.distanceStarts ?? 0),
          surfaceStarts: horse.surfaceStarts ?? 0,
          surfaceWins: horse.surfaceWins ?? 0,
          surfaceWinRate: safeWinRate(horse.surfaceWins ?? 0, horse.surfaceStarts ?? 0),
          turfStarts: horse.turfStarts ?? 0,
          turfWins: horse.turfWins ?? 0,
          turfWinRate: safeWinRate(horse.turfWins ?? 0, horse.turfStarts ?? 0),
          wetStarts: horse.wetStarts ?? 0,
          wetWins: horse.wetWins ?? 0,
          wetWinRate: safeWinRate(horse.wetWins ?? 0, horse.wetStarts ?? 0),
        },
        // Form indicators
        formIndicators: {
          daysSinceLastRace: horse.daysSinceLastRace ?? null,
          averageBeyer: horse.averageBeyer ?? null,
          bestBeyer: horse.bestBeyer ?? null,
          lastBeyer: horse.lastBeyer ?? null,
          earlySpeedRating: horse.earlySpeedRating ?? null,
          lifetimeStarts: horse.lifetimeStarts ?? 0,
          lifetimeWins: horse.lifetimeWins ?? 0,
          lifetimeWinRate: safeWinRate(horse.lifetimeWins ?? 0, horse.lifetimeStarts ?? 0),
        },
        // Odds
        morningLineOdds: horse.morningLineOdds ?? '',
        morningLineDecimal: horse.morningLineDecimal ?? 0,
      };
    });

    // Create race analysis
    const raceAnalysis: RaceAnalysis = {
      paceScenario: {
        expectedPace: 'moderate',
        likelyLeader: null,
        speedDuelProbability: 0.5,
        earlySpeedCount: horseScores.filter((s) =>
          race.horses.find((h) => h.programNumber === s.programNumber)?.runningStyle?.includes('E')
        ).length,
      },
      fieldStrength: this.classifyFieldStrength(horseScores),
      vulnerableFavorite: false,
      likelyPaceCollapse: false,
    };

    return {
      scores: horseScores,
      raceAnalysis,
    };
  }

  /**
   * Map data completeness grade to confidence tier
   */
  private mapConfidenceTier(grade?: string): 'high' | 'medium' | 'low' {
    if (!grade) return 'medium';
    if (grade === 'A' || grade === 'B') return 'high';
    if (grade === 'C') return 'medium';
    return 'low';
  }

  /**
   * Classify field strength based on scores
   */
  private classifyFieldStrength(
    scores: HorseScoreForAI[]
  ): 'elite' | 'strong' | 'average' | 'weak' {
    const avgScore = scores.reduce((sum, s) => sum + s.finalScore, 0) / scores.length;
    if (avgScore >= 200) return 'elite';
    if (avgScore >= 170) return 'strong';
    if (avgScore >= 140) return 'average';
    return 'weak';
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: Orchestrator | null = null;

/**
 * Get the singleton orchestrator instance
 */
export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * Reset the orchestrator instance (for testing)
 */
export function resetOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.reset();
    orchestratorInstance = null;
  }
  resetConcurrencyManager();
}

/**
 * Create a new orchestrator with custom config
 */
export function createOrchestrator(config?: Partial<OrchestratorConfig>): Orchestrator {
  return new Orchestrator(config);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Process multiple tracks using the singleton orchestrator
 */
export async function processMultipleTracks(
  tracks: TrackJob[],
  callbacks?: ProgressCallbacks
): Promise<MultiTrackResult> {
  return getOrchestrator().processMultipleTracks(tracks, callbacks);
}

/**
 * Process a single track using the singleton orchestrator
 */
export async function processSingleTrack(
  track: TrackJob,
  callbacks?: ProgressCallbacks
): Promise<TrackResult> {
  return getOrchestrator().processSingleTrack(track, callbacks);
}

/**
 * Get processing status from singleton orchestrator
 */
export function getProcessingStatus(): ProcessingStatus {
  return getOrchestrator().getProcessingStatus();
}

/**
 * Cancel processing on singleton orchestrator
 */
export function cancelProcessing(): void {
  getOrchestrator().cancelProcessing();
}

export default getOrchestrator;
