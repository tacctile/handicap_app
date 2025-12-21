/**
 * SubscriptionStatus Component
 *
 * Displays current subscription details for existing subscribers.
 * Shows plan, billing info, and cancel/reactivate actions.
 */

import { useState, useCallback } from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { formatSubscriptionStatus, getStatusColor } from '../../services/payments/types';
import { logger } from '../../services/logging';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionStatusProps {
  /** Optional callback after subscription is cancelled */
  onCancel?: () => void;
  /** Optional callback after subscription is reactivated */
  onReactivate?: () => void;
  /** Show in compact card format */
  compact?: boolean;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0F0F10',
    border: '1px solid #2A2A2C',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '440px',
    width: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  planIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#19abb5',
  },
  planInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  planName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#EEEFF1',
    margin: 0,
  },
  planPrice: {
    fontSize: '13px',
    color: '#B4B4B6',
    margin: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  statusBadge: {
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '100px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#1A1A1C',
    borderRadius: '8px',
    border: '1px solid #2A2A2C',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: '13px',
    color: '#6E6E70',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  detailLabelIcon: {
    fontSize: '16px',
  },
  detailValue: {
    fontSize: '13px',
    color: '#EEEFF1',
    margin: 0,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  actions: {
    display: 'flex',
    gap: '12px',
  },
  cancelButton: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#B4B4B6',
    backgroundColor: 'transparent',
    border: '1px solid #3A3A3C',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  reactivateButton: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0A0A0B',
    backgroundColor: '#19abb5',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  warning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  warningIcon: {
    color: '#f59e0b',
    fontSize: '18px',
    flexShrink: 0,
  },
  warningText: {
    fontSize: '13px',
    color: '#f59e0b',
    margin: 0,
    lineHeight: 1.4,
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
  modal: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#0F0F10',
    border: '1px solid #2A2A2C',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '400px',
    width: '100%',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#EEEFF1',
    margin: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modalTitleIcon: {
    color: '#f59e0b',
    fontSize: '22px',
  },
  modalText: {
    fontSize: '14px',
    color: '#B4B4B6',
    margin: '0 0 20px 0',
    lineHeight: 1.5,
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
  },
  modalCancelButton: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#B4B4B6',
    backgroundColor: 'transparent',
    border: '1px solid #3A3A3C',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  modalConfirmButton: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#EEEFF1',
    backgroundColor: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  loadingState: {
    padding: '40px',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: '14px',
    color: '#6E6E70',
    margin: 0,
  },
  noSubscription: {
    padding: '40px',
    textAlign: 'center',
  },
  noSubscriptionText: {
    fontSize: '14px',
    color: '#6E6E70',
    margin: 0,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * SubscriptionStatus displays subscription info and management options.
 *
 * @example
 * ```tsx
 * <SubscriptionStatus
 *   onCancel={() => console.log('Cancelled')}
 *   onReactivate={() => console.log('Reactivated')}
 * />
 * ```
 */
export function SubscriptionStatus({
  onCancel,
  onReactivate,
  compact = false,
}: SubscriptionStatusProps) {
  const {
    subscription,
    isLoading,
    isActive,
    isCanceling,
    daysRemaining,
    status,
    error,
    cancel,
    resume,
    clearError,
  } = useSubscription();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCancelClick = useCallback(() => {
    setShowCancelModal(true);
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    setIsProcessing(true);
    clearError();

    try {
      logger.logInfo('Cancelling subscription', {
        component: 'SubscriptionStatus',
        subscriptionId: subscription?.id,
      });

      await cancel();

      logger.logInfo('Subscription cancelled successfully', {
        component: 'SubscriptionStatus',
      });

      setShowCancelModal(false);
      onCancel?.();
    } catch (err) {
      logger.logError(err instanceof Error ? err : new Error('Failed to cancel'), {
        component: 'SubscriptionStatus',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [cancel, clearError, subscription, onCancel]);

  const handleReactivate = useCallback(async () => {
    setIsProcessing(true);
    clearError();

    try {
      logger.logInfo('Reactivating subscription', {
        component: 'SubscriptionStatus',
        subscriptionId: subscription?.id,
      });

      await resume();

      logger.logInfo('Subscription reactivated successfully', {
        component: 'SubscriptionStatus',
      });

      onReactivate?.();
    } catch (err) {
      logger.logError(err instanceof Error ? err : new Error('Failed to reactivate'), {
        component: 'SubscriptionStatus',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [resume, clearError, subscription, onReactivate]);

  // Loading state
  if (isLoading && !subscription) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>
          <p style={styles.loadingText}>Loading subscription details...</p>
        </div>
      </div>
    );
  }

  // No subscription
  if (!subscription) {
    return (
      <div style={styles.container}>
        <div style={styles.noSubscription}>
          <p style={styles.noSubscriptionText}>No active subscription</p>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(status);
  const statusText = formatSubscriptionStatus(status);

  return (
    <>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.planIcon}>
              <span className="material-icons" style={{ fontSize: '22px' }}>
                workspace_premium
              </span>
            </div>
            <div style={styles.planInfo}>
              <p style={styles.planName}>{subscription.plan.name}</p>
              <p style={styles.planPrice}>
                {subscription.plan.priceFormatted}/{subscription.plan.interval}
              </p>
            </div>
          </div>
          <span
            style={{
              ...styles.statusBadge,
              backgroundColor: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {statusText}
          </span>
        </div>

        {isCanceling && (
          <div style={styles.warning}>
            <span className="material-icons" style={styles.warningIcon}>
              warning
            </span>
            <p style={styles.warningText}>
              Your subscription will end on {formatDate(subscription.currentPeriodEnd)}. You'll
              continue to have access until then.
            </p>
          </div>
        )}

        {error && (
          <div style={styles.error}>
            <span className="material-icons" style={styles.errorIcon}>
              error_outline
            </span>
            <p style={styles.errorText}>{error.message}</p>
          </div>
        )}

        {!compact && (
          <div style={styles.details}>
            <div style={styles.detailRow}>
              <p style={styles.detailLabel}>
                <span className="material-icons" style={styles.detailLabelIcon}>
                  event
                </span>
                Next billing date
              </p>
              <p style={styles.detailValue}>
                {isCanceling ? 'N/A' : formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            <div style={styles.detailRow}>
              <p style={styles.detailLabel}>
                <span className="material-icons" style={styles.detailLabelIcon}>
                  schedule
                </span>
                Days remaining
              </p>
              <p style={styles.detailValue}>{daysRemaining} days</p>
            </div>
            <div style={styles.detailRow}>
              <p style={styles.detailLabel}>
                <span className="material-icons" style={styles.detailLabelIcon}>
                  today
                </span>
                Member since
              </p>
              <p style={styles.detailValue}>{formatDate(subscription.createdAt)}</p>
            </div>
          </div>
        )}

        <div style={styles.actions}>
          {isCanceling ? (
            <button
              type="button"
              style={{
                ...styles.reactivateButton,
                ...(isProcessing ? styles.buttonDisabled : {}),
              }}
              onClick={handleReactivate}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="material-icons" style={{ fontSize: '18px' }}>
                    hourglass_empty
                  </span>
                  Processing...
                </>
              ) : (
                <>
                  <span className="material-icons" style={{ fontSize: '18px' }}>
                    refresh
                  </span>
                  Reactivate Subscription
                </>
              )}
            </button>
          ) : (
            isActive && (
              <button
                type="button"
                style={{
                  ...styles.cancelButton,
                  ...(isProcessing ? styles.buttonDisabled : {}),
                }}
                onClick={handleCancelClick}
                disabled={isProcessing}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  cancel
                </span>
                Cancel Subscription
              </button>
            )
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          style={styles.modal}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCancelModal(false);
            }
          }}
        >
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>
              <span className="material-icons" style={styles.modalTitleIcon}>
                warning
              </span>
              Cancel Subscription?
            </h3>
            <p style={styles.modalText}>
              Are you sure you want to cancel? Your subscription will remain active until{' '}
              <strong>{formatDate(subscription.currentPeriodEnd)}</strong>, and you won't be charged
              again. No refunds are provided for the current billing period.
            </p>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalCancelButton}
                onClick={() => setShowCancelModal(false)}
                disabled={isProcessing}
              >
                Keep Subscription
              </button>
              <button
                type="button"
                style={{
                  ...styles.modalConfirmButton,
                  ...(isProcessing ? styles.buttonDisabled : {}),
                }}
                onClick={handleCancelConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SubscriptionStatus;
