/**
 * useInstallPrompt Hook
 *
 * Captures the beforeinstallprompt event and provides methods to:
 * - Check if the app can be installed
 * - Trigger the install prompt
 * - Track installation status
 *
 * Stores dismissal preference in localStorage to respect user choice.
 */

import { useState, useEffect, useCallback } from 'react';

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// localStorage key for dismissal
const INSTALL_DISMISSED_KEY = 'furlong-install-dismissed';
const INSTALL_DISMISSED_EXPIRY_DAYS = 30; // Re-show prompt after 30 days

interface InstallPromptState {
  /** True if the install prompt can be shown */
  canInstall: boolean;
  /** True if the app is already installed (standalone mode) */
  isInstalled: boolean;
  /** True if user has dismissed the prompt recently */
  isDismissed: boolean;
  /** Trigger the native install prompt */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Mark the prompt as dismissed (stored in localStorage) */
  dismiss: () => void;
  /** Clear dismissal and allow prompt to show again */
  resetDismissal: () => void;
}

/**
 * Check if the app is running in standalone (installed) mode
 */
function checkIsInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check iOS standalone mode
  if (
    'standalone' in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone
  ) {
    return true;
  }

  // Check if running in TWA (Trusted Web Activity)
  if (document.referrer.includes('android-app://')) {
    return true;
  }

  return false;
}

/**
 * Check if dismissal is still valid (within expiry period)
 */
function checkIsDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;

  try {
    const dismissedAt = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!dismissedAt) return false;

    const dismissedDate = new Date(dismissedAt);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - INSTALL_DISMISSED_EXPIRY_DAYS);

    return dismissedDate > expiryDate;
  } catch {
    return false;
  }
}

/**
 * Hook to manage PWA install prompt
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => checkIsInstalled());
  const [isDismissed, setIsDismissed] = useState(() => checkIsDismissed());

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Listen for app installed event
  useEffect(() => {
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      // Clear dismissal when installed
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
      setIsDismissed(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Listen for display mode changes (e.g., when app is launched from home screen)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };

    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  /**
   * Trigger the install prompt
   */
  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) {
      return 'unavailable';
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond
      const { outcome } = await deferredPrompt.userChoice;

      // Clear the deferred prompt - it can only be used once
      setDeferredPrompt(null);

      if (outcome === 'accepted') {
        setIsInstalled(true);
      }

      return outcome;
    } catch (error) {
      console.error('[InstallPrompt] Error showing install prompt:', error);
      return 'unavailable';
    }
  }, [deferredPrompt]);

  /**
   * Dismiss the install prompt and remember the choice
   */
  const dismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, new Date().toISOString());
    } catch (error) {
      console.error('[InstallPrompt] Error saving dismissal:', error);
    }
  }, []);

  /**
   * Reset dismissal to allow prompt to show again
   */
  const resetDismissal = useCallback(() => {
    setIsDismissed(false);
    try {
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
    } catch (error) {
      console.error('[InstallPrompt] Error resetting dismissal:', error);
    }
  }, []);

  return {
    canInstall: !!deferredPrompt && !isInstalled && !isDismissed,
    isInstalled,
    isDismissed,
    promptInstall,
    dismiss,
    resetDismissal,
  };
}

export default useInstallPrompt;
