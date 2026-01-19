/**
 * Multi-Track Orchestration Types
 *
 * Type definitions for the orchestration layer that enables
 * parallel processing of multiple tracks with 4 AI bots per race.
 */

import type { ParsedRace } from '../../types/drf';
import type { AIRaceAnalysis } from '../ai/types';

// ============================================================================
// TRACK JOB TYPES
// ============================================================================

/**
 * A job representing a single track with races to analyze
 */
export interface TrackJob {
  /** Track code (e.g., "SAR", "CD", "GP") */
  trackCode: string;
  /** Array of parsed races for this track */
  races: ParsedRace[];
  /** Priority level (1 = highest, larger = lower priority) */
  priority?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// RACE ANALYSIS RESULT TYPES
// ============================================================================

/**
 * Result of analyzing a single race with 4 bots
 */
export interface RaceAnalysisResult {
  /** Race number */
  raceNumber: number;
  /** Track code */
  trackCode: string;
  /** AI analysis result (null if all bots failed) */
  analysis: AIRaceAnalysis | null;
  /** Processing time for this race in milliseconds */
  duration: number;
  /** Errors encountered during analysis */
  errors: RaceError[];
  /** Number of successful bot analyses (0-4) */
  successfulBots: number;
  /** Timestamp when analysis completed */
  completedAt: string;
}

/**
 * Error information for a race analysis
 */
export interface RaceError {
  /** Which bot or operation failed */
  source:
    | 'tripTrouble'
    | 'paceScenario'
    | 'vulnerableFavorite'
    | 'fieldSpread'
    | 'combiner'
    | 'unknown';
  /** Error message */
  message: string;
  /** Error code if available */
  code?: string;
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Timestamp when error occurred */
  timestamp: string;
}

// ============================================================================
// TRACK RESULT TYPES
// ============================================================================

/**
 * Result of processing all races for a single track
 */
export interface TrackResult {
  /** Track code */
  trackCode: string;
  /** Results for each race analyzed */
  results: RaceAnalysisResult[];
  /** Errors that occurred at the track level (not race-specific) */
  errors: TrackError[];
  /** Total processing duration in milliseconds */
  duration: number;
  /** Number of races successfully analyzed */
  racesSuccessful: number;
  /** Number of races that failed entirely */
  racesFailed: number;
  /** Whether processing was stopped early (circuit breaker) */
  circuitBroken: boolean;
  /** Reason for circuit break if applicable */
  circuitBreakReason?: string;
  /** Timestamp when track processing started */
  startedAt: string;
  /** Timestamp when track processing completed */
  completedAt: string;
}

/**
 * Track-level error
 */
export interface TrackError {
  /** Error message */
  message: string;
  /** Error code if available */
  code?: string;
  /** Which race triggered the error (null if track-level) */
  raceNumber?: number;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// MULTI-TRACK RESULT TYPES
// ============================================================================

/**
 * Result of processing multiple tracks
 */
export interface MultiTrackResult {
  /** Results for each track */
  tracks: TrackResult[];
  /** Summary statistics */
  summary: ProcessingSummary;
  /** Job ID for tracking */
  jobId: string;
  /** Timestamp when job started */
  startedAt: string;
  /** Timestamp when job completed */
  completedAt: string;
}

/**
 * Summary statistics for a multi-track processing job
 */
export interface ProcessingSummary {
  /** Total number of races across all tracks */
  totalRaces: number;
  /** Number of races successfully analyzed */
  successful: number;
  /** Number of races that failed */
  failed: number;
  /** Number of races skipped (due to circuit breaker) */
  skipped: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Total number of API calls made */
  totalApiCalls: number;
  /** Number of API calls that succeeded */
  successfulApiCalls: number;
  /** Number of API calls that failed */
  failedApiCalls: number;
  /** Number of retries performed */
  retries: number;
  /** Average processing time per race in milliseconds */
  avgTimePerRace: number;
  /** Number of tracks that completed successfully */
  tracksComplete: number;
  /** Number of tracks that failed entirely */
  tracksFailed: number;
  /** Number of tracks that were circuit broken */
  tracksCircuitBroken: number;
}

// ============================================================================
// PROCESSING STATUS TYPES
// ============================================================================

/**
 * Current status of orchestrator processing
 */
export interface ProcessingStatus {
  /** Whether processing is currently active */
  active: boolean;
  /** Current state of the job */
  state: ProcessingState;
  /** Number of tracks that have completed */
  tracksComplete: number;
  /** Total number of tracks to process */
  tracksTotal: number;
  /** Current track being processed (if any) */
  currentTrack?: string;
  /** Current race being processed (if any) */
  currentRace?: number;
  /** Total races processed so far */
  racesProcessed: number;
  /** Total races to process */
  racesTotal: number;
  /** Timestamp when processing started */
  startedAt?: string;
  /** Estimated time remaining in milliseconds (null if unknown) */
  estimatedTimeRemaining?: number | null;
  /** Current job ID */
  jobId?: string;
}

/**
 * Processing state enum
 */
export type ProcessingState =
  | 'idle'
  | 'starting'
  | 'processing'
  | 'paused'
  | 'completing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ============================================================================
// PROGRESS EVENT TYPES
// ============================================================================

/**
 * Progress event types for callbacks
 */
export type ProgressEventType =
  | 'job_start'
  | 'track_start'
  | 'track_complete'
  | 'race_start'
  | 'race_complete'
  | 'error'
  | 'warning'
  | 'job_complete';

/**
 * Base progress event
 */
export interface ProgressEvent {
  /** Event type */
  type: ProgressEventType;
  /** Timestamp */
  timestamp: string;
  /** Job ID */
  jobId: string;
}

/**
 * Job start event
 */
export interface JobStartEvent extends ProgressEvent {
  type: 'job_start';
  totalTracks: number;
  totalRaces: number;
}

/**
 * Track start event
 */
export interface TrackStartEvent extends ProgressEvent {
  type: 'track_start';
  trackCode: string;
  raceCount: number;
}

/**
 * Track complete event
 */
export interface TrackCompleteEvent extends ProgressEvent {
  type: 'track_complete';
  trackCode: string;
  result: TrackResult;
}

/**
 * Race start event
 */
export interface RaceStartEvent extends ProgressEvent {
  type: 'race_start';
  trackCode: string;
  raceNumber: number;
}

/**
 * Race complete event
 */
export interface RaceCompleteEvent extends ProgressEvent {
  type: 'race_complete';
  trackCode: string;
  raceNumber: number;
  result: RaceAnalysisResult;
}

/**
 * Error event
 */
export interface ErrorEvent extends ProgressEvent {
  type: 'error';
  trackCode?: string;
  raceNumber?: number;
  error: Error | TrackError | RaceError;
}

/**
 * Warning event
 */
export interface WarningEvent extends ProgressEvent {
  type: 'warning';
  trackCode?: string;
  raceNumber?: number;
  message: string;
}

/**
 * Job complete event
 */
export interface JobCompleteEvent extends ProgressEvent {
  type: 'job_complete';
  result: MultiTrackResult;
}

/**
 * Union type for all progress events
 */
export type AnyProgressEvent =
  | JobStartEvent
  | TrackStartEvent
  | TrackCompleteEvent
  | RaceStartEvent
  | RaceCompleteEvent
  | ErrorEvent
  | WarningEvent
  | JobCompleteEvent;

// ============================================================================
// CALLBACK TYPES
// ============================================================================

/**
 * Progress callback function type
 */
export type ProgressCallback = (event: AnyProgressEvent) => void;

/**
 * Individual event callbacks
 */
export interface ProgressCallbacks {
  onJobStart?: (event: JobStartEvent) => void;
  onTrackStart?: (trackCode: string) => void;
  onTrackComplete?: (trackCode: string, result: TrackResult) => void;
  onRaceStart?: (trackCode: string, raceNumber: number) => void;
  onRaceComplete?: (trackCode: string, raceNumber: number, result: RaceAnalysisResult) => void;
  onError?: (trackCode: string | undefined, error: Error) => void;
  onWarning?: (trackCode: string | undefined, message: string) => void;
  onJobComplete?: (result: MultiTrackResult) => void;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Orchestrator configuration options
 */
export interface OrchestratorConfig {
  /** Maximum number of tracks to process concurrently (default: 2) */
  maxConcurrentTracks: number;
  /** Maximum number of API calls at any time (default: 6) */
  maxConcurrentApiCalls: number;
  /** Maximum retries per failed API call (default: 3) */
  maxRetries: number;
  /** Retry delays in milliseconds (default: [1000, 2000, 4000]) */
  retryDelays: number[];
  /** Number of failures to trigger circuit breaker per track (default: 5) */
  circuitBreakerThreshold: number;
  /** Rate limit for API calls per minute (default: 120) */
  rateLimitPerMinute: number;
  /** Enable adaptive throttling (default: true) */
  adaptiveThrottling: boolean;
  /** Timeout for single race analysis in ms (default: 60000) */
  raceTimeoutMs: number;
  /** Timeout for entire job in ms (default: 600000 = 10 min) */
  jobTimeoutMs: number;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxConcurrentTracks: 2,
  maxConcurrentApiCalls: 6, // 4 bots × 1.5 buffer
  maxRetries: 3,
  retryDelays: [1000, 2000, 4000], // Exponential backoff: 1s, 2s, 4s
  circuitBreakerThreshold: 5,
  rateLimitPerMinute: 120,
  adaptiveThrottling: true,
  raceTimeoutMs: 60000,
  jobTimeoutMs: 600000, // 10 minutes
};

// ============================================================================
// CONCURRENCY MANAGER TYPES
// ============================================================================

/**
 * Result of attempting to acquire a slot
 */
export interface SlotAcquisitionResult {
  /** Whether the slot was acquired */
  acquired: boolean;
  /** Slot ID if acquired (for release) */
  slotId?: string;
  /** Time waited in ms if had to wait */
  waitTime?: number;
  /** Reason if not acquired */
  reason?: string;
}

/**
 * Concurrency manager statistics
 */
export interface ConcurrencyStats {
  /** Currently active track slots */
  activeTrackSlots: number;
  /** Maximum track slots */
  maxTrackSlots: number;
  /** Currently active API slots */
  activeApiSlots: number;
  /** Maximum API slots */
  maxApiSlots: number;
  /** Requests waiting for track slot */
  trackQueueLength: number;
  /** Requests waiting for API slot */
  apiQueueLength: number;
}

// ============================================================================
// API JOB TYPES (for serverless endpoints)
// ============================================================================

/**
 * Request body for /api/analyze-tracks endpoint
 */
export interface AnalyzeTracksRequest {
  /** Tracks to analyze */
  tracks: TrackJob[];
  /** Optional configuration overrides */
  config?: Partial<OrchestratorConfig>;
}

/**
 * Response from /api/analyze-tracks endpoint
 */
export interface AnalyzeTracksResponse {
  /** Job ID for tracking */
  jobId: string;
  /** Status message */
  message: string;
  /** Estimated completion time in ms */
  estimatedTimeMs?: number;
}

/**
 * Response from /api/job-status endpoint
 */
export interface JobStatusResponse {
  /** Job ID */
  jobId: string;
  /** Current status */
  status: ProcessingStatus;
  /** Result if complete */
  result?: MultiTrackResult;
  /** Error if failed */
  error?: string;
}

/**
 * In-memory job storage entry
 */
export interface JobEntry {
  /** Job ID */
  jobId: string;
  /** Current status */
  status: ProcessingStatus;
  /** Result if complete */
  result?: MultiTrackResult;
  /** Request that created this job */
  request: AnalyzeTracksRequest;
  /** Timestamp when job was created */
  createdAt: string;
  /** Timestamp when job was last updated */
  updatedAt: string;
  /** Error message if failed */
  error?: string;
}
