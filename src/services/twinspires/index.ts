/**
 * TwinSpires Service Barrel Export
 *
 * Re-exports all types, client functions, and mapper utilities
 * for the TwinSpires live data integration.
 */

// Types
export type {
  TwinSpiresEntry,
  TwinSpiresRaceData,
  TwinSpiresError,
  TwinSpiresErrorCode,
  TwinSpiresConnectionStatus,
  TwinSpiresOddsTrend,
  TwinSpiresOddsTrendEntry,
} from './types';

// Client
export { fetchTwinSpiresEntries, buildEntriesUrl } from './client';

// Mapper
export {
  mapTwinSpiresEntriesToOdds,
  mapTwinSpiresEntriesToScratches,
  validateTrackMatch,
  extractTrackInfoFromUrl,
} from './mapper';
