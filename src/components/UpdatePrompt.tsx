/**
 * UpdatePrompt Component
 *
 * Detects when a new service worker is available and prompts the user to update.
 * "New version available — refresh to update"
 *
 * Uses vite-plugin-pwa's registerSW for update detection.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface UpdatePromptProps {
  /** Optional className for custom positioning */
  className?: string;
}

export function UpdatePrompt({ className = '' }: UpdatePromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for updates periodically (every 1 hour)
      if (registration) {
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000
        );
      }
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error);
    },
  });

  // Show prompt when update is available
  useEffect(() => {
    if (needRefresh) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external state
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.2 }}
          className={`update-prompt ${className}`}
          role="alert"
          aria-live="assertive"
        >
          <div className="update-prompt-content">
            <div className="update-prompt-icon">
              <span className="material-icons">system_update</span>
            </div>
            <div className="update-prompt-text">
              <span className="update-prompt-title">New version available</span>
              <span className="update-prompt-description">
                Refresh to get the latest features and fixes.
              </span>
            </div>
            <div className="update-prompt-actions">
              <button onClick={handleDismiss} className="update-prompt-dismiss">
                Later
              </button>
              <button onClick={handleUpdate} className="update-prompt-update">
                <span className="material-icons">refresh</span>
                Update now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Minimal update notification (toast-style)
export function UpdateToast({ className = '' }: { className?: string }) {
  const [showToast, setShowToast] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000
        );
      }
    },
  });

  useEffect(() => {
    if (needRefresh) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external state
      setShowToast(true);
    }
  }, [needRefresh]);

  if (!showToast) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={`update-toast ${className}`}
    >
      <span className="material-icons">update</span>
      <span>Update available</span>
      <button onClick={() => updateServiceWorker(true)} className="update-toast-button">
        Refresh
      </button>
      <button
        onClick={() => {
          setShowToast(false);
          setNeedRefresh(false);
        }}
        className="update-toast-close"
      >
        <span className="material-icons">close</span>
      </button>
    </motion.div>
  );
}

// Styles
const styles = `
.update-prompt {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  background: linear-gradient(135deg, #1a1a1c 0%, #242428 100%);
  border: 1px solid rgba(25, 171, 181, 0.3);
  border-radius: var(--radius-lg);
  padding: 1rem;
  max-width: 400px;
  width: calc(100% - 2rem);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

@media (max-width: 640px) {
  .update-prompt {
    bottom: 100px;
    left: 1rem;
    right: 1rem;
    transform: none;
  }
}

.update-prompt-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.update-prompt-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: var(--radius-lg);
}

.update-prompt-icon .material-icons {
  font-size: 1.5rem;
  color: #fff;
}

.update-prompt-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.update-prompt-title {
  font-size: 1rem;
  font-weight: 600;
  color: #EEEFF1;
}

.update-prompt-description {
  font-size: 0.875rem;
  color: rgba(238, 239, 241, 0.7);
  line-height: 1.4;
}

.update-prompt-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.update-prompt-dismiss {
  flex: 1;
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: rgba(238, 239, 241, 0.7);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.update-prompt-dismiss:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.update-prompt-update {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.update-prompt-update:hover {
  filter: brightness(1.1);
}

.update-prompt-update .material-icons {
  font-size: 1.125rem;
}

/* Toast style */
.update-toast {
  position: fixed;
  bottom: 80px;
  right: 1rem;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #1a1a1c;
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius-md);
  padding: 0.625rem 1rem;
  color: #EEEFF1;
  font-size: 0.875rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

@media (max-width: 640px) {
  .update-toast {
    bottom: 100px;
    left: 1rem;
    right: 1rem;
    justify-content: space-between;
  }
}

.update-toast .material-icons {
  font-size: 1.25rem;
  color: #10b981;
}

.update-toast-button {
  padding: 0.375rem 0.75rem;
  background: #10b981;
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.update-toast-button:hover {
  background: #059669;
}

.update-toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.update-toast-close:hover {
  opacity: 1;
}

.update-toast-close .material-icons {
  font-size: 1rem;
  color: #EEEFF1;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'update-prompt-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}

export default UpdatePrompt;
