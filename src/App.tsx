import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { AuthPage, AccountSettings } from './components/auth';
import { HelpCenter } from './components/help';
import { ViewerLayout } from './components/LiveViewer';
import { EmptyState, RaceOverview, RaceDetail, TopBets } from './components/screens';
import { analyzeRaceValue } from './hooks/useValueDetection';
import { calculateRaceScores } from './lib/scoring';
import { getTrackData } from './data/tracks';
import { useRaceState } from './hooks/useRaceState';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAnalytics } from './hooks/useAnalytics';
import { useFeatureFlag } from './hooks/useFeatureFlag';
import { validateParsedData, getValidationSummary, isDataUsable } from './lib/validation';
import { extractShareCodeFromUrl } from './lib/supabase/shareCode';
import { logger } from './services/logging';
import type { ParsedDRFFile } from './types/drf';
import './styles/responsive.css';
import './styles/dashboard.css';
import './styles/help.css';

// ============================================================================
// ROUTE TYPES (for special routes not handled by NavigationContext)
// ============================================================================

type AppRoute = 'main' | 'account' | 'live-viewer';

// ============================================================================
// APP CONTENT PROPS
// ============================================================================

interface AppContentProps {
  parsedData: ParsedDRFFile | null;
  setParsedData: React.Dispatch<React.SetStateAction<ParsedDRFFile | null>>;
}

function AppContent({ parsedData, setParsedData }: AppContentProps) {
  const [_isLoading, setIsLoading] = useState(false);
  const [, setValidationWarnings] = useState<string[]>([]);
  const [, setShowWarnings] = useState(true);
  const [modalOpen] = useState(false);
  const [selectedRaceIndex, setSelectedRaceIndex] = useState(0);

  // Check for live viewer route from URL
  const liveShareCode = useMemo(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const code = extractShareCodeFromUrl(path);
      return code;
    }
    return null;
  }, []);

  // Routing state - check URL on initial load for special routes
  const getInitialRoute = (): AppRoute => {
    // Check for /live/:code route
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/live/') && extractShareCodeFromUrl(path)) {
        return 'live-viewer';
      }
    }
    return 'main';
  };
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute);

  // Auth state
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const authEnabled = useFeatureFlag('AUTH_ENABLED');

  const raceState = useRaceState();
  const sessionPersistence = useSessionPersistence();
  const { trackEvent } = useAnalytics();
  const { addToast } = useToastContext();

  // Track previous race index to detect race switches
  const prevRaceIndexRef = useRef<number>(selectedRaceIndex);
  // Track if we should skip saving (during initial load)
  const skipSaveRef = useRef<boolean>(false);

  // ============================================================================
  // CENTRALIZED NAVIGATION
  // ============================================================================
  const navigation = useNavigation();

  // Navigation handler to return to main app from special routes (account, live-viewer)
  const navigateToMain = useCallback(() => {
    setCurrentRoute('main');
    if (parsedData) {
      navigation.goToRaces();
    } else {
      navigation.goToEmpty();
    }
  }, [parsedData, navigation]);

  // Handle successful auth (login/signup)
  const handleAuthSuccess = useCallback(() => {
    setCurrentRoute('main');
    navigation.goToEmpty();
  }, [navigation]);

  // Handle logout
  const handleLogout = useCallback(() => {
    setCurrentRoute('main');
    navigation.goToEmpty();
  }, [navigation]);

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

    [raceState, sessionPersistence, addToast, setParsedData]
  );

  // Handle reset for current race only
  const handleReset = useCallback(async () => {
    raceState.resetAll();
    // Also reset in session persistence
    if (sessionPersistence.session) {
      await sessionPersistence.resetRace(selectedRaceIndex);
    }
  }, [raceState, sessionPersistence, selectedRaceIndex]);

  const handleFullReset = useCallback(() => {
    setParsedData(null);
    setValidationWarnings([]);
    setShowWarnings(true);
    raceState.resetAll();
    sessionPersistence.clearSession();
    setSelectedRaceIndex(0);
    // Sync with new navigation
    navigation.goToEmpty();
  }, [raceState, sessionPersistence, navigation, setParsedData]);

  // Handler for exiting help screen back to main app
  const handleExitHelp = useCallback(() => {
    if (parsedData) {
      navigation.goToRaces();
    } else {
      navigation.goToEmpty();
    }
  }, [parsedData, navigation]);

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

  // Calculate scored horses for all races (for RaceOverview verdict calculation)
  const allScoredHorses = useMemo(() => {
    if (!parsedData) return [];

    return parsedData.races.map((race, raceIndex) => {
      // Get persisted state for this race (if available)
      const persistedState = sessionPersistence?.getRaceState(raceIndex);

      // Build scratched set from persisted state
      const scratchedSet = new Set<number>(persistedState?.scratches || []);

      // Build odds override map from persisted state
      const oddsOverrides = persistedState?.oddsOverrides || {};

      // Use persisted track condition or default to 'fast'
      const trackConditionForRace = persistedState?.trackCondition || 'fast';

      return calculateRaceScores(
        race.horses,
        race.header,
        (i, originalOdds) => oddsOverrides[i] ?? originalOdds,
        (i) => scratchedSet.has(i),
        trackConditionForRace
      );
    });
  }, [parsedData, sessionPersistence]);

  // Create a Map of scored horses by race number (1-indexed) for TopBets
  const scoredHorsesMap = useMemo(() => {
    const map = new Map<number, (typeof allScoredHorses)[0]>();
    for (let i = 0; i < allScoredHorses.length; i++) {
      const scoredHorse = allScoredHorses[i];
      if (scoredHorse) {
        map.set(i + 1, scoredHorse); // Race numbers are 1-indexed
      }
    }
    return map;
  }, [allScoredHorses]);

  // Get track info for RaceOverview header
  const trackInfo = useMemo(() => {
    if (!parsedData?.races?.[0]?.header) {
      return { trackName: 'Unknown Track', raceDate: '' };
    }

    const header = parsedData.races[0].header;
    const trackData = getTrackData(header.trackCode);
    const trackName = trackData?.name || header.trackName || header.trackCode || 'Unknown Track';

    // Format race date
    let raceDate = header.raceDate || '';
    if (header.raceDateRaw && header.raceDateRaw.length === 8) {
      const year = header.raceDateRaw.substring(0, 4);
      const monthNum = parseInt(header.raceDateRaw.substring(4, 6), 10);
      const dayNum = parseInt(header.raceDateRaw.substring(6, 8), 10);
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const monthName = months[monthNum - 1];
      if (monthName && !isNaN(dayNum)) {
        raceDate = `${monthName} ${dayNum}, ${year}`;
      }
    }

    return { trackName, raceDate };
  }, [parsedData]);

  // Handler for selecting a race from RaceOverview
  const handleSelectRaceFromOverview = useCallback(
    (raceNumber: number) => {
      // Convert 1-indexed race number to 0-indexed for selectedRaceIndex
      setSelectedRaceIndex(raceNumber - 1);
      // Navigate to race detail
      navigation.goToRace(raceNumber);
    },
    [navigation]
  );

  // Show loading state while checking auth
  if (authEnabled && authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0A0A0B',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid #2A2A2C',
            borderTopColor: '#19abb5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // Show auth page if auth is enabled and user is not authenticated
  if (authEnabled && !isAuthenticated) {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      </ErrorBoundary>
    );
  }

  // Show live viewer (no auth required for viewers)
  if (currentRoute === 'live-viewer' && liveShareCode) {
    const handleExitViewer = () => {
      // Clear the URL and go to main app
      window.history.pushState({}, '', '/');
      setCurrentRoute('main');
    };

    return (
      <ErrorBoundary onReset={handleExitViewer}>
        <ViewerLayout shareCode={liveShareCode} onExit={handleExitViewer} />
      </ErrorBoundary>
    );
  }

  // Show help center
  if (navigation.currentView.screen === 'help') {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <HelpCenter onBack={handleExitHelp} />
      </ErrorBoundary>
    );
  }

  // Show account settings page
  if (currentRoute === 'account') {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <AccountSettings onLogout={handleLogout} onBack={navigateToMain} />
      </ErrorBoundary>
    );
  }

  // ============================================================================
  // MAIN VIEW RENDERING
  // ============================================================================

  // Show EmptyState when no data is loaded
  if (navigation.currentView.screen === 'empty') {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <EmptyState onParsed={handleParsed} />
      </ErrorBoundary>
    );
  }

  // Show RaceOverview when on the races screen
  if (navigation.currentView.screen === 'races' && parsedData) {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <RaceOverview
          races={parsedData.races}
          trackName={trackInfo.trackName}
          raceDate={trackInfo.raceDate}
          onSelectRace={handleSelectRaceFromOverview}
          allScoredHorses={allScoredHorses}
        />
      </ErrorBoundary>
    );
  }

  // Show RaceDetail when on the race-detail screen
  if (navigation.currentView.screen === 'race-detail' && parsedData) {
    const raceIndex = navigation.currentView.raceNumber - 1;
    const race = parsedData.races[raceIndex];
    const scoredHorsesForRace = allScoredHorses[raceIndex] || [];

    // Calculate verdict using value detection
    const valueAnalysis = analyzeRaceValue(
      scoredHorsesForRace,
      (index, original) => {
        const persistedState = sessionPersistence?.getRaceState(raceIndex);
        const oddsOverrides = persistedState?.oddsOverrides || {};
        return oddsOverrides[index] ?? original;
      },
      (index) => {
        const persistedState = sessionPersistence?.getRaceState(raceIndex);
        const scratches = persistedState?.scratches || [];
        return scratches.includes(index);
      }
    );

    const handleSelectHorseFromRaceDetail = (postPosition: number) => {
      // For now, just log - horse detail drawer comes in Phase 2
      console.log('Selected horse at post position:', postPosition);
    };

    if (race) {
      return (
        <ErrorBoundary onReset={handleFullReset}>
          <RaceDetail
            race={race}
            scoredHorses={scoredHorsesForRace}
            verdict={valueAnalysis.verdict}
            onBack={() => navigation.goToRaces()}
            onSelectHorse={handleSelectHorseFromRaceDetail}
            onViewTopBets={() => navigation.goToTopBets()}
            getOdds={(index, original) => {
              const persistedState = sessionPersistence?.getRaceState(raceIndex);
              const oddsOverrides = persistedState?.oddsOverrides || {};
              return oddsOverrides[index] ?? original;
            }}
            isScratched={(index) => {
              const persistedState = sessionPersistence?.getRaceState(raceIndex);
              const scratches = persistedState?.scratches || [];
              return scratches.includes(index);
            }}
          />
        </ErrorBoundary>
      );
    }
  }

  // Show TopBets screen when on the top-bets view
  if (navigation.currentView.screen === 'top-bets' && parsedData) {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <TopBets
          races={parsedData.races}
          scoredHorses={scoredHorsesMap}
          onSelectRace={(raceNumber) => navigation.goToRace(raceNumber)}
          onBack={() => navigation.goToRaces()}
          getOdds={(raceNumber, horseIndex, original) => {
            const persistedState = sessionPersistence?.getRaceState(raceNumber - 1);
            const oddsOverrides = persistedState?.oddsOverrides || {};
            return oddsOverrides[horseIndex] ?? original;
          }}
          isScratched={(raceNumber, horseIndex) => {
            const persistedState = sessionPersistence?.getRaceState(raceNumber - 1);
            const scratches = persistedState?.scratches || [];
            return scratches.includes(horseIndex);
          }}
        />
      </ErrorBoundary>
    );
  }

  // All navigation states should be handled above - this is a safety fallback
  // If we reach here, navigate to empty state
  navigation.goToEmpty();
  return null;
}

// ============================================================================
// APP STATE MANAGER
// ============================================================================
// This component manages the core data state and provides NavigationProvider.
// It passes state down to AppContent which handles rendering.

function AppStateManager() {
  const [parsedData, setParsedData] = useState<ParsedDRFFile | null>(null);

  return (
    <NavigationProvider
      hasData={!!parsedData}
      initialRaceNumber={1}
      onNavigate={(from, to) => {
        // Analytics tracking for navigation changes
        logger.logInfo('Navigation change', {
          from: from.screen,
          to: to.screen,
          raceNumber: to.screen === 'race-detail' ? to.raceNumber : undefined,
        });
      }}
    >
      <AppContent parsedData={parsedData} setParsedData={setParsedData} />
    </NavigationProvider>
  );
}

/**
 * App component wrapped with providers
 * AuthProvider is always present but auth is controlled by feature flags
 * ToastProvider enables app-wide toast notifications
 * NavigationProvider provides centralized view state management (Phase 0.2)
 */
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppStateManager />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
