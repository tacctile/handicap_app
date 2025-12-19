import type { ParsedRace } from '../types/drf'

interface RaceTableProps {
  race: ParsedRace
}

// Material Icon component for cleaner usage
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

// Race header card component
function RaceHeader({ race }: { race: ParsedRace }) {
  const { header } = race

  // Format surface for display
  const surfaceLabel = header.surface.charAt(0).toUpperCase() + header.surface.slice(1)

  return (
    <div className="race-header-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="track-badge">
            <Icon name="location_on" className="text-lg" />
            <span className="font-semibold">{header.trackCode}</span>
          </div>
          <div className="race-number">
            Race {header.raceNumber}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="info-chip">
            <Icon name="route" className="text-base" />
            <span>{header.distance}</span>
          </div>
          <div className="info-chip">
            <Icon name="terrain" className="text-base" />
            <span>{surfaceLabel}</span>
          </div>
          <div className="text-white/40 text-xs">
            {header.raceDate}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main RaceTable component
export function RaceTable({ race }: RaceTableProps) {
  const { horses } = race

  return (
    <div className="race-table-container">
      <RaceHeader race={race} />

      {/* Desktop/Tablet Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="race-table">
          <thead>
            <tr>
              <th className="w-16 text-center">PP</th>
              <th className="text-left">Horse</th>
              <th className="text-left">Trainer</th>
              <th className="text-left">Jockey</th>
              <th className="w-24 text-right">ML Odds</th>
            </tr>
          </thead>
          <tbody>
            {horses.map((horse, index) => (
              <tr key={index} className="race-row">
                <td className="text-center tabular-nums font-medium">
                  {horse.postPosition}
                </td>
                <td className="font-medium text-foreground">
                  {horse.horseName}
                </td>
                <td className="text-white/70">
                  {horse.trainerName}
                </td>
                <td className="text-white/70">
                  {horse.jockeyName}
                </td>
                <td className="text-right tabular-nums text-accent font-medium">
                  {horse.morningLineOdds}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-2">
        {horses.map((horse, index) => (
          <div key={index} className="mobile-horse-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="pp-badge">
                  {horse.postPosition}
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {horse.horseName}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">
                    {horse.jockeyName}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-accent font-medium tabular-nums">
                  {horse.morningLineOdds}
                </div>
                <div className="text-xs text-white/40">ML</div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/50">
              <span className="text-white/30">T:</span> {horse.trainerName}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Styles embedded as CSS-in-JS alternative using Tailwind @apply
// These styles are defined in index.css
