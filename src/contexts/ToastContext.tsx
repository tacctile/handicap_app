/* eslint-disable react-refresh/only-export-components */
/**
 * Toast Context
 *
 * Provides app-wide toast notification functionality.
 * Allows any component to trigger toast messages without prop drilling.
 */

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import { ResponsiveToastContainer } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface ToastContextValue {
  addToast: (
    message: string,
    type?: ToastMessage['type'],
    options?: {
      duration?: number;
      persistent?: boolean;
      icon?: string;
      action?: { label: string; onClick: () => void };
    }
  ) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
  addPostTimeNotification: (minutesMark: number, raceNumber?: number) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (
      message: string,
      type: ToastMessage['type'] = 'info',
      options?: {
        duration?: number;
        persistent?: boolean;
        icon?: string;
        action?: { label: string; onClick: () => void };
      }
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastMessage = {
        id,
        message,
        type,
        duration: options?.duration,
        persistent: options?.persistent,
        icon: options?.icon,
        action: options?.action,
      };
      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const addPostTimeNotification = useCallback(
    (minutesMark: number, raceNumber?: number) => {
      const isUrgent = minutesMark <= 5;
      const isCritical = minutesMark <= 2;

      let message: string;
      let type: ToastMessage['type'];
      let icon: string;

      if (isCritical) {
        message = raceNumber
          ? `Race ${raceNumber} starts in ${minutesMark} minute${minutesMark === 1 ? '' : 's'}! Place bets now!`
          : `Race starts in ${minutesMark} minute${minutesMark === 1 ? '' : 's'}! Place bets now!`;
        type = 'critical';
        icon = 'sports_score';
      } else if (isUrgent) {
        message = raceNumber
          ? `Race ${raceNumber}: ${minutesMark} minutes until post time`
          : `${minutesMark} minutes until post time`;
        type = 'warning';
        icon = 'timer';
      } else {
        message = raceNumber
          ? `Race ${raceNumber}: ${minutesMark} minutes until post time`
          : `${minutesMark} minutes until post time`;
        type = 'info';
        icon = 'schedule';
      }

      return addToast(message, type, {
        duration: isCritical ? 8000 : isUrgent ? 6000 : 4000,
        persistent: isCritical,
        icon,
      });
    },
    [addToast]
  );

  const value: ToastContextValue = {
    addToast,
    dismissToast,
    clearAll,
    addPostTimeNotification,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ResponsiveToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access toast functionality from any component.
 * Must be used within a ToastProvider.
 */
export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ToastContext };
export type { ToastContextValue };
