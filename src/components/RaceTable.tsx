import { useState, useCallback } from 'react'
import type { ParsedRace } from '../types/drf'
import type { TrackCondition, UseRaceStateReturn } from '../hooks/useRaceState'
import { RaceControls } from './RaceControls'

interface RaceTableProps {
  race: ParsedRace
  raceState: UseRaceStateReturn
}

// Material Icon component for cleaner usage
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

// Editable odds field component
interface EditableOddsProps {
  value: string
  onChange: (value: string) => void
  hasChanged: boolean
  disabled?: boolean
}

function EditableOdds({ value, onChange, hasChanged, disabled }: EditableOddsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  const handleClick = useCallback(() => {
    if (!disabled) {
      setEditValue(value)
      setIsEditing(true)
    }
  }, [disabled, value])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    if (editValue.trim() && editValue !== value) {
      onChange(editValue.trim())
    }
  }, [editValue, value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setEditValue(value)
      setIsEditing(false)
    }
  }, [value])

  if (isEditing) {
    return (
      <input
        type="text"
        className="odds-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    )
  }

  return (
    <button
      type="button"
      className={`odds-display ${hasChanged ? 'odds-changed' : ''} ${disabled ? 'odds-disabled' : ''}`}
      onClick={handleClick}
      disabled={disabled}
    >
      <span className="tabular-nums">{value}</span>
      {!disabled && <Icon name="edit" className="odds-edit-icon" />}
    </button>
  )
}

// Scratch checkbox component
interface ScratchCheckboxProps {
  checked: boolean
  onChange: () => void
  horseName: string
}

function ScratchCheckbox({ checked, onChange, horseName }: ScratchCheckboxProps) {
  return (
    <label className="scratch-checkbox" title={checked ? `Unscratsch ${horseName}` : `Scratch ${horseName}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="scratch-input"
      />
      <span className="scratch-box">
        <Icon name={checked ? 'close' : 'check_box_outline_blank'} className="scratch-icon" />
      </span>
    </label>
  )
}

// Race header card component
function RaceHeader({
  race,
  trackCondition,
  onTrackConditionChange,
}: {
  race: ParsedRace
  trackCondition: TrackCondition
  onTrackConditionChange: (condition: TrackCondition) => void
}) {
  const { header } = race

  // Format surface for display
  const surfaceLabel = header.surface.charAt(0).toUpperCase() + header.surface.slice(1)

  return (
    <div className="race-header-card">
      <div className="flex flex-col gap-4">
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

        {/* Race Controls integrated in header */}
        <RaceControls
          trackCondition={trackCondition}
          onTrackConditionChange={onTrackConditionChange}
          surface={header.surface}
        />
      </div>
    </div>
  )
}

// Main RaceTable component
export function RaceTable({ race, raceState }: RaceTableProps) {
  const { horses } = race
  const {
    trackCondition,
    setTrackCondition,
    toggleScratch,
    isScratched,
    getOdds,
    updateOdds,
    hasOddsChanged,
  } = raceState

  return (
    <div className="race-table-container">
      <RaceHeader
        race={race}
        trackCondition={trackCondition}
        onTrackConditionChange={setTrackCondition}
      />

      {/* Desktop/Tablet Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="race-table">
          <thead>
            <tr>
              <th className="w-12 text-center">
                <Icon name="cancel" className="text-base text-white/40" />
              </th>
              <th className="w-16 text-center">PP</th>
              <th className="text-left">Horse</th>
              <th className="text-left">Trainer</th>
              <th className="text-left">Jockey</th>
              <th className="w-28 text-right">Odds</th>
            </tr>
          </thead>
          <tbody>
            {horses.map((horse, index) => {
              const scratched = isScratched(index)
              const currentOdds = getOdds(index, horse.morningLineOdds)
              const oddsChanged = hasOddsChanged(index)

              return (
                <tr
                  key={index}
                  className={`race-row ${scratched ? 'race-row-scratched' : ''}`}
                >
                  <td className="text-center">
                    <ScratchCheckbox
                      checked={scratched}
                      onChange={() => toggleScratch(index)}
                      horseName={horse.horseName}
                    />
                  </td>
                  <td className="text-center tabular-nums font-medium">
                    {horse.postPosition}
                  </td>
                  <td className={`font-medium ${scratched ? 'horse-name-scratched' : 'text-foreground'}`}>
                    {horse.horseName}
                  </td>
                  <td className="text-white/70">
                    {horse.trainerName}
                  </td>
                  <td className="text-white/70">
                    {horse.jockeyName}
                  </td>
                  <td className="text-right">
                    <EditableOdds
                      value={currentOdds}
                      onChange={(newOdds) => updateOdds(index, newOdds)}
                      hasChanged={oddsChanged}
                      disabled={scratched}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-2">
        {horses.map((horse, index) => {
          const scratched = isScratched(index)
          const currentOdds = getOdds(index, horse.morningLineOdds)
          const oddsChanged = hasOddsChanged(index)

          return (
            <div
              key={index}
              className={`mobile-horse-card ${scratched ? 'mobile-card-scratched' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ScratchCheckbox
                    checked={scratched}
                    onChange={() => toggleScratch(index)}
                    horseName={horse.horseName}
                  />
                  <div className="pp-badge">
                    {horse.postPosition}
                  </div>
                  <div>
                    <div className={`font-medium ${scratched ? 'horse-name-scratched' : 'text-foreground'}`}>
                      {horse.horseName}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {horse.jockeyName}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <EditableOdds
                    value={currentOdds}
                    onChange={(newOdds) => updateOdds(index, newOdds)}
                    hasChanged={oddsChanged}
                    disabled={scratched}
                  />
                  <div className="text-xs text-white/40">Odds</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/50">
                <span className="text-white/30">T:</span> {horse.trainerName}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
