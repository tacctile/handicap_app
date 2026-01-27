import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// APP VIEW TYPES
// ============================================================================

/**
 * Represents all possible views/screens in the app.
 * This is the single source of truth for "where am I in the app".
 */
export type AppView =
  | { screen: 'empty' }
  | { screen: 'races' }
  | { screen: 'race-detail'; raceNumber: number }
  | { screen: 'top-bets' }
  | { screen: 'help' };

/**
 * Navigation interface providing all navigation methods.
 */
export interface AppNavigation {
  /** Current view/screen being displayed */
  currentView: AppView;
  /** Navigate to any view directly */
  navigateTo: (view: AppView) => void;
  /** Navigate to a specific race detail view */
  goToRace: (raceNumber: number) => void;
  /** Navigate to the races overview grid */
  goToRaces: () => void;
  /** Navigate to the top bets view */
  goToTopBets: () => void;
  /** Navigate to the help/strategy guide */
  goToHelp: () => void;
  /** Navigate to the empty state (no data loaded) */
  goToEmpty: () => void;
  /** Check if currently on a specific screen type */
  isScreen: (screen: AppView['screen']) => boolean;
  /** Get the current race number (only valid when on race-detail or top-bets) */
  currentRaceNumber: number | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

interface UseAppNavigationOptions {
  /** Whether race data is currently loaded (affects automatic empty state) */
  hasData: boolean;
  /** Initial race number to use when data loads (defaults to 1) */
  initialRaceNumber?: number;
  /** Callback when navigation changes (for analytics, etc.) */
  onNavigate?: (from: AppView, to: AppView) => void;
}

/**
 * Central navigation hook for the app.
 *
 * This is the single source of truth for view state.
 * All navigation actions should go through this hook.
 *
 * @example
 * ```tsx
 * const { currentView, goToRace, goToRaces, goToHelp } = useAppNavigation({ hasData: !!parsedData });
 *
 * // Navigate to race 3
 * goToRace(3);
 *
 * // Check current screen
 * if (currentView.screen === 'race-detail') {
 *   console.log('Viewing race:', currentView.raceNumber);
 * }
 * ```
 */
export function useAppNavigation(options: UseAppNavigationOptions): AppNavigation {
  const { hasData, initialRaceNumber = 1, onNavigate } = options;

  // Initialize view based on whether data exists
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (!hasData) {
      return { screen: 'empty' };
    }
    return { screen: 'races' };
  });

  // Track the last race number for preserving context when switching views
  const [lastRaceNumber, setLastRaceNumber] = useState<number>(initialRaceNumber);

  // Automatically switch to empty when data is removed
  // Automatically switch to races when data is loaded (and currently on empty)
  useEffect(() => {
    if (!hasData && currentView.screen !== 'empty') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync view state with data availability
      setCurrentView({ screen: 'empty' });
    } else if (hasData && currentView.screen === 'empty') {
      setCurrentView({ screen: 'races' });
    }
  }, [hasData, currentView.screen]);

  // Core navigation function
  const navigateTo = useCallback(
    (view: AppView) => {
      setCurrentView((prev) => {
        // Don't navigate if already on the same screen
        if (
          prev.screen === view.screen &&
          (view.screen !== 'race-detail' ||
            (view.screen === 'race-detail' &&
              prev.screen === 'race-detail' &&
              prev.raceNumber === view.raceNumber))
        ) {
          return prev;
        }

        // Track race number when navigating to race-detail or top-bets
        if (view.screen === 'race-detail') {
          setLastRaceNumber(view.raceNumber);
        }

        // Call onNavigate callback if provided
        if (onNavigate) {
          onNavigate(prev, view);
        }

        return view;
      });
    },
    [onNavigate]
  );

  // Convenience navigation methods
  const goToRace = useCallback(
    (raceNumber: number) => {
      if (!hasData) return;
      navigateTo({ screen: 'race-detail', raceNumber });
    },
    [hasData, navigateTo]
  );

  const goToRaces = useCallback(() => {
    if (!hasData) return;
    navigateTo({ screen: 'races' });
  }, [hasData, navigateTo]);

  const goToTopBets = useCallback(() => {
    if (!hasData) return;
    navigateTo({ screen: 'top-bets' });
  }, [hasData, navigateTo]);

  const goToHelp = useCallback(() => {
    navigateTo({ screen: 'help' });
  }, [navigateTo]);

  const goToEmpty = useCallback(() => {
    navigateTo({ screen: 'empty' });
  }, [navigateTo]);

  // Utility to check current screen
  const isScreen = useCallback(
    (screen: AppView['screen']): boolean => {
      return currentView.screen === screen;
    },
    [currentView.screen]
  );

  // Get current race number from context
  const currentRaceNumber =
    currentView.screen === 'race-detail'
      ? currentView.raceNumber
      : currentView.screen === 'top-bets'
        ? lastRaceNumber
        : null;

  return {
    currentView,
    navigateTo,
    goToRace,
    goToRaces,
    goToTopBets,
    goToHelp,
    goToEmpty,
    isScreen,
    currentRaceNumber,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a human-readable label for a screen type.
 */
export function getScreenLabel(screen: AppView['screen']): string {
  switch (screen) {
    case 'empty':
      return 'Welcome';
    case 'races':
      return 'Race Overview';
    case 'race-detail':
      return 'Race Analysis';
    case 'top-bets':
      return 'Top Bets';
    case 'help':
      return 'Help & Strategy';
    default:
      return 'Unknown';
  }
}

/**
 * Check if a view requires race data to be loaded.
 */
export function viewRequiresData(view: AppView): boolean {
  return view.screen !== 'empty' && view.screen !== 'help';
}
