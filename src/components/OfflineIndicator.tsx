/**
 * OfflineIndicator Component
 *
 * Shows a subtle banner when the user is offline.
 * Reassures users that all features still work offline.
 * Dismissible but re-appears on status change.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  /** Optional className for custom positioning */
  className?: string;
}

export function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const { isOffline } = useOnlineStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when coming back online then going offline again
  useEffect(() => {
    if (!isOffline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external state
      setIsDismissed(false);
    }
  }, [isOffline]);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const shouldShow = isOffline && !isDismissed;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className={`offline-indicator ${className}`}
          role="status"
          aria-live="polite"
        >
          <div className="offline-indicator-content">
            <span className="material-icons offline-indicator-icon">cloud_off</span>
            <span className="offline-indicator-text">You're offline — all features still work</span>
            <button
              onClick={handleDismiss}
              className="offline-indicator-dismiss"
              aria-label="Dismiss offline notification"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Compact version for use in headers/toolbars
export function OfflineIndicatorCompact() {
  const { isOffline } = useOnlineStatus();

  if (!isOffline) return null;

  return (
    <div className="offline-indicator-compact" title="You're offline — all features still work">
      <span className="material-icons">cloud_off</span>
    </div>
  );
}

// Styles (add to index.css or keep as styled component)
const styles = `
.offline-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
  color: #fff;
  padding: 0.5rem 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.offline-indicator-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.offline-indicator-icon {
  font-size: 1.25rem;
}

.offline-indicator-text {
  font-size: 0.875rem;
  font-weight: 500;
}

.offline-indicator-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 1.5rem;
  height: 1.5rem;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: background 0.15s ease;
}

.offline-indicator-dismiss:hover {
  background: rgba(255, 255, 255, 0.3);
}

.offline-indicator-dismiss .material-icons {
  font-size: 1rem;
  color: #fff;
}

.offline-indicator-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-warning);
  padding: 0.25rem;
}

.offline-indicator-compact .material-icons {
  font-size: 1.25rem;
}

/* Adjust dashboard content when offline banner is shown */
.has-offline-banner .dashboard-main {
  padding-top: calc(2.5rem + var(--topbar-height, 64px));
}
`;

// Inject styles if not using a CSS file
if (typeof document !== 'undefined') {
  const styleId = 'offline-indicator-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}

export default OfflineIndicator;
