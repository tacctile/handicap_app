import { useState, useCallback, useMemo } from 'react'
import { FileUpload } from './components/FileUpload'
import { RaceTable } from './components/RaceTable'
import { Header } from './components/Header'
import { EmptyState } from './components/EmptyState'
import { ErrorBoundary, DataValidationWarning } from './components/ErrorBoundary'
import { LoadingState } from './components/LoadingState'
import { useRaceState } from './hooks/useRaceState'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { validateParsedData, getValidationSummary, isDataUsable } from './lib/validation'
import type { ParsedDRFFile } from './types/drf'
import './styles/responsive.css'

function App() {
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

  const handleFileSelect = useCallback(() => {
    // Trigger the file input in FileUpload
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.click()
    }
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

  const totalHorses = useMemo(() =>
    parsedData?.races.reduce((sum, race) => sum + race.horses.length, 0) ?? 0,
    [parsedData]
  )

  return (
    <ErrorBoundary onReset={handleFullReset}>
      <div className="app-container min-h-screen bg-background text-foreground">
        <Header
          currentFileName={parsedData?.filename}
          onReset={handleReset}
          hasChanges={raceState.hasChanges}
        />

        <main className="app-main">
          {/* File Upload - Always visible but compact when file is loaded */}
          <div className={parsedData ? 'file-upload-compact' : ''}>
            <FileUpload onParsed={handleParsed} />
          </div>

          {/* Loading State */}
          {isLoading && (
            <LoadingState message="Parsing race data..." />
          )}

          {/* Empty State - Show when no file is loaded */}
          {!parsedData && !isLoading && (
            <EmptyState onFileSelect={handleFileSelect} />
          )}

          {/* Validation Warnings */}
          {parsedData && showWarnings && validationWarnings.length > 0 && (
            <div className="validation-warnings-container">
              <DataValidationWarning
                warnings={validationWarnings}
                onDismiss={handleDismissWarnings}
              />
            </div>
          )}

          {/* Race Data */}
          {parsedData && parsedData.races.length > 0 && !isLoading && (
            <div className="races-container">
              {/* Summary stats */}
              <div className="summary-stats">
                <span className="stat-item">
                  <span className="stat-value">{parsedData.races.length}</span> race{parsedData.races.length !== 1 ? 's' : ''}
                </span>
                <span className="stat-divider">•</span>
                <span className="stat-item">
                  <span className="stat-value">{totalHorses}</span> horse{totalHorses !== 1 ? 's' : ''}
                </span>
                <span className="stat-divider hidden-mobile">•</span>
                <span className="filename-display">{parsedData.filename}</span>
              </div>

              {/* Race tables - each handles its own modal */}
              <div className="race-list">
                {parsedData.races.map((race, index) => (
                  <RaceTable
                    key={index}
                    race={race}
                    raceState={raceState}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
