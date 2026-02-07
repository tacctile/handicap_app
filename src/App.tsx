import { useState, useCallback, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { HelpCenter } from './components/help';
import { DiagnosticsPage } from './components/diagnostics/DiagnosticsPage';
import { useRaceState } from './hooks/useRaceState';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAnalytics } from './hooks/useAnalytics';
import { validateParsedData, getValidationSummary, isDataUsable } from './lib/validation';
import { logger } from './services/logging';
import type { ParsedDRFFile } from './types/drf';
import './styles/responsive.css';
import './styles/dashboard.css';
import './styles/help.css';

// ============================================================================
// ROUTE TYPES
// ============================================================================

type AppRoute = 'dashboard' | 'help' | 'diagnostics';

function AppContent() {
  const [parsedData, setParsedData] = useState<ParsedDRFFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setValidationWarnings] = useState<string[]>([]);
  const [, setShowWarnings] = useState(true);
  const [modalOpen] = useState(false);
  const [selectedRaceIndex, setSelectedRaceIndex] = useState(0);

  // Routing state
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('dashboard');

  const raceState = useRaceState();
  const sessionPersistence = useSessionPersistence();
  const { trackEvent } = useAnalytics();
  const { addToast } = useToastContext();
  // Diagnostics no longer needs a separate hook call at App level;
  // parsedData is passed directly to DiagnosticsPage

  // Track previous race index to detect race switches
  const prevRaceIndexRef = useRef<number>(selectedRaceIndex);
  // Track if we should skip saving (during initial load)
  const skipSaveRef = useRef<boolean>(false);

  // Navigation handlers
  const navigateToDashboard = useCallback(() => {
    setCurrentRoute('dashboard');
  }, []);

  const navigateToDiagnostics = useCallback(() => {
    setCurrentRoute('diagnostics');
  }, []);

  // Session tracking - track start on mount and end on beforeunload
  useEffect(() => {
    // Track session start
    trackEvent('session_start', {
      user_agent: navigator.userAgent,
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
      is_pwa: window.matchMedia('(display-mode: standalone)').matches,
    });

    // Track session end on beforeunload
    const handleBeforeUnload = () => {
      trackEvent('session_end', {
        session_duration_hint: 'calculated_by_analytics_service',
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [trackEvent]);

  const handleParsed = useCallback(
    async (data: ParsedDRFFile) => {
      setIsLoading(true);

      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Validate the parsed data
      const validationResult = validateParsedData(data);

      // Log validation result for debugging
      logger.logInfo('DRF validation result', {
        isValid: validationResult.isValid,
        stats: validationResult.stats,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
      });

      if (!isDataUsable(validationResult)) {
        setIsLoading(false);

        logger.logWarning('DRF validation failed - data not usable', {
          validationResult,
          parsedDataStructure: {
            hasRaces: !!data?.races,
            raceCount: data?.races?.length ?? 0,
            filename: data?.filename,
          },
        });

        // Surface validation errors to user via toast
        if (validationResult.errors.length > 0) {
          // Show specific validation errors
          const errorMessages = validationResult.errors
            .slice(0, 3) // Limit to first 3 errors for toast readability
            .map((err) => err.message)
            .join('. ');

          addToast(`File validation failed: ${errorMessages}`, 'critical', {
            duration: 8000,
            icon: 'error',
          });
        } else {
          // No specific errors but still failed - generic message
          addToast(
            'File parsed but contained no usable race data. Check console for details.',
            'critical',
            { duration: 8000, icon: 'error' }
          );
        }

        return;
      }

      // Get validation warnings summary
      const warnings = getValidationSummary(validationResult);
      setValidationWarnings(warnings);
      setShowWarnings(warnings.length > 0);

      // Check for existing session and restore if found
      // Skip saving during initial load to avoid overwriting restored state
      skipSaveRef.current = true;

      try {
        const { wasRestored, session } = await sessionPersistence.loadOrCreateSession(data);

        if (wasRestored) {
          // Use data from restored session
          setParsedData(session.parsedData);

          // Restore race state for race 0
          const raceZeroState = session.raceStates[0];
          if (raceZeroState) {
            raceState.initializeFromPersisted(raceZeroState);
          }

          // Show restore notification
          addToast('Restored previous session', 'success', {
            duration: 3000,
            icon: 'restore',
          });

          logger.logInfo('Session restored', {
            filename: session.filename,
            raceCount: session.parsedData.races.length,
          });
        } else {
          // New session - use fresh parsed data
          setParsedData(data);
          // Reset race state for new file
          raceState.resetAll();
        }
      } catch (error) {
        // If session persistence fails, continue with fresh data
        logger.logWarning('Session persistence error', { error });
        setParsedData(data);
        raceState.resetAll();
      }

      setIsLoading(false);
      setSelectedRaceIndex(0);
      prevRaceIndexRef.current = 0;

      // Re-enable saving after initial load completes
      setTimeout(() => {
        skipSaveRef.current = false;
      }, 100);
    },
    [raceState, sessionPersistence, addToast]
  );

  // Handle reset for current race only
  const handleReset = useCallback(async () => {
    raceState.resetAll();
    // Also reset in session persistence
    if (sessionPersistence.session) {
      await sessionPersistence.resetRace(selectedRaceIndex);
    }
  }, [raceState, sessionPersistence, selectedRaceIndex]);

  // Handle reset all races
  const handleResetAllRaces = useCallback(async () => {
    raceState.resetAll();
    // Reset all races in session persistence
    if (sessionPersistence.session) {
      await sessionPersistence.resetAllRaces();
    }
  }, [raceState, sessionPersistence]);

  const handleFullReset = useCallback(() => {
    setParsedData(null);
    setValidationWarnings([]);
    setShowWarnings(true);
    raceState.resetAll();
    sessionPersistence.clearSession();
    setSelectedRaceIndex(0);
  }, [raceState, sessionPersistence]);

  // Effect: Save race state changes to session persistence
  useEffect(() => {
    if (!sessionPersistence.session || skipSaveRef.current) return;

    const currentState = raceState.getSerializableState();
    sessionPersistence.updateRaceState(selectedRaceIndex, {
      scratches: currentState.scratches,
      oddsOverrides: currentState.oddsOverrides,
      trackCondition: currentState.trackCondition,
    });
  }, [
    raceState.scratchedHorses,
    raceState.updatedOdds,
    raceState.trackCondition,
    selectedRaceIndex,
    sessionPersistence,
    raceState,
  ]);

  // Effect: Handle race selection changes - save current and load new
  useEffect(() => {
    const prevIndex = prevRaceIndexRef.current;
    const newIndex = selectedRaceIndex;

    if (prevIndex === newIndex || !sessionPersistence.session) {
      return;
    }

    // Load the state for the newly selected race
    const newRaceState = sessionPersistence.getRaceState(newIndex);
    if (newRaceState) {
      // Skip save trigger during state restoration
      skipSaveRef.current = true;
      raceState.initializeFromPersisted(newRaceState);
      setTimeout(() => {
        skipSaveRef.current = false;
      }, 50);
    } else {
      // No saved state for this race, reset to defaults
      raceState.resetAll();
    }

    prevRaceIndexRef.current = newIndex;
  }, [selectedRaceIndex, sessionPersistence, raceState]);

  // Keyboard shortcuts for global actions
  useKeyboardShortcuts({
    isModalOpen: modalOpen,
    onResetPress: () => {
      if (raceState.hasChanges) {
        handleReset();
      }
    },
    hasChanges: raceState.hasChanges,
  });

  // Show diagnostics dashboard (hidden route)
  if (currentRoute === 'diagnostics') {
    return <DiagnosticsPage parsedData={parsedData} onBack={navigateToDashboard} />;
  }

  // Show help center
  if (currentRoute === 'help') {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <HelpCenter onBack={navigateToDashboard} />
      </ErrorBoundary>
    );
  }

  // Show dashboard
  return (
    <ErrorBoundary onReset={handleFullReset}>
      <Dashboard
        parsedData={parsedData}
        selectedRaceIndex={selectedRaceIndex}
        onRaceSelect={setSelectedRaceIndex}
        trackCondition={raceState.trackCondition}
        onTrackConditionChange={raceState.setTrackCondition}
        raceState={raceState}
        isLoading={isLoading}
        onParsed={handleParsed}
        sessionPersistence={sessionPersistence}
        onResetRace={handleReset}
        onResetAllRaces={handleResetAllRaces}
        onDiagnosticsClick={navigateToDiagnostics}
      />
    </ErrorBoundary>
  );
}

/**
 * App component wrapped with providers
 * ToastProvider enables app-wide toast notifications
 */
function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
