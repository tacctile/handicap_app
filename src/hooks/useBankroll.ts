import { useState, useCallback, useMemo, useEffect } from 'react';

// Experience levels for simplified UI
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

// Complexity mode levels (legacy, maps to experience levels)
export type ComplexityMode = 'simple' | 'moderate' | 'advanced';

// Betting styles for Simple mode
export type BettingStyle = 'safe' | 'balanced' | 'aggressive';

// Bet types for Moderate mode
export type BetType = 'win_place' | 'exacta' | 'trifecta' | 'superfecta' | 'multi_race';

// Experience level info for UI display
export const EXPERIENCE_LEVEL_INFO: Record<
  ExperienceLevel,
  { label: string; icon: string; description: string; maxBets: number }
> = {
  beginner: {
    label: 'Beginner',
    icon: 'school',
    description: 'Simple bets with clear guidance',
    maxBets: 3,
  },
  intermediate: {
    label: 'Intermediate',
    icon: 'trending_up',
    description: 'Win bets plus exacta/trifecta boxes',
    maxBets: 5,
  },
  advanced: {
    label: 'Advanced',
    icon: 'psychology',
    description: 'All bet types with full EV data',
    maxBets: 999, // No limit
  },
};

// Risk tolerance levels
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

// Bet unit type
export type BetUnitType = 'percentage' | 'fixed';

// Daily budget type
export type DailyBudgetType = 'percentage' | 'fixed';

// Simple mode settings
export interface SimpleModeSettings {
  raceBudget: number;
  bettingStyle: BettingStyle;
}

// Moderate mode settings
export interface ModerateModeSettings {
  raceBudget: number;
  riskLevel: RiskTolerance;
  selectedBetTypes: BetType[];
}

// Bankroll settings interface
export interface BankrollSettings {
  // Mode selection
  complexityMode: ComplexityMode;

  // Experience level for simplified UI
  experienceLevel: ExperienceLevel;

  // Simple mode fields
  simpleRaceBudget: number;
  simpleBettingStyle: BettingStyle;

  // Moderate mode fields
  moderateRaceBudget: number;
  moderateRiskLevel: RiskTolerance;
  moderateSelectedBetTypes: BetType[];

  // Advanced mode fields (existing)
  totalBankroll: number;
  dailyBudgetType: DailyBudgetType;
  dailyBudgetValue: number; // Either dollar amount or percentage
  perRaceBudget: number;
  riskTolerance: RiskTolerance;
  betUnitType: BetUnitType;
  betUnitValue: number; // Either dollar amount or percentage
}

// Daily tracking interface
export interface DailyTracking {
  date: string; // ISO date string
  spent: number;
  races: number;
}

// Risk tolerance unit percentages
const RISK_UNIT_RANGES: Record<RiskTolerance, { min: number; max: number }> = {
  conservative: { min: 1, max: 2 },
  moderate: { min: 2, max: 4 },
  aggressive: { min: 4, max: 6 },
};

const RISK_LABELS: Record<RiskTolerance, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
};

// Betting style labels and descriptions
export const BETTING_STYLE_INFO: Record<
  BettingStyle,
  { label: string; emoji: string; description: string }
> = {
  safe: {
    label: 'Play It Safe',
    emoji: '🎯',
    description: 'Win, Place and Show bets only, favorites',
  },
  balanced: {
    label: 'Balanced Mix',
    emoji: '⚖️',
    description: 'Win, Place, Show and Exactas on top picks',
  },
  aggressive: {
    label: 'Swing for Fences',
    emoji: '🎲',
    description: 'All bet types including longshots',
  },
};

// Bet type labels
export const BET_TYPE_LABELS: Record<BetType, string> = {
  win_place: 'Win/Place bets',
  exacta: 'Exacta boxes',
  trifecta: 'Trifecta combos',
  superfecta: 'Superfectas',
  multi_race: 'Daily Doubles/Pick 3s',
};

// Expected return ranges by risk and bet types
export function getExpectedReturnRange(riskLevel: RiskTolerance, betTypes: BetType[]): string {
  const hasExotics = betTypes.some((t) => ['trifecta', 'superfecta', 'multi_race'].includes(t));

  if (riskLevel === 'conservative') {
    return hasExotics ? '0.8x - 2.5x' : '0.9x - 1.5x';
  } else if (riskLevel === 'moderate') {
    return hasExotics ? '0.5x - 5x' : '0.7x - 2x';
  } else {
    return hasExotics ? '0x - 20x' : '0.3x - 4x';
  }
}

// Default settings
const DEFAULT_SETTINGS: BankrollSettings = {
  // Mode - defaults to simple for new users
  complexityMode: 'simple',

  // Experience level - defaults to beginner for new users
  experienceLevel: 'beginner',

  // Simple mode defaults
  simpleRaceBudget: 20,
  simpleBettingStyle: 'balanced',

  // Moderate mode defaults
  moderateRaceBudget: 100,
  moderateRiskLevel: 'moderate',
  moderateSelectedBetTypes: ['win_place', 'exacta'],

  // Advanced mode defaults (existing)
  totalBankroll: 1000,
  dailyBudgetType: 'fixed',
  dailyBudgetValue: 200,
  perRaceBudget: 50,
  riskTolerance: 'moderate',
  betUnitType: 'percentage',
  betUnitValue: 3, // 3% for moderate
};

// Local storage keys
const STORAGE_KEY = 'furlong_bankroll_settings';
const TRACKING_KEY = 'furlong_bankroll_tracking';
const PL_KEY = 'furlong_daily_pl';

// Helper: get today's date as ISO string
function getTodayISO(): string {
  const datePart = new Date().toISOString().split('T')[0];
  if (!datePart) {
    throw new Error('Failed to extract date from ISO string');
  }
  return datePart;
}

export interface UseBankrollReturn {
  // Settings
  settings: BankrollSettings;
  updateSettings: (newSettings: Partial<BankrollSettings>) => void;
  resetToDefaults: () => void;

  // Experience level
  getExperienceLevel: () => ExperienceLevel;

  // Mode-aware getters
  getComplexityMode: () => ComplexityMode;
  getSimpleSettings: () => SimpleModeSettings;
  getModerateSettings: () => ModerateModeSettings;
  getBettingStyleLabel: () => string;
  getSelectedBetTypesLabel: () => string;

  // Calculated values
  getDailyBudget: () => number;
  getRaceBudget: () => number;
  getUnitSize: () => number;
  getRemainingDaily: () => number;
  getSpentToday: () => number;
  getExpectedReturn: () => string;

  // Bet sizing helpers
  getBetAmount: (confidence: number, tierMultiplier?: number) => number;
  getUnitMultiplier: (confidence: number) => number;

  // Tracking
  recordSpending: (amount: number) => void;
  getRacesPlayedToday: () => number;
  resetDailyTracking: () => void;

  // Warnings
  isApproachingLimit: () => boolean;
  isOverBudget: () => boolean;
  getWarningMessage: () => string | null;

  // P&L tracking
  dailyPL: number;
  updateDailyPL: (amount: number) => void;
  resetDailyPL: () => void;

  // Labels
  getRiskLabel: () => string;
  formatCurrency: (amount: number) => string;
  formatPercentage: (value: number) => string;
}

export function useBankroll(): UseBankrollReturn {
  // Load settings from localStorage
  const [settings, setSettings] = useState<BankrollSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SETTINGS;
  });

  // Load daily tracking from localStorage
  const [tracking, setTracking] = useState<DailyTracking>(() => {
    try {
      const stored = localStorage.getItem(TRACKING_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Reset if it's a new day
        if (parsed.date !== getTodayISO()) {
          return { date: getTodayISO(), spent: 0, races: 0 };
        }
        return parsed;
      }
    } catch {
      // Ignore parse errors
    }
    return { date: getTodayISO(), spent: 0, races: 0 };
  });

  // Load daily P&L from localStorage
  const [dailyPL, setDailyPL] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(PL_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Reset if it's a new day
        if (parsed.date !== getTodayISO()) {
          return 0;
        }
        return parsed.amount || 0;
      }
    } catch {
      // Ignore parse errors
    }
    return 0;
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  // Save tracking to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(TRACKING_KEY, JSON.stringify(tracking));
    } catch {
      // Ignore storage errors
    }
  }, [tracking]);

  // Save P&L to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(PL_KEY, JSON.stringify({ date: getTodayISO(), amount: dailyPL }));
    } catch {
      // Ignore storage errors
    }
  }, [dailyPL]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<BankrollSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Get calculated daily budget
  const getDailyBudget = useCallback((): number => {
    if (settings.dailyBudgetType === 'percentage') {
      return (settings.dailyBudgetValue / 100) * settings.totalBankroll;
    }
    return settings.dailyBudgetValue;
  }, [settings.dailyBudgetType, settings.dailyBudgetValue, settings.totalBankroll]);

  // Get complexity mode
  const getComplexityMode = useCallback((): ComplexityMode => {
    return settings.complexityMode;
  }, [settings.complexityMode]);

  // Get experience level
  const getExperienceLevel = useCallback((): ExperienceLevel => {
    return settings.experienceLevel;
  }, [settings.experienceLevel]);

  // Get simple mode settings
  const getSimpleSettings = useCallback((): SimpleModeSettings => {
    return {
      raceBudget: settings.simpleRaceBudget,
      bettingStyle: settings.simpleBettingStyle,
    };
  }, [settings.simpleRaceBudget, settings.simpleBettingStyle]);

  // Get moderate mode settings
  const getModerateSettings = useCallback((): ModerateModeSettings => {
    return {
      raceBudget: settings.moderateRaceBudget,
      riskLevel: settings.moderateRiskLevel,
      selectedBetTypes: settings.moderateSelectedBetTypes,
    };
  }, [settings.moderateRaceBudget, settings.moderateRiskLevel, settings.moderateSelectedBetTypes]);

  // Get betting style label for Simple mode
  const getBettingStyleLabel = useCallback((): string => {
    const info = BETTING_STYLE_INFO[settings.simpleBettingStyle];
    return `${info.emoji} ${info.label}`;
  }, [settings.simpleBettingStyle]);

  // Get selected bet types label for Moderate mode
  const getSelectedBetTypesLabel = useCallback((): string => {
    const labels = settings.moderateSelectedBetTypes.map((t) => {
      switch (t) {
        case 'win_place':
          return 'Win';
        case 'exacta':
          return 'Exacta';
        case 'trifecta':
          return 'Trifecta';
        case 'superfecta':
          return 'Super';
        case 'multi_race':
          return 'Multi';
        default:
          return t;
      }
    });
    return labels.join(', ');
  }, [settings.moderateSelectedBetTypes]);

  // Get expected return range for Moderate mode
  const getExpectedReturn = useCallback((): string => {
    return getExpectedReturnRange(settings.moderateRiskLevel, settings.moderateSelectedBetTypes);
  }, [settings.moderateRiskLevel, settings.moderateSelectedBetTypes]);

  // Get race budget - mode aware
  const getRaceBudget = useCallback((): number => {
    switch (settings.complexityMode) {
      case 'simple':
        return settings.simpleRaceBudget;
      case 'moderate':
        return settings.moderateRaceBudget;
      case 'advanced':
      default:
        return settings.perRaceBudget;
    }
  }, [
    settings.complexityMode,
    settings.simpleRaceBudget,
    settings.moderateRaceBudget,
    settings.perRaceBudget,
  ]);

  // Get unit size based on risk tolerance and settings
  const getUnitSize = useCallback((): number => {
    if (settings.betUnitType === 'fixed') {
      return settings.betUnitValue;
    }

    // Use percentage of bankroll
    const percentage = settings.betUnitValue;
    return (percentage / 100) * settings.totalBankroll;
  }, [settings.betUnitType, settings.betUnitValue, settings.totalBankroll]);

  // Get remaining daily budget
  const getRemainingDaily = useCallback((): number => {
    const daily = getDailyBudget();
    return Math.max(0, daily - tracking.spent);
  }, [getDailyBudget, tracking.spent]);

  // Get amount spent today
  const getSpentToday = useCallback((): number => {
    return tracking.spent;
  }, [tracking.spent]);

  // Get unit multiplier based on confidence (1-3 units)
  const getUnitMultiplier = useCallback(
    (confidence: number): number => {
      // Scale confidence (50-100) to multiplier (0.5-2.5)
      const normalized = Math.max(0, Math.min(100, confidence));
      const range = RISK_UNIT_RANGES[settings.riskTolerance];
      const avgPercentage = (range.min + range.max) / 2;

      // Higher confidence = more units
      if (normalized >= 85) return 2.5;
      if (normalized >= 75) return 2.0;
      if (normalized >= 65) return 1.5;
      if (normalized >= 55) return 1.0;
      return 0.5 + avgPercentage / 10; // Lower base for low confidence
    },
    [settings.riskTolerance]
  );

  // Get bet amount based on confidence and optional tier multiplier
  const getBetAmount = useCallback(
    (confidence: number, tierMultiplier: number = 1): number => {
      const unitSize = getUnitSize();
      const multiplier = getUnitMultiplier(confidence);
      return Math.round(unitSize * multiplier * tierMultiplier);
    },
    [getUnitSize, getUnitMultiplier]
  );

  // Record spending
  const recordSpending = useCallback((amount: number) => {
    setTracking((prev) => ({
      ...prev,
      spent: prev.spent + amount,
      races: prev.races + 1,
    }));
  }, []);

  // Get races played today
  const getRacesPlayedToday = useCallback((): number => {
    return tracking.races;
  }, [tracking.races]);

  // Reset daily tracking
  const resetDailyTracking = useCallback(() => {
    setTracking({ date: getTodayISO(), spent: 0, races: 0 });
  }, []);

  // Check if approaching limit (80% of daily budget)
  const isApproachingLimit = useCallback((): boolean => {
    const daily = getDailyBudget();
    return tracking.spent >= daily * 0.8 && tracking.spent < daily;
  }, [getDailyBudget, tracking.spent]);

  // Check if over budget
  const isOverBudget = useCallback((): boolean => {
    const daily = getDailyBudget();
    return tracking.spent >= daily;
  }, [getDailyBudget, tracking.spent]);

  // Get warning message
  const getWarningMessage = useCallback((): string | null => {
    if (isOverBudget()) {
      return 'Daily budget exceeded! Consider stopping for today.';
    }
    if (isApproachingLimit()) {
      const remaining = getRemainingDaily();
      return `Approaching daily limit. $${remaining.toFixed(0)} remaining.`;
    }
    return null;
  }, [isOverBudget, isApproachingLimit, getRemainingDaily]);

  // Update daily P&L
  const updateDailyPL = useCallback((amount: number) => {
    setDailyPL((prev) => prev + amount);
  }, []);

  // Reset daily P&L
  const resetDailyPL = useCallback(() => {
    setDailyPL(0);
  }, []);

  // Get risk label
  const getRiskLabel = useCallback((): string => {
    return RISK_LABELS[settings.riskTolerance];
  }, [settings.riskTolerance]);

  // Format currency
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  // Format percentage
  const formatPercentage = useCallback((value: number): string => {
    return `${value.toFixed(1)}%`;
  }, []);

  return useMemo(
    () => ({
      settings,
      updateSettings,
      resetToDefaults,
      getExperienceLevel,
      getComplexityMode,
      getSimpleSettings,
      getModerateSettings,
      getBettingStyleLabel,
      getSelectedBetTypesLabel,
      getDailyBudget,
      getRaceBudget,
      getUnitSize,
      getRemainingDaily,
      getSpentToday,
      getExpectedReturn,
      getBetAmount,
      getUnitMultiplier,
      recordSpending,
      getRacesPlayedToday,
      resetDailyTracking,
      isApproachingLimit,
      isOverBudget,
      getWarningMessage,
      dailyPL,
      updateDailyPL,
      resetDailyPL,
      getRiskLabel,
      formatCurrency,
      formatPercentage,
    }),
    [
      settings,
      updateSettings,
      resetToDefaults,
      getExperienceLevel,
      getComplexityMode,
      getSimpleSettings,
      getModerateSettings,
      getBettingStyleLabel,
      getSelectedBetTypesLabel,
      getDailyBudget,
      getRaceBudget,
      getUnitSize,
      getRemainingDaily,
      getSpentToday,
      getExpectedReturn,
      getBetAmount,
      getUnitMultiplier,
      recordSpending,
      getRacesPlayedToday,
      resetDailyTracking,
      isApproachingLimit,
      isOverBudget,
      getWarningMessage,
      dailyPL,
      updateDailyPL,
      resetDailyPL,
      getRiskLabel,
      formatCurrency,
      formatPercentage,
    ]
  );
}

export default useBankroll;
