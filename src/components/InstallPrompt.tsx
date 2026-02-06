/**
 * InstallPrompt Component
 *
 * Shows an install CTA for eligible users (when beforeinstallprompt fires).
 * "Add Furlong to your home screen"
 * Appears once, dismissible, respects user choice.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { logger } from '../services/logging';

interface InstallPromptProps {
  /** Optional className for custom positioning */
  className?: string;
  /** Position of the prompt */
  position?: 'bottom' | 'bottom-right' | 'top';
}

export function InstallPrompt({ className = '', position = 'bottom-right' }: InstallPromptProps) {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const result = await promptInstall();

      if (result === 'accepted') {
        // Prompt is automatically hidden when installed
      } else if (result === 'dismissed') {
        // User dismissed, already handled by the hook
      }
    } catch (error) {
      logger.logError(error instanceof Error ? error : new Error(String(error)), {
        component: 'InstallPrompt',
        action: 'handleInstall',
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    dismiss();
  };

  if (!canInstall) {
    return null;
  }

  const positionClasses = {
    bottom: 'install-prompt-bottom',
    'bottom-right': 'install-prompt-bottom-right',
    top: 'install-prompt-top',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`install-prompt ${positionClasses[position]} ${className}`}
        role="dialog"
        aria-labelledby="install-prompt-title"
        aria-describedby="install-prompt-description"
      >
        <div className="install-prompt-content">
          <div className="install-prompt-icon">
            <span className="material-icons">add_to_home_screen</span>
          </div>
          <div className="install-prompt-text">
            <h3 id="install-prompt-title" className="install-prompt-title">
              Add Furlong to your home screen
            </h3>
            <p id="install-prompt-description" className="install-prompt-description">
              Access your handicapping tools instantly, even offline at the track.
            </p>
          </div>
          <div className="install-prompt-actions">
            <button onClick={handleDismiss} className="install-prompt-dismiss" aria-label="Not now">
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="install-prompt-install"
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <span className="material-icons install-prompt-spinner">hourglass_empty</span>
                  Installing...
                </>
              ) : (
                <>
                  <span className="material-icons">download</span>
                  Install
                </>
              )}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="install-prompt-close"
          aria-label="Close install prompt"
        >
          <span className="material-icons">close</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// Compact install button for use in headers/menus
export function InstallButton({ className = '' }: { className?: string }) {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!canInstall) {
    return null;
  }

  const handleClick = async () => {
    setIsInstalling(true);
    try {
      await promptInstall();
    } catch (error) {
      logger.logError(error instanceof Error ? error : new Error(String(error)), {
        component: 'InstallButton',
        action: 'handleClick',
      });
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`install-button ${className}`}
      disabled={isInstalling}
      title="Install Furlong"
    >
      <span className="material-icons">{isInstalling ? 'hourglass_empty' : 'download'}</span>
      <span className="install-button-text">Install App</span>
    </button>
  );
}

// Styles
const styles = `
.install-prompt {
  position: fixed;
  z-index: 999;
  background: linear-gradient(135deg, #1a1a1c 0%, #242428 100%);
  border: 1px solid rgba(25, 171, 181, 0.3);
  border-radius: var(--radius-lg);
  padding: 1rem;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.install-prompt-bottom {
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
}

.install-prompt-bottom-right {
  bottom: 80px;
  right: 1rem;
}

.install-prompt-top {
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
}

@media (max-width: 640px) {
  .install-prompt {
    left: 1rem;
    right: 1rem;
    max-width: none;
    transform: none;
  }

  .install-prompt-bottom-right {
    right: 1rem;
  }
}

.install-prompt-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.install-prompt-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #19abb5 0%, #1b7583 100%);
  border-radius: var(--radius-lg);
  margin-bottom: 0.25rem;
}

.install-prompt-icon .material-icons {
  font-size: 1.5rem;
  color: #fff;
}

.install-prompt-text {
  flex: 1;
}

.install-prompt-title {
  font-size: 1rem;
  font-weight: 600;
  color: #EEEFF1;
  margin: 0 0 0.25rem 0;
}

.install-prompt-description {
  font-size: 0.875rem;
  color: rgba(238, 239, 241, 0.7);
  margin: 0;
  line-height: 1.4;
}

.install-prompt-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.install-prompt-dismiss {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
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

.install-prompt-dismiss:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.install-prompt-install {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  background: linear-gradient(135deg, #19abb5 0%, #1b7583 100%);
  border: none;
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.install-prompt-install:hover:not(:disabled) {
  filter: brightness(1.1);
}

.install-prompt-install:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.install-prompt-install .material-icons {
  font-size: 1.125rem;
}

.install-prompt-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.install-prompt-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.install-prompt-close:hover {
  opacity: 1;
}

.install-prompt-close .material-icons {
  font-size: 1rem;
  color: #EEEFF1;
}

/* Compact install button */
.install-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: rgba(25, 171, 181, 0.1);
  border: 1px solid rgba(25, 171, 181, 0.3);
  border-radius: var(--radius-md);
  color: #19abb5;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.install-button:hover:not(:disabled) {
  background: rgba(25, 171, 181, 0.2);
}

.install-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.install-button .material-icons {
  font-size: 1rem;
}

@media (max-width: 640px) {
  .install-button-text {
    display: none;
  }

  .install-button {
    padding: 0.5rem;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'install-prompt-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}

export default InstallPrompt;
