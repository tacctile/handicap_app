import { useState, useCallback, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider, useAuthContext } from './contexts/AuthContext'
import { ToastProvider, useToastContext } from './contexts/ToastContext'
import { DisclaimerBanner, LegalModal } from './components/legal'
import type { LegalContentType } from './components/legal'
import { AuthPage, AccountSettings } from './components/auth'
import { HelpCenter } from './components/help'
import { useRaceState } from './hooks/useRaceState'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAnalytics } from './hooks/useAnalytics'
import { useFeatureFlag } from './hooks/useFeatureFlag'
import { validateParsedData, getValidationSummary, isDataUsable } from './lib/validation'
import { logger } from './services/logging'
import type { ParsedDRFFile } from './types/drf'
import './styles/responsive.css'
import './styles/dashboard.css'
import './styles/help.css'

// ============================================================================
// ROUTE TYPES
// ============================================================================

type AppRoute = 'dashboard' | 'account' | 'help'

function AppContent() {
  const [parsedData, setParsedData] = useState<ParsedDRFFile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [showWarnings, setShowWarnings] = useState(true)
  const [modalOpen] = useState(false)

  // Routing state
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('dashboard')

  // Auth state
  const { isAuthenticated, isLoading: authLoading } = useAuthContext()
  const authEnabled = useFeatureFlag('AUTH_ENABLED')

  // Legal modal state
  const [legalModalOpen, setLegalModalOpen] = useState(false)
  const [legalModalType, setLegalModalType] = useState<LegalContentType>('disclaimer')

  // Handle opening legal modal from disclaimer banner
  const handleViewFullDisclaimer = useCallback(() => {
    setLegalModalType('disclaimer')
    setLegalModalOpen(true)
  }, [])

  // Handle closing legal modal
  const handleCloseLegalModal = useCallback(() => {
    setLegalModalOpen(false)
  }, [])

  const raceState = useRaceState()
  const { trackEvent } = useAnalytics()
  const { addToast } = useToastContext()

  // Navigation handlers
  const navigateToAccount = useCallback(() => {
    setCurrentRoute('account')
  }, [])

  const navigateToDashboard = useCallback(() => {
    setCurrentRoute('dashboard')
  }, [])

  const navigateToHelp = useCallback(() => {
    setCurrentRoute('help')
  }, [])

  // Handle successful auth (login/signup)
  const handleAuthSuccess = useCallback(() => {
    setCurrentRoute('dashboard')
  }, [])

  // Handle logout
  const handleLogout = useCallback(() => {
    setCurrentRoute('dashboard')
  }, [])

  // Session tracking - track start on mount and end on beforeunload
  useEffect(() => {
    // Track session start
    trackEvent('session_start', {
      user_agent: navigator.userAgent,
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
      is_pwa: window.matchMedia('(display-mode: standalone)').matches,
    })

    // Track session end on beforeunload
    const handleBeforeUnload = () => {
      trackEvent('session_end', {
        session_duration_hint: 'calculated_by_analytics_service',
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [trackEvent])

  const handleParsed = useCallback((data: ParsedDRFFile) => {
    setIsLoading(true)

    // Small delay to show loading state
    setTimeout(() => {
      // Validate the parsed data
      const validationResult = validateParsedData(data)

      // Log validation result for debugging
      logger.logInfo('DRF validation result', {
        isValid: validationResult.isValid,
        stats: validationResult.stats,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
      })

      if (!isDataUsable(validationResult)) {
        setIsLoading(false)

        // Log full validation result for debugging
        logger.logWarning('DRF validation failed - data not usable', {
          validationResult,
          parsedDataStructure: {
            hasRaces: !!data?.races,
            raceCount: data?.races?.length ?? 0,
            filename: data?.filename,
          },
        })
        console.log('[DEBUG] Full validation result:', validationResult)
        console.log('[DEBUG] Parsed data structure:', data)

        // Surface validation errors to user via toast
        if (validationResult.errors.length > 0) {
          // Show specific validation errors
          const errorMessages = validationResult.errors
            .slice(0, 3) // Limit to first 3 errors for toast readability
            .map(err => err.message)
            .join('. ')

          addToast(
            `File validation failed: ${errorMessages}`,
            'critical',
            { duration: 8000, icon: 'error' }
          )
        } else {
          // No specific errors but still failed - generic message
          addToast(
            'File parsed but contained no usable race data. Check console for details.',
            'critical',
            { duration: 8000, icon: 'error' }
          )
        }

        return
      }

      // Get validation warnings summary
      const warnings = getValidationSummary(validationResult)
      setValidationWarnings(warnings)
      setShowWarnings(warnings.length > 0)

      setParsedData(data)
      setIsLoading(false)
      // Reset race state when new file is loaded
      raceState.resetAll()
    }, 100)
  }, [raceState, addToast])

  const handleReset = useCallback(() => {
    raceState.resetAll()
  }, [raceState])

  const handleFullReset = useCallback(() => {
    setParsedData(null)
    setValidationWarnings([])
    setShowWarnings(true)
    raceState.resetAll()
  }, [raceState])

  const handleDismissWarnings = useCallback(() => {
    setShowWarnings(false)
  }, [])

  // Keyboard shortcuts for global actions
  useKeyboardShortcuts({
    isModalOpen: modalOpen,
    onResetPress: () => {
      if (raceState.hasChanges) {
        handleReset()
      }
    },
    hasChanges: raceState.hasChanges,
  })

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
    )
  }

  // Show auth page if auth is enabled and user is not authenticated
  if (authEnabled && !isAuthenticated) {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      </ErrorBoundary>
    )
  }

  // Show help center
  if (currentRoute === 'help') {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <HelpCenter onBack={navigateToDashboard} />
      </ErrorBoundary>
    )
  }

  // Show account settings page
  if (currentRoute === 'account') {
    return (
      <ErrorBoundary onReset={handleFullReset}>
        <AccountSettings
          onLogout={handleLogout}
          onBack={navigateToDashboard}
        />
      </ErrorBoundary>
    )
  }

  // Show main dashboard
  return (
    <ErrorBoundary onReset={handleFullReset}>
      {/* Disclaimer Banner - shows on first visit */}
      <DisclaimerBanner onViewFull={handleViewFullDisclaimer} />

      <Dashboard
        parsedData={parsedData}
        isLoading={isLoading}
        validationWarnings={validationWarnings}
        showWarnings={showWarnings}
        onParsed={handleParsed}
        onDismissWarnings={handleDismissWarnings}
        raceState={raceState}
        onOpenLegalModal={(type: LegalContentType) => {
          setLegalModalType(type)
          setLegalModalOpen(true)
        }}
        onNavigateToAccount={navigateToAccount}
        onNavigateToHelp={navigateToHelp}
      />

      {/* Legal Modal - shared across app */}
      <LegalModal
        type={legalModalType}
        isOpen={legalModalOpen}
        onClose={handleCloseLegalModal}
      />
    </ErrorBoundary>
  )
}

/**
 * App component wrapped with providers
 * AuthProvider is always present but auth is controlled by feature flags
 * ToastProvider enables app-wide toast notifications
 */
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
