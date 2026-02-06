/**
 * Day Session State Management
 *
 * Manages the state of a day betting session including:
 * - Session persistence to localStorage
 * - Budget tracking
 * - Race completion tracking
 */

import type { RiskStyle, ExperienceLevel, MultiRaceBet } from './betTypes';
import { logger } from '../../services/logging';
import type { RaceAllocation } from './allocateDayBudget';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Race result tracking (for future use)
 */
export interface RaceResult {
  raceNumber: number;
  wagered: number;
  returned: number;
  betsPlaced: string[];
}

/**
 * Day session state
 */
export interface DaySession {
  /** Unique session ID */
  id: string;
  /** Session creation timestamp */
  createdAt: string;
  /** Track name */
  trackName: string;
  /** Race date (YYYY-MM-DD format) */
  raceDate: string;

  // Setup configuration
  /** Total bankroll for the day */
  totalBankroll: number;
  /** User's experience level */
  experienceLevel: ExperienceLevel;
  /** User's risk style */
  riskStyle: RiskStyle;

  // Allocations
  /** Budget allocations per race */
  raceAllocations: RaceAllocation[];
  /** Budget reserved for multi-race bets */
  multiRaceReserve: number;

  // Tracking
  /** Race numbers that have been marked as bet */
  racesCompleted: number[];
  /** Total amount wagered so far */
  amountWagered: number;
  /** Amount remaining from bankroll */
  amountRemaining: number;

  // Multi-race bets tracking
  /** Multi-race bets that have been added */
  multiRaceBets: MultiRaceBet[];
  /** Total wagered on multi-race bets */
  multiRaceWagered: number;

  // Optional: results tracking (future feature)
  results?: RaceResult[];
}

// ============================================================================
// STORAGE KEY
// ============================================================================

const STORAGE_KEY = 'handicap_day_session';

// ============================================================================
// SESSION MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `day_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const isoString = new Date().toISOString();
  return isoString.split('T')[0] ?? isoString.slice(0, 10);
}

/**
 * Create a new day session
 */
export function createDaySession(
  trackName: string,
  totalBankroll: number,
  experienceLevel: ExperienceLevel,
  riskStyle: RiskStyle,
  raceAllocations: RaceAllocation[],
  multiRaceReserve: number = 0
): DaySession {
  const session: DaySession = {
    id: generateSessionId(),
    createdAt: new Date().toISOString(),
    trackName,
    raceDate: getTodayDate(),
    totalBankroll,
    experienceLevel,
    riskStyle,
    raceAllocations,
    multiRaceReserve,
    racesCompleted: [],
    amountWagered: 0,
    amountRemaining: totalBankroll,
    multiRaceBets: [],
    multiRaceWagered: 0,
    results: [],
  };

  return session;
}

/**
 * Save session to localStorage
 */
export function saveDaySession(session: DaySession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (_error) {
    logger.logWarning('Failed to save day session to localStorage');
  }
}

/**
 * Load session from localStorage
 */
export function loadDaySession(): DaySession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as DaySession;

    // Validate session is still for today
    if (session.raceDate !== getTodayDate()) {
      // Session is from a different day, clear it
      clearDaySession();
      return null;
    }

    return session;
  } catch (_error) {
    logger.logWarning('Failed to load day session from localStorage');
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearDaySession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    logger.logWarning('Failed to clear day session from localStorage');
  }
}

/**
 * Check if there's an active day session
 */
export function hasActiveDaySession(): boolean {
  return loadDaySession() !== null;
}

// ============================================================================
// SESSION UPDATE FUNCTIONS
// ============================================================================

/**
 * Mark a race as bet (completed)
 */
export function markRaceAsBet(
  session: DaySession,
  raceNumber: number,
  amountWagered: number
): DaySession {
  // Don't double-count if already marked
  if (session.racesCompleted.includes(raceNumber)) {
    return session;
  }

  const updated: DaySession = {
    ...session,
    racesCompleted: [...session.racesCompleted, raceNumber],
    amountWagered: session.amountWagered + amountWagered,
    amountRemaining: session.amountRemaining - amountWagered,
  };

  saveDaySession(updated);
  return updated;
}

/**
 * Unmark a race as bet (undo)
 */
export function unmarkRaceAsBet(
  session: DaySession,
  raceNumber: number,
  amountRefunded: number
): DaySession {
  if (!session.racesCompleted.includes(raceNumber)) {
    return session;
  }

  const updated: DaySession = {
    ...session,
    racesCompleted: session.racesCompleted.filter((r) => r !== raceNumber),
    amountWagered: Math.max(0, session.amountWagered - amountRefunded),
    amountRemaining: session.amountRemaining + amountRefunded,
  };

  saveDaySession(updated);
  return updated;
}

/**
 * Update race allocations (for budget adjustments)
 */
export function updateRaceAllocations(
  session: DaySession,
  newAllocations: RaceAllocation[]
): DaySession {
  const updated: DaySession = {
    ...session,
    raceAllocations: newAllocations,
  };

  saveDaySession(updated);
  return updated;
}

/**
 * Get session progress stats
 */
export function getSessionProgress(session: DaySession): {
  totalRaces: number;
  completedRaces: number;
  remainingRaces: number;
  progressPercent: number;
  amountWagered: number;
  amountRemaining: number;
} {
  const totalRaces = session.raceAllocations.length;
  const completedRaces = session.racesCompleted.length;
  const remainingRaces = totalRaces - completedRaces;
  const progressPercent = totalRaces > 0 ? Math.round((completedRaces / totalRaces) * 100) : 0;

  return {
    totalRaces,
    completedRaces,
    remainingRaces,
    progressPercent,
    amountWagered: session.amountWagered,
    amountRemaining: session.amountRemaining,
  };
}

/**
 * Check if all races are complete
 */
export function isSessionComplete(session: DaySession): boolean {
  return session.racesCompleted.length >= session.raceAllocations.length;
}

/**
 * Get allocation for a specific race
 */
export function getRaceAllocation(session: DaySession, raceNumber: number): RaceAllocation | null {
  return session.raceAllocations.find((a) => a.raceNumber === raceNumber) ?? null;
}

/**
 * Check if a specific race has been marked as bet
 */
export function isRaceCompleted(session: DaySession, raceNumber: number): boolean {
  return session.racesCompleted.includes(raceNumber);
}

/**
 * Get summary stats for end of day
 */
export function getDaySummary(session: DaySession): {
  bankroll: number;
  totalWagered: number;
  totalRaces: number;
  racesBet: number;
  valueRacesBet: number;
  valueRacesBudget: number;
} {
  const valueRaces = session.raceAllocations.filter((a) => a.verdict === 'BET');
  const valueRacesBet = valueRaces.filter((a) =>
    session.racesCompleted.includes(a.raceNumber)
  ).length;
  const valueRacesBudget = valueRaces.reduce((sum, a) => sum + a.allocatedBudget, 0);

  return {
    bankroll: session.totalBankroll,
    totalWagered: session.amountWagered,
    totalRaces: session.raceAllocations.length,
    racesBet: session.racesCompleted.length,
    valueRacesBet,
    valueRacesBudget,
  };
}

// ============================================================================
// MULTI-RACE BET FUNCTIONS
// ============================================================================

/**
 * Add a multi-race bet to the session
 */
export function addMultiRaceBet(session: DaySession, bet: MultiRaceBet): DaySession {
  // Don't add duplicates
  if (session.multiRaceBets.some((b) => b.id === bet.id)) {
    return session;
  }

  const updated: DaySession = {
    ...session,
    multiRaceBets: [...session.multiRaceBets, { ...bet, isSelected: true }],
    multiRaceWagered: session.multiRaceWagered + bet.totalCost,
    amountRemaining: session.amountRemaining - bet.totalCost,
    amountWagered: session.amountWagered + bet.totalCost,
  };

  saveDaySession(updated);
  return updated;
}

/**
 * Remove a multi-race bet from the session
 */
export function removeMultiRaceBet(session: DaySession, betId: string): DaySession {
  const bet = session.multiRaceBets.find((b) => b.id === betId);
  if (!bet) return session;

  const updated: DaySession = {
    ...session,
    multiRaceBets: session.multiRaceBets.filter((b) => b.id !== betId),
    multiRaceWagered: Math.max(0, session.multiRaceWagered - bet.totalCost),
    amountRemaining: session.amountRemaining + bet.totalCost,
    amountWagered: Math.max(0, session.amountWagered - bet.totalCost),
  };

  saveDaySession(updated);
  return updated;
}

/**
 * Update a multi-race bet in the session
 */
export function updateMultiRaceBet(session: DaySession, updatedBet: MultiRaceBet): DaySession {
  const oldBet = session.multiRaceBets.find((b) => b.id === updatedBet.id);
  if (!oldBet) {
    // If not found, add as new
    return addMultiRaceBet(session, updatedBet);
  }

  const costDiff = updatedBet.totalCost - oldBet.totalCost;

  const updated: DaySession = {
    ...session,
    multiRaceBets: session.multiRaceBets.map((b) => (b.id === updatedBet.id ? updatedBet : b)),
    multiRaceWagered: session.multiRaceWagered + costDiff,
    amountRemaining: session.amountRemaining - costDiff,
    amountWagered: session.amountWagered + costDiff,
  };

  saveDaySession(updated);
  return updated;
}

/**
 * Get remaining multi-race reserve budget
 */
export function getMultiRaceRemaining(session: DaySession): number {
  return Math.max(0, session.multiRaceReserve - session.multiRaceWagered);
}

/**
 * Check if can afford a multi-race bet
 */
export function canAffordMultiRaceBet(session: DaySession, betCost: number): boolean {
  return betCost <= getMultiRaceRemaining(session);
}

/**
 * Get multi-race bet summary
 */
export function getMultiRaceSummary(session: DaySession): {
  reserve: number;
  wagered: number;
  remaining: number;
  betCount: number;
} {
  return {
    reserve: session.multiRaceReserve,
    wagered: session.multiRaceWagered,
    remaining: getMultiRaceRemaining(session),
    betCount: session.multiRaceBets.length,
  };
}
