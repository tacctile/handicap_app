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
  calculateRaceConfidence,
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
  // Class analysis imports - PRESERVED FOR EXPANDED ROW INTEGRATION
  getClassMovementColor,
  getClassMovementIcon,
  getClassLevelAbbrev,
  getHiddenDropsSummary,
  type HorseScore,
  type OverlayAnalysis,
  type ValuePlay,
} from '../lib/scoring'
import { calculateEdgeColor, formatEdgePercent } from '../lib/edgeGradient'
import { getTrackBiasSummary } from '../lib/trackIntelligence'
import {
  analyzeRaceLongshots,
  type RaceLongshotSummary,
  type LongshotAnalysisResult,
} from '../lib/longshots'
import {
  analyzeRaceDiamonds,
  type RaceDiamondSummary,
  type DiamondAnalysis,
  getDiamondColor,
  getDiamondBgColor,
} from '../lib/diamonds'

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

// Class movement badge component for displaying class changes
interface ClassBadgeProps {
  score: HorseScore
}

const ClassBadge = memo(function ClassBadge({ score }: ClassBadgeProps) {
  if (!score.classScore) {
    return <span className="text-white/30">—</span>
  }

  const { analysis } = score.classScore
  const direction = analysis.movement.direction
  const color = getClassMovementColor(direction)
  const icon = getClassMovementIcon(direction)
  const hasHiddenDrops = analysis.hiddenDrops.length > 0
  const hiddenDropsSummary = getHiddenDropsSummary(analysis.hiddenDrops)

  // Build tooltip
  const tooltipParts = [
    `${direction === 'drop' ? 'Dropping' : direction === 'rise' ? 'Rising' : direction === 'lateral' ? 'Same class' : 'First start'}`,
  ]

  if (analysis.lastRaceClass) {
    tooltipParts.push(`From: ${getClassLevelAbbrev(analysis.lastRaceClass)}`)
  }
  tooltipParts.push(`To: ${getClassLevelAbbrev(analysis.currentClass)}`)

  if (hasHiddenDrops) {
    tooltipParts.push(`Hidden edges: ${hiddenDropsSummary}`)
  }

  if (analysis.provenAtLevel.hasWon) {
    tooltipParts.push(`Proven: ${analysis.provenAtLevel.winsAtLevel}W at level`)
  } else if (analysis.provenAtLevel.hasPlaced) {
    tooltipParts.push(`Proven: ${analysis.provenAtLevel.itmAtLevel} ITM`)
  }

  tooltipParts.push(`Class Score: ${score.classScore.total}/20`)

  return (
    <div
      className="class-badge"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color: color,
        padding: '4px 8px',
        borderRadius: '6px',
        border: '1px solid',
        fontSize: '0.75rem',
        fontWeight: 600,
        cursor: 'default',
      }}
      title={tooltipParts.join('\n')}
    >
      <span style={{ fontSize: '0.9rem' }}>{icon}</span>
      <span>{getClassLevelAbbrev(analysis.currentClass)}</span>
      {hasHiddenDrops && (
        <span style={{
          backgroundColor: '#22c55e',
          color: '#fff',
          borderRadius: '50%',
          width: '14px',
          height: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6rem',
          fontWeight: 700,
          marginLeft: '2px',
        }}>
          {analysis.hiddenDrops.length}
        </span>
      )}
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

// Diamond in Rough detector badge for race header
interface DiamondDetectorProps {
  diamondSummary: RaceDiamondSummary
  onHighlightHorse?: (index: number) => void
}

const DiamondDetector = memo(function DiamondDetector({
  diamondSummary,
  onHighlightHorse,
}: DiamondDetectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!diamondSummary.hasDiamonds) return null

  const diamondColor = getDiamondColor()
  const diamondBg = getDiamondBgColor(0.2)

  return (
    <div className="diamond-detector" style={{
      marginBottom: '12px',
    }}>
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: diamondBg,
          border: `2px solid ${diamondColor}60`,
          borderRadius: '8px',
          color: diamondColor,
          cursor: 'pointer',
          width: '100%',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '0.95rem',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.3rem' }}>💎</span>
          <span>
            {diamondSummary.diamondCount} Hidden Gem{diamondSummary.diamondCount > 1 ? 's' : ''} Detected!
          </span>
          <span style={{
            backgroundColor: diamondColor,
            color: '#1a1a1a',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 800,
          }}>
            RARE FIND
          </span>
        </div>
        <Icon name={isExpanded ? 'expand_less' : 'expand_more'} />
      </button>

      {isExpanded && (
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '0 0 8px 8px',
          border: `1px solid ${diamondColor}40`,
          borderTop: 'none',
          marginTop: '-4px',
          paddingTop: '8px',
        }}>
          {diamondSummary.diamonds.map((diamond) => (
            <button
              key={diamond.programNumber}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #333',
                cursor: 'pointer',
                color: '#e0e0e0',
              }}
              onClick={() => onHighlightHorse?.(diamond.horseIndex)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  backgroundColor: diamondColor,
                  color: '#1a1a1a',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}>
                  #{diamond.programNumber}
                </span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{diamond.horseName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    {diamond.story}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: diamondColor, fontSize: '0.85rem' }}>
                  {diamond.oddsDisplay}
                </span>
                <span style={{
                  color: '#22c55e',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}>
                  +{diamond.overlayPercent.toFixed(0)}%
                </span>
                <span style={{
                  backgroundColor: `${diamondColor}20`,
                  color: diamondColor,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}>
                  {diamond.confidence}% conf
                </span>
              </div>
            </button>
          ))}

          <div style={{
            padding: '10px 12px',
            fontSize: '0.8rem',
            color: diamondColor,
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span>💎</span>
            <span>Click horse to highlight in table</span>
          </div>
        </div>
      )}
    </div>
  )
})

// Nuclear Longshots detector badge for race header
interface NuclearLongshotsDetectorProps {
  longshotSummary: RaceLongshotSummary
  onHighlightHorse?: (index: number) => void
}

const NuclearLongshotsDetector = memo(function NuclearLongshotsDetector({
  longshotSummary,
  onHighlightHorse,
}: NuclearLongshotsDetectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Only show if we have nuclear or live longshots
  if (!longshotSummary.hasNuclear && !longshotSummary.hasLive) return null

  const nuclearCount = longshotSummary.nuclearLongshots.length
  const liveCount = longshotSummary.liveLongshots.length

  const bgColor = longshotSummary.hasNuclear ? '#ef444420' : '#f59e0b20'
  const borderColor = longshotSummary.hasNuclear ? '#ef4444' : '#f59e0b'
  const textColor = longshotSummary.hasNuclear ? '#ef4444' : '#f59e0b'

  return (
    <div className="nuclear-longshots-detector" style={{
      marginBottom: '12px',
    }}>
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}40`,
          borderRadius: '8px',
          color: textColor,
          cursor: 'pointer',
          width: '100%',
          justifyContent: 'space-between',
          fontWeight: 600,
          fontSize: '0.9rem',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name={longshotSummary.hasNuclear ? 'local_fire_department' : 'bolt'} />
          <span>
            {nuclearCount > 0 && `${nuclearCount} NUCLEAR`}
            {nuclearCount > 0 && liveCount > 0 && ' + '}
            {liveCount > 0 && `${liveCount} Live`}
            {' '}Longshot{(nuclearCount + liveCount) > 1 ? 's' : ''} Detected
          </span>
        </div>
        <Icon name={isExpanded ? 'expand_less' : 'expand_more'} />
      </button>

      {isExpanded && (
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '0 0 8px 8px',
          border: '1px solid #333',
          borderTop: 'none',
          marginTop: '-4px',
          paddingTop: '8px',
        }}>
          {/* Nuclear Longshots */}
          {longshotSummary.nuclearLongshots.map((longshot) => (
            <button
              key={longshot.programNumber}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #333',
                cursor: 'pointer',
                color: '#e0e0e0',
              }}
              onClick={() => onHighlightHorse?.(longshot.programNumber - 1)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  #{longshot.programNumber}
                </span>
                <span style={{ fontWeight: 500 }}>{longshot.horseName}</span>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>{longshot.oddsDisplay}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}>
                  {longshot.totalAnglePoints} pts
                </span>
                <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>
                  {(longshot.upsetProbability * 100).toFixed(0)}% upset
                </span>
              </div>
            </button>
          ))}

          {/* Live Longshots */}
          {longshotSummary.liveLongshots.map((longshot) => (
            <button
              key={longshot.programNumber}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #333',
                cursor: 'pointer',
                color: '#e0e0e0',
              }}
              onClick={() => onHighlightHorse?.(longshot.programNumber - 1)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  backgroundColor: '#f59e0b',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  #{longshot.programNumber}
                </span>
                <span style={{ fontWeight: 500 }}>{longshot.horseName}</span>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>{longshot.oddsDisplay}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  color: '#f59e0b',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}>
                  {longshot.totalAnglePoints} pts
                </span>
                <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>
                  {(longshot.upsetProbability * 100).toFixed(0)}% upset
                </span>
              </div>
            </button>
          ))}

          <div style={{
            padding: '8px 12px',
            fontSize: '0.75rem',
            color: '#888',
            fontStyle: 'italic',
          }}>
            Click horse to highlight in table
          </div>
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
  longshotSummary: RaceLongshotSummary | null
  diamondSummary: RaceDiamondSummary | null
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
  longshotSummary,
  diamondSummary,
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

        {/* Diamond in Rough Detection Badge - Most prominent! */}
        {diamondSummary && (
          <DiamondDetector diamondSummary={diamondSummary} onHighlightHorse={onHighlightHorse} />
        )}

        {/* Nuclear Longshots Detection Badge */}
        {longshotSummary && (
          <NuclearLongshotsDetector longshotSummary={longshotSummary} onHighlightHorse={onHighlightHorse} />
        )}

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

// Sort column type for table sorting
// Default is POST position ascending when race loads
type SortColumn = 'post' | 'horse' | 'odds' | 'finish' | 'fair' | 'edge'
type SortDirection = 'asc' | 'desc'

interface SortState {
  column: SortColumn
  direction: SortDirection
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

  // Sort state - default to POST position ascending when race loads
  const [sortState, setSortState] = useState<SortState>({ column: 'post', direction: 'asc' })

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

  // Analyze nuclear longshots
  const longshotSummary = useMemo(() => {
    // Create a scores map for the longshot analyzer
    const scoresMap = new Map<number, HorseScore>()
    for (const { horse, score } of scoredHorses) {
      scoresMap.set(horse.programNumber, score)
    }
    return analyzeRaceLongshots(horses, header, scoresMap)
  }, [horses, header, scoredHorses])

  // Analyze diamonds in rough
  const diamondSummary = useMemo(() => {
    const scoresMap = new Map<number, HorseScore>()
    for (const { index, score } of scoredHorses) {
      scoresMap.set(index, score)
    }
    return analyzeRaceDiamonds(horses, scoresMap, header, getOdds)
  }, [horses, header, scoredHorses, getOdds])

  // Create a map of program number to diamond analysis for easy lookup
  const diamondsByProgram = useMemo(() => {
    const map = new Map<number, DiamondAnalysis>()
    for (const diamond of diamondSummary.diamonds) {
      map.set(diamond.programNumber, diamond)
    }
    return map
  }, [diamondSummary])

  // Create a map of program number to longshot analysis for easy lookup
  const longshotsByProgram = useMemo(() => {
    const map = new Map<number, LongshotAnalysisResult>()
    for (const longshot of longshotSummary.allLongshots) {
      map.set(longshot.programNumber, longshot)
    }
    return map
  }, [longshotSummary])

  // Calculate all edges in the race for gradient coloring
  // This recalculates when scratches change (field composition affects min/max)
  const allEdgesInRace = useMemo(() => {
    const edges: number[] = []
    for (const { index, score } of scoredHorses) {
      if (!score.isScratched) {
        const overlay = overlaysByIndex.get(index)
        if (overlay) {
          edges.push(overlay.overlayPercent)
        }
      }
    }
    return edges
  }, [scoredHorses, overlaysByIndex])

  // Parse odds string to numeric value for sorting
  const parseOddsForSort = useCallback((oddsStr: string): number => {
    // Parse odds like "5-1", "3/2", "EVEN" to a numeric value
    if (!oddsStr || oddsStr === 'EVEN') return 1
    const parts = oddsStr.split(/[-/]/)
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0])
      const denominator = parseFloat(parts[1])
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator
      }
    }
    return parseFloat(oddsStr) || 999
  }, [])

  // Sort horses based on current sort state
  const sortedHorses = useMemo(() => {
    const sorted = [...scoredHorses]

    sorted.sort((a, b) => {
      // Scratched horses always go to the bottom
      if (a.score.isScratched && !b.score.isScratched) return 1
      if (!a.score.isScratched && b.score.isScratched) return -1
      if (a.score.isScratched && b.score.isScratched) return 0

      let aVal: number | string
      let bVal: number | string

      switch (sortState.column) {
        case 'post':
          aVal = a.horse.postPosition
          bVal = b.horse.postPosition
          break
        case 'horse':
          aVal = a.horse.horseName.toLowerCase()
          bVal = b.horse.horseName.toLowerCase()
          break
        case 'odds':
          aVal = parseOddsForSort(getOdds(a.index, a.horse.morningLineOdds))
          bVal = parseOddsForSort(getOdds(b.index, b.horse.morningLineOdds))
          break
        case 'finish':
          // Lower rank = better finish position
          aVal = a.rank
          bVal = b.rank
          break
        case 'fair':
          const aOverlay = overlaysByIndex.get(a.index)
          const bOverlay = overlaysByIndex.get(b.index)
          aVal = aOverlay?.fairOdds ?? 999
          bVal = bOverlay?.fairOdds ?? 999
          break
        case 'edge':
          const aEdge = overlaysByIndex.get(a.index)
          const bEdge = overlaysByIndex.get(b.index)
          aVal = aEdge?.overlayPercent ?? -999
          bVal = bEdge?.overlayPercent ?? -999
          break
        default:
          aVal = a.horse.postPosition
          bVal = b.horse.postPosition
      }

      // Compare
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal)
        return sortState.direction === 'asc' ? comparison : -comparison
      }

      const numComparison = (aVal as number) - (bVal as number)
      return sortState.direction === 'asc' ? numComparison : -numComparison
    })

    return sorted
  }, [scoredHorses, sortState, getOdds, overlaysByIndex, parseOddsForSort])

  // Handle sort column click
  const handleSortClick = useCallback((column: SortColumn) => {
    setSortState(prev => {
      if (prev.column === column) {
        // Toggle direction
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      // New column - default to ascending (except edge which defaults descending)
      return { column, direction: column === 'edge' ? 'desc' : 'asc' }
    })
  }, [])

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
  // Use centralized confidence calculation from scoring module
  const confidenceLevel = useMemo(() => {
    return calculateRaceConfidence(scoredHorses)
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
        longshotSummary={longshotSummary}
        diamondSummary={diamondSummary}
        onHighlightHorse={handleHighlightHorse}
      />

      {/* Desktop/Tablet Table View - visible at 768px+ */}
      {/* Column order: SCR, POST, HORSE, ODDS, FINISH, FAIR, EDGE */}
      {/* VALUE tag column removed from display - preserved for expanded row integration */}
      <div className="race-table-wrapper">
        <table className="race-table">
          <thead>
            <tr>
              {/* SCR - Scratch toggle */}
              <th className="w-12 text-center">
                <Icon name="cancel" className="text-base text-white/40" />
              </th>
              {/* POST - Post position, sortable */}
              <th
                className="w-16 text-center sortable-header"
                onClick={() => handleSortClick('post')}
                title="Sort by post position"
              >
                <span className="header-content">
                  POST
                  {sortState.column === 'post' && (
                    <Icon name={sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} className="sort-icon" />
                  )}
                </span>
              </th>
              {/* HORSE - Horse name, sortable */}
              <th
                className="text-left sortable-header"
                onClick={() => handleSortClick('horse')}
                title="Sort by horse name"
              >
                <span className="header-content">
                  HORSE
                  {sortState.column === 'horse' && (
                    <Icon name={sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} className="sort-icon" />
                  )}
                </span>
              </th>
              {/* ODDS - Current odds, sortable */}
              <th
                className="w-20 text-center sortable-header"
                onClick={() => handleSortClick('odds')}
                title="Sort by current odds"
              >
                <span className="header-content">
                  ODDS
                  {sortState.column === 'odds' && (
                    <Icon name={sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} className="sort-icon" />
                  )}
                </span>
              </th>
              {/* FINISH - Predicted finish position, sortable */}
              <th
                className="w-16 text-center sortable-header"
                onClick={() => handleSortClick('finish')}
                title="Sort by predicted finish position"
              >
                <span className="header-content">
                  FINISH
                  {sortState.column === 'finish' && (
                    <Icon name={sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} className="sort-icon" />
                  )}
                </span>
              </th>
              {/* FAIR - Fair odds based on score, sortable */}
              <th
                className="w-16 text-center sortable-header"
                onClick={() => handleSortClick('fair')}
                title="Sort by fair odds"
              >
                <span className="header-content">
                  FAIR
                  {sortState.column === 'fair' && (
                    <Icon name={sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} className="sort-icon" />
                  )}
                </span>
              </th>
              {/* EDGE - Edge percentage with gradient coloring, sortable */}
              <th
                className="w-20 text-center sortable-header"
                onClick={() => handleSortClick('edge')}
                title="Sort by edge percentage"
              >
                <span className="header-content">
                  EDGE
                  {sortState.column === 'edge' && (
                    <Icon name={sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'} className="sort-icon" />
                  )}
                </span>
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {/* Using sortedHorses with default POST ascending sort */}
            {sortedHorses.map(({ horse, index, score, rank }) => {
              const scratched = score.isScratched
              const currentOdds = getOdds(index, horse.morningLineOdds)
              const oddsChanged = hasOddsChanged(index)
              const oddsHighlighted = calculationState.changedOddsIndices.has(index)
              const overlay = overlaysByIndex.get(index)
              const isHighlighted = highlightedHorseIndex === index
              const longshotAnalysis = longshotsByProgram.get(horse.programNumber)
              const isNuclear = longshotAnalysis?.classification === 'nuclear'
              const isLive = longshotAnalysis?.classification === 'live'
              const diamondAnalysis = diamondsByProgram.get(horse.programNumber)
              const isDiamond = !!diamondAnalysis
              const diamondColor = getDiamondColor()
              // Calculate edge color based on race field context
              const edgeColor = overlay ? calculateEdgeColor(overlay.overlayPercent, allEdgesInRace) : '#6E6E70'

              return (
                <tr
                  key={index}
                  data-horse-index={index}
                  // Uniform neutral dark background - no conditional coloring based on value/edge
                  // Preserves: hover state, expanded row styling, highlighted state
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
                  {/* SCR - Scratch checkbox */}
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <ScratchCheckbox
                      checked={scratched}
                      onChange={() => toggleScratch(index)}
                      horseName={horse.horseName}
                    />
                  </td>
                  {/* POST - Post position */}
                  <td className="text-center tabular-nums font-medium">
                    {horse.postPosition}
                  </td>
                  {/* HORSE - Horse name with indicator badges */}
                  <td className={`font-medium ${scratched ? 'horse-name-scratched' : 'text-foreground'}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {horse.horseName}
                      {isDiamond && !scratched && (
                        <span
                          title={`💎 HIDDEN GEM: ${diamondAnalysis?.factorCount} factors align for upset at ${diamondAnalysis?.oddsDisplay}\n${diamondAnalysis?.story}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            backgroundColor: diamondColor,
                            borderRadius: '4px',
                            cursor: 'help',
                            fontSize: '0.85rem',
                          }}
                        >
                          💎
                        </span>
                      )}
                      {isNuclear && !scratched && (
                        <span
                          title={`NUCLEAR LONGSHOT: ${longshotAnalysis?.totalAnglePoints} pts - ${longshotAnalysis?.detectedAngles.map(a => a.name).join(' + ')}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            backgroundColor: '#ef4444',
                            borderRadius: '50%',
                            cursor: 'help',
                          }}
                        >
                          <Icon name="local_fire_department" className="text-xs text-white" />
                        </span>
                      )}
                      {isLive && !scratched && (
                        <span
                          title={`Live Longshot: ${longshotAnalysis?.totalAnglePoints} pts - ${longshotAnalysis?.detectedAngles.map(a => a.name).join(' + ')}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            backgroundColor: '#f59e0b',
                            borderRadius: '50%',
                            cursor: 'help',
                          }}
                        >
                          <Icon name="bolt" className="text-xs text-white" />
                        </span>
                      )}
                    </div>
                  </td>
                  {/* ODDS - Current odds (editable) */}
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <EditableOdds
                      value={currentOdds}
                      onChange={(newOdds) => updateOdds(index, newOdds)}
                      hasChanged={oddsChanged}
                      disabled={scratched}
                      isHighlighted={oddsHighlighted}
                    />
                  </td>
                  {/* FINISH - Predicted finish position (rank) */}
                  <td className="text-center tabular-nums font-semibold">
                    {!scratched ? (
                      <span
                        title={`Predicted to finish #${rank} based on score of ${score.total}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '28px',
                          height: '28px',
                          padding: '0 6px',
                          borderRadius: '6px',
                          backgroundColor: rank <= 3 ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
                          color: rank <= 3 ? '#19abb5' : 'rgba(238, 239, 241, 0.7)',
                          fontWeight: rank <= 3 ? 700 : 500,
                        }}
                      >
                        {rank}
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  {/* FAIR - Fair odds */}
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <FairOddsDisplay overlay={overlay} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  {/* EDGE - Edge percentage with dynamic gradient color */}
                  {/* VALUE tag display removed - logic preserved for expanded row integration */}
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: edgeColor }}
                        title={`Edge: ${formatEdgePercent(overlay.overlayPercent)}\nPositive = odds better than fair value\nColor intensity based on field range`}
                      >
                        {formatEdgePercent(overlay.overlayPercent)}
                      </span>
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
      {/* Column structure matches desktop: POST, HORSE, ODDS, FINISH, FAIR, EDGE */}
      {/* VALUE tag display removed - preserved for expanded row integration */}
      <div className="mobile-cards-container">
        {sortedHorses.map(({ horse, index, score, rank }) => {
          const scratched = score.isScratched
          const currentOdds = getOdds(index, horse.morningLineOdds)
          const oddsChanged = hasOddsChanged(index)
          const oddsHighlighted = calculationState.changedOddsIndices.has(index)
          const overlay = overlaysByIndex.get(index)
          const isHighlighted = highlightedHorseIndex === index
          const longshotAnalysisMobile = longshotsByProgram.get(horse.programNumber)
          const isNuclearMobile = longshotAnalysisMobile?.classification === 'nuclear'
          const isLiveMobile = longshotAnalysisMobile?.classification === 'live'
          const diamondAnalysisMobile = diamondsByProgram.get(horse.programNumber)
          const isDiamondMobile = !!diamondAnalysisMobile
          const diamondColorMobile = getDiamondColor()
          // Calculate edge color based on race field context
          const edgeColorMobile = overlay ? calculateEdgeColor(overlay.overlayPercent, allEdgesInRace) : '#6E6E70'

          return (
            <div
              key={index}
              data-horse-index={index}
              // Uniform neutral dark background - no conditional coloring based on value/edge
              // Preserves: hover state, highlighted state
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
              {/* FINISH - Predicted finish position (rank) */}
              <div className="mobile-card-rank" style={{
                backgroundColor: rank <= 3 && !scratched ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
                color: rank <= 3 && !scratched ? '#19abb5' : undefined,
                fontWeight: rank <= 3 && !scratched ? 700 : undefined,
              }}>
                {!scratched ? rank : '—'}
              </div>

              {/* Main card content */}
              <div className="mobile-card-main">
                <div className="mobile-card-header">
                  <div className="mobile-card-left">
                    {/* SCR - Scratch checkbox */}
                    <div className="mobile-scratch-area" onClick={(e) => e.stopPropagation()}>
                      <ScratchCheckbox
                        checked={scratched}
                        onChange={() => toggleScratch(index)}
                        horseName={horse.horseName}
                      />
                    </div>
                    {/* POST - Post position */}
                    <div className="pp-badge">
                      {horse.postPosition}
                    </div>
                  </div>
                  {/* ODDS - Current odds (editable) */}
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
                  {/* HORSE - Horse name with indicator badges */}
                  <div className={`mobile-horse-name ${scratched ? 'horse-name-scratched' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {horse.horseName}
                    {isDiamondMobile && !scratched && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        backgroundColor: diamondColorMobile,
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                      }}>
                        💎
                      </span>
                    )}
                    {isNuclearMobile && !scratched && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        backgroundColor: '#ef4444',
                        borderRadius: '50%',
                      }}>
                        <Icon name="local_fire_department" className="text-xs text-white" />
                      </span>
                    )}
                    {isLiveMobile && !scratched && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#f59e0b',
                        borderRadius: '50%',
                      }}>
                        <Icon name="bolt" className="text-xs text-white" />
                      </span>
                    )}
                  </div>
                  {/* Jockey/Trainer info - kept for context */}
                  <div className="mobile-horse-details">
                    <span className="mobile-detail-item">
                      <span className="mobile-detail-label">J:</span> {horse.jockeyName}
                    </span>
                    <span className="mobile-detail-item">
                      <span className="mobile-detail-label">T:</span> {horse.trainerName}
                    </span>
                  </div>
                  {/* FAIR and EDGE info row for mobile */}
                  {/* VALUE tag display removed - preserved for expanded row integration */}
                  {!scratched && overlay && (
                    <div className="mobile-overlay-row" style={{ marginTop: '8px' }}>
                      <div className="mobile-overlay-item">
                        <span className="mobile-overlay-label">Fair:</span>
                        <FairOddsDisplay overlay={overlay} />
                      </div>
                      <div className="mobile-overlay-item">
                        <span className="mobile-overlay-label">Edge:</span>
                        <span
                          className="tabular-nums font-semibold"
                          style={{ color: edgeColorMobile }}
                        >
                          {formatEdgePercent(overlay.overlayPercent)}
                        </span>
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
          longshotAnalysis={longshotsByProgram.get(selectedHorse.horse.programNumber)}
          diamondAnalysis={diamondsByProgram.get(selectedHorse.horse.programNumber)}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
