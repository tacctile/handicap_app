/**
 * ProtectedRoute Component
 *
 * Protects routes based on authentication and subscription status.
 * Redirects to login if not authenticated.
 * Shows upgrade prompt if not subscribed (when subscription is required).
 */

import { type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { useFeatureFlag } from '../hooks/useFeatureFlag'

// ============================================================================
// TYPES
// ============================================================================

export interface ProtectedRouteProps {
  /** Child components to render when authorized */
  children: ReactNode
  /** Whether subscription is required for this route */
  requireSubscription?: boolean
  /** Custom component to show when not authenticated */
  fallbackAuth?: ReactNode
  /** Custom component to show when not subscribed */
  fallbackSubscription?: ReactNode
  /** Callback when user needs to login */
  onNeedAuth?: () => void
  /** Callback when user needs to subscribe */
  onNeedSubscription?: () => void
}

// ============================================================================
// DEFAULT FALLBACK COMPONENTS
// ============================================================================

function DefaultAuthFallback({ onLogin }: { onLogin?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          marginBottom: '16px',
        }}
      >
        🔐
      </div>
      <h2
        style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: 600,
          color: '#EEEFF1',
        }}
      >
        Authentication Required
      </h2>
      <p
        style={{
          margin: '0 0 24px 0',
          color: '#B4B4B6',
          maxWidth: '400px',
        }}
      >
        Please sign in to access this feature.
      </p>
      {onLogin && (
        <button
          onClick={onLogin}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 600,
            color: '#0A0A0B',
            backgroundColor: '#19abb5',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Sign In
        </button>
      )}
    </div>
  )
}

function DefaultSubscriptionFallback({ onSubscribe }: { onSubscribe?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          marginBottom: '16px',
        }}
      >
        ⭐
      </div>
      <h2
        style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: 600,
          color: '#EEEFF1',
        }}
      >
        Subscription Required
      </h2>
      <p
        style={{
          margin: '0 0 24px 0',
          color: '#B4B4B6',
          maxWidth: '400px',
        }}
      >
        Upgrade to Pro to unlock all handicapping features and full scoring breakdowns.
      </p>
      {onSubscribe && (
        <button
          onClick={onSubscribe}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 600,
            color: '#0A0A0B',
            backgroundColor: '#19abb5',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Subscribe Now
        </button>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid #2A2A2C',
          borderTopColor: '#19abb5',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ProtectedRoute guards access to child components based on auth/subscription.
 *
 * Uses feature flags to determine if auth and subscription are required:
 * - AUTH_ENABLED: If false, auth check is skipped
 * - SUBSCRIPTION_REQUIRED: If false, subscription check is skipped
 *
 * @example
 * ```tsx
 * // Basic usage - auth only
 * <ProtectedRoute>
 *   <DashboardContent />
 * </ProtectedRoute>
 *
 * // Require subscription
 * <ProtectedRoute requireSubscription>
 *   <PremiumFeature />
 * </ProtectedRoute>
 *
 * // Custom fallbacks
 * <ProtectedRoute
 *   fallbackAuth={<CustomLoginPrompt />}
 *   fallbackSubscription={<CustomUpgradePrompt />}
 *   onNeedAuth={() => navigate('/login')}
 * >
 *   <ProtectedContent />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
  children,
  requireSubscription = false,
  fallbackAuth,
  fallbackSubscription,
  onNeedAuth,
  onNeedSubscription,
}: ProtectedRouteProps) {
  const authEnabled = useFeatureFlag('AUTH_ENABLED')
  const subscriptionRequired = useFeatureFlag('SUBSCRIPTION_REQUIRED')

  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { isActive, isLoading: subscriptionLoading, openCheckout } = useSubscription()

  // If auth is disabled, skip auth checks
  const needsAuth = authEnabled && !isAuthenticated

  // If subscription checking is disabled, skip subscription checks
  const needsSubscription =
    subscriptionRequired && requireSubscription && !isActive && isAuthenticated

  // Show loading state while checking auth/subscription
  const isLoading = authEnabled && authLoading ||
    (subscriptionRequired && requireSubscription && subscriptionLoading)

  if (isLoading) {
    return <LoadingState />
  }

  // Check auth first
  if (needsAuth) {
    if (fallbackAuth) {
      return <>{fallbackAuth}</>
    }
    return <DefaultAuthFallback onLogin={onNeedAuth} />
  }

  // Then check subscription
  if (needsSubscription) {
    if (fallbackSubscription) {
      return <>{fallbackSubscription}</>
    }

    const handleSubscribe = onNeedSubscription || (async () => {
      try {
        const url = await openCheckout()
        // In real app, you would redirect to checkout URL
        console.log('Checkout URL:', url)
        window.open(url, '_blank')
      } catch (err) {
        console.error('Failed to open checkout:', err)
      }
    })

    return <DefaultSubscriptionFallback onSubscribe={handleSubscribe} />
  }

  // Authorized - render children
  return <>{children}</>
}

export default ProtectedRoute
