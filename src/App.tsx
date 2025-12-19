import { useState, useCallback } from 'react'
import { FileUpload } from './components/FileUpload'
import { RaceTable } from './components/RaceTable'
import { useRaceState } from './hooks/useRaceState'
import type { ParsedDRFFile } from './types/drf'
import './styles/responsive.css'

function App() {
  const [parsedData, setParsedData] = useState<ParsedDRFFile | null>(null)
  const raceState = useRaceState()

  const handleParsed = useCallback((data: ParsedDRFFile) => {
    setParsedData(data)
    // Reset race state when new file is loaded
    raceState.resetAll()
  }, [raceState])

  const totalHorses = parsedData?.races.reduce((sum, race) => sum + race.horses.length, 0) ?? 0

  return (
    <div className="app-container min-h-screen bg-background text-foreground">
      <header className="app-header sticky-header-mobile border-b border-white/10">
        <div className="app-header-content">
          <h1 className="app-title">Horse Monster</h1>
        </div>
      </header>
      <main className="app-main">
        <FileUpload onParsed={handleParsed} />

        {parsedData && parsedData.races.length > 0 && (
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

            {/* Race tables */}
            <div className="race-list">
              {parsedData.races.map((race, index) => (
                <RaceTable key={index} race={race} raceState={raceState} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
