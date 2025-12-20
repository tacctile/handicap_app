/**
 * Dutch Booking Settings Module
 *
 * Manages Dutch booking preferences stored in bankroll settings:
 * - Enable/disable Dutch booking (off by default)
 * - Minimum edge required: 5%, 7.5%, 10%
 * - Maximum horses in Dutch: 2, 3, 4, 5
 * - Preferred allocation % of race budget
 *
 * @module dutch/dutchSettings
 */

// ============================================================================
// TYPES
// ============================================================================

/** Dutch booking settings */
export interface DutchSettings {
  /** Whether Dutch booking is enabled */
  enabled: boolean
  /** Minimum edge required (percentage) */
  minEdgeRequired: number
  /** Maximum horses in Dutch */
  maxHorses: number
  /** Preferred allocation of race budget (0-100%) */
  budgetAllocation: number
  /** Show Dutch opportunities automatically */
  showAutomatically: boolean
  /** Only show overlay horses */
  overlayOnly: boolean
  /** Prefer tier-mixed combinations */
  preferMixedTiers: boolean
}

/** Risk preset for Dutch settings */
export type DutchRiskPreset = 'conservative' | 'moderate' | 'aggressive'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default Dutch settings */
export const DEFAULT_DUTCH_SETTINGS: DutchSettings = {
  enabled: false, // Off by default
  minEdgeRequired: 5,
  maxHorses: 4,
  budgetAllocation: 50,
  showAutomatically: true,
  overlayOnly: false,
  preferMixedTiers: true,
}

/** Edge requirement options for UI */
export const DUTCH_EDGE_OPTIONS = [
  { value: 3, label: '3%', description: 'Accept smaller edges' },
  { value: 5, label: '5%', description: 'Standard threshold' },
  { value: 7.5, label: '7.5%', description: 'Require good edge' },
  { value: 10, label: '10%', description: 'Strong edges only' },
  { value: 15, label: '15%', description: 'Premium edges only' },
]

/** Maximum horses options */
export const DUTCH_MAX_HORSES_OPTIONS = [
  { value: 2, label: '2 horses', description: 'Concentrated' },
  { value: 3, label: '3 horses', description: 'Balanced (recommended)' },
  { value: 4, label: '4 horses', description: 'Broad coverage' },
  { value: 5, label: '5 horses', description: 'Wide spread' },
]

/** Budget allocation options */
export const DUTCH_ALLOCATION_OPTIONS = [
  { value: 25, label: '25%', description: 'Small portion' },
  { value: 50, label: '50%', description: 'Half budget' },
  { value: 75, label: '75%', description: 'Most of budget' },
  { value: 100, label: '100%', description: 'Full race budget' },
]

/** Risk presets */
export const DUTCH_RISK_PRESETS: Record<
  DutchRiskPreset,
  { name: string; description: string; settings: Omit<DutchSettings, 'enabled'> }
> = {
  conservative: {
    name: 'Conservative',
    description: 'Higher edge requirements, fewer horses',
    settings: {
      minEdgeRequired: 10,
      maxHorses: 3,
      budgetAllocation: 25,
      showAutomatically: true,
      overlayOnly: true,
      preferMixedTiers: true,
    },
  },
  moderate: {
    name: 'Moderate',
    description: 'Balanced approach',
    settings: {
      minEdgeRequired: 5,
      maxHorses: 4,
      budgetAllocation: 50,
      showAutomatically: true,
      overlayOnly: false,
      preferMixedTiers: true,
    },
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Lower edge threshold, more horses',
    settings: {
      minEdgeRequired: 3,
      maxHorses: 5,
      budgetAllocation: 75,
      showAutomatically: true,
      overlayOnly: false,
      preferMixedTiers: false,
    },
  },
}

/** Dutch education content */
export const DUTCH_EDUCATION = {
  title: 'Dutch Booking Strategy',

  overview: `
Dutch booking spreads your risk across multiple horses while guaranteeing
profit if any of your selected horses wins. It's a powerful strategy when
overlay opportunities exist in a race.
  `.trim(),

  howItWorks: `
The Dutch book formula calculates bet amounts so that your return is the same
regardless of which selected horse wins:

For each horse: Bet = (Total Stake × Implied Prob) / Sum of All Implied Probs

This creates an "arbitrage" opportunity when the combined implied probabilities
are less than 100%, giving you an edge.
  `.trim(),

  example: `
Example with $100 total stake:
• Horse A at 2/1 (33% implied)
• Horse B at 5/1 (16.7% implied)
• Horse C at 8/1 (11.1% implied)
• Sum: 60.8% (39.2% edge!)

Bet amounts:
• $54.77 on Horse A
• $27.47 on Horse B
• $18.26 on Horse C

If ANY wins: Return ≈ $164 (profit $64, 64% ROI)
  `.trim(),

  requirements: [
    'Combined implied probabilities must be < 100%',
    'At least 2 horses required',
    'Recommend 3-4 horses for optimal balance',
    'All selected horses should have positive overlays',
  ],

  benefits: [
    'Guaranteed profit if any selected horse wins',
    'Distributes risk across multiple outcomes',
    'Removes emotional bias from betting',
    'Works well with overlay detection',
  ],

  warnings: [
    'Only works when combined book is < 100%',
    'Spreads your money thin across multiple bets',
    'All selected horses must lose for you to lose',
    'Edge decreases as more horses are added',
  ],
}

// ============================================================================
// SETTINGS HELPERS
// ============================================================================

/**
 * Get Dutch settings for a risk tolerance level
 */
export function getDutchPresetForRisk(riskPreset: DutchRiskPreset): DutchSettings {
  const preset = DUTCH_RISK_PRESETS[riskPreset]
  return {
    enabled: true,
    ...preset.settings,
  }
}

/**
 * Merge user settings with defaults
 */
export function mergeDutchSettings(
  userSettings: Partial<DutchSettings> | undefined
): DutchSettings {
  if (!userSettings) {
    return { ...DEFAULT_DUTCH_SETTINGS }
  }

  return {
    enabled: userSettings.enabled ?? DEFAULT_DUTCH_SETTINGS.enabled,
    minEdgeRequired: userSettings.minEdgeRequired ?? DEFAULT_DUTCH_SETTINGS.minEdgeRequired,
    maxHorses: userSettings.maxHorses ?? DEFAULT_DUTCH_SETTINGS.maxHorses,
    budgetAllocation: userSettings.budgetAllocation ?? DEFAULT_DUTCH_SETTINGS.budgetAllocation,
    showAutomatically: userSettings.showAutomatically ?? DEFAULT_DUTCH_SETTINGS.showAutomatically,
    overlayOnly: userSettings.overlayOnly ?? DEFAULT_DUTCH_SETTINGS.overlayOnly,
    preferMixedTiers: userSettings.preferMixedTiers ?? DEFAULT_DUTCH_SETTINGS.preferMixedTiers,
  }
}

/**
 * Validate Dutch settings
 */
export function validateDutchSettings(settings: Partial<DutchSettings>): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (settings.minEdgeRequired !== undefined) {
    if (settings.minEdgeRequired < 0 || settings.minEdgeRequired > 50) {
      errors.push('Minimum edge must be between 0% and 50%')
    }
  }

  if (settings.maxHorses !== undefined) {
    if (settings.maxHorses < 2 || settings.maxHorses > 10) {
      errors.push('Maximum horses must be between 2 and 10')
    }
  }

  if (settings.budgetAllocation !== undefined) {
    if (settings.budgetAllocation < 1 || settings.budgetAllocation > 100) {
      errors.push('Budget allocation must be between 1% and 100%')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

const DUTCH_SETTINGS_KEY = 'furlong_dutch_settings'

/**
 * Load Dutch settings from localStorage
 */
export function loadDutchSettings(): DutchSettings {
  try {
    const stored = localStorage.getItem(DUTCH_SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return mergeDutchSettings(parsed)
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_DUTCH_SETTINGS }
}

/**
 * Save Dutch settings to localStorage
 */
export function saveDutchSettings(settings: DutchSettings): void {
  try {
    localStorage.setItem(DUTCH_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Reset Dutch settings to defaults
 */
export function resetDutchSettings(): void {
  try {
    localStorage.removeItem(DUTCH_SETTINGS_KEY)
  } catch {
    // Ignore storage errors
  }
}
