/**
 * Supabase Module Exports
 */

export { supabase, getSupabaseClient, isSupabaseConfigured } from './client';
export type { Database } from './client';

export {
  generateShareCode,
  isValidShareCode,
  normalizeShareCode,
  getShareUrl,
  extractShareCodeFromUrl,
} from './shareCode';

export {
  createLiveSession,
  getLiveSessionByCode,
  getLiveSessionById,
  endLiveSession,
  syncAllRaces,
  updateLiveSessionRace,
  getLiveSessionRaces,
  updateLiveSessionHorse,
  updateLiveSessionHorses,
  getLiveSessionHorses,
  syncMultiRaceBets,
  getLiveSessionMultiRaceBets,
  subscribeToLiveSession,
  incrementViewerCount,
  decrementViewerCount,
  isLiveSharingAvailable,
} from './liveSession';

export type {
  LiveSession,
  LiveSessionRace,
  LiveSessionHorse,
  LiveSessionMultiRace,
} from './liveSession';
