import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react'
import type { ParsedRace, HorseEntry } from '../types/drf'
import type { TrackCondition, UseRaceStateReturn } from '../hooks/useRaceState'
import type { UseBankrollReturn } from '../hooks/useBankroll'
import { RaceControls } from './RaceControls'
import { BettingRecommendations } from './BettingRecommendations'
import { HorseDetailModal } from './HorseDetailModal'
import { CalculationStatus } from './CalculationStatus'
import { ToastContainer, useToasts } from './Toast'
import {
  calculateRaceScores,
  getScoreColor,
  getScoreTier,
  SCORE_THRESHOLDS,
  analyzeOverlay,
  detectValuePlays,
  getValuePlaysSummary,
  formatOverlayPercent,
  formatEV,
  getOverlayColor,
  getOverlayBgColor,
  VALUE_LABELS,
  getEquipmentImpactSummary,
  getImpactColor,
  getImpactIcon,
  type HorseScore,
  type OverlayAnalysis,
  type ValuePlay,
} from '../lib/scoring'
import { getTrackBiasSummary } from '../lib/trackIntelligence'

interface RaceTableProps {
  race: ParsedRace
  raceState: UseRaceStateReturn
  bankroll: UseBankrollReturn
  onOpenBankrollSettings: () => void
}

// Material Icon component for cleaner usage
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

// Editable odds field component with highlight animation
interface EditableOddsProps {
  value: string
  onChange: (value: string) => void
  hasChanged: boolean
  disabled?: boolean
  isHighlighted?: boolean
}

const EditableOdds = memo(function EditableOdds({
  value,
  onChange,
  hasChanged,
  disabled,
  isHighlighted = false,
}: EditableOddsProps) {
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
      className={`odds-display ${hasChanged ? 'odds-changed' : ''} ${disabled ? 'odds-disabled' : ''} ${isHighlighted ? 'odds-highlight' : ''}`}
      onClick={handleClick}
      disabled={disabled}
    >
      <span className="tabular-nums">{value}</span>
      {!disabled && <Icon name="edit" className="odds-edit-icon" />}
    </button>
  )
})

// Scratch checkbox component
interface ScratchCheckboxProps {
  checked: boolean
  onChange: () => void
  horseName: string
}

const ScratchCheckbox = memo(function ScratchCheckbox({ checked, onChange, horseName }: ScratchCheckboxProps) {
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
})

// Rank badge component for top 3 horses
interface RankBadgeProps {
  rank: number
}

const RankBadge = memo(function RankBadge({ rank }: RankBadgeProps) {
  if (rank > 3) return null

  const colors = {
    1: { bg: '#FFD700', text: '#1a1a1a' },  // Gold
    2: { bg: '#C0C0C0', text: '#1a1a1a' },  // Silver
    3: { bg: '#CD7F32', text: '#1a1a1a' },  // Bronze
  }

  const { bg, text } = colors[rank as 1 | 2 | 3]

  return (
    <div
      className="rank-badge"
      style={{
        backgroundColor: bg,
        color: text,
      }}
    >
      #{rank}
    </div>
  )
})

// Overlay badge component for displaying value
interface OverlayBadgeProps {
  overlay: OverlayAnalysis
  compact?: boolean
}

const OverlayBadge = memo(function OverlayBadge({ overlay, compact = false }: OverlayBadgeProps) {
  const color = getOverlayColor(overlay.overlayPercent)
  const bgColor = getOverlayBgColor(overlay.overlayPercent)

  if (compact) {
    return (
      <span
        className="overlay-badge-compact"
        style={{
          backgroundColor: bgColor,
          color: color,
          borderColor: `${color}40`,
        }}
        title={`${overlay.overlayDescription}\nEV: ${formatEV(overlay.evPerDollar)}/dollar`}
      >
        {formatOverlayPercent(overlay.overlayPercent)}
      </span>
    )
  }

  return (
    <div
      className="overlay-badge"
      style={{
        backgroundColor: bgColor,
        color: color,
        borderColor: `${color}40`,
      }}
      title={overlay.overlayDescription}
    >
      <span className="overlay-percent">{formatOverlayPercent(overlay.overlayPercent)}</span>
      <span className="overlay-label">{VALUE_LABELS[overlay.valueClass]}</span>
    </div>
  )
})

// Fair odds display component
interface FairOddsDisplayProps {
  overlay: OverlayAnalysis
}

const FairOddsDisplay = memo(function FairOddsDisplay({ overlay }: FairOddsDisplayProps) {
  return (
    <span
      className="fair-odds-display"
      title={`Fair odds based on score\nWin probability: ${overlay.winProbability.toFixed(1)}%`}
    >
      {overlay.fairOddsDisplay}
    </span>
  )
})

// EV display component
interface EVDisplayProps {
  overlay: OverlayAnalysis
}

const EVDisplay = memo(function EVDisplay({ overlay }: EVDisplayProps) {
  const isPositive = overlay.evPerDollar > 0
  const color = isPositive ? '#22c55e' : overlay.evPerDollar < -0.05 ? '#ef4444' : '#9ca3af'

  return (
    <span
      className="ev-display"
      style={{ color }}
      title={`Expected Value per $1 wagered\n${overlay.isPositiveEV ? 'Profitable long-term bet' : 'Not profitable long-term'}`}
    >
      {formatEV(overlay.evPerDollar)}
    </span>
  )
})

// Equipment badge component for displaying equipment changes
interface EquipmentBadgeProps {
  horse: HorseEntry
}

const EquipmentBadge = memo(function EquipmentBadge({ horse }: EquipmentBadgeProps) {
  const equipmentInfo = getEquipmentImpactSummary(horse)

  if (!equipmentInfo.hasChanges || !equipmentInfo.primaryChange) {
    return <span className="text-white/30">—</span>
  }

  const { primaryChange, totalImpact, hasTrainerPattern } = equipmentInfo
  const isPositive = totalImpact > 0
  const color = getImpactColor(primaryChange.impact)
  const icon = getImpactIcon(primaryChange.impact)

  return (
    <div
      className="equipment-badge"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color: color,
      }}
      title={`${equipmentInfo.summary}\nImpact: ${isPositive ? '+' : ''}${totalImpact} pts${hasTrainerPattern ? '\n★ Trainer pattern applied' : ''}`}
    >
      <Icon name={icon} className="equipment-badge-icon" />
      <span className="equipment-badge-label">
        {primaryChange.equipmentType.name.slice(0, 3).toUpperCase()}
      </span>
      {isPositive && <Icon name="arrow_upward" className="equipment-badge-arrow" />}
      {totalImpact < 0 && <Icon name="arrow_downward" className="equipment-badge-arrow" />}
    </div>
  )
})

// Value plays detector badge for race header
interface ValuePlaysDetectorProps {
  valuePlays: ValuePlay[]
  onHighlightHorse?: (index: number) => void
}

const ValuePlaysDetector = memo(function ValuePlaysDetector({ valuePlays, onHighlightHorse }: ValuePlaysDetectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const summary = useMemo(() => getValuePlaysSummary(valuePlays), [valuePlays])

  if (summary.totalCount === 0) return null

  return (
    <div className="value-plays-detector">
      <button
        type="button"
        className="value-plays-badge"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Icon name="local_fire_department" className="value-plays-icon" />
        <span className="value-plays-text">
          {summary.totalCount} Value Play{summary.totalCount > 1 ? 's' : ''} Detected
        </span>
        {summary.massiveCount > 0 && (
          <span className="value-plays-massive-badge">{summary.massiveCount} HOT</span>
        )}
        <Icon name={isExpanded ? 'expand_less' : 'expand_more'} className="value-plays-chevron" />
      </button>

      {isExpanded && (
        <div className="value-plays-dropdown">
          {valuePlays.slice(0, 5).map((play) => (
            <button
              key={play.horseIndex}
              type="button"
              className="value-play-item"
              onClick={() => onHighlightHorse?.(play.horseIndex)}
            >
              <span className="value-play-number">#{play.programNumber}</span>
              <span className="value-play-name">{play.horseName}</span>
              <span
                className="value-play-overlay"
                style={{ color: getOverlayColor(play.overlayPercent) }}
              >
                {formatOverlayPercent(play.overlayPercent)}
              </span>
              <span className="value-play-ev">{formatEV(play.evPerDollar)}</span>
            </button>
          ))}
          {valuePlays.length > 5 && (
            <div className="value-plays-more">+{valuePlays.length - 5} more</div>
          )}
        </div>
      )}
    </div>
  )
})

// Score badge component with pulse animation and tier coloring
interface ScoreBadgeProps {
  score: HorseScore
  rank: number
  hasChanged?: boolean
}

const ScoreBadge = memo(function ScoreBadge({ score, rank, hasChanged = false }: ScoreBadgeProps) {
  const color = getScoreColor(score.total, score.isScratched)
  const tier = getScoreTier(score.total)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  useEffect(() => {
    if (hasChanged) {
      setShouldAnimate(true)
      const timer = setTimeout(() => setShouldAnimate(false), 600)
      return () => clearTimeout(timer)
    }
  }, [hasChanged, score.total])

  // Build detailed tooltip
  const tooltipParts = [
    `Score: ${score.total}/240 (${tier})`,
    `Connections: ${score.breakdown.connections.total}`,
    `Post Position: ${score.breakdown.postPosition.total}`,
    `Speed/Class: ${score.breakdown.speedClass.total}`,
    `Form: ${score.breakdown.form.total}`,
    `Equipment: ${score.breakdown.equipment.total}`,
    `Pace: ${score.breakdown.pace.total}`,
  ]

  return (
    <div className="score-badge-container">
      {!score.isScratched && <RankBadge rank={rank} />}
      <div
        className={`score-badge ${shouldAnimate ? 'score-changed' : ''} ${score.total >= SCORE_THRESHOLDS.elite ? 'score-elite' : ''}`}
        style={{
          backgroundColor: `${color}20`,
          color: color,
          borderColor: `${color}40`,
        }}
        title={score.isScratched ? 'Scratched' : tooltipParts.join('\n')}
      >
        <span className="tabular-nums font-semibold">
          {score.isScratched ? '—' : score.total}
        </span>
      </div>
    </div>
  )
})

// Track bias info component with tooltip
interface TrackBiasInfoProps {
  trackCode: string
  distance: string
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
}

const TrackBiasInfo = memo(function TrackBiasInfo({ trackCode, distance, surface }: TrackBiasInfoProps) {
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
})

// Race header card component
interface RaceHeaderProps {
  race: ParsedRace
  trackCondition: TrackCondition
  onTrackConditionChange: (condition: TrackCondition) => void
  hasChanges: boolean
  onReset: () => void
  scratchesCount: number
  oddsChangesCount: number
  valuePlays: ValuePlay[]
  onHighlightHorse?: (index: number) => void
}

const RaceHeader = memo(function RaceHeader({
  race,
  trackCondition,
  onTrackConditionChange,
  hasChanges,
  onReset,
  scratchesCount,
  oddsChangesCount,
  valuePlays,
  onHighlightHorse,
}: RaceHeaderProps) {
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

        {/* Value Plays Detection Badge */}
        <ValuePlaysDetector valuePlays={valuePlays} onHighlightHorse={onHighlightHorse} />

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
          hasChanges={hasChanges}
          onReset={onReset}
          scratchesCount={scratchesCount}
          oddsChangesCount={oddsChangesCount}
        />
      </div>
    </div>
  )
})

// Modal state interface
interface SelectedHorseData {
  horse: HorseEntry
  score: HorseScore
  index: number
  predictedPosition: number
}

// Main RaceTable component
export function RaceTable({ race, raceState, bankroll, onOpenBankrollSettings }: RaceTableProps) {
  const { horses, header } = race
  const {
    trackCondition,
    setTrackCondition,
    toggleScratch,
    isScratched,
    getOdds,
    updateOdds,
    hasOddsChanged,
    resetAll,
    hasChanges,
    calculationState,
    clearChangeHighlights,
  } = raceState

  // Toast notifications
  const { toasts, addToast, dismissToast } = useToasts()

  // Track previous calculation version for toast notifications
  const prevVersionRef = useRef(calculationState.calculationVersion)

  // Modal state
  const [selectedHorse, setSelectedHorse] = useState<SelectedHorseData | null>(null)

  // Highlighted horse index (from value plays click)
  const [highlightedHorseIndex, setHighlightedHorseIndex] = useState<number | null>(null)

  // Track previous scores for change detection
  const prevScoresRef = useRef<Map<number, number>>(new Map())

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

  // Calculate overlay analysis for each horse
  const overlaysByIndex = useMemo(() => {
    const overlays: Map<number, OverlayAnalysis> = new Map()
    for (const { horse, index, score } of scoredHorses) {
      if (!score.isScratched) {
        const currentOdds = getOdds(index, horse.morningLineOdds)
        overlays.set(index, analyzeOverlay(score.total, currentOdds))
      }
    }
    return overlays
  }, [scoredHorses, getOdds])

  // Detect value plays for the race header badge
  const valuePlays = useMemo(() => {
    const horsesData = scoredHorses.map(({ horse, index, score }) => ({
      horseIndex: index,
      horseName: horse.horseName,
      programNumber: horse.programNumber,
      score: score.total,
      currentOdds: getOdds(index, horse.morningLineOdds),
      isScratched: score.isScratched,
    }))
    return detectValuePlays(horsesData, 10) // 10% minimum overlay
  }, [scoredHorses, getOdds])

  // Handle highlight horse from value plays click
  const handleHighlightHorse = useCallback((index: number) => {
    setHighlightedHorseIndex(index)
    // Auto-clear highlight after 3 seconds
    setTimeout(() => setHighlightedHorseIndex(null), 3000)
    // Scroll to the horse row
    const row = document.querySelector(`[data-horse-index="${index}"]`)
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // Detect score changes and track them
  const changedScoreIndices = useMemo(() => {
    const changed = new Set<number>()
    for (const { index, score } of scoredHorses) {
      const prevScore = prevScoresRef.current.get(index)
      if (prevScore !== undefined && prevScore !== score.total) {
        changed.add(index)
      }
    }
    return changed
  }, [scoredHorses])

  // Update previous scores after render
  useEffect(() => {
    const newMap = new Map<number, number>()
    for (const { index, score } of scoredHorses) {
      newMap.set(index, score.total)
    }
    prevScoresRef.current = newMap
  }, [scoredHorses])

  // Show toast when recalculation completes (after first load)
  useEffect(() => {
    if (
      calculationState.calculationVersion > 1 &&
      calculationState.calculationVersion !== prevVersionRef.current &&
      !calculationState.isCalculating
    ) {
      addToast('Recalculated based on changes', 'success', { duration: 2000 })
    }
    prevVersionRef.current = calculationState.calculationVersion
  }, [calculationState.calculationVersion, calculationState.isCalculating, addToast])

  // Clear highlights after animation
  useEffect(() => {
    if (changedScoreIndices.size > 0) {
      const timer = setTimeout(() => {
        clearChangeHighlights()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [changedScoreIndices.size, clearChangeHighlights])

  // Calculate stats for CalculationStatus
  const activeHorses = scoredHorses.filter(h => !h.score.isScratched).length
  const confidenceLevel = useMemo(() => {
    const scores = scoredHorses
      .filter(h => !h.score.isScratched)
      .map(h => h.score.total)
      .sort((a, b) => b - a)

    if (scores.length < 2) return 50

    const topScore = scores[0]
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const differential = scores.length > 1 ? ((topScore - scores[1]) / topScore) * 30 : 0
    const qualityBonus = Math.min(20, (topScore / 240) * 25)
    const baseConfidence = 40 + (avgScore / 240) * 30

    return Math.min(100, Math.round(baseConfidence + differential + qualityBonus))
  }, [scoredHorses])

  // Handle row click to open modal
  const handleRowClick = useCallback((
    horse: HorseEntry,
    score: HorseScore,
    index: number,
    predictedPosition: number
  ) => {
    setSelectedHorse({ horse, score, index, predictedPosition })
  }, [])

  // Close modal
  const handleCloseModal = useCallback(() => {
    setSelectedHorse(null)
  }, [])

  // Handle reset with toast
  const handleReset = useCallback(() => {
    resetAll()
    addToast('All changes reset to original', 'info', { duration: 2500 })
  }, [resetAll, addToast])

  return (
    <div className="race-table-container">
      <RaceHeader
        race={race}
        trackCondition={trackCondition}
        onTrackConditionChange={setTrackCondition}
        hasChanges={hasChanges}
        onReset={handleReset}
        scratchesCount={raceState.scratchedHorses.size}
        oddsChangesCount={Object.keys(raceState.updatedOdds).length}
        valuePlays={valuePlays}
        onHighlightHorse={handleHighlightHorse}
      />

      {/* Desktop/Tablet Table View - visible at 768px+ */}
      <div className="race-table-wrapper">
        <table className="race-table">
          <thead>
            <tr>
              <th className="w-12 text-center">
                <Icon name="cancel" className="text-base text-white/40" />
              </th>
              <th className="w-20 text-center">Score</th>
              <th className="w-16 text-center">PP</th>
              <th className="text-left">Horse</th>
              <th className="w-20 text-center hide-on-small" title="Equipment changes">Equip</th>
              <th className="text-left hide-on-small">Trainer</th>
              <th className="text-left hide-on-small">Jockey</th>
              <th className="w-20 text-right">Odds</th>
              <th className="w-16 text-center" title="Fair Odds based on score">Fair</th>
              <th className="w-20 text-center" title="Overlay percentage (value)">Overlay</th>
              <th className="w-16 text-center" title="Expected Value per $1">EV</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {scoredHorses.map(({ horse, index, score, rank }) => {
              const scratched = score.isScratched
              const currentOdds = getOdds(index, horse.morningLineOdds)
              const oddsChanged = hasOddsChanged(index)
              const scoreChanged = changedScoreIndices.has(index)
              const oddsHighlighted = calculationState.changedOddsIndices.has(index)
              const overlay = overlaysByIndex.get(index)
              const isHighlighted = highlightedHorseIndex === index

              return (
                <tr
                  key={index}
                  data-horse-index={index}
                  className={`race-row race-row-clickable ${scratched ? 'race-row-scratched' : ''} ${isHighlighted ? 'race-row-highlighted' : ''}`}
                  onClick={() => handleRowClick(horse, score, index, rank)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleRowClick(horse, score, index, rank)
                    }
                  }}
                  role="button"
                  aria-label={`View details for ${horse.horseName}`}
                >
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <ScratchCheckbox
                      checked={scratched}
                      onChange={() => toggleScratch(index)}
                      horseName={horse.horseName}
                    />
                  </td>
                  <td className="text-center">
                    <ScoreBadge score={score} rank={rank} hasChanged={scoreChanged} />
                  </td>
                  <td className="text-center tabular-nums font-medium">
                    {horse.postPosition}
                  </td>
                  <td className={`font-medium ${scratched ? 'horse-name-scratched' : 'text-foreground'}`}>
                    {horse.horseName}
                  </td>
                  <td className="text-center hide-on-small">
                    {!scratched ? <EquipmentBadge horse={horse} /> : <span className="text-white/30">—</span>}
                  </td>
                  <td className="text-white/70 hide-on-small">
                    {horse.trainerName}
                  </td>
                  <td className="text-white/70 hide-on-small">
                    {horse.jockeyName}
                  </td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <EditableOdds
                      value={currentOdds}
                      onChange={(newOdds) => updateOdds(index, newOdds)}
                      hasChanged={oddsChanged}
                      disabled={scratched}
                      isHighlighted={oddsHighlighted}
                    />
                  </td>
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <FairOddsDisplay overlay={overlay} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <OverlayBadge overlay={overlay} compact />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <EVDisplay overlay={overlay} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="row-chevron-cell">
                    <Icon name="chevron_right" className="row-chevron" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - visible below 768px */}
      <div className="mobile-cards-container">
        {scoredHorses.map(({ horse, index, score, rank }) => {
          const scratched = score.isScratched
          const currentOdds = getOdds(index, horse.morningLineOdds)
          const oddsChanged = hasOddsChanged(index)
          const scoreChanged = changedScoreIndices.has(index)
          const oddsHighlighted = calculationState.changedOddsIndices.has(index)
          const overlay = overlaysByIndex.get(index)
          const isHighlighted = highlightedHorseIndex === index

          return (
            <div
              key={index}
              data-horse-index={index}
              className={`mobile-horse-card mobile-card-clickable ${scratched ? 'mobile-card-scratched' : ''} ${isHighlighted ? 'mobile-card-highlighted' : ''}`}
              onClick={() => handleRowClick(horse, score, index, rank)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleRowClick(horse, score, index, rank)
                }
              }}
              aria-label={`View details for ${horse.horseName}. Tap to expand for full details.`}
            >
              {/* Rank indicator */}
              <div className="mobile-card-rank">{rank || '—'}</div>

              {/* Main card content */}
              <div className="mobile-card-main">
                <div className="mobile-card-header">
                  <div className="mobile-card-left">
                    <div className="mobile-scratch-area" onClick={(e) => e.stopPropagation()}>
                      <ScratchCheckbox
                        checked={scratched}
                        onChange={() => toggleScratch(index)}
                        horseName={horse.horseName}
                      />
                    </div>
                    <ScoreBadge score={score} rank={rank} hasChanged={scoreChanged} />
                    <div className="pp-badge">
                      {horse.postPosition}
                    </div>
                  </div>
                  <div className="mobile-card-right" onClick={(e) => e.stopPropagation()}>
                    <EditableOdds
                      value={currentOdds}
                      onChange={(newOdds) => updateOdds(index, newOdds)}
                      hasChanged={oddsChanged}
                      disabled={scratched}
                      isHighlighted={oddsHighlighted}
                    />
                  </div>
                </div>

                <div className="mobile-card-body">
                  <div className={`mobile-horse-name ${scratched ? 'horse-name-scratched' : ''}`}>
                    {horse.horseName}
                  </div>
                  <div className="mobile-horse-details">
                    <span className="mobile-detail-item">
                      <span className="mobile-detail-label">J:</span> {horse.jockeyName}
                    </span>
                    <span className="mobile-detail-item">
                      <span className="mobile-detail-label">T:</span> {horse.trainerName}
                    </span>
                  </div>
                  {/* Overlay info row for mobile */}
                  {!scratched && overlay && (
                    <div className="mobile-overlay-row">
                      <div className="mobile-overlay-item">
                        <span className="mobile-overlay-label">Fair:</span>
                        <FairOddsDisplay overlay={overlay} />
                      </div>
                      <div className="mobile-overlay-item">
                        <span className="mobile-overlay-label">Value:</span>
                        <OverlayBadge overlay={overlay} compact />
                      </div>
                      <div className="mobile-overlay-item">
                        <span className="mobile-overlay-label">EV:</span>
                        <EVDisplay overlay={overlay} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mobile-card-footer">
                  <span className="mobile-tap-hint">Tap for details</span>
                  <Icon name="chevron_right" className="mobile-card-chevron" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Betting Recommendations with Calculation Status */}
      {scoredHorses.length > 0 && (
        <>
          <CalculationStatus
            calculationState={calculationState}
            horsesAnalyzed={horses.length}
            activeHorses={activeHorses}
            confidenceLevel={confidenceLevel}
          />
          <BettingRecommendations
            horses={scoredHorses}
            raceNumber={header.raceNumber}
            bankroll={bankroll}
            onOpenBankrollSettings={onOpenBankrollSettings}
          />
        </>
      )}

      {/* Horse Detail Modal */}
      {selectedHorse && (
        <HorseDetailModal
          isOpen={!!selectedHorse}
          onClose={handleCloseModal}
          horse={selectedHorse.horse}
          score={selectedHorse.score}
          raceHeader={header}
          currentOdds={getOdds(selectedHorse.index, selectedHorse.horse.morningLineOdds)}
          predictedPosition={selectedHorse.predictedPosition}
          totalHorses={horses.filter((_, i) => !isScratched(i)).length}
          overlay={overlaysByIndex.get(selectedHorse.index)}
          allHorses={horses.filter((_, i) => !isScratched(i))}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
