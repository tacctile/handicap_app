/**
 * Track Processor
 *
 * Processes all races for a single track sequentially.
 * Calls the existing 4-bot AI analysis per race.
 * Implements retry logic and circuit breaker pattern.
 */

import type { ParsedRace } from '../../types/drf';
import type { RaceScoringResult } from '../../types/scoring';
import type { AIRaceAnalysis } from '../ai/types';
import { getMultiBotAnalysis } from '../ai';
import { getConcurrencyManager, type ConcurrencyManager } from './concurrencyManager';
import type { ProgressEmitter } from './progressEmitter';
import type {
  TrackJob,
  TrackResult,
  RaceAnalysisResult,
  RaceError,
  TrackError,
  OrchestratorConfig,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

interface TrackProcessorOptions {
  /** Configuration options */
  config?: Partial<OrchestratorConfig>;
  /** Concurrency manager to use */
  concurrencyManager?: ConcurrencyManager;
  /** Progress emitter for events */
  progressEmitter?: ProgressEmitter;
  /** Function to get scoring result for a race (must be provided) */
  getScoringResult: (race: ParsedRace) => RaceScoringResult;
  /** Cancellation signal */
  abortSignal?: AbortSignal;
}

interface RetryState {
  attempt: number;
  lastError?: Error;
}

// ============================================================================
// TRACK PROCESSOR CLASS
// ============================================================================

/**
 * Processes all races for a single track with retry and circuit breaker
 */
export class TrackProcessor {
  private config: Pick<
    OrchestratorConfig,
    'maxRetries' | 'retryDelays' | 'circuitBreakerThreshold' | 'raceTimeoutMs'
  >;
  private concurrencyManager: ConcurrencyManager;
  private progressEmitter?: ProgressEmitter;
  private getScoringResult: (race: ParsedRace) => RaceScoringResult;
  private abortSignal?: AbortSignal;

  // Circuit breaker state
  private consecutiveFailures = 0;
  private circuitBroken = false;
  private circuitBreakReason?: string;

  // Statistics
  private totalApiCalls = 0;
  private successfulApiCalls = 0;
  private failedApiCalls = 0;
  private retriesPerformed = 0;

  constructor(options: TrackProcessorOptions) {
    this.config = {
      maxRetries: options.config?.maxRetries ?? 3,
      retryDelays: options.config?.retryDelays ?? [1000, 2000, 4000],
      circuitBreakerThreshold: options.config?.circuitBreakerThreshold ?? 5,
      raceTimeoutMs: options.config?.raceTimeoutMs ?? 60000,
    };
    this.concurrencyManager = options.concurrencyManager ?? getConcurrencyManager();
    this.progressEmitter = options.progressEmitter;
    this.getScoringResult = options.getScoringResult;
    this.abortSignal = options.abortSignal;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Process all races for a track sequentially
   *
   * @param job - Track job to process
   * @returns TrackResult with all race analyses
   */
  async processTrack(job: TrackJob): Promise<TrackResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const results: RaceAnalysisResult[] = [];
    const errors: TrackError[] = [];

    // Reset state for new track
    this.consecutiveFailures = 0;
    this.circuitBroken = false;
    this.circuitBreakReason = undefined;
    this.totalApiCalls = 0;
    this.successfulApiCalls = 0;
    this.failedApiCalls = 0;
    this.retriesPerformed = 0;

    // Emit track start
    this.progressEmitter?.emitTrackStart(job.trackCode, job.races.length);

    // Process races sequentially
    for (const race of job.races) {
      // Check for cancellation
      if (this.abortSignal?.aborted) {
        errors.push({
          message: 'Processing cancelled',
          code: 'CANCELLED',
          timestamp: new Date().toISOString(),
        });
        break;
      }

      // Check circuit breaker
      if (this.circuitBroken) {
        // Skip remaining races
        results.push(this.createSkippedResult(race, job.trackCode, this.circuitBreakReason));
        continue;
      }

      // Process this race
      try {
        const result = await this.processRace(race, job.trackCode);
        results.push(result);

        // Update circuit breaker state
        if (result.analysis === null) {
          this.consecutiveFailures++;
          if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
            this.circuitBroken = true;
            this.circuitBreakReason = `Circuit breaker triggered after ${this.consecutiveFailures} consecutive failures`;
            errors.push({
              message: this.circuitBreakReason,
              code: 'CIRCUIT_BREAKER',
              raceNumber: race.header.raceNumber,
              timestamp: new Date().toISOString(),
            });
            this.progressEmitter?.emitWarning(
              this.circuitBreakReason,
              job.trackCode,
              race.header.raceNumber
            );
          }
        } else {
          // Reset consecutive failures on success
          this.consecutiveFailures = 0;
        }

        // Emit race complete
        this.progressEmitter?.emitRaceComplete(job.trackCode, race.header.raceNumber, result);
      } catch (error) {
        // Unexpected error - should not happen normally as processRace handles errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          message: `Unexpected error processing race ${race.header.raceNumber}: ${errorMessage}`,
          code: 'UNEXPECTED_ERROR',
          raceNumber: race.header.raceNumber,
          timestamp: new Date().toISOString(),
        });
        this.progressEmitter?.emitError(
          error instanceof Error ? error : new Error(errorMessage),
          job.trackCode,
          race.header.raceNumber
        );

        // Create failed result
        results.push(
          this.createFailedResult(race, job.trackCode, [
            {
              source: 'unknown',
              message: errorMessage,
              recoverable: false,
              timestamp: new Date().toISOString(),
            },
          ])
        );

        // Update circuit breaker
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
          this.circuitBroken = true;
          this.circuitBreakReason = `Circuit breaker triggered after ${this.consecutiveFailures} consecutive failures`;
        }
      }
    }

    const completedAt = new Date().toISOString();
    const duration = Date.now() - startTime;

    // Count successful and failed races
    const racesSuccessful = results.filter((r) => r.analysis !== null).length;
    const racesFailed = results.filter((r) => r.analysis === null).length;

    // Emit track complete
    const trackResult: TrackResult = {
      trackCode: job.trackCode,
      results,
      errors,
      duration,
      racesSuccessful,
      racesFailed,
      circuitBroken: this.circuitBroken,
      circuitBreakReason: this.circuitBreakReason,
      startedAt,
      completedAt,
    };

    this.progressEmitter?.emitTrackComplete(job.trackCode, trackResult);

    return trackResult;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      totalApiCalls: this.totalApiCalls,
      successfulApiCalls: this.successfulApiCalls,
      failedApiCalls: this.failedApiCalls,
      retriesPerformed: this.retriesPerformed,
      consecutiveFailures: this.consecutiveFailures,
      circuitBroken: this.circuitBroken,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Process a single race with retries
   */
  private async processRace(race: ParsedRace, trackCode: string): Promise<RaceAnalysisResult> {
    const startTime = Date.now();
    const raceNumber = race.header.raceNumber;

    // Emit race start
    this.progressEmitter?.emitRaceStart(trackCode, raceNumber);

    // Get scoring result
    const scoringResult = this.getScoringResult(race);

    // Retry state
    const retryState: RetryState = { attempt: 0 };
    const errors: RaceError[] = [];

    while (retryState.attempt <= this.config.maxRetries) {
      // Acquire API slot
      const slotResult = await this.concurrencyManager.acquireApiSlot(
        trackCode,
        this.config.raceTimeoutMs
      );

      if (!slotResult.acquired) {
        // Could not acquire slot
        errors.push({
          source: 'unknown',
          message: `Failed to acquire API slot: ${slotResult.reason}`,
          recoverable: true,
          timestamp: new Date().toISOString(),
        });

        if (retryState.attempt < this.config.maxRetries) {
          retryState.attempt++;
          this.retriesPerformed++;
          await this.delay(this.config.retryDelays[retryState.attempt - 1] ?? 4000);
          continue;
        } else {
          break;
        }
      }

      try {
        // Call multi-bot analysis
        this.totalApiCalls++;
        const analysis = await this.withTimeout(
          getMultiBotAnalysis(race, scoringResult, { forceRefresh: true }),
          this.config.raceTimeoutMs
        );

        // Release slot (no error)
        this.concurrencyManager.releaseApiSlot(slotResult.slotId!, false);
        this.successfulApiCalls++;

        // Success - return result
        return {
          raceNumber,
          trackCode,
          analysis,
          duration: Date.now() - startTime,
          errors,
          successfulBots: this.countSuccessfulBots(analysis),
          completedAt: new Date().toISOString(),
        };
      } catch (error) {
        // Release slot (with error)
        this.concurrencyManager.releaseApiSlot(slotResult.slotId!, true);
        this.failedApiCalls++;

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = this.extractErrorCode(error);

        errors.push({
          source: this.classifyErrorSource(errorMessage),
          message: errorMessage,
          code: errorCode,
          recoverable: this.isRecoverableError(errorCode),
          timestamp: new Date().toISOString(),
        });

        retryState.lastError = error instanceof Error ? error : new Error(errorMessage);

        // Check if we should retry
        if (retryState.attempt < this.config.maxRetries && this.isRecoverableError(errorCode)) {
          retryState.attempt++;
          this.retriesPerformed++;
          const delay = this.config.retryDelays[retryState.attempt - 1] ?? 4000;
          console.warn(
            `[TrackProcessor] Retry ${retryState.attempt}/${this.config.maxRetries} for ${trackCode} Race ${raceNumber} after ${delay}ms: ${errorMessage}`
          );
          await this.delay(delay);
          continue;
        } else {
          break;
        }
      }
    }

    // All retries exhausted or non-recoverable error
    return this.createFailedResult(race, trackCode, errors, Date.now() - startTime);
  }

  /**
   * Create a result for a skipped race (due to circuit breaker)
   */
  private createSkippedResult(
    race: ParsedRace,
    trackCode: string,
    reason?: string
  ): RaceAnalysisResult {
    return {
      raceNumber: race.header.raceNumber,
      trackCode,
      analysis: null,
      duration: 0,
      errors: [
        {
          source: 'unknown',
          message: reason || 'Race skipped due to circuit breaker',
          code: 'CIRCUIT_BREAKER',
          recoverable: false,
          timestamp: new Date().toISOString(),
        },
      ],
      successfulBots: 0,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a result for a failed race
   */
  private createFailedResult(
    race: ParsedRace,
    trackCode: string,
    errors: RaceError[],
    duration = 0
  ): RaceAnalysisResult {
    return {
      raceNumber: race.header.raceNumber,
      trackCode,
      analysis: null,
      duration,
      errors,
      successfulBots: 0,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Count successful bots based on analysis content
   */
  private countSuccessfulBots(analysis: AIRaceAnalysis): number {
    // The multi-bot analysis combines results from 4 bots
    // We estimate success based on confidence and content
    if (!analysis) return 0;
    if (analysis.confidence === 'HIGH') return 4;
    if (analysis.confidence === 'MEDIUM') return 3;
    if (analysis.confidence === 'LOW') return 2;
    return 1;
  }

  /**
   * Extract error code from error object
   */
  private extractErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object') {
      if ('code' in error && typeof error.code === 'string') {
        return error.code;
      }
    }
    return undefined;
  }

  /**
   * Classify error source based on message
   */
  private classifyErrorSource(message: string): RaceError['source'] {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('tripTrouble') || lowerMessage.includes('trip trouble')) {
      return 'tripTrouble';
    }
    if (lowerMessage.includes('pacescenario') || lowerMessage.includes('pace scenario')) {
      return 'paceScenario';
    }
    if (
      lowerMessage.includes('vulnerablefavorite') ||
      lowerMessage.includes('vulnerable favorite')
    ) {
      return 'vulnerableFavorite';
    }
    if (lowerMessage.includes('fieldspread') || lowerMessage.includes('field spread')) {
      return 'fieldSpread';
    }
    if (lowerMessage.includes('combiner') || lowerMessage.includes('combine')) {
      return 'combiner';
    }
    return 'unknown';
  }

  /**
   * Determine if an error is recoverable (worth retrying)
   */
  private isRecoverableError(code?: string): boolean {
    if (!code) return true; // Unknown errors are potentially recoverable

    const nonRecoverableCodes = [
      'API_KEY_MISSING',
      'API_KEY_INVALID',
      'QUOTA_EXCEEDED',
      'PARSE_ERROR',
      'INVALID_REQUEST',
    ];

    return !nonRecoverableCodes.includes(code);
  }

  /**
   * Wrap a promise with a timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a track processor with given options
 */
export function createTrackProcessor(options: TrackProcessorOptions): TrackProcessor {
  return new TrackProcessor(options);
}

export default createTrackProcessor;
