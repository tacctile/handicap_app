import { useState, useCallback } from 'react'
import { FileUpload } from './components/FileUpload'
import { RaceTable } from './components/RaceTable'
import type { ParsedDRFFile } from './types/drf'

function App() {
  const [parsedData, setParsedData] = useState<ParsedDRFFile | null>(null)

  const handleParsed = useCallback((data: ParsedDRFFile) => {
    setParsedData(data)
  }, [])

  const totalHorses = parsedData?.races.reduce((sum, race) => sum + race.horses.length, 0) ?? 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Horse Monster</h1>
      </header>
      <main className="p-6">
        <FileUpload onParsed={handleParsed} />

        {parsedData && parsedData.races.length > 0 && (
          <div className="mt-6">
            {/* Summary stats */}
            <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-white/60">
              <span>
                <span className="text-foreground font-medium">{parsedData.races.length}</span> race{parsedData.races.length !== 1 ? 's' : ''}
              </span>
              <span className="text-white/20">•</span>
              <span>
                <span className="text-foreground font-medium">{totalHorses}</span> horse{totalHorses !== 1 ? 's' : ''}
              </span>
              <span className="text-white/20">•</span>
              <span className="text-white/40">{parsedData.filename}</span>
            </div>

            {/* Race tables */}
            <div className="space-y-6">
              {parsedData.races.map((race, index) => (
                <RaceTable key={index} race={race} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
