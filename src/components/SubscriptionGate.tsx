/**
 * SubscriptionGate Component
 *
 * Wraps features that require an active subscription.
 * Shows an inline upgrade prompt if user is not subscribed.
 * Useful for gating individual features within a page.
 *
 * Can also show a full-page subscription page for route-level gating.
 */

import { type ReactNode, type CSSProperties } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { useFeatureFlag } from '../hooks/useFeatureFlag'
import { SubscriptionPage } from './subscription'

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionGateProps {
  /** Child components to render when authorized */
  children: ReactNode
  /** Feature name for display in upgrade prompt */
  featureName?: string
  /** Custom prompt to show when not subscribed */
  fallback?: ReactNode
  /** Whether to show a blurred preview of the content */
  showPreview?: boolean
  /** Custom styles for the gate container */
  style?: CSSProperties
  /** Custom class name */
  className?: string
  /** Whether to hide completely instead of showing prompt */
  hideWhenLocked?: boolean
  /** Show full-page subscription page instead of inline prompt */
  fullPage?: boolean
}

// ============================================================================
// DEFAULT FALLBACK
// ============================================================================

interface InlineUpgradePromptProps {
  featureName?: string
  onSubscribe: () => void
  isLoading: boolean
}

function InlineUpgradePrompt({
  featureName,
  onSubscribe,
  isLoading,
}: InlineUpgradePromptProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        borderRadius: '12px',
        backgroundColor: '#1A1A1C',
        border: '1px solid #2A2A2C',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'rgba(25, 171, 181, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#19abb5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
        </svg>
      </div>

      <h3
        style={{
          margin: '0 0 4px 0',
          fontSize: '16px',
          fontWeight: 600,
          color: '#EEEFF1',
        }}
      >
        Pro Feature
      </h3>

      {featureName && (
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: '#B4B4B6',
          }}
        >
          {featureName} requires a Pro subscription
        </p>
      )}

      {!featureName && (
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: '#B4B4B6',
          }}
        >
          Upgrade to Pro to unlock this feature
        </p>
      )}

      <button
        onClick={onSubscribe}
        disabled={isLoading}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#0A0A0B',
          backgroundColor: '#19abb5',
          border: 'none',
          borderRadius: '6px',
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {isLoading ? 'Loading...' : 'Upgrade'}
      </button>
    </div>
  )
}

// ============================================================================
// BLURRED PREVIEW OVERLAY
// ============================================================================

interface BlurredPreviewProps {
  children: ReactNode
  featureName?: string
  onSubscribe: () => void
  isLoading: boolean
}

function BlurredPreview({
  children,
  featureName,
  onSubscribe,
  isLoading,
}: BlurredPreviewProps) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Blurred content */}
      <div
        style={{
          filter: 'blur(8px)',
          opacity: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {children}
      </div>

      {/* Overlay with upgrade prompt */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(10, 10, 11, 0.7)',
          borderRadius: '8px',
        }}
      >
        <InlineUpgradePrompt
          featureName={featureName}
          onSubscribe={onSubscribe}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * SubscriptionGate gates individual features based on subscription status.
 *
 * Unlike ProtectedRoute which guards entire routes, SubscriptionGate can be
 * used to gate individual features or sections within a page.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SubscriptionGate>
 *   <PremiumFeature />
 * </SubscriptionGate>
 *
 * // With feature name
 * <SubscriptionGate featureName="Detailed Scoring Breakdown">
 *   <ScoringBreakdown />
 * </SubscriptionGate>
 *
 * // With blurred preview
 * <SubscriptionGate showPreview featureName="Pace Analysis">
 *   <PaceAnalysisChart />
 * </SubscriptionGate>
 *
 * // Hide when locked
 * <SubscriptionGate hideWhenLocked>
 *   <SecretFeature />
 * </SubscriptionGate>
 *
 * // Full page paywall
 * <SubscriptionGate fullPage>
 *   <Dashboard />
 * </SubscriptionGate>
 * ```
 */
export function SubscriptionGate({
  children,
  featureName,
  fallback,
  showPreview = false,
  style,
  className,
  hideWhenLocked = false,
  fullPage = false,
}: SubscriptionGateProps) {
  const subscriptionRequired = useFeatureFlag('SUBSCRIPTION_REQUIRED')
  const { isAuthenticated } = useAuth()
  const { isActive, isLoading, openCheckout, refresh } = useSubscription()

  // If subscription checking is disabled, show content
  if (!subscriptionRequired) {
    return <>{children}</>
  }

  // Handle loading state for full-page mode
  if (fullPage && isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0B',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '3px solid #2A2A2C',
              borderTopColor: '#19abb5',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p
            style={{
              fontSize: '14px',
              color: '#6E6E70',
              margin: 0,
            }}
          >
            Checking subscription...
          </p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  // If user is not authenticated, they can't have a subscription
  // But we still show the content if subscription isn't required
  if (!isAuthenticated) {
    if (hideWhenLocked) {
      return null
    }

    // Show full-page subscription page for unauthenticated users too
    if (fullPage) {
      return (
        <SubscriptionPage
          context={featureName ? `${featureName} requires a subscription` : undefined}
        />
      )
    }

    if (fallback) {
      return <div style={style} className={className}>{fallback}</div>
    }

    if (showPreview) {
      return (
        <div style={style} className={className}>
          <BlurredPreview
            featureName={featureName}
            onSubscribe={() => {
              console.log('Need to authenticate first')
            }}
            isLoading={false}
          >
            {children}
          </BlurredPreview>
        </div>
      )
    }

    return (
      <div style={style} className={className}>
        <InlineUpgradePrompt
          featureName={featureName}
          onSubscribe={() => {
            console.log('Need to authenticate first')
          }}
          isLoading={false}
        />
      </div>
    )
  }

  // Handle subscribe button click
  const handleSubscribe = async () => {
    try {
      const url = await openCheckout()
      console.log('Checkout URL:', url)
      window.open(url, '_blank')
    } catch (err) {
      console.error('Failed to open checkout:', err)
    }
  }

  // If user has active subscription, show content
  if (isActive) {
    return <>{children}</>
  }

  // User is authenticated but not subscribed
  if (hideWhenLocked) {
    return null
  }

  // Show full-page subscription page
  if (fullPage) {
    return (
      <SubscriptionPage
        context={featureName ? `${featureName} requires a subscription` : undefined}
        onSubscribe={refresh}
      />
    )
  }

  // Show custom fallback if provided
  if (fallback) {
    return <div style={style} className={className}>{fallback}</div>
  }

  // Show blurred preview with overlay
  if (showPreview) {
    return (
      <div style={style} className={className}>
        <BlurredPreview
          featureName={featureName}
          onSubscribe={handleSubscribe}
          isLoading={isLoading}
        >
          {children}
        </BlurredPreview>
      </div>
    )
  }

  // Show inline upgrade prompt
  return (
    <div style={style} className={className}>
      <InlineUpgradePrompt
        featureName={featureName}
        onSubscribe={handleSubscribe}
        isLoading={isLoading}
      />
    </div>
  )
}

export default SubscriptionGate
