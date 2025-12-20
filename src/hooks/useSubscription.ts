/**
 * useSubscription Hook
 *
 * Provides subscription state and actions to React components.
 * Subscribes to subscription changes and provides computed helpers.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getSubscriptionService } from '../services/payments'
import { useAuth } from './useAuth'
import type {
  Subscription,
  SubscriptionStatus,
  Plan,
  SubscriptionError,
  ISubscriptionService,
} from '../services/payments/types'
import {
  hasActiveAccess,
  getDaysRemaining,
  isSubscriptionError,
  createSubscriptionError,
} from '../services/payments/types'

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

export interface UseSubscriptionReturn {
  /** Current subscription, or null if none */
  subscription: Subscription | null
  /** Whether subscription data is loading */
  isLoading: boolean
  /** Whether user has an active subscription */
  isActive: boolean
  /** Days remaining in current period */
  daysRemaining: number
  /** Current subscription status */
  status: SubscriptionStatus
  /** Current error, if any */
  error: SubscriptionError | null
  /** Available plans */
  plans: Plan[]
  /** Open checkout for a plan (creates session and returns URL) */
  openCheckout: (planId?: string) => Promise<string>
  /** Open billing portal (returns URL) */
  openPortal: () => Promise<string>
  /** Cancel the current subscription */
  cancel: () => Promise<void>
  /** Resume a canceled subscription */
  resume: () => Promise<void>
  /** Refresh subscription data */
  refresh: () => Promise<void>
  /** Clear current error */
  clearError: () => void
  /** Whether subscription is canceling at period end */
  isCanceling: boolean
  /** Whether user is in trial period */
  isTrialing: boolean
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to access subscription state and actions
 *
 * @example
 * ```tsx
 * function SubscriptionBanner() {
 *   const { isActive, daysRemaining, openCheckout, status } = useSubscription()
 *
 *   if (isActive) {
 *     return <p>Your subscription renews in {daysRemaining} days</p>
 *   }
 *
 *   return (
 *     <div>
 *       <p>Subscribe to unlock all features</p>
 *       <button onClick={() => openCheckout()}>Subscribe Now</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useSubscription(): UseSubscriptionReturn {
  const { user, isAuthenticated } = useAuth()
  const [subscriptionService] = useState<ISubscriptionService>(() =>
    getSubscriptionService()
  )

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<SubscriptionError | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Subscribe to subscription changes when user is authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSubscription(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const unsubscribe = subscriptionService.onSubscriptionChange(
      user.id,
      (newSubscription) => {
        setSubscription(newSubscription)
        setIsLoading(false)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [isAuthenticated, user, subscriptionService])

  // Computed: Is subscription active
  const isActive = useMemo(() => {
    if (!subscription) return false
    return hasActiveAccess(subscription.status)
  }, [subscription])

  // Computed: Days remaining
  const daysRemaining = useMemo(() => {
    return getDaysRemaining(subscription)
  }, [subscription])

  // Computed: Current status
  const status: SubscriptionStatus = useMemo(() => {
    return subscription?.status || 'none'
  }, [subscription])

  // Computed: Is canceling at period end
  const isCanceling = useMemo(() => {
    return subscription?.cancelAtPeriodEnd || false
  }, [subscription])

  // Computed: Is in trial
  const isTrialing = useMemo(() => {
    return subscription?.status === 'trialing'
  }, [subscription])

  // Get available plans
  const plans = useMemo(() => {
    return subscriptionService.getPlans()
  }, [subscriptionService])

  // Open checkout session
  const openCheckout = useCallback(
    async (planId?: string): Promise<string> => {
      if (!user) {
        const err = createSubscriptionError(
          'NOT_AUTHENTICATED',
          'Must be signed in to subscribe'
        )
        setError(err)
        throw err
      }

      setError(null)
      setIsProcessing(true)

      try {
        const targetPlanId = planId || plans[0]?.id
        if (!targetPlanId) {
          const err = createSubscriptionError('INVALID_PLAN', 'No plan specified')
          setError(err)
          throw err
        }

        const url = await subscriptionService.createCheckoutSession(user.id, targetPlanId)
        return url
      } catch (err) {
        const subscriptionError = isSubscriptionError(err)
          ? err
          : createSubscriptionError('UNKNOWN_ERROR', 'Failed to create checkout session', err)
        setError(subscriptionError)
        throw subscriptionError
      } finally {
        setIsProcessing(false)
      }
    },
    [user, plans, subscriptionService]
  )

  // Open billing portal
  const openPortal = useCallback(async (): Promise<string> => {
    if (!user) {
      const err = createSubscriptionError(
        'NOT_AUTHENTICATED',
        'Must be signed in to manage subscription'
      )
      setError(err)
      throw err
    }

    setError(null)
    setIsProcessing(true)

    try {
      const url = await subscriptionService.createPortalSession(user.id)
      return url
    } catch (err) {
      const subscriptionError = isSubscriptionError(err)
        ? err
        : createSubscriptionError('UNKNOWN_ERROR', 'Failed to create portal session', err)
      setError(subscriptionError)
      throw subscriptionError
    } finally {
      setIsProcessing(false)
    }
  }, [user, subscriptionService])

  // Cancel subscription
  const cancel = useCallback(async (): Promise<void> => {
    if (!subscription) {
      const err = createSubscriptionError(
        'SUBSCRIPTION_NOT_FOUND',
        'No subscription to cancel'
      )
      setError(err)
      throw err
    }

    setError(null)
    setIsProcessing(true)

    try {
      await subscriptionService.cancelSubscription(subscription.id)
    } catch (err) {
      const subscriptionError = isSubscriptionError(err)
        ? err
        : createSubscriptionError('UNKNOWN_ERROR', 'Failed to cancel subscription', err)
      setError(subscriptionError)
      throw subscriptionError
    } finally {
      setIsProcessing(false)
    }
  }, [subscription, subscriptionService])

  // Resume subscription
  const resume = useCallback(async (): Promise<void> => {
    if (!subscription) {
      const err = createSubscriptionError(
        'SUBSCRIPTION_NOT_FOUND',
        'No subscription to resume'
      )
      setError(err)
      throw err
    }

    if (!subscriptionService.resumeSubscription) {
      const err = createSubscriptionError(
        'UNKNOWN_ERROR',
        'Resume not supported by this provider'
      )
      setError(err)
      throw err
    }

    setError(null)
    setIsProcessing(true)

    try {
      await subscriptionService.resumeSubscription(subscription.id)
    } catch (err) {
      const subscriptionError = isSubscriptionError(err)
        ? err
        : createSubscriptionError('UNKNOWN_ERROR', 'Failed to resume subscription', err)
      setError(subscriptionError)
      throw subscriptionError
    } finally {
      setIsProcessing(false)
    }
  }, [subscription, subscriptionService])

  // Refresh subscription data
  const refresh = useCallback(async (): Promise<void> => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      const newSubscription = await subscriptionService.getSubscription(user.id)
      setSubscription(newSubscription)
    } catch (err) {
      const subscriptionError = isSubscriptionError(err)
        ? err
        : createSubscriptionError('UNKNOWN_ERROR', 'Failed to refresh subscription', err)
      setError(subscriptionError)
    } finally {
      setIsLoading(false)
    }
  }, [user, subscriptionService])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Combine loading states
  const combinedIsLoading = isLoading || isProcessing

  return useMemo(
    () => ({
      subscription,
      isLoading: combinedIsLoading,
      isActive,
      daysRemaining,
      status,
      error,
      plans,
      openCheckout,
      openPortal,
      cancel,
      resume,
      refresh,
      clearError,
      isCanceling,
      isTrialing,
    }),
    [
      subscription,
      combinedIsLoading,
      isActive,
      daysRemaining,
      status,
      error,
      plans,
      openCheckout,
      openPortal,
      cancel,
      resume,
      refresh,
      clearError,
      isCanceling,
      isTrialing,
    ]
  )
}

// ============================================================================
// MOCK HELPER (for testing)
// ============================================================================

/**
 * Set mock subscription status for testing
 * Only works with mock provider
 */
export function setMockSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus
): void {
  const service = getSubscriptionService()
  if ('setMockSubscription' in service) {
    ;(service as { setMockSubscription: (userId: string, status: SubscriptionStatus) => void })
      .setMockSubscription(userId, status)
  } else {
    console.warn('[useSubscription] setMockSubscriptionStatus only works with mock provider')
  }
}

export default useSubscription
