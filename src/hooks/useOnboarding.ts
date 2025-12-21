import { useState, useCallback, useEffect } from 'react'

const ONBOARDING_STORAGE_KEY = 'furlong_onboarding_complete'

interface UseOnboardingReturn {
  isOnboardingComplete: boolean
  completeOnboarding: () => void
  resetOnboarding: () => void
}

/**
 * Hook to manage onboarding state
 * Tracks whether the user has completed the onboarding flow using localStorage
 * First-time users see onboarding, returning users skip it
 */
export function useOnboarding(): UseOnboardingReturn {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      return stored === 'true'
    } catch {
      // localStorage might not be available
      return false
    }
  })

  // Sync state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, String(isOnboardingComplete))
    } catch {
      // localStorage might not be available
    }
  }, [isOnboardingComplete])

  const completeOnboarding = useCallback(() => {
    setIsOnboardingComplete(true)
  }, [])

  const resetOnboarding = useCallback(() => {
    setIsOnboardingComplete(false)
  }, [])

  return {
    isOnboardingComplete,
    completeOnboarding,
    resetOnboarding,
  }
}
