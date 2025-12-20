/**
 * Kelly Criterion Settings Module
 *
 * Manages Kelly Criterion preferences stored in bankroll settings:
 * - Enable/disable Kelly Criterion (off by default)
 * - Fraction: Full Kelly (100%), Half Kelly (50%), Quarter Kelly (25%)
 * - Maximum bet cap: 5%, 10%, or 15% of bankroll
 * - Minimum edge required: 5%, 10%, or 15% overlay
 *
 * Risk tolerance defaults:
 * - Conservative: Quarter Kelly, 5% max, 15% edge required
 * - Moderate: Half Kelly, 10% max, 10% edge required
 * - Aggressive: Full Kelly, 15% max, 5% edge required
 *
 * @module betting/kellySettings
 */

// ============================================================================
// TYPES
// ============================================================================

/** Kelly fraction options */
export type KellyFraction = 'quarter' | 'half' | 'full'

/** Risk tolerance levels for Kelly */
export type RiskToleranceKelly = 'conservative' | 'moderate' | 'aggressive'

/** Kelly Criterion settings */
export interface KellySettings {
  /** Whether Kelly Criterion is enabled */
  enabled: boolean
  /** Kelly fraction to use */
  kellyFraction: KellyFraction
  /** Maximum bet as percentage of bankroll (1-20) */
  maxBetPercent: number
  /** Minimum edge required to bet (1-25) */
  minEdgeRequired: number
}

/** Kelly preset configuration */
export interface KellyPreset {
  /** Preset name */
  name: string
  /** Description */
  description: string
  /** Settings for this preset */
  settings: Omit<KellySettings, 'enabled'>
}

/** Kelly display info for UI */
export interface KellyDisplayInfo {
  label: string
  shortLabel: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  color: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default Kelly settings */
export const DEFAULT_KELLY_SETTINGS: KellySettings = {
  enabled: false, // Off by default
  kellyFraction: 'quarter',
  maxBetPercent: 10,
  minEdgeRequired: 10,
}

/** Kelly fraction options for UI */
export const KELLY_FRACTION_OPTIONS: Array<{
  value: KellyFraction
  label: string
  shortLabel: string
  description: string
  multiplier: number
}> = [
  {
    value: 'quarter',
    label: 'Quarter Kelly (1/4)',
    shortLabel: '1/4 Kelly',
    description: 'Safest option - 25% of optimal bet',
    multiplier: 0.25,
  },
  {
    value: 'half',
    label: 'Half Kelly (1/2)',
    shortLabel: '1/2 Kelly',
    description: 'Balanced - 50% of optimal bet',
    multiplier: 0.50,
  },
  {
    value: 'full',
    label: 'Full Kelly',
    shortLabel: 'Full Kelly',
    description: 'Optimal growth but higher variance',
    multiplier: 1.00,
  },
]

/** Maximum bet percentage options */
export const MAX_BET_PERCENT_OPTIONS = [
  { value: 5, label: '5%', description: 'Very conservative' },
  { value: 10, label: '10%', description: 'Standard max' },
  { value: 15, label: '15%', description: 'Aggressive max' },
  { value: 20, label: '20%', description: 'Very aggressive' },
]

/** Minimum edge required options */
export const MIN_EDGE_OPTIONS = [
  { value: 5, label: '5%', description: 'Accept small edges' },
  { value: 10, label: '10%', description: 'Standard threshold' },
  { value: 15, label: '15%', description: 'Require clear edge' },
  { value: 20, label: '20%', description: 'Strong edges only' },
  { value: 25, label: '25%', description: 'Premium edges only' },
]

/** Risk tolerance presets */
export const KELLY_RISK_PRESETS: Record<RiskToleranceKelly, KellyPreset> = {
  conservative: {
    name: 'Conservative',
    description: 'Lower risk with Quarter Kelly, strict edge requirements',
    settings: {
      kellyFraction: 'quarter',
      maxBetPercent: 5,
      minEdgeRequired: 15,
    },
  },
  moderate: {
    name: 'Moderate',
    description: 'Balanced approach with Half Kelly',
    settings: {
      kellyFraction: 'half',
      maxBetPercent: 10,
      minEdgeRequired: 10,
    },
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Maximum growth potential with Full Kelly',
    settings: {
      kellyFraction: 'full',
      maxBetPercent: 15,
      minEdgeRequired: 5,
    },
  },
}

/** Kelly fraction display info */
export const KELLY_FRACTION_INFO: Record<KellyFraction, KellyDisplayInfo> = {
  quarter: {
    label: 'Quarter Kelly',
    shortLabel: '1/4',
    description: 'Recommended for most bettors. Sacrifices ~6% growth for 75% less variance.',
    riskLevel: 'low',
    color: '#22c55e', // green
  },
  half: {
    label: 'Half Kelly',
    shortLabel: '1/2',
    description: 'Good balance of growth and risk. About 75% of optimal growth rate.',
    riskLevel: 'medium',
    color: '#f59e0b', // amber
  },
  full: {
    label: 'Full Kelly',
    shortLabel: 'Full',
    description: 'Maximum expected growth but high variance. Not for the faint-hearted.',
    riskLevel: 'high',
    color: '#ef4444', // red
  },
}

// ============================================================================
// SETTINGS HELPERS
// ============================================================================

/**
 * Get Kelly settings for a risk tolerance level
 */
export function getKellyPresetForRisk(riskTolerance: RiskToleranceKelly): KellySettings {
  const preset = KELLY_RISK_PRESETS[riskTolerance]
  return {
    enabled: true,
    ...preset.settings,
  }
}

/**
 * Merge user settings with defaults
 */
export function mergeKellySettings(
  userSettings: Partial<KellySettings> | undefined
): KellySettings {
  if (!userSettings) {
    return { ...DEFAULT_KELLY_SETTINGS }
  }

  return {
    enabled: userSettings.enabled ?? DEFAULT_KELLY_SETTINGS.enabled,
    kellyFraction: userSettings.kellyFraction ?? DEFAULT_KELLY_SETTINGS.kellyFraction,
    maxBetPercent: userSettings.maxBetPercent ?? DEFAULT_KELLY_SETTINGS.maxBetPercent,
    minEdgeRequired: userSettings.minEdgeRequired ?? DEFAULT_KELLY_SETTINGS.minEdgeRequired,
  }
}

/**
 * Validate Kelly settings
 */
export function validateKellySettings(settings: Partial<KellySettings>): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (settings.maxBetPercent !== undefined) {
    if (settings.maxBetPercent < 1 || settings.maxBetPercent > 20) {
      errors.push('Max bet percent must be between 1% and 20%')
    }
  }

  if (settings.minEdgeRequired !== undefined) {
    if (settings.minEdgeRequired < 1 || settings.minEdgeRequired > 25) {
      errors.push('Minimum edge must be between 1% and 25%')
    }
  }

  if (settings.kellyFraction !== undefined) {
    if (!['quarter', 'half', 'full'].includes(settings.kellyFraction)) {
      errors.push('Invalid Kelly fraction')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Get Kelly fraction multiplier
 */
export function getKellyMultiplier(fraction: KellyFraction): number {
  const option = KELLY_FRACTION_OPTIONS.find(o => o.value === fraction)
  return option?.multiplier ?? 0.25
}

/**
 * Get display label for Kelly fraction
 */
export function getKellyFractionLabel(fraction: KellyFraction): string {
  return KELLY_FRACTION_INFO[fraction]?.label ?? 'Quarter Kelly'
}

/**
 * Get short label for Kelly fraction (for compact display)
 */
export function getKellyFractionShortLabel(fraction: KellyFraction): string {
  return KELLY_FRACTION_INFO[fraction]?.shortLabel ?? '1/4'
}

// ============================================================================
// KELLY EDUCATION CONTENT
// ============================================================================

/** Kelly Criterion explanations for help center */
export const KELLY_EDUCATION = {
  title: 'Kelly Criterion for Bet Sizing',

  overview: `
The Kelly Criterion is a mathematical formula for optimal bet sizing.
It tells you exactly what percentage of your bankroll to wager on each bet
to maximize long-term growth while avoiding ruin.
  `.trim(),

  formula: `
Kelly Formula: f* = (bp - q) / b

Where:
• f* = fraction of bankroll to wager
• b = decimal odds - 1 (net profit if you win)
• p = your estimated probability of winning
• q = probability of losing (1 - p)
  `.trim(),

  example: `
Example: 20% edge at 5/1 odds

• Your win probability: 25% (0.25)
• Decimal odds: 6.0 (5/1 + 1)
• b = 6.0 - 1 = 5
• p = 0.25, q = 0.75

f* = (5 × 0.25 - 0.75) / 5
f* = (1.25 - 0.75) / 5
f* = 0.50 / 5
f* = 0.10 (10%)

Full Kelly says bet 10% of your bankroll.
Quarter Kelly (safer): 2.5% of bankroll.
  `.trim(),

  whyFractional: `
Why Use Fractional Kelly (1/4 or 1/2)?

Full Kelly is mathematically optimal but has drawbacks:
• High variance - your bankroll will swing wildly
• Assumes perfect probability estimates (we're never perfect)
• One bad streak can devastate your bankroll

Quarter Kelly is recommended because:
• Sacrifices only ~6% of growth rate
• Reduces variance by 75%
• Much smoother ride for your bankroll
• More forgiving of estimation errors
  `.trim(),

  warnings: [
    'Never bet if Kelly is negative (you have no edge)',
    'Kelly assumes you know true probabilities (you don\'t perfectly)',
    'Full Kelly can lead to 90% drawdowns even with an edge',
    'Start with Quarter Kelly until you trust your estimates',
    'Kelly is for long-term growth, not short-term wins',
  ],

  glossary: {
    edge: 'Your probability advantage over the implied odds',
    overlay: 'When your estimated probability exceeds the implied probability',
    underlay: 'When your estimated probability is below the implied probability - don\'t bet!',
    implied_probability: 'The probability suggested by the odds (1/decimal odds)',
    fractional_kelly: 'Using a fraction (1/4, 1/2) of the full Kelly to reduce variance',
    expected_growth: 'The geometric mean of expected bankroll growth per bet',
  },
}

/**
 * Get Kelly education section by key
 */
export function getKellyEducation(section: keyof typeof KELLY_EDUCATION): string | string[] | Record<string, string> {
  return KELLY_EDUCATION[section]
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

const KELLY_SETTINGS_KEY = 'furlong_kelly_settings'

/**
 * Load Kelly settings from localStorage
 */
export function loadKellySettings(): KellySettings {
  try {
    const stored = localStorage.getItem(KELLY_SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return mergeKellySettings(parsed)
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_KELLY_SETTINGS }
}

/**
 * Save Kelly settings to localStorage
 */
export function saveKellySettings(settings: KellySettings): void {
  try {
    localStorage.setItem(KELLY_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Reset Kelly settings to defaults
 */
export function resetKellySettings(): void {
  try {
    localStorage.removeItem(KELLY_SETTINGS_KEY)
  } catch {
    // Ignore storage errors
  }
}
