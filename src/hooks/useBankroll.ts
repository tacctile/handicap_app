import { useState, useCallback, useMemo, useEffect } from 'react'

// Risk tolerance levels
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'

// Bet unit type
export type BetUnitType = 'percentage' | 'fixed'

// Daily budget type
export type DailyBudgetType = 'percentage' | 'fixed'

// Bankroll settings interface
export interface BankrollSettings {
  totalBankroll: number
  dailyBudgetType: DailyBudgetType
  dailyBudgetValue: number // Either dollar amount or percentage
  perRaceBudget: number
  riskTolerance: RiskTolerance
  betUnitType: BetUnitType
  betUnitValue: number // Either dollar amount or percentage
}

// Daily tracking interface
export interface DailyTracking {
  date: string // ISO date string
  spent: number
  races: number
}

// Risk tolerance unit percentages
const RISK_UNIT_RANGES: Record<RiskTolerance, { min: number; max: number }> = {
  conservative: { min: 1, max: 2 },
  moderate: { min: 2, max: 4 },
  aggressive: { min: 4, max: 6 },
}

const RISK_LABELS: Record<RiskTolerance, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
}

// Default settings
const DEFAULT_SETTINGS: BankrollSettings = {
  totalBankroll: 1000,
  dailyBudgetType: 'fixed',
  dailyBudgetValue: 200,
  perRaceBudget: 50,
  riskTolerance: 'moderate',
  betUnitType: 'percentage',
  betUnitValue: 3, // 3% for moderate
}

// Local storage keys
const STORAGE_KEY = 'horseMonster_bankroll_settings'
const TRACKING_KEY = 'horseMonster_bankroll_tracking'
const PL_KEY = 'horseMonster_daily_pl'

// Helper: get today's date as ISO string
function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export interface UseBankrollReturn {
  // Settings
  settings: BankrollSettings
  updateSettings: (newSettings: Partial<BankrollSettings>) => void
  resetToDefaults: () => void

  // Calculated values
  getDailyBudget: () => number
  getRaceBudget: () => number
  getUnitSize: () => number
  getRemainingDaily: () => number
  getSpentToday: () => number

  // Bet sizing helpers
  getBetAmount: (confidence: number, tierMultiplier?: number) => number
  getUnitMultiplier: (confidence: number) => number

  // Tracking
  recordSpending: (amount: number) => void
  getRacesPlayedToday: () => number
  resetDailyTracking: () => void

  // Warnings
  isApproachingLimit: () => boolean
  isOverBudget: () => boolean
  getWarningMessage: () => string | null

  // P&L tracking
  dailyPL: number
  updateDailyPL: (amount: number) => void
  resetDailyPL: () => void

  // Labels
  getRiskLabel: () => string
  formatCurrency: (amount: number) => string
  formatPercentage: (value: number) => string
}

export function useBankroll(): UseBankrollReturn {
  // Load settings from localStorage
  const [settings, setSettings] = useState<BankrollSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SETTINGS
  })

  // Load daily tracking from localStorage
  const [tracking, setTracking] = useState<DailyTracking>(() => {
    try {
      const stored = localStorage.getItem(TRACKING_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Reset if it's a new day
        if (parsed.date !== getTodayISO()) {
          return { date: getTodayISO(), spent: 0, races: 0 }
        }
        return parsed
      }
    } catch {
      // Ignore parse errors
    }
    return { date: getTodayISO(), spent: 0, races: 0 }
  })

  // Load daily P&L from localStorage
  const [dailyPL, setDailyPL] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(PL_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Reset if it's a new day
        if (parsed.date !== getTodayISO()) {
          return 0
        }
        return parsed.amount || 0
      }
    } catch {
      // Ignore parse errors
    }
    return 0
  })

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore storage errors
    }
  }, [settings])

  // Save tracking to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(TRACKING_KEY, JSON.stringify(tracking))
    } catch {
      // Ignore storage errors
    }
  }, [tracking])

  // Save P&L to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(PL_KEY, JSON.stringify({ date: getTodayISO(), amount: dailyPL }))
    } catch {
      // Ignore storage errors
    }
  }, [dailyPL])

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<BankrollSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  // Get calculated daily budget
  const getDailyBudget = useCallback((): number => {
    if (settings.dailyBudgetType === 'percentage') {
      return (settings.dailyBudgetValue / 100) * settings.totalBankroll
    }
    return settings.dailyBudgetValue
  }, [settings.dailyBudgetType, settings.dailyBudgetValue, settings.totalBankroll])

  // Get race budget
  const getRaceBudget = useCallback((): number => {
    return settings.perRaceBudget
  }, [settings.perRaceBudget])

  // Get unit size based on risk tolerance and settings
  const getUnitSize = useCallback((): number => {
    if (settings.betUnitType === 'fixed') {
      return settings.betUnitValue
    }

    // Use percentage of bankroll
    const percentage = settings.betUnitValue
    return (percentage / 100) * settings.totalBankroll
  }, [settings.betUnitType, settings.betUnitValue, settings.totalBankroll])

  // Get remaining daily budget
  const getRemainingDaily = useCallback((): number => {
    const daily = getDailyBudget()
    return Math.max(0, daily - tracking.spent)
  }, [getDailyBudget, tracking.spent])

  // Get amount spent today
  const getSpentToday = useCallback((): number => {
    return tracking.spent
  }, [tracking.spent])

  // Get unit multiplier based on confidence (1-3 units)
  const getUnitMultiplier = useCallback((confidence: number): number => {
    // Scale confidence (50-100) to multiplier (0.5-2.5)
    const normalized = Math.max(0, Math.min(100, confidence))
    const range = RISK_UNIT_RANGES[settings.riskTolerance]
    const avgPercentage = (range.min + range.max) / 2

    // Higher confidence = more units
    if (normalized >= 85) return 2.5
    if (normalized >= 75) return 2.0
    if (normalized >= 65) return 1.5
    if (normalized >= 55) return 1.0
    return 0.5 + (avgPercentage / 10) // Lower base for low confidence
  }, [settings.riskTolerance])

  // Get bet amount based on confidence and optional tier multiplier
  const getBetAmount = useCallback((confidence: number, tierMultiplier: number = 1): number => {
    const unitSize = getUnitSize()
    const multiplier = getUnitMultiplier(confidence)
    return Math.round(unitSize * multiplier * tierMultiplier)
  }, [getUnitSize, getUnitMultiplier])

  // Record spending
  const recordSpending = useCallback((amount: number) => {
    setTracking(prev => ({
      ...prev,
      spent: prev.spent + amount,
      races: prev.races + 1,
    }))
  }, [])

  // Get races played today
  const getRacesPlayedToday = useCallback((): number => {
    return tracking.races
  }, [tracking.races])

  // Reset daily tracking
  const resetDailyTracking = useCallback(() => {
    setTracking({ date: getTodayISO(), spent: 0, races: 0 })
  }, [])

  // Check if approaching limit (80% of daily budget)
  const isApproachingLimit = useCallback((): boolean => {
    const daily = getDailyBudget()
    return tracking.spent >= daily * 0.8 && tracking.spent < daily
  }, [getDailyBudget, tracking.spent])

  // Check if over budget
  const isOverBudget = useCallback((): boolean => {
    const daily = getDailyBudget()
    return tracking.spent >= daily
  }, [getDailyBudget, tracking.spent])

  // Get warning message
  const getWarningMessage = useCallback((): string | null => {
    if (isOverBudget()) {
      return 'Daily budget exceeded! Consider stopping for today.'
    }
    if (isApproachingLimit()) {
      const remaining = getRemainingDaily()
      return `Approaching daily limit. $${remaining.toFixed(0)} remaining.`
    }
    return null
  }, [isOverBudget, isApproachingLimit, getRemainingDaily])

  // Update daily P&L
  const updateDailyPL = useCallback((amount: number) => {
    setDailyPL(prev => prev + amount)
  }, [])

  // Reset daily P&L
  const resetDailyPL = useCallback(() => {
    setDailyPL(0)
  }, [])

  // Get risk label
  const getRiskLabel = useCallback((): string => {
    return RISK_LABELS[settings.riskTolerance]
  }, [settings.riskTolerance])

  // Format currency
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

  // Format percentage
  const formatPercentage = useCallback((value: number): string => {
    return `${value.toFixed(1)}%`
  }, [])

  return useMemo(() => ({
    settings,
    updateSettings,
    resetToDefaults,
    getDailyBudget,
    getRaceBudget,
    getUnitSize,
    getRemainingDaily,
    getSpentToday,
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
  }), [
    settings,
    updateSettings,
    resetToDefaults,
    getDailyBudget,
    getRaceBudget,
    getUnitSize,
    getRemainingDaily,
    getSpentToday,
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
  ])
}

export default useBankroll
