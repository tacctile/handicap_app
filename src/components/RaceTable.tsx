import { useState, useCallback, useMemo } from 'react'
import type { ParsedRace } from '../types/drf'
import type { TrackCondition, UseRaceStateReturn } from '../hooks/useRaceState'
import { RaceControls } from './RaceControls'
import { BettingRecommendations } from './BettingRecommendations'
import { calculateRaceScores, getScoreColor, type HorseScore } from '../lib/scoring'
import { getTrackBiasSummary } from '../lib/trackIntelligence'

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

// Score badge component
interface ScoreBadgeProps {
  score: HorseScore
}

function ScoreBadge({ score }: ScoreBadgeProps) {
  const color = getScoreColor(score.total, score.isScratched)

  return (
    <div
      className="score-badge"
      style={{
        backgroundColor: `${color}20`,
        color: color,
        borderColor: `${color}40`,
      }}
      title={score.isScratched ? 'Scratched' : `Score: ${score.total}/240`}
    >
      <span className="tabular-nums font-semibold">
        {score.isScratched ? '—' : score.total}
      </span>
    </div>
  )
}

// Track bias info component with tooltip
interface TrackBiasInfoProps {
  trackCode: string
  distance: string
  surface: 'dirt' | 'turf' | 'synthetic'
}

function TrackBiasInfo({ trackCode, distance, surface }: TrackBiasInfoProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const biasSummary = useMemo(
    () => getTrackBiasSummary(trackCode, distance, surface),
    [trackCode, distance, surface]
  )

  if (!biasSummary.isDataAvailable) {
    return null
  }

  const speedBiasLabel = biasSummary.speedBiasPercent >= 55
    ? 'Speed favoring'
    : biasSummary.speedBiasPercent <= 45
    ? 'Closer friendly'
    : 'Fair track'

  return (
    <div className="track-bias-container">
      <div className="track-bias-chips">
        <div className="bias-chip speed-bias">
          <Icon name="speed" className="text-sm" />
          <span>Speed: {biasSummary.speedBiasPercent}%</span>
        </div>
        <div className="bias-chip post-bias">
          <Icon name="grid_view" className="text-sm" />
          <span>{biasSummary.favoredPostsDescription}</span>
        </div>
        <button
          type="button"
          className="bias-info-btn"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          aria-label="Track bias details"
        >
          <Icon name="info" className="text-base" />
        </button>
      </div>

      {showTooltip && (
        <div className="bias-tooltip">
          <div className="tooltip-header">
            <Icon name="analytics" className="text-base" />
            <span>{biasSummary.trackName} Bias</span>
          </div>
          <div className="tooltip-content">
            <div className="tooltip-row">
              <span className="tooltip-label">Speed bias:</span>
              <span className="tooltip-value">{speedBiasLabel}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Early speed win rate:</span>
              <span className="tooltip-value">{biasSummary.speedBiasPercent}%</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Post advantage:</span>
              <span className="tooltip-value">{biasSummary.favoredPostsDescription}</span>
            </div>
            <div className="tooltip-desc">{biasSummary.speedBiasDescription}</div>
          </div>
          <div className="tooltip-footer">
            <Icon name="verified" className="text-xs" />
            <span>Track bias applied to scoring</span>
          </div>
        </div>
      )}
    </div>
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

        {/* Track Bias Information */}
        <TrackBiasInfo
          trackCode={header.trackCode}
          distance={header.distance}
          surface={header.surface}
        />

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
  const { horses, header } = race
  const {
    trackCondition,
    setTrackCondition,
    toggleScratch,
    isScratched,
    getOdds,
    updateOdds,
    hasOddsChanged,
  } = raceState

  // Calculate and sort scores - recalculates when odds, scratches, or track condition change
  const scoredHorses = useMemo(() => {
    return calculateRaceScores(
      horses,
      header,
      getOdds,
      isScratched,
      trackCondition
    )
  }, [horses, header, getOdds, isScratched, trackCondition])

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
              <th className="w-20 text-center">Score</th>
              <th className="w-16 text-center">PP</th>
              <th className="text-left">Horse</th>
              <th className="text-left">Trainer</th>
              <th className="text-left">Jockey</th>
              <th className="w-28 text-right">Odds</th>
            </tr>
          </thead>
          <tbody>
            {scoredHorses.map(({ horse, index, score }) => {
              const scratched = score.isScratched
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
                  <td className="text-center">
                    <ScoreBadge score={score} />
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
        {scoredHorses.map(({ horse, index, score }) => {
          const scratched = score.isScratched
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
                  <ScoreBadge score={score} />
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

      {/* Betting Recommendations - Only show when horses are scored */}
      {scoredHorses.length > 0 && (
        <BettingRecommendations
          horses={scoredHorses}
          raceNumber={header.raceNumber}
        />
      )}
    </div>
  )
}
