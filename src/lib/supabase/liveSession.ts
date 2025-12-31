/**
 * Live Session Service
 *
 * Handles all Supabase operations for live session sharing:
 * - Creating/ending sessions
 * - Syncing race and horse data
 * - Real-time subscriptions
 * - Viewer count management
 */

import { getSupabaseClient, isSupabaseConfigured } from './client';
import { generateShareCode } from './shareCode';
import type { DaySession } from '../betting/daySession';
import type { RaceAllocation } from '../betting/allocateDayBudget';
import type { MultiRaceBet } from '../betting/betTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface LiveSession {
  id: string;
  shareCode: string;
  trackName: string;
  trackCode: string;
  raceDate: string;
  totalBankroll: number | null;
  experienceLevel: string | null;
  riskStyle: string | null;
  isActive: boolean;
  viewerCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface LiveSessionRace {
  id: string;
  sessionId: string;
  raceNumber: number;
  verdict: string | null;
  confidence: string | null;
  valuePlayPost: number | null;
  valuePlayName: string | null;
  valuePlayOdds: string | null;
  valuePlayEdge: number | null;
  betSuggestions: Record<string, unknown> | null;
  trackCondition: string | null;
  allocatedBudget: number | null;
  updatedAt: string;
}

export interface LiveSessionHorse {
  id: string;
  sessionId: string;
  raceNumber: number;
  postPosition: number;
  horseName: string;
  morningLine: string | null;
  liveOdds: string | null;
  fairOdds: string | null;
  edge: number | null;
  isScratched: boolean;
  modelRank: number | null;
  valueStatus: string | null;
  updatedAt: string;
}

export interface LiveSessionMultiRace {
  id: string;
  sessionId: string;
  betType: string;
  startingRace: number;
  endingRace: number;
  legs: Record<string, unknown>;
  combinations: number | null;
  totalCost: number | null;
  potentialReturnMin: number | null;
  potentialReturnMax: number | null;
  quality: string | null;
  whatToSay: string | null;
  updatedAt: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database row to LiveSession interface
 */
function mapToLiveSession(row: Record<string, unknown>): LiveSession {
  return {
    id: row.id as string,
    shareCode: row.share_code as string,
    trackName: row.track_name as string,
    trackCode: row.track_code as string,
    raceDate: row.race_date as string,
    totalBankroll: row.total_bankroll as number | null,
    experienceLevel: row.experience_level as string | null,
    riskStyle: row.risk_style as string | null,
    isActive: row.is_active as boolean,
    viewerCount: row.viewer_count as number,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  };
}

/**
 * Map database row to LiveSessionRace interface
 */
function mapToLiveSessionRace(row: Record<string, unknown>): LiveSessionRace {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    raceNumber: row.race_number as number,
    verdict: row.verdict as string | null,
    confidence: row.confidence as string | null,
    valuePlayPost: row.value_play_post as number | null,
    valuePlayName: row.value_play_name as string | null,
    valuePlayOdds: row.value_play_odds as string | null,
    valuePlayEdge: row.value_play_edge as number | null,
    betSuggestions: row.bet_suggestions as Record<string, unknown> | null,
    trackCondition: row.track_condition as string | null,
    allocatedBudget: row.allocated_budget as number | null,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Map database row to LiveSessionHorse interface
 */
function mapToLiveSessionHorse(row: Record<string, unknown>): LiveSessionHorse {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    raceNumber: row.race_number as number,
    postPosition: row.post_position as number,
    horseName: row.horse_name as string,
    morningLine: row.morning_line as string | null,
    liveOdds: row.live_odds as string | null,
    fairOdds: row.fair_odds as string | null,
    edge: row.edge as number | null,
    isScratched: row.is_scratched as boolean,
    modelRank: row.model_rank as number | null,
    valueStatus: row.value_status as string | null,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Map database row to LiveSessionMultiRace interface
 */
function mapToLiveSessionMultiRace(row: Record<string, unknown>): LiveSessionMultiRace {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    betType: row.bet_type as string,
    startingRace: row.starting_race as number,
    endingRace: row.ending_race as number,
    legs: row.legs as Record<string, unknown>,
    combinations: row.combinations as number | null,
    totalCost: row.total_cost as number | null,
    potentialReturnMin: row.potential_return_min as number | null,
    potentialReturnMax: row.potential_return_max as number | null,
    quality: row.quality as string | null,
    whatToSay: row.what_to_say as string | null,
    updatedAt: row.updated_at as string,
  };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new live session from a DaySession
 */
export async function createLiveSession(
  daySession: DaySession,
  trackCode: string = ''
): Promise<{ session: LiveSession; shareCode: string } | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured - cannot create live session');
    return null;
  }

  const shareCode = generateShareCode();

  const { data, error } = await supabase
    .from('live_sessions')
    .insert({
      share_code: shareCode,
      track_name: daySession.trackName,
      track_code: trackCode || daySession.trackName.substring(0, 3).toUpperCase(),
      race_date: daySession.raceDate,
      total_bankroll: daySession.totalBankroll,
      experience_level: daySession.experienceLevel,
      risk_style: daySession.riskStyle,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating live session:', error);
    return null;
  }

  return {
    session: mapToLiveSession(data),
    shareCode,
  };
}

/**
 * Get live session by share code
 */
export async function getLiveSessionByCode(shareCode: string): Promise<LiveSession | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('share_code', shareCode.toLowerCase())
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return mapToLiveSession(data);
}

/**
 * Get live session by ID
 */
export async function getLiveSessionById(sessionId: string): Promise<LiveSession | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapToLiveSession(data);
}

/**
 * End a live session (mark as inactive)
 */
export async function endLiveSession(sessionId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from('live_sessions')
    .update({ is_active: false })
    .eq('id', sessionId);

  return !error;
}

// ============================================================================
// RACE DATA SYNC
// ============================================================================

/**
 * Sync all race data from a DaySession to the live session
 */
export async function syncAllRaces(
  sessionId: string,
  allocations: RaceAllocation[]
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const raceData = allocations.map((allocation) => ({
    session_id: sessionId,
    race_number: allocation.raceNumber,
    verdict: allocation.verdict,
    confidence: null, // RaceAllocation doesn't have confidence
    value_play_post: allocation.valuePlay?.programNumber ?? null,
    value_play_name: allocation.valuePlay?.horseName ?? null,
    value_play_odds: allocation.valuePlay?.currentOdds ?? null,
    value_play_edge: allocation.edge ?? null,
    allocated_budget: allocation.allocatedBudget,
  }));

  const { error } = await supabase
    .from('live_session_races')
    .upsert(raceData, { onConflict: 'session_id,race_number' });

  return !error;
}

/**
 * Update a single race in the live session
 */
export async function updateLiveSessionRace(
  sessionId: string,
  raceNumber: number,
  raceData: {
    verdict?: string;
    confidence?: string;
    valuePlayPost?: number | null;
    valuePlayName?: string | null;
    valuePlayOdds?: string | null;
    valuePlayEdge?: number | null;
    betSuggestions?: Record<string, unknown> | null;
    trackCondition?: string | null;
    allocatedBudget?: number | null;
  }
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from('live_session_races')
    .upsert(
      {
        session_id: sessionId,
        race_number: raceNumber,
        verdict: raceData.verdict,
        confidence: raceData.confidence,
        value_play_post: raceData.valuePlayPost,
        value_play_name: raceData.valuePlayName,
        value_play_odds: raceData.valuePlayOdds,
        value_play_edge: raceData.valuePlayEdge,
        bet_suggestions: raceData.betSuggestions,
        track_condition: raceData.trackCondition,
        allocated_budget: raceData.allocatedBudget,
      },
      { onConflict: 'session_id,race_number' }
    );

  return !error;
}

/**
 * Get all races for a live session
 */
export async function getLiveSessionRaces(sessionId: string): Promise<LiveSessionRace[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('live_session_races')
    .select('*')
    .eq('session_id', sessionId)
    .order('race_number', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapToLiveSessionRace);
}

// ============================================================================
// HORSE DATA SYNC
// ============================================================================

/**
 * Update a horse in the live session
 */
export async function updateLiveSessionHorse(
  sessionId: string,
  raceNumber: number,
  horseData: {
    postPosition: number;
    horseName: string;
    morningLine?: string | null;
    liveOdds?: string | null;
    fairOdds?: string | null;
    edge?: number | null;
    isScratched?: boolean;
    modelRank?: number | null;
    valueStatus?: string | null;
  }
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from('live_session_horses')
    .upsert(
      {
        session_id: sessionId,
        race_number: raceNumber,
        post_position: horseData.postPosition,
        horse_name: horseData.horseName,
        morning_line: horseData.morningLine,
        live_odds: horseData.liveOdds,
        fair_odds: horseData.fairOdds,
        edge: horseData.edge,
        is_scratched: horseData.isScratched ?? false,
        model_rank: horseData.modelRank,
        value_status: horseData.valueStatus,
      },
      { onConflict: 'session_id,race_number,post_position' }
    );

  return !error;
}

/**
 * Batch update multiple horses
 */
export async function updateLiveSessionHorses(
  sessionId: string,
  raceNumber: number,
  horses: Array<{
    postPosition: number;
    horseName: string;
    morningLine?: string | null;
    liveOdds?: string | null;
    fairOdds?: string | null;
    edge?: number | null;
    isScratched?: boolean;
    modelRank?: number | null;
    valueStatus?: string | null;
  }>
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const horseData = horses.map((horse) => ({
    session_id: sessionId,
    race_number: raceNumber,
    post_position: horse.postPosition,
    horse_name: horse.horseName,
    morning_line: horse.morningLine ?? null,
    live_odds: horse.liveOdds ?? null,
    fair_odds: horse.fairOdds ?? null,
    edge: horse.edge ?? null,
    is_scratched: horse.isScratched ?? false,
    model_rank: horse.modelRank ?? null,
    value_status: horse.valueStatus ?? null,
  }));

  const { error } = await supabase
    .from('live_session_horses')
    .upsert(horseData, { onConflict: 'session_id,race_number,post_position' });

  return !error;
}

/**
 * Get all horses for a race in a live session
 */
export async function getLiveSessionHorses(
  sessionId: string,
  raceNumber?: number
): Promise<LiveSessionHorse[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from('live_session_horses')
    .select('*')
    .eq('session_id', sessionId);

  if (raceNumber !== undefined) {
    query = query.eq('race_number', raceNumber);
  }

  const { data, error } = await query.order('post_position', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapToLiveSessionHorse);
}

// ============================================================================
// MULTI-RACE BET SYNC
// ============================================================================

/**
 * Sync multi-race bets to the live session
 */
export async function syncMultiRaceBets(
  sessionId: string,
  bets: MultiRaceBet[]
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  // First delete existing multi-race bets for this session
  await supabase.from('live_session_multi_race').delete().eq('session_id', sessionId);

  if (bets.length === 0) {
    return true;
  }

  const betData = bets.map((bet) => ({
    session_id: sessionId,
    bet_type: bet.type,
    starting_race: bet.startingRace,
    ending_race: bet.endingRace,
    legs: bet.legs as unknown as Record<string, unknown>,
    combinations: bet.combinations,
    total_cost: bet.totalCost,
    potential_return_min: bet.potentialReturn.min,
    potential_return_max: bet.potentialReturn.max,
    quality: bet.quality,
    what_to_say: bet.whatToSay,
  }));

  const { error } = await supabase.from('live_session_multi_race').insert(betData);

  return !error;
}

/**
 * Get multi-race bets for a live session
 */
export async function getLiveSessionMultiRaceBets(
  sessionId: string
): Promise<LiveSessionMultiRace[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('live_session_multi_race')
    .select('*')
    .eq('session_id', sessionId)
    .order('starting_race', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapToLiveSessionMultiRace);
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to live session updates (for viewers)
 * Returns an unsubscribe function
 */
export function subscribeToLiveSession(
  sessionId: string,
  callbacks: {
    onSessionUpdate?: (session: LiveSession) => void;
    onRaceUpdate?: (race: LiveSessionRace) => void;
    onHorseUpdate?: (horse: LiveSessionHorse) => void;
    onMultiRaceUpdate?: (bets: LiveSessionMultiRace[]) => void;
  }
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel(`live_session_${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_sessions',
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        if (callbacks.onSessionUpdate && payload.new) {
          callbacks.onSessionUpdate(mapToLiveSession(payload.new as Record<string, unknown>));
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_session_races',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        if (callbacks.onRaceUpdate && payload.new) {
          callbacks.onRaceUpdate(mapToLiveSessionRace(payload.new as Record<string, unknown>));
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_session_horses',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        if (callbacks.onHorseUpdate && payload.new) {
          callbacks.onHorseUpdate(mapToLiveSessionHorse(payload.new as Record<string, unknown>));
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_session_multi_race',
        filter: `session_id=eq.${sessionId}`,
      },
      async () => {
        // For multi-race, we reload all bets since the structure is complex
        if (callbacks.onMultiRaceUpdate) {
          const bets = await getLiveSessionMultiRaceBets(sessionId);
          callbacks.onMultiRaceUpdate(bets);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// VIEWER COUNT MANAGEMENT
// ============================================================================

/**
 * Increment viewer count when someone opens the live view
 */
export async function incrementViewerCount(sessionId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.rpc('increment_viewer_count', {
    session_uuid: sessionId,
  });

  return !error;
}

/**
 * Decrement viewer count when someone leaves the live view
 */
export async function decrementViewerCount(sessionId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.rpc('decrement_viewer_count', {
    session_uuid: sessionId,
  });

  return !error;
}

// ============================================================================
// EXPORT CHECK FUNCTION
// ============================================================================

/**
 * Check if live sharing is available (Supabase configured)
 */
export function isLiveSharingAvailable(): boolean {
  return isSupabaseConfigured();
}
