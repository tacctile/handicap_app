/**
 * Progress Emitter
 *
 * Event-based progress tracking for multi-track orchestration.
 * Supports both callback-style and EventEmitter-style subscriptions.
 */

import type {
  ProgressCallback,
  ProgressCallbacks,
  AnyProgressEvent,
  JobStartEvent,
  TrackStartEvent,
  TrackCompleteEvent,
  RaceStartEvent,
  RaceCompleteEvent,
  ErrorEvent,
  WarningEvent,
  JobCompleteEvent,
  TrackResult,
  RaceAnalysisResult,
  MultiTrackResult,
  TrackError,
  RaceError,
} from './types';

// ============================================================================
// PROGRESS EMITTER CLASS
// ============================================================================

/**
 * Emits progress events for multi-track orchestration
 */
export class ProgressEmitter {
  private jobId: string;
  private listeners: Set<ProgressCallback> = new Set();
  private callbacks: ProgressCallbacks = {};

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  // ============================================================================
  // SUBSCRIPTION METHODS
  // ============================================================================

  /**
   * Subscribe to all progress events
   *
   * @param callback - Function to call for each event
   * @returns Unsubscribe function
   */
  subscribe(callback: ProgressCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Subscribe to specific event types via callbacks object
   *
   * @param callbacks - Object with event-specific callbacks
   */
  setCallbacks(callbacks: ProgressCallbacks): void {
    this.callbacks = { ...callbacks };
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.listeners.clear();
    this.callbacks = {};
  }

  // ============================================================================
  // EMIT METHODS
  // ============================================================================

  /**
   * Emit job start event
   */
  emitJobStart(totalTracks: number, totalRaces: number): void {
    const event: JobStartEvent = {
      type: 'job_start',
      timestamp: new Date().toISOString(),
      jobId: this.jobId,
      totalTracks,
      totalRaces,
    };
    this.emit(event);
    this.callbacks.onJobStart?.(event);
  }

  /**
   * Emit track start event
   */
  emitTrackStart(trackCode: string, raceCount: number): void {
    const event: TrackStartEvent = {
      type: 'track_start',
      timestamp: new Date().toISOString(),
      jobId: this.jobId,
      trackCode,
      raceCount,
    };
    this.emit(event);
    this.callbacks.onTrackStart?.(trackCode);
  }

  /**
   * Emit track complete event
   */
  emitTrackComplete(trackCode: string, result: TrackResult): void {
    const event: TrackCompleteEvent = {
      type: 'track_complete',
      timestamp: new Date().toISOString(),
      jobId: this.jobId,
      trackCode,
      result,
    };
    this.emit(event);
    this.callbacks.onTrackComplete?.(trackCode, result);
  }

  /**
   * Emit race start event
   */
  emitRaceStart(trackCode: string, raceNumber: number): void {
    const event: RaceStartEvent = {
      type: 'race_start',
      timestamp: new Date().toISOString(),
      jobId: this.jobId,
      trackCode,
      raceNumber,
    };
    this.emit(event);
    this.callbacks.onRaceStart?.(trackCode, raceNumber);
  }

  /**
   * Emit race complete event
   */
  emitRaceComplete(trackCode: string, raceNumber: number, result: RaceAnalysisResult): void {
    const event: RaceCompleteEvent = {
      type: 'race_complete',
      timestamp: new Date().toISOString(),
      jobId: this.jobId,
      trackCode,
      raceNumber,
      result,
    };
    this.emit(event);
    this.callbacks.onRaceComplete?.(trackCode, raceNumber, result);
  }

  /**
   * Emit error event
   */
  emitError(error: Error | TrackError | RaceError, trackCode?: string, raceNumber?: number): void {
    const event: ErrorEvent = {
      type: 'error',
      timestamp: new Date().toISOString(),
      jobId: this.jobId,
      trackCode,
      raceNumber,
      error,
    };
    this.emit(event);
    this.callbacks.onError?.(trackCode, error instanceof Error ? error : new Error(error.message));
  }

  /**
   * Emit warning event
   */
  emitWarning(message: string, trackCode?: string, raceNumber?: number): void {
    const event: WarningEvent = {
      type: 'warning',
      timestamp: new Date().toISOString(),
      jobId: this.jobId,
      trackCode,
      raceNumber,
      message,
    };
    this.emit(event);
    this.callbacks.onWarning?.(trackCode, message);
  }

  /**
   * Emit job complete event
   */
  emitJobComplete(result: MultiTrackResult): void {
    const event: JobCompleteEvent = {
      type: 'job_complete',
      timestamp: new Date().toISOString(),
      jobId: this.jobId,
      result,
    };
    this.emit(event);
    this.callbacks.onJobComplete?.(result);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private emit(event: AnyProgressEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[ProgressEmitter] Listener error:', err);
      }
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new progress emitter for a job
 *
 * @param jobId - Unique job identifier
 * @returns New ProgressEmitter instance
 */
export function createProgressEmitter(jobId: string): ProgressEmitter {
  return new ProgressEmitter(jobId);
}

// ============================================================================
// LOGGING PROGRESS EMITTER
// ============================================================================

/**
 * Create a progress emitter that logs all events to console
 * Useful for debugging and development
 *
 * @param jobId - Unique job identifier
 * @returns ProgressEmitter with console logging
 */
export function createLoggingProgressEmitter(jobId: string): ProgressEmitter {
  const emitter = new ProgressEmitter(jobId);

  emitter.subscribe((event) => {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();

    switch (event.type) {
      case 'job_start':
        console.log(
          `[${timestamp}] JOB START: ${event.totalTracks} tracks, ${event.totalRaces} races`
        );
        break;
      case 'track_start':
        console.log(`[${timestamp}] TRACK START: ${event.trackCode} (${event.raceCount} races)`);
        break;
      case 'track_complete':
        console.log(
          `[${timestamp}] TRACK COMPLETE: ${event.trackCode} - ${event.result.racesSuccessful}/${event.result.results.length} races successful`
        );
        break;
      case 'race_start':
        console.log(`[${timestamp}] RACE START: ${event.trackCode} Race ${event.raceNumber}`);
        break;
      case 'race_complete': {
        const status = event.result.analysis ? 'SUCCESS' : 'FAILED';
        console.log(
          `[${timestamp}] RACE COMPLETE: ${event.trackCode} Race ${event.raceNumber} - ${status}`
        );
        break;
      }
      case 'error': {
        const errorMsg =
          event.error instanceof Error ? event.error.message : (event.error as RaceError).message;
        console.error(`[${timestamp}] ERROR: ${event.trackCode || 'JOB'} - ${errorMsg}`);
        break;
      }
      case 'warning':
        console.warn(`[${timestamp}] WARNING: ${event.trackCode || 'JOB'} - ${event.message}`);
        break;
      case 'job_complete':
        console.log(
          `[${timestamp}] JOB COMPLETE: ${event.result.summary.successful}/${event.result.summary.totalRaces} races successful in ${event.result.summary.duration}ms`
        );
        break;
    }
  });

  return emitter;
}

export default createProgressEmitter;
