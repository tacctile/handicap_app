/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback } from 'react';
import { DISCLAIMER_ABBREVIATED } from '../../legal';
import { logger } from '../../services/logging';

const DISCLAIMER_STORAGE_KEY = 'handicap_disclaimer_acknowledged';

interface DisclaimerBannerProps {
  /** Callback when user clicks "View Full" */
  onViewFull?: () => void;
}

/**
 * DisclaimerBanner Component
 *
 * Displays a dismissible banner with abbreviated disclaimer on first visit.
 * Stores acknowledgment in localStorage to prevent re-display.
 */
export function DisclaimerBanner({ onViewFull }: DisclaimerBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    try {
      const acknowledged = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
      if (!acknowledged) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialization from localStorage
        setIsVisible(true);
        logger.logInfo('Disclaimer banner displayed', { component: 'DisclaimerBanner' });
      }
    } catch (error) {
      // localStorage might be unavailable (private browsing, etc.)
      logger.logWarning('Could not access localStorage for disclaimer check', {
        component: 'DisclaimerBanner',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Show banner if we can't check storage
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsAnimatingOut(true);

    // Store acknowledgment
    try {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, new Date().toISOString());
      logger.logInfo('Disclaimer acknowledged and stored', { component: 'DisclaimerBanner' });
    } catch (error) {
      logger.logWarning('Could not store disclaimer acknowledgment', {
        component: 'DisclaimerBanner',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Wait for animation then hide
    setTimeout(() => {
      setIsVisible(false);
      setIsAnimatingOut(false);
    }, 300);
  }, []);

  const handleViewFull = useCallback(() => {
    logger.logInfo('User clicked View Full Disclaimer', { component: 'DisclaimerBanner' });
    onViewFull?.();
  }, [onViewFull]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`disclaimer-banner ${isAnimatingOut ? 'disclaimer-banner-exit' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="disclaimer-banner-content">
        <span className="material-icons disclaimer-banner-icon">gavel</span>
        <p className="disclaimer-banner-text">{DISCLAIMER_ABBREVIATED}</p>
        <div className="disclaimer-banner-actions">
          {onViewFull && (
            <button
              type="button"
              className="disclaimer-banner-link"
              onClick={handleViewFull}
              aria-label="View full disclaimer"
            >
              View Full
            </button>
          )}
          <button
            type="button"
            className="disclaimer-banner-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss disclaimer"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Utility function to clear disclaimer acknowledgment (for testing)
 */
export function clearDisclaimerAcknowledgment(): void {
  try {
    localStorage.removeItem(DISCLAIMER_STORAGE_KEY);
    logger.logInfo('Disclaimer acknowledgment cleared', { component: 'DisclaimerBanner' });
  } catch (error) {
    logger.logWarning('Could not clear disclaimer acknowledgment', {
      component: 'DisclaimerBanner',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Utility function to check if disclaimer has been acknowledged
 */
export function isDisclaimerAcknowledged(): boolean {
  try {
    return localStorage.getItem(DISCLAIMER_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
