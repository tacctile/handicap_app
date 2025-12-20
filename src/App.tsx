import { useState, useCallback } from 'react'
import { Dashboard } from './components/Dashboard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { useRaceState } from './hooks/useRaceState'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { validateParsedData, getValidationSummary, isDataUsable } from './lib/validation'
import type { ParsedDRFFile } from './types/drf'
import './styles/responsive.css'
import './styles/dashboard.css'

function AppContent() {
  const [parsedData, setParsedData] = useState<ParsedDRFFile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [showWarnings, setShowWarnings] = useState(true)
  const [modalOpen] = useState(false)

  const raceState = useRaceState()

  const handleParsed = useCallback((data: ParsedDRFFile) => {
    setIsLoading(true)

    // Small delay to show loading state
    setTimeout(() => {
      // Validate the parsed data
      const validationResult = validateParsedData(data)

      if (!isDataUsable(validationResult)) {
        setIsLoading(false)
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
  }, [raceState])

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

  return (
    <ErrorBoundary onReset={handleFullReset}>
      <Dashboard
        parsedData={parsedData}
        isLoading={isLoading}
        validationWarnings={validationWarnings}
        showWarnings={showWarnings}
        onParsed={handleParsed}
        onDismissWarnings={handleDismissWarnings}
        raceState={raceState}
      />
    </ErrorBoundary>
  )
}

/**
 * App component wrapped with providers
 * AuthProvider is always present but auth is controlled by feature flags
 */
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
