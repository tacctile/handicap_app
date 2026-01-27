/* eslint-disable react-refresh/only-export-components -- Context files export both Provider components and consumer hooks by design */
import React, { createContext, useContext, useMemo } from 'react';
import { useAppNavigation, type AppNavigation, type AppView } from '../hooks/useAppNavigation';

// ============================================================================
// CONTEXT DEFINITION
// ============================================================================

/**
 * Navigation context value type.
 * Extends AppNavigation with any context-specific additions.
 */
export interface NavigationContextValue extends AppNavigation {
  /** Whether navigation is ready (context is properly initialized) */
  isReady: boolean;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface NavigationProviderProps {
  /** Whether race data is currently loaded */
  hasData: boolean;
  /** Initial race number when data loads */
  initialRaceNumber?: number;
  /** Callback when navigation changes */
  onNavigate?: (from: AppView, to: AppView) => void;
  /** Child components */
  children: React.ReactNode;
}

/**
 * Navigation context provider.
 *
 * Wraps useAppNavigation and provides navigation state/methods to all descendants.
 * Place this near the top of your component tree, after data-related providers.
 *
 * @example
 * ```tsx
 * function App() {
 *   const [parsedData, setParsedData] = useState(null);
 *
 *   return (
 *     <NavigationProvider hasData={!!parsedData}>
 *       <AppContent />
 *     </NavigationProvider>
 *   );
 * }
 * ```
 */
export function NavigationProvider({
  hasData,
  initialRaceNumber = 1,
  onNavigate,
  children,
}: NavigationProviderProps): React.ReactElement {
  const navigation = useAppNavigation({
    hasData,
    initialRaceNumber,
    onNavigate,
  });

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<NavigationContextValue>(
    () => ({
      ...navigation,
      isReady: true,
    }),
    [navigation]
  );

  return <NavigationContext.Provider value={contextValue}>{children}</NavigationContext.Provider>;
}

// ============================================================================
// CONSUMER HOOK
// ============================================================================

/**
 * Hook to access navigation context.
 *
 * Must be used within a NavigationProvider.
 * Throws an error if used outside the provider.
 *
 * @example
 * ```tsx
 * function RaceCard({ raceNumber }: { raceNumber: number }) {
 *   const { goToRace, currentView } = useNavigation();
 *
 *   return (
 *     <button onClick={() => goToRace(raceNumber)}>
 *       View Race {raceNumber}
 *     </button>
 *   );
 * }
 * ```
 */
export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);

  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }

  return context;
}

// ============================================================================
// OPTIONAL CONSUMER HOOK (SAFE VERSION)
// ============================================================================

/**
 * Hook to optionally access navigation context.
 *
 * Returns null if used outside NavigationProvider.
 * Useful for components that may be rendered both inside and outside the provider.
 *
 * @example
 * ```tsx
 * function FlexibleComponent() {
 *   const navigation = useNavigationSafe();
 *
 *   if (navigation) {
 *     // Has navigation context
 *     return <button onClick={navigation.goToHelp}>Help</button>;
 *   }
 *
 *   // No navigation context - render static version
 *   return <a href="/help">Help</a>;
 * }
 * ```
 */
export function useNavigationSafe(): NavigationContextValue | null {
  return useContext(NavigationContext);
}

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

export type { AppView, AppNavigation } from '../hooks/useAppNavigation';
export { getScreenLabel, viewRequiresData } from '../hooks/useAppNavigation';
