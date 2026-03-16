/**
 * TwinSpires Live Data Service Types
 *
 * Type definitions for the TwinSpires entries API integration.
 * Maps live odds, scratches, and odds trend data from TwinSpires
 * to the internal DRF-based data model.
 */

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Odds trend data point from TwinSpires API
 */
export interface TwinSpiresOddsTrendEntry {
  oddsNumeric: number;
  oddsText: string;
  change: number;
}

/**
 * Odds trend history from TwinSpires API.
 * Contains current and up to 4 historical snapshots.
 */
export interface TwinSpiresOddsTrend {
  current: TwinSpiresOddsTrendEntry | null;
  odds2: TwinSpiresOddsTrendEntry | null;
  odds3: TwinSpiresOddsTrendEntry | null;
  odds4: TwinSpiresOddsTrendEntry | null;
  odds5: TwinSpiresOddsTrendEntry | null;
}

/**
 * Single horse entry from TwinSpires entries endpoint.
 * Matches the confirmed API response shape.
 */
export interface TwinSpiresEntry {
  startId: number;
  programNumber: string;
  postPosition: number;
  name: string;
  liveOdds: string | null;
  scratched: boolean;
  morningLineOdds: string;
  liveOddsFavorite: boolean;
  oddsTrend: TwinSpiresOddsTrend | null;
}

// ============================================================================
// INTERNAL DATA TYPES
// ============================================================================

/**
 * Processed race data from a single TwinSpires API call.
 * Wraps the raw entries with metadata.
 */
export interface TwinSpiresRaceData {
  raceNumber: number;
  trackCode: string;
  raceType: string;
  entries: TwinSpiresEntry[];
  fetchedAt: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/** Error codes for TwinSpires API failures */
export type TwinSpiresErrorCode = 'NETWORK' | 'TIMEOUT' | 'PARSE' | 'TRACK_MISMATCH';

/**
 * Typed error for TwinSpires API failures.
 */
export interface TwinSpiresError {
  code: TwinSpiresErrorCode;
  message: string;
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

/**
 * Connection status for the TwinSpires polling service.
 * - disconnected: Not connected, no polling active
 * - connecting: Initial connection/validation in progress
 * - polling: Actively polling and receiving data
 * - error: A fatal error occurred (e.g., TRACK_MISMATCH)
 * - paused: Temporarily paused (e.g., tab hidden)
 */
export type TwinSpiresConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'polling'
  | 'error'
  | 'paused';
