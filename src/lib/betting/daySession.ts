/**
 * Day Session State Management
 *
 * Manages the state of a day betting session including:
 * - Session persistence to localStorage
 * - Budget tracking
 * - Race completion tracking
 */

import type { RiskStyle, ExperienceLevel } from './betTypes';
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

  // Tracking
  /** Race numbers that have been marked as bet */
  racesCompleted: number[];
  /** Total amount wagered so far */
  amountWagered: number;
  /** Amount remaining from bankroll */
  amountRemaining: number;

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
  return new Date().toISOString().split('T')[0];
}

/**
 * Create a new day session
 */
export function createDaySession(
  trackName: string,
  totalBankroll: number,
  experienceLevel: ExperienceLevel,
  riskStyle: RiskStyle,
  raceAllocations: RaceAllocation[]
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
    racesCompleted: [],
    amountWagered: 0,
    amountRemaining: totalBankroll,
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
  } catch (error) {
    console.warn('Failed to save day session to localStorage:', error);
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
  } catch (error) {
    console.warn('Failed to load day session from localStorage:', error);
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearDaySession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear day session from localStorage:', error);
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
export function getRaceAllocation(
  session: DaySession,
  raceNumber: number
): RaceAllocation | null {
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
