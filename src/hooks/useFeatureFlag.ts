/**
 * useFeatureFlag Hook
 *
 * Provides access to feature flags in React components.
 * Subscribes to flag changes for reactive updates.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getFeatureFlagService,
  type FeatureFlagName,
  type FeatureFlags,
  type FeatureFlagDefinition,
} from '../services/features'

// ============================================================================
// SINGLE FLAG HOOK
// ============================================================================

/**
 * Hook to check if a single feature flag is enabled
 *
 * @example
 * ```tsx
 * function PremiumFeature() {
 *   const isEnabled = useFeatureFlag('AI_FEATURES_ENABLED')
 *
 *   if (!isEnabled) return null
 *
 *   return <AIFeatureComponent />
 * }
 * ```
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const service = useMemo(() => getFeatureFlagService(), [])
  const [isEnabled, setIsEnabled] = useState(() => service.isEnabled(flagName))

  useEffect(() => {
    const unsubscribe = service.subscribe((flags) => {
      setIsEnabled(flags[flagName])
    })

    return () => {
      unsubscribe()
    }
  }, [service, flagName])

  return isEnabled
}

// ============================================================================
// MULTIPLE FLAGS HOOK
// ============================================================================

/**
 * Hook to access multiple feature flags at once
 *
 * @example
 * ```tsx
 * function FeaturePanel() {
 *   const flags = useFeatureFlags(['AUTH_ENABLED', 'AI_FEATURES_ENABLED'])
 *
 *   return (
 *     <div>
 *       <p>Auth: {flags.AUTH_ENABLED ? 'On' : 'Off'}</p>
 *       <p>AI: {flags.AI_FEATURES_ENABLED ? 'On' : 'Off'}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useFeatureFlags(flagNames: FeatureFlagName[]): Partial<FeatureFlags> {
  const service = useMemo(() => getFeatureFlagService(), [])
  const [flags, setFlags] = useState<Partial<FeatureFlags>>(() => {
    const allFlags = service.getAllFlags()
    const subset: Partial<FeatureFlags> = {}
    for (const name of flagNames) {
      subset[name] = allFlags[name]
    }
    return subset
  })

  useEffect(() => {
    const unsubscribe = service.subscribe((allFlags) => {
      const subset: Partial<FeatureFlags> = {}
      for (const name of flagNames) {
        subset[name] = allFlags[name]
      }
      setFlags(subset)
    })

    return () => {
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, ...flagNames])

  return flags
}

// ============================================================================
// ALL FLAGS HOOK
// ============================================================================

/**
 * Hook to access all feature flags
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const { flags, setFlag, resetAll } = useAllFeatureFlags()
 *
 *   return (
 *     <div>
 *       {Object.entries(flags).map(([name, value]) => (
 *         <label key={name}>
 *           <input
 *             type="checkbox"
 *             checked={value}
 *             onChange={(e) => setFlag(name, e.target.checked)}
 *           />
 *           {name}
 *         </label>
 *       ))}
 *       <button onClick={resetAll}>Reset All</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAllFeatureFlags(): {
  flags: FeatureFlags
  setFlag: (name: FeatureFlagName, value: boolean) => void
  resetFlag: (name: FeatureFlagName) => void
  resetAll: () => void
  definitions: Record<FeatureFlagName, FeatureFlagDefinition>
} {
  const service = useMemo(() => getFeatureFlagService(), [])
  const [flags, setFlags] = useState<FeatureFlags>(() => service.getAllFlags())

  useEffect(() => {
    const unsubscribe = service.subscribe((newFlags) => {
      setFlags(newFlags)
    })

    return () => {
      unsubscribe()
    }
  }, [service])

  const setFlag = useCallback(
    (name: FeatureFlagName, value: boolean) => {
      service.setFlag(name, value)
    },
    [service]
  )

  const resetFlag = useCallback(
    (name: FeatureFlagName) => {
      service.resetFlag(name)
    },
    [service]
  )

  const resetAll = useCallback(() => {
    service.resetAll()
  }, [service])

  const definitions = useMemo(() => service.getAllDefinitions(), [service])

  return useMemo(
    () => ({
      flags,
      setFlag,
      resetFlag,
      resetAll,
      definitions,
    }),
    [flags, setFlag, resetFlag, resetAll, definitions]
  )
}

// ============================================================================
// CONDITIONAL RENDERING HELPER
// ============================================================================

/**
 * Props for Feature component
 */
export interface FeatureProps {
  /** Feature flag name to check */
  name: FeatureFlagName
  /** Content to render when enabled */
  children: React.ReactNode
  /** Content to render when disabled (optional) */
  fallback?: React.ReactNode
}

/**
 * Component for conditional rendering based on feature flag
 *
 * @example
 * ```tsx
 * <Feature name="AI_FEATURES_ENABLED">
 *   <AIChat />
 * </Feature>
 *
 * <Feature name="BETA_FEATURES" fallback={<p>Coming soon</p>}>
 *   <BetaFeature />
 * </Feature>
 * ```
 */
export function Feature({ name, children, fallback = null }: FeatureProps): React.ReactNode {
  const isEnabled = useFeatureFlag(name)
  return isEnabled ? children : fallback
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useFeatureFlag
