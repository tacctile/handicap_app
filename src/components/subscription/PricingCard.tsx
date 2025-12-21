/**
 * PricingCard Component
 *
 * Displays the subscription tier with pricing, features, and subscribe action.
 * Single tier model: $24.99/month as per MASTER_CONTEXT.md
 */

import { useState } from 'react'
import { useSubscription } from '../../hooks/useSubscription'
import { logger } from '../../services/logging'

// ============================================================================
// TYPES
// ============================================================================

export interface PricingCardProps {
  /** Optional callback after successful subscription initiation */
  onSubscribe?: () => void
  /** Show compact version */
  compact?: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FEATURES = [
  {
    icon: 'upload_file',
    title: 'DRF Parsing',
    description: 'Parse and analyze Daily Racing Form files',
  },
  {
    icon: 'analytics',
    title: 'Scoring System',
    description: 'Proprietary 6-category scoring algorithm',
  },
  {
    icon: 'casino',
    title: 'Betting Recommendations',
    description: 'Tiered betting advice with confidence levels',
  },
  {
    icon: 'cloud_off',
    title: 'Offline Access',
    description: 'Full functionality at the track, no signal needed',
  },
]

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#0F0F10',
    border: '2px solid #19abb5',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '400px',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  cardCompact: {
    padding: '24px',
  },
  badge: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    backgroundColor: '#19abb5',
    color: '#0A0A0B',
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '100px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  header: {
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  planName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#19abb5',
    margin: '0 0 8px 0',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  price: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '4px',
  },
  priceAmount: {
    fontSize: '48px',
    fontWeight: 700,
    color: '#EEEFF1',
    margin: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  pricePeriod: {
    fontSize: '16px',
    color: '#B4B4B6',
    fontWeight: 500,
  },
  featuresContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  featureIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#19abb5',
    fontSize: '18px',
  },
  featureText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  featureTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#EEEFF1',
    margin: 0,
  },
  featureDescription: {
    fontSize: '12px',
    color: '#B4B4B6',
    margin: 0,
    lineHeight: 1.4,
  },
  subscribeButton: {
    width: '100%',
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#0A0A0B',
    backgroundColor: '#19abb5',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  subscribeButtonHover: {
    backgroundColor: '#1992a1',
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  cancelNote: {
    textAlign: 'center',
    marginTop: '16px',
    fontSize: '13px',
    color: '#6E6E70',
  },
  cancelNoteIcon: {
    fontSize: '14px',
    verticalAlign: 'text-bottom',
    marginRight: '4px',
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  errorIcon: {
    color: '#ef4444',
    fontSize: '18px',
    flexShrink: 0,
  },
  errorText: {
    fontSize: '13px',
    color: '#ef4444',
    margin: 0,
    lineHeight: 1.4,
  },
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PricingCard displays the single subscription tier.
 *
 * @example
 * ```tsx
 * <PricingCard onSubscribe={() => console.log('Subscribed!')} />
 * ```
 */
export function PricingCard({ onSubscribe, compact = false }: PricingCardProps) {
  const { openCheckout, isLoading, error, clearError } = useSubscription()
  const [isHovered, setIsHovered] = useState(false)

  const handleSubscribe = async () => {
    try {
      clearError()
      logger.logInfo('Initiating subscription checkout', {
        component: 'PricingCard',
      })

      const url = await openCheckout('monthly')

      logger.logInfo('Checkout session created', {
        component: 'PricingCard',
        hasUrl: !!url,
      })

      // In production, redirect to Stripe checkout
      // For mock, the subscription is created immediately
      if (url) {
        window.open(url, '_blank')
      }

      onSubscribe?.()
    } catch (err) {
      logger.logError(err instanceof Error ? err : new Error('Failed to open checkout'), {
        component: 'PricingCard',
      })
    }
  }

  const cardStyle = {
    ...styles.card,
    ...(compact ? styles.cardCompact : {}),
  }

  const buttonStyle = {
    ...styles.subscribeButton,
    ...(isHovered && !isLoading ? styles.subscribeButtonHover : {}),
    ...(isLoading ? styles.subscribeButtonDisabled : {}),
  }

  return (
    <div style={cardStyle}>
      <span style={styles.badge}>Pro</span>

      <div style={styles.header}>
        <p style={styles.planName}>Monthly Plan</p>
        <div style={styles.price}>
          <span style={styles.priceAmount}>$24.99</span>
          <span style={styles.pricePeriod}>/mo</span>
        </div>
      </div>

      <div style={styles.featuresContainer}>
        {FEATURES.map((feature) => (
          <div key={feature.title} style={styles.featureItem}>
            <div style={styles.featureIcon}>
              <span className="material-icons" style={{ fontSize: 'inherit' }}>
                {feature.icon}
              </span>
            </div>
            <div style={styles.featureText}>
              <p style={styles.featureTitle}>{feature.title}</p>
              {!compact && (
                <p style={styles.featureDescription}>{feature.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={styles.error}>
          <span className="material-icons" style={styles.errorIcon}>
            error_outline
          </span>
          <p style={styles.errorText}>{error.message}</p>
        </div>
      )}

      <button
        type="button"
        style={buttonStyle}
        onClick={handleSubscribe}
        disabled={isLoading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isLoading ? (
          <>
            <span className="material-icons" style={{ fontSize: '20px' }}>
              hourglass_empty
            </span>
            Processing...
          </>
        ) : (
          <>
            <span className="material-icons" style={{ fontSize: '20px' }}>
              lock_open
            </span>
            Subscribe Now
          </>
        )}
      </button>

      <p style={styles.cancelNote}>
        <span className="material-icons" style={styles.cancelNoteIcon}>
          check_circle
        </span>
        Cancel anytime. No refunds.
      </p>
    </div>
  )
}

export default PricingCard
