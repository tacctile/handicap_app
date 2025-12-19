import { useState, useCallback } from 'react'
import { FileUpload } from './components/FileUpload'
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
          <div className="mt-6 w-full max-w-xl">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-3">
                Debug View
              </h2>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-white/40">File:</span>{' '}
                  <span className="text-foreground">{parsedData.filename}</span>
                </p>
                <p>
                  <span className="text-white/40">Races:</span>{' '}
                  <span className="text-foreground">{parsedData.races.length}</span>
                </p>
                <p>
                  <span className="text-white/40">Total Horses:</span>{' '}
                  <span className="text-foreground">{totalHorses}</span>
                </p>
              </div>

              {parsedData.races.map((race, index) => (
                <div key={index} className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-foreground font-medium">
                      {race.header.trackCode}
                    </span>
                    <span className="text-white/40">Race {race.header.raceNumber}</span>
                    <span className="text-white/30 text-xs">
                      {race.header.distance} | {race.header.surface} | {race.header.raceDate}
                    </span>
                  </div>

                  <p className="text-xs text-white/40 mb-2">
                    {race.horses.length} horse{race.horses.length !== 1 ? 's' : ''}
                  </p>

                  <ul className="space-y-1">
                    {race.horses.map((horse, horseIndex) => (
                      <li key={horseIndex} className="text-sm text-white/60">
                        <span className="text-white/30 w-6 inline-block">
                          {horse.postPosition}.
                        </span>
                        <span className="text-foreground">{horse.horseName}</span>
                        <span className="text-white/30 ml-2">
                          ({horse.jockeyName} / {horse.trainerName})
                        </span>
                        <span className="text-white/40 ml-2">
                          ML: {horse.morningLineOdds}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
