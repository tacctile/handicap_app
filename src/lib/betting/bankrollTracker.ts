/**
 * Bankroll Tracker Module
 *
 * Tracks betting session state including:
 * - Current bankroll
 * - Bets placed and results
 * - Session statistics (ROI, win rate, etc.)
 * - Optional localStorage persistence
 *
 * @module betting/bankrollTracker
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Current state of the bankroll
 */
export interface BankrollState {
  /** Current bankroll in dollars */
  currentBankroll: number;
  /** Starting bankroll for the session */
  startingBankroll: number;
  /** When the session started */
  sessionStart: Date;
  /** Total number of bets placed */
  betsPlaced: number;
  /** Number of winning bets */
  betsWon: number;
  /** Number of losing bets */
  betsLost: number;
  /** Total amount wagered */
  totalWagered: number;
  /** Total amount returned (including original stake on wins) */
  totalReturned: number;
  /** Net profit/loss */
  netProfit: number;
  /** Return on investment percentage */
  roi: number;
  /** Win rate percentage */
  winRate: number;
  /** Average bet size */
  averageBetSize: number;
  /** Largest single bet */
  largestBet: number;
  /** Largest single win */
  largestWin: number;
  /** Largest single loss */
  largestLoss: number;
  /** Current streak (positive = wins, negative = losses) */
  currentStreak: number;
  /** Longest winning streak */
  longestWinStreak: number;
  /** Longest losing streak */
  longestLossStreak: number;
}

/**
 * Individual bet record
 */
export interface BetRecord {
  /** Unique identifier */
  id: string;
  /** Amount wagered */
  amount: number;
  /** Whether the bet won */
  won: boolean;
  /** Payout received (0 if lost) */
  payout: number;
  /** Timestamp */
  timestamp: Date;
  /** Optional bet details */
  details?: {
    horseNumber?: number;
    horseName?: string;
    betType?: string;
    odds?: number;
    raceId?: string;
  };
}

/**
 * Serializable state for localStorage
 */
interface SerializableBankrollState {
  currentBankroll: number;
  startingBankroll: number;
  sessionStart: string; // ISO date string
  betsPlaced: number;
  betsWon: number;
  betsLost: number;
  totalWagered: number;
  totalReturned: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  largestBet: number;
  largestWin: number;
  largestLoss: number;
  betHistory: SerializableBetRecord[];
}

interface SerializableBetRecord {
  id: string;
  amount: number;
  won: boolean;
  payout: number;
  timestamp: string;
  details?: BetRecord['details'];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'furlong_betting_session';
const MAX_HISTORY_SIZE = 100; // Keep last 100 bets

// ============================================================================
// BANKROLL TRACKER CLASS
// ============================================================================

/**
 * BankrollTracker - Manages session betting state
 *
 * @example
 * const tracker = new BankrollTracker(500);
 * tracker.placeBet(20);
 * tracker.recordWin(60); // Won $60 on $20 bet
 * console.log(tracker.getState().roi); // ROI percentage
 */
export class BankrollTracker {
  private currentBankroll: number;
  private startingBankroll: number;
  private sessionStart: Date;
  private betsPlaced: number = 0;
  private betsWon: number = 0;
  private betsLost: number = 0;
  private totalWagered: number = 0;
  private totalReturned: number = 0;
  private currentStreak: number = 0;
  private longestWinStreak: number = 0;
  private longestLossStreak: number = 0;
  private largestBet: number = 0;
  private largestWin: number = 0;
  private largestLoss: number = 0;
  private betHistory: BetRecord[] = [];
  private pendingBetAmount: number = 0;

  /**
   * Create a new BankrollTracker
   *
   * @param startingBankroll - Initial bankroll in dollars
   * @param loadFromStorage - Whether to load saved state from localStorage
   */
  constructor(startingBankroll: number, loadFromStorage: boolean = false) {
    this.startingBankroll = startingBankroll;
    this.currentBankroll = startingBankroll;
    this.sessionStart = new Date();

    if (loadFromStorage) {
      this.loadState();
    }
  }

  /**
   * Place a bet (deduct from bankroll)
   *
   * @param amount - Bet amount in dollars
   * @param details - Optional bet details for tracking
   */
  placeBet(amount: number, details?: BetRecord['details']): void {
    if (amount <= 0) return;
    if (amount > this.currentBankroll) {
      throw new Error(`Insufficient bankroll: ${this.currentBankroll} < ${amount}`);
    }

    this.currentBankroll -= amount;
    this.totalWagered += amount;
    this.betsPlaced += 1;
    this.pendingBetAmount = amount;

    if (amount > this.largestBet) {
      this.largestBet = amount;
    }

    // Add to history (will be completed when result is recorded)
    this.betHistory.push({
      id: this.generateBetId(),
      amount,
      won: false, // Will be updated
      payout: 0, // Will be updated
      timestamp: new Date(),
      details,
    });

    // Trim history if needed
    if (this.betHistory.length > MAX_HISTORY_SIZE) {
      this.betHistory = this.betHistory.slice(-MAX_HISTORY_SIZE);
    }
  }

  /**
   * Record a winning bet
   *
   * @param payout - Total payout received (includes original stake)
   */
  recordWin(payout: number): void {
    this.currentBankroll += payout;
    this.totalReturned += payout;
    this.betsWon += 1;

    // Update streak
    if (this.currentStreak >= 0) {
      this.currentStreak += 1;
    } else {
      this.currentStreak = 1;
    }

    if (this.currentStreak > this.longestWinStreak) {
      this.longestWinStreak = this.currentStreak;
    }

    // Track largest win (profit, not payout)
    const profit = payout - this.pendingBetAmount;
    if (profit > this.largestWin) {
      this.largestWin = profit;
    }

    // Update last bet record
    const lastBet = this.betHistory[this.betHistory.length - 1];
    if (lastBet) {
      lastBet.won = true;
      lastBet.payout = payout;
    }

    this.pendingBetAmount = 0;
  }

  /**
   * Record a losing bet
   */
  recordLoss(): void {
    this.betsLost += 1;

    // Update streak
    if (this.currentStreak <= 0) {
      this.currentStreak -= 1;
    } else {
      this.currentStreak = -1;
    }

    if (Math.abs(this.currentStreak) > this.longestLossStreak) {
      this.longestLossStreak = Math.abs(this.currentStreak);
    }

    // Track largest loss
    if (this.pendingBetAmount > this.largestLoss) {
      this.largestLoss = this.pendingBetAmount;
    }

    // Update last bet record
    const lastBet = this.betHistory[this.betHistory.length - 1];
    if (lastBet) {
      lastBet.won = false;
      lastBet.payout = 0;
    }

    this.pendingBetAmount = 0;
  }

  /**
   * Get current bankroll state
   */
  getState(): BankrollState {
    const netProfit = this.currentBankroll - this.startingBankroll;
    const roi = this.totalWagered > 0 ? (netProfit / this.totalWagered) * 100 : 0;
    const winRate = this.betsPlaced > 0 ? (this.betsWon / this.betsPlaced) * 100 : 0;
    const averageBetSize = this.betsPlaced > 0 ? this.totalWagered / this.betsPlaced : 0;

    return {
      currentBankroll: this.currentBankroll,
      startingBankroll: this.startingBankroll,
      sessionStart: this.sessionStart,
      betsPlaced: this.betsPlaced,
      betsWon: this.betsWon,
      betsLost: this.betsLost,
      totalWagered: this.totalWagered,
      totalReturned: this.totalReturned,
      netProfit,
      roi,
      winRate,
      averageBetSize,
      largestBet: this.largestBet,
      largestWin: this.largestWin,
      largestLoss: this.largestLoss,
      currentStreak: this.currentStreak,
      longestWinStreak: this.longestWinStreak,
      longestLossStreak: this.longestLossStreak,
    };
  }

  /**
   * Get bet history
   */
  getBetHistory(): BetRecord[] {
    return [...this.betHistory];
  }

  /**
   * Reset session with new bankroll
   *
   * @param newBankroll - New starting bankroll
   */
  reset(newBankroll: number): void {
    this.startingBankroll = newBankroll;
    this.currentBankroll = newBankroll;
    this.sessionStart = new Date();
    this.betsPlaced = 0;
    this.betsWon = 0;
    this.betsLost = 0;
    this.totalWagered = 0;
    this.totalReturned = 0;
    this.currentStreak = 0;
    this.longestWinStreak = 0;
    this.longestLossStreak = 0;
    this.largestBet = 0;
    this.largestWin = 0;
    this.largestLoss = 0;
    this.betHistory = [];
    this.pendingBetAmount = 0;
    this.clearSavedState();
  }

  /**
   * Adjust bankroll (for deposits/withdrawals)
   *
   * @param amount - Amount to add (positive) or subtract (negative)
   */
  adjustBankroll(amount: number): void {
    this.currentBankroll += amount;
    if (amount > 0) {
      this.startingBankroll += amount; // Treat deposits as new starting capital
    }
  }

  /**
   * Save state to localStorage
   */
  saveState(): void {
    try {
      const state: SerializableBankrollState = {
        currentBankroll: this.currentBankroll,
        startingBankroll: this.startingBankroll,
        sessionStart: this.sessionStart.toISOString(),
        betsPlaced: this.betsPlaced,
        betsWon: this.betsWon,
        betsLost: this.betsLost,
        totalWagered: this.totalWagered,
        totalReturned: this.totalReturned,
        currentStreak: this.currentStreak,
        longestWinStreak: this.longestWinStreak,
        longestLossStreak: this.longestLossStreak,
        largestBet: this.largestBet,
        largestWin: this.largestWin,
        largestLoss: this.largestLoss,
        betHistory: this.betHistory.map((bet) => ({
          id: bet.id,
          amount: bet.amount,
          won: bet.won,
          payout: bet.payout,
          timestamp: bet.timestamp.toISOString(),
          details: bet.details,
        })),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors (e.g., private browsing)
    }
  }

  /**
   * Load state from localStorage
   */
  private loadState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const state: SerializableBankrollState = JSON.parse(stored);

      this.currentBankroll = state.currentBankroll;
      this.startingBankroll = state.startingBankroll;
      this.sessionStart = new Date(state.sessionStart);
      this.betsPlaced = state.betsPlaced;
      this.betsWon = state.betsWon;
      this.betsLost = state.betsLost;
      this.totalWagered = state.totalWagered;
      this.totalReturned = state.totalReturned;
      this.currentStreak = state.currentStreak;
      this.longestWinStreak = state.longestWinStreak;
      this.longestLossStreak = state.longestLossStreak;
      this.largestBet = state.largestBet;
      this.largestWin = state.largestWin;
      this.largestLoss = state.largestLoss;
      this.betHistory = state.betHistory.map((bet) => ({
        id: bet.id,
        amount: bet.amount,
        won: bet.won,
        payout: bet.payout,
        timestamp: new Date(bet.timestamp),
        details: bet.details,
      }));
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  /**
   * Clear saved state from localStorage
   */
  private clearSavedState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Generate unique bet ID
   */
  private generateBetId(): string {
    return `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// STANDALONE PERSISTENCE FUNCTIONS
// ============================================================================

/**
 * Save bankroll state to localStorage
 */
export function saveBankrollState(state: BankrollState): void {
  try {
    const serializable = {
      ...state,
      sessionStart: state.sessionStart.toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load bankroll state from localStorage
 */
export function loadBankrollState(): BankrollState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      sessionStart: new Date(parsed.sessionStart),
    };
  } catch {
    return null;
  }
}

/**
 * Clear saved bankroll state
 */
export function clearBankrollState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format bankroll state for display
 */
export function formatBankrollState(state: BankrollState): {
  bankroll: string;
  profit: string;
  profitClass: 'positive' | 'negative' | 'neutral';
  roi: string;
  winRate: string;
  betsPlaced: string;
  streak: string;
} {
  const profitClass =
    state.netProfit > 0 ? 'positive' : state.netProfit < 0 ? 'negative' : 'neutral';

  return {
    bankroll: `$${state.currentBankroll.toFixed(2)}`,
    profit: `${state.netProfit >= 0 ? '+' : ''}$${state.netProfit.toFixed(2)}`,
    profitClass,
    roi: `${state.roi >= 0 ? '+' : ''}${state.roi.toFixed(1)}%`,
    winRate: `${state.winRate.toFixed(1)}%`,
    betsPlaced: `${state.betsWon}W-${state.betsLost}L`,
    streak:
      state.currentStreak >= 0 ? `${state.currentStreak}W` : `${Math.abs(state.currentStreak)}L`,
  };
}

/**
 * Calculate session duration
 */
export function getSessionDuration(state: BankrollState): string {
  const now = new Date();
  const diffMs = now.getTime() - state.sessionStart.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Calculate risk of ruin based on current performance
 */
export function calculateSessionRisk(state: BankrollState): {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  percentRemaining: number;
  recommendation: string;
} {
  const percentRemaining = (state.currentBankroll / state.startingBankroll) * 100;

  if (percentRemaining >= 80) {
    return {
      riskLevel: 'LOW',
      percentRemaining,
      recommendation: 'Bankroll is healthy',
    };
  }

  if (percentRemaining >= 60) {
    return {
      riskLevel: 'MEDIUM',
      percentRemaining,
      recommendation: 'Consider reducing bet sizes',
    };
  }

  if (percentRemaining >= 40) {
    return {
      riskLevel: 'HIGH',
      percentRemaining,
      recommendation: 'Reduce bet sizes significantly or take a break',
    };
  }

  return {
    riskLevel: 'CRITICAL',
    percentRemaining,
    recommendation: 'Consider stopping for today',
  };
}
