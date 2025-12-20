/**
 * Feature Flags Service
 *
 * Simple feature flag system for toggling features on/off.
 * Defaults all flags to OFF for safe gradual rollout.
 *
 * Flags can be overridden via:
 * - localStorage (for development)
 * - Environment variables (for deployment)
 * - Programmatically (for testing)
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * All available feature flags
 */
export type FeatureFlagName =
  | 'AUTH_ENABLED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'AI_FEATURES_ENABLED'
  | 'DEBUG_MODE'
  | 'MOCK_DATA_ENABLED'
  | 'ANALYTICS_ENABLED'
  | 'BETA_FEATURES'

/**
 * Feature flag definition with metadata
 */
export interface FeatureFlagDefinition {
  /** Default value if not overridden */
  defaultValue: boolean
  /** Description for documentation */
  description: string
  /** Whether this flag can be toggled in production */
  allowProdOverride: boolean
}

/**
 * Record of all feature flags and their values
 */
export type FeatureFlags = Record<FeatureFlagName, boolean>

// ============================================================================
// FLAG DEFINITIONS
// ============================================================================

/**
 * All feature flag definitions with defaults
 *
 * IMPORTANT: All flags default to OFF (false) for safe deployment
 */
export const FLAG_DEFINITIONS: Record<FeatureFlagName, FeatureFlagDefinition> = {
  AUTH_ENABLED: {
    defaultValue: false,
    description: 'Enable authentication requirement for protected routes',
    allowProdOverride: true,
  },
  SUBSCRIPTION_REQUIRED: {
    defaultValue: false,
    description: 'Enable subscription requirement for premium features',
    allowProdOverride: true,
  },
  AI_FEATURES_ENABLED: {
    defaultValue: false,
    description: 'Enable AI-powered features (requires API connection)',
    allowProdOverride: true,
  },
  DEBUG_MODE: {
    defaultValue: false,
    description: 'Enable debug logging and developer tools',
    allowProdOverride: false,
  },
  MOCK_DATA_ENABLED: {
    defaultValue: false,
    description: 'Use mock data instead of real services',
    allowProdOverride: false,
  },
  ANALYTICS_ENABLED: {
    defaultValue: false,
    description: 'Enable usage analytics tracking',
    allowProdOverride: true,
  },
  BETA_FEATURES: {
    defaultValue: false,
    description: 'Enable experimental beta features',
    allowProdOverride: true,
  },
}

// ============================================================================
// FEATURE FLAG SERVICE
// ============================================================================

const STORAGE_KEY = 'handicap_app_feature_flags'

/**
 * Feature flags service singleton
 */
class FeatureFlagService {
  private flags: FeatureFlags
  private listeners: Set<(flags: FeatureFlags) => void> = new Set()
  private initialized = false

  constructor() {
    // Initialize with defaults
    this.flags = this.getDefaults()
  }

  /**
   * Get default values for all flags
   */
  private getDefaults(): FeatureFlags {
    const defaults: Partial<FeatureFlags> = {}
    for (const [name, definition] of Object.entries(FLAG_DEFINITIONS)) {
      defaults[name as FeatureFlagName] = definition.defaultValue
    }
    return defaults as FeatureFlags
  }

  /**
   * Initialize flags from storage and environment
   */
  initialize(): void {
    if (this.initialized) return
    this.initialized = true

    // Start with defaults
    this.flags = this.getDefaults()

    // Override with environment variables (if available)
    this.loadFromEnvironment()

    // Override with localStorage (for development)
    this.loadFromStorage()

    // Log initial state in debug mode
    if (this.flags.DEBUG_MODE) {
      console.log('[FeatureFlags] Initialized:', this.flags)
    }
  }

  /**
   * Load flag overrides from environment variables
   */
  private loadFromEnvironment(): void {
    // Check for Vite environment variables
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}

    for (const flagName of Object.keys(FLAG_DEFINITIONS) as FeatureFlagName[]) {
      const envKey = `VITE_${flagName}`
      const envValue = env[envKey]

      if (envValue !== undefined) {
        this.flags[flagName] = envValue === 'true' || envValue === '1'
      }
    }
  }

  /**
   * Load flag overrides from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return

      const overrides = JSON.parse(stored) as Partial<FeatureFlags>

      for (const [name, value] of Object.entries(overrides)) {
        if (name in FLAG_DEFINITIONS && typeof value === 'boolean') {
          this.flags[name as FeatureFlagName] = value
        }
      }
    } catch {
      // Invalid stored data, ignore
    }
  }

  /**
   * Save current overrides to localStorage
   */
  private saveToStorage(): void {
    const overrides: Partial<FeatureFlags> = {}

    // Only save values that differ from defaults
    for (const [name, value] of Object.entries(this.flags)) {
      const flagName = name as FeatureFlagName
      if (value !== FLAG_DEFINITIONS[flagName].defaultValue) {
        overrides[flagName] = value
      }
    }

    if (Object.keys(overrides).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  /**
   * Notify all listeners of flag changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback({ ...this.flags }))
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagName: FeatureFlagName): boolean {
    if (!this.initialized) {
      this.initialize()
    }
    return this.flags[flagName] ?? false
  }

  /**
   * Get all current flag values
   */
  getAllFlags(): FeatureFlags {
    if (!this.initialized) {
      this.initialize()
    }
    return { ...this.flags }
  }

  /**
   * Set a feature flag value
   */
  setFlag(flagName: FeatureFlagName, value: boolean): void {
    if (!this.initialized) {
      this.initialize()
    }

    if (this.flags[flagName] !== value) {
      this.flags[flagName] = value
      this.saveToStorage()
      this.notifyListeners()

      if (this.flags.DEBUG_MODE) {
        console.log(`[FeatureFlags] ${flagName} = ${value}`)
      }
    }
  }

  /**
   * Set multiple flags at once
   */
  setFlags(updates: Partial<FeatureFlags>): void {
    if (!this.initialized) {
      this.initialize()
    }

    let changed = false

    for (const [name, value] of Object.entries(updates)) {
      const flagName = name as FeatureFlagName
      if (flagName in FLAG_DEFINITIONS && this.flags[flagName] !== value) {
        this.flags[flagName] = value
        changed = true
      }
    }

    if (changed) {
      this.saveToStorage()
      this.notifyListeners()

      if (this.flags.DEBUG_MODE) {
        console.log('[FeatureFlags] Updated:', updates)
      }
    }
  }

  /**
   * Reset a flag to its default value
   */
  resetFlag(flagName: FeatureFlagName): void {
    this.setFlag(flagName, FLAG_DEFINITIONS[flagName].defaultValue)
  }

  /**
   * Reset all flags to defaults
   */
  resetAll(): void {
    this.flags = this.getDefaults()
    localStorage.removeItem(STORAGE_KEY)
    this.notifyListeners()

    if (this.flags.DEBUG_MODE) {
      console.log('[FeatureFlags] Reset to defaults')
    }
  }

  /**
   * Subscribe to flag changes
   */
  subscribe(callback: (flags: FeatureFlags) => void): () => void {
    this.listeners.add(callback)

    // Call immediately with current flags
    callback({ ...this.flags })

    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Get flag definition/metadata
   */
  getFlagDefinition(flagName: FeatureFlagName): FeatureFlagDefinition {
    return FLAG_DEFINITIONS[flagName]
  }

  /**
   * Get all flag definitions
   */
  getAllDefinitions(): Record<FeatureFlagName, FeatureFlagDefinition> {
    return { ...FLAG_DEFINITIONS }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let featureFlagServiceInstance: FeatureFlagService | null = null

/**
 * Get the singleton feature flag service instance
 */
export function getFeatureFlagService(): FeatureFlagService {
  if (!featureFlagServiceInstance) {
    featureFlagServiceInstance = new FeatureFlagService()
    featureFlagServiceInstance.initialize()
  }
  return featureFlagServiceInstance
}

/**
 * Reset the feature flag service (for testing)
 */
export function resetFeatureFlagService(): void {
  if (featureFlagServiceInstance) {
    featureFlagServiceInstance.resetAll()
  }
  featureFlagServiceInstance = null
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if a feature flag is enabled
 * Shorthand for getFeatureFlagService().isEnabled()
 */
export function isFeatureEnabled(flagName: FeatureFlagName): boolean {
  return getFeatureFlagService().isEnabled(flagName)
}

/**
 * Set a feature flag
 * Shorthand for getFeatureFlagService().setFlag()
 */
export function setFeatureFlag(flagName: FeatureFlagName, value: boolean): void {
  getFeatureFlagService().setFlag(flagName, value)
}

/**
 * Enable a feature flag
 */
export function enableFeature(flagName: FeatureFlagName): void {
  setFeatureFlag(flagName, true)
}

/**
 * Disable a feature flag
 */
export function disableFeature(flagName: FeatureFlagName): void {
  setFeatureFlag(flagName, false)
}

/**
 * Toggle a feature flag
 */
export function toggleFeature(flagName: FeatureFlagName): void {
  const current = isFeatureEnabled(flagName)
  setFeatureFlag(flagName, !current)
}

// ============================================================================
// EXPORTS
// ============================================================================

export { FeatureFlagService }
export default getFeatureFlagService
