import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import type { ParsedRace, HorseEntry } from '../types/drf';
import type { TrackCondition, UseRaceStateReturn } from '../hooks/useRaceState';
import { RaceControls } from './RaceControls';
import { HorseDetailModal } from './HorseDetailModal';
import { CalculationStatus } from './CalculationStatus';
import { ToastContainer, useToasts } from './Toast';
import { InfoTooltip } from './InfoTooltip';
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
  // Class analysis imports
  getClassMovementColor,
  getClassMovementIcon,
  getClassLevelAbbrev,
  getHiddenDropsSummary,
  type HorseScore,
  type OverlayAnalysis,
  type ValuePlay,
} from '../lib/scoring';
import { getTrackBiasSummary } from '../lib/trackIntelligence';
import {
  analyzeRaceLongshots,
  type RaceLongshotSummary,
  type LongshotAnalysisResult,
} from '../lib/longshots';
import {
  analyzeRaceDiamonds,
  type RaceDiamondSummary,
  type DiamondAnalysis,
  getDiamondColor,
  getDiamondBgColor,
} from '../lib/diamonds';
import {
  incrementOdds,
  decrementOdds,
  canIncrementOdds,
  canDecrementOdds,
} from '../lib/utils/oddsStepper';

interface RaceTableProps {
  race: ParsedRace;
  raceState: UseRaceStateReturn;
}

// Material Icon component for cleaner usage
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

// Editable odds field component with +/- stepper buttons
interface EditableOddsProps {
  value: string;
  onChange: (value: string) => void;
  hasChanged: boolean;
  disabled?: boolean;
  isHighlighted?: boolean;
}

const EditableOdds = memo(function EditableOdds({
  value,
  onChange,
  hasChanged,
  disabled,
  isHighlighted = false,
}: EditableOddsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleClick = useCallback(() => {
    if (!disabled) {
      setEditValue(value);
      setIsEditing(true);
    }
  }, [disabled, value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== value) {
      onChange(editValue.trim());
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        setEditValue(value);
        setIsEditing(false);
      }
    },
    [value]
  );

  const handleIncrement = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled && canIncrementOdds(value)) {
        onChange(incrementOdds(value));
      }
    },
    [disabled, value, onChange]
  );

  const handleDecrement = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled && canDecrementOdds(value)) {
        onChange(decrementOdds(value));
      }
    },
    [disabled, value, onChange]
  );

  if (isEditing) {
    return (
      <div className="odds-stepper">
        <input
          type="text"
          className="odds-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
    );
  }

  const canIncrement = !disabled && canIncrementOdds(value);
  const canDecrement = !disabled && canDecrementOdds(value);

  return (
    <div
      className={`odds-stepper ${hasChanged ? 'odds-changed' : ''} ${disabled ? 'odds-disabled' : ''} ${isHighlighted ? 'odds-highlight' : ''}`}
    >
      <button
        type="button"
        className="odds-stepper-btn odds-stepper-minus"
        onClick={handleDecrement}
        disabled={!canDecrement}
        aria-label="Decrease odds"
        title="Lower odds (more favored)"
      >
        <Icon name="remove" className="odds-stepper-icon" />
      </button>
      <button
        type="button"
        className="odds-value-btn"
        onClick={handleClick}
        disabled={disabled}
        title="Click to edit odds manually"
      >
        <span className="tabular-nums">{value}</span>
      </button>
      <button
        type="button"
        className="odds-stepper-btn odds-stepper-plus"
        onClick={handleIncrement}
        disabled={!canIncrement}
        aria-label="Increase odds"
        title="Higher odds (longer shot)"
      >
        <Icon name="add" className="odds-stepper-icon" />
      </button>
    </div>
  );
});

// Scratch checkbox component
interface ScratchCheckboxProps {
  checked: boolean;
  onChange: () => void;
  horseName: string;
}

const ScratchCheckbox = memo(function ScratchCheckbox({
  checked,
  onChange,
  horseName,
}: ScratchCheckboxProps) {
  return (
    <label
      className="scratch-checkbox"
      title={checked ? `Unscratsch ${horseName}` : `Scratch ${horseName}`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="scratch-input" />
      <span className="scratch-box">
        <Icon name={checked ? 'close' : 'check_box_outline_blank'} className="scratch-icon" />
      </span>
    </label>
  );
});

// Rank badge component for top 3 horses
interface RankBadgeProps {
  rank: number;
}

const RankBadge = memo(function RankBadge({ rank }: RankBadgeProps) {
  if (rank > 3) return null;

  const colors = {
    1: { bg: '#FFD700', text: '#1a1a1a' }, // Gold
    2: { bg: '#C0C0C0', text: '#1a1a1a' }, // Silver
    3: { bg: '#CD7F32', text: '#1a1a1a' }, // Bronze
  };

  const { bg, text } = colors[rank as 1 | 2 | 3];

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
  );
});

// Overlay badge component for displaying value
interface OverlayBadgeProps {
  overlay: OverlayAnalysis;
  compact?: boolean;
}

const OverlayBadge = memo(function OverlayBadge({ overlay, compact = false }: OverlayBadgeProps) {
  const color = getOverlayColor(overlay.overlayPercent);
  const bgColor = getOverlayBgColor(overlay.overlayPercent);

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
    );
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
  );
});

// Fair odds display component
interface FairOddsDisplayProps {
  overlay: OverlayAnalysis;
}

const FairOddsDisplay = memo(function FairOddsDisplay({ overlay }: FairOddsDisplayProps) {
  // Handle invalid fair odds display
  const displayValue =
    overlay.fairOddsDisplay && overlay.fairOddsDisplay !== 'N/A' ? overlay.fairOddsDisplay : '—';
  const winProbDisplay = Number.isFinite(overlay.winProbability)
    ? overlay.winProbability.toFixed(1)
    : '—';

  return (
    <span
      className="fair-odds-display"
      title={`Fair odds based on score\nWin probability: ${winProbDisplay}%`}
    >
      {displayValue}
    </span>
  );
});

// EV display component
interface EVDisplayProps {
  overlay: OverlayAnalysis;
}

const EVDisplay = memo(function EVDisplay({ overlay }: EVDisplayProps) {
  const isPositive = overlay.evPerDollar > 0;
  const color = isPositive ? '#22c55e' : overlay.evPerDollar < -0.05 ? '#ef4444' : '#9ca3af';

  return (
    <span
      className="ev-display"
      style={{ color }}
      title={`Expected Value per $1 wagered\n${overlay.isPositiveEV ? 'Profitable long-term bet' : 'Not profitable long-term'}`}
    >
      {formatEV(overlay.evPerDollar)}
    </span>
  );
});

// Win Confidence display component
interface WinConfidenceDisplayProps {
  overlay: OverlayAnalysis;
}

const WinConfidenceDisplay = memo(function WinConfidenceDisplay({
  overlay,
}: WinConfidenceDisplayProps) {
  const winProb = overlay.winProbability;
  // Handle invalid win probability
  if (!Number.isFinite(winProb) || winProb <= 0) {
    return <span className="text-white/30">—</span>;
  }

  // Color based on win probability
  const color = winProb >= 25 ? '#22c55e' : winProb >= 15 ? '#eab308' : '#9ca3af';

  return (
    <span
      className="win-conf-display tabular-nums"
      style={{ color, fontWeight: 600 }}
      title={`Model's estimated win probability based on score analysis`}
    >
      {winProb.toFixed(1)}%
    </span>
  );
});

// Equipment badge component for displaying equipment changes
interface EquipmentBadgeProps {
  horse: HorseEntry;
}

const EquipmentBadge = memo(function EquipmentBadge({ horse }: EquipmentBadgeProps) {
  const equipmentInfo = getEquipmentImpactSummary(horse);

  if (!equipmentInfo.hasChanges || !equipmentInfo.primaryChange) {
    return <span className="text-white/30">—</span>;
  }

  const { primaryChange, totalImpact, hasTrainerPattern } = equipmentInfo;
  const isPositive = totalImpact > 0;
  const color = getImpactColor(primaryChange.impact);
  const icon = getImpactIcon(primaryChange.impact);

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
  );
});

// Class movement badge component for displaying class changes
interface ClassBadgeProps {
  score: HorseScore;
}

const ClassBadge = memo(function ClassBadge({ score }: ClassBadgeProps) {
  if (!score.classScore) {
    return <span className="text-white/30">—</span>;
  }

  const { analysis } = score.classScore;
  const direction = analysis.movement.direction;
  const color = getClassMovementColor(direction);
  const icon = getClassMovementIcon(direction);
  const hasHiddenDrops = analysis.hiddenDrops.length > 0;
  const hiddenDropsSummary = getHiddenDropsSummary(analysis.hiddenDrops);

  // Build tooltip
  const tooltipParts = [
    `${direction === 'drop' ? 'Dropping' : direction === 'rise' ? 'Rising' : direction === 'lateral' ? 'Same class' : 'First start'}`,
  ];

  if (analysis.lastRaceClass) {
    tooltipParts.push(`From: ${getClassLevelAbbrev(analysis.lastRaceClass)}`);
  }
  tooltipParts.push(`To: ${getClassLevelAbbrev(analysis.currentClass)}`);

  if (hasHiddenDrops) {
    tooltipParts.push(`Hidden edges: ${hiddenDropsSummary}`);
  }

  if (analysis.provenAtLevel.hasWon) {
    tooltipParts.push(`Proven: ${analysis.provenAtLevel.winsAtLevel}W at level`);
  } else if (analysis.provenAtLevel.hasPlaced) {
    tooltipParts.push(`Proven: ${analysis.provenAtLevel.itmAtLevel} ITM`);
  }

  tooltipParts.push(`Class Score: ${score.classScore.total}/20`);

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
        <span
          style={{
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
          }}
        >
          {analysis.hiddenDrops.length}
        </span>
      )}
    </div>
  );
});

// Value plays detector badge for race header
interface ValuePlaysDetectorProps {
  valuePlays: ValuePlay[];
  onHighlightHorse?: (index: number) => void;
}

const ValuePlaysDetector = memo(function ValuePlaysDetector({
  valuePlays,
  onHighlightHorse,
}: ValuePlaysDetectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const summary = useMemo(() => getValuePlaysSummary(valuePlays), [valuePlays]);

  if (summary.totalCount === 0) return null;

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
  );
});

// Diamond in Rough detector badge for race header
interface DiamondDetectorProps {
  diamondSummary: RaceDiamondSummary;
  onHighlightHorse?: (index: number) => void;
}

const DiamondDetector = memo(function DiamondDetector({
  diamondSummary,
  onHighlightHorse,
}: DiamondDetectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!diamondSummary.hasDiamonds) return null;

  const diamondColor = getDiamondColor();
  const diamondBg = getDiamondBgColor(0.2);

  return (
    <div
      className="diamond-detector"
      style={{
        marginBottom: '12px',
      }}
    >
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
            {diamondSummary.diamondCount} Hidden Gem{diamondSummary.diamondCount > 1 ? 's' : ''}{' '}
            Detected!
          </span>
          <span
            style={{
              backgroundColor: diamondColor,
              color: '#1a1a1a',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 800,
            }}
          >
            RARE FIND
          </span>
        </div>
        <Icon name={isExpanded ? 'expand_less' : 'expand_more'} />
      </button>

      {isExpanded && (
        <div
          style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '0 0 8px 8px',
            border: `1px solid ${diamondColor}40`,
            borderTop: 'none',
            marginTop: '-4px',
            paddingTop: '8px',
          }}
        >
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
                <span
                  style={{
                    backgroundColor: diamondColor,
                    color: '#1a1a1a',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  #{diamond.programNumber}
                </span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{diamond.horseName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>{diamond.story}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: diamondColor, fontSize: '0.85rem' }}>
                  {diamond.oddsDisplay}
                </span>
                <span
                  style={{
                    color: '#22c55e',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                  }}
                >
                  +{diamond.overlayPercent.toFixed(0)}%
                </span>
                <span
                  style={{
                    backgroundColor: `${diamondColor}20`,
                    color: diamondColor,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                >
                  {diamond.confidence}% conf
                </span>
              </div>
            </button>
          ))}

          <div
            style={{
              padding: '10px 12px',
              fontSize: '0.8rem',
              color: diamondColor,
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>💎</span>
            <span>Click horse to highlight in table</span>
          </div>
        </div>
      )}
    </div>
  );
});

// Nuclear Longshots detector badge for race header
interface NuclearLongshotsDetectorProps {
  longshotSummary: RaceLongshotSummary;
  onHighlightHorse?: (index: number) => void;
}

const NuclearLongshotsDetector = memo(function NuclearLongshotsDetector({
  longshotSummary,
  onHighlightHorse,
}: NuclearLongshotsDetectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show if we have nuclear or live longshots
  if (!longshotSummary.hasNuclear && !longshotSummary.hasLive) return null;

  const nuclearCount = longshotSummary.nuclearLongshots.length;
  const liveCount = longshotSummary.liveLongshots.length;

  const bgColor = longshotSummary.hasNuclear ? '#ef444420' : '#f59e0b20';
  const borderColor = longshotSummary.hasNuclear ? '#ef4444' : '#f59e0b';
  const textColor = longshotSummary.hasNuclear ? '#ef4444' : '#f59e0b';

  return (
    <div
      className="nuclear-longshots-detector"
      style={{
        marginBottom: '12px',
      }}
    >
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
            {liveCount > 0 && `${liveCount} Live`} Longshot{nuclearCount + liveCount > 1 ? 's' : ''}{' '}
            Detected
          </span>
        </div>
        <Icon name={isExpanded ? 'expand_less' : 'expand_more'} />
      </button>

      {isExpanded && (
        <div
          style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '0 0 8px 8px',
            border: '1px solid #333',
            borderTop: 'none',
            marginTop: '-4px',
            paddingTop: '8px',
          }}
        >
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
                <span
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  #{longshot.programNumber}
                </span>
                <span style={{ fontWeight: 500 }}>{longshot.horseName}</span>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>{longshot.oddsDisplay}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                  }}
                >
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
                <span
                  style={{
                    backgroundColor: '#f59e0b',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  #{longshot.programNumber}
                </span>
                <span style={{ fontWeight: 500 }}>{longshot.horseName}</span>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>{longshot.oddsDisplay}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    color: '#f59e0b',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                  }}
                >
                  {longshot.totalAnglePoints} pts
                </span>
                <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>
                  {(longshot.upsetProbability * 100).toFixed(0)}% upset
                </span>
              </div>
            </button>
          ))}

          <div
            style={{
              padding: '8px 12px',
              fontSize: '0.75rem',
              color: '#888',
              fontStyle: 'italic',
            }}
          >
            Click horse to highlight in table
          </div>
        </div>
      )}
    </div>
  );
});

// Score badge component with pulse animation and tier coloring
interface ScoreBadgeProps {
  score: HorseScore;
  rank: number;
  hasChanged?: boolean;
}

const ScoreBadge = memo(function ScoreBadge({ score, rank, hasChanged = false }: ScoreBadgeProps) {
  const color = getScoreColor(score.total, score.isScratched);
  const tier = getScoreTier(score.total);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (hasChanged) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing animation state
      setShouldAnimate(true);
      const timer = setTimeout(() => setShouldAnimate(false), 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasChanged, score.total]);

  // Build detailed tooltip
  const tooltipParts = [
    `Score: ${score.total}/240 (${tier})`,
    `Connections: ${score.breakdown.connections.total}`,
    `Post Position: ${score.breakdown.postPosition.total}`,
    `Speed/Class: ${score.breakdown.speedClass.total}`,
    `Form: ${score.breakdown.form.total}`,
    `Equipment: ${score.breakdown.equipment.total}`,
    `Pace: ${score.breakdown.pace.total}`,
  ];

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
        <span className="tabular-nums font-semibold">{score.isScratched ? '—' : score.total}</span>
      </div>
    </div>
  );
});

// Track bias info component with tooltip
interface TrackBiasInfoProps {
  trackCode: string;
  distance: string;
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather';
}

const TrackBiasInfo = memo(function TrackBiasInfo({
  trackCode,
  distance,
  surface,
}: TrackBiasInfoProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const biasSummary = useMemo(
    () => getTrackBiasSummary(trackCode, distance, surface),
    [trackCode, distance, surface]
  );

  if (!biasSummary.isDataAvailable) {
    return null;
  }

  const speedBiasLabel =
    biasSummary.speedBiasPercent >= 55
      ? 'Speed favoring'
      : biasSummary.speedBiasPercent <= 45
        ? 'Closer friendly'
        : 'Fair track';

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
  );
});

// Race header card component
interface RaceHeaderProps {
  race: ParsedRace;
  trackCondition: TrackCondition;
  onTrackConditionChange: (condition: TrackCondition) => void;
  hasChanges: boolean;
  onReset: () => void;
  scratchesCount: number;
  oddsChangesCount: number;
  valuePlays: ValuePlay[];
  longshotSummary: RaceLongshotSummary | null;
  diamondSummary: RaceDiamondSummary | null;
  onHighlightHorse?: (index: number) => void;
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
  const { header } = race;

  // Format surface for display
  const surfaceLabel = header.surface.charAt(0).toUpperCase() + header.surface.slice(1);

  return (
    <div className="race-header-card">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="track-badge">
              <Icon name="location_on" className="text-lg" />
              <span className="font-semibold">{header.trackCode}</span>
            </div>
            <div className="race-number">Race {header.raceNumber}</div>
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
            <div className="text-white/40 text-xs">{header.raceDate}</div>
          </div>
        </div>

        {/* Diamond in Rough Detection Badge - Most prominent! */}
        {diamondSummary && (
          <DiamondDetector diamondSummary={diamondSummary} onHighlightHorse={onHighlightHorse} />
        )}

        {/* Nuclear Longshots Detection Badge */}
        {longshotSummary && (
          <NuclearLongshotsDetector
            longshotSummary={longshotSummary}
            onHighlightHorse={onHighlightHorse}
          />
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
  );
});

// Modal state interface
interface SelectedHorseData {
  horse: HorseEntry;
  score: HorseScore;
  index: number;
  predictedPosition: number;
}

// Main RaceTable component
export function RaceTable({ race, raceState }: RaceTableProps) {
  const { horses, header } = race;
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
  } = raceState;

  // Toast notifications
  const { toasts, addToast, dismissToast } = useToasts();

  // Track previous calculation version for toast notifications
  const prevVersionRef = useRef(calculationState.calculationVersion);

  // Modal state
  const [selectedHorse, setSelectedHorse] = useState<SelectedHorseData | null>(null);

  // Highlighted horse index (from value plays click)
  const [highlightedHorseIndex, setHighlightedHorseIndex] = useState<number | null>(null);

  // Track previous scores for change detection
  const prevScoresRef = useRef<Map<number, number>>(new Map());

  // Calculate and sort scores - recalculates when odds, scratches, or track condition change
  const scoredHorses = useMemo(() => {
    return calculateRaceScores(horses, header, getOdds, isScratched, trackCondition);
  }, [horses, header, getOdds, isScratched, trackCondition]);

  // Calculate overlay analysis for each horse
  const overlaysByIndex = useMemo(() => {
    const overlays: Map<number, OverlayAnalysis> = new Map();
    for (const { horse, index, score } of scoredHorses) {
      if (!score.isScratched) {
        const currentOdds = getOdds(index, horse.morningLineOdds);
        overlays.set(index, analyzeOverlay(score.total, currentOdds));
      }
    }
    return overlays;
  }, [scoredHorses, getOdds]);

  // Detect value plays for the race header badge
  const valuePlays = useMemo(() => {
    const horsesData = scoredHorses.map(({ horse, index, score }) => ({
      horseIndex: index,
      horseName: horse.horseName,
      programNumber: horse.programNumber,
      score: score.total,
      currentOdds: getOdds(index, horse.morningLineOdds),
      isScratched: score.isScratched,
    }));
    return detectValuePlays(horsesData, 10); // 10% minimum overlay
  }, [scoredHorses, getOdds]);

  // Analyze nuclear longshots
  const longshotSummary = useMemo(() => {
    // Create a scores map for the longshot analyzer
    const scoresMap = new Map<number, HorseScore>();
    for (const { horse, score } of scoredHorses) {
      scoresMap.set(horse.programNumber, score);
    }
    return analyzeRaceLongshots(horses, header, scoresMap);
  }, [horses, header, scoredHorses]);

  // Analyze diamonds in rough
  const diamondSummary = useMemo(() => {
    const scoresMap = new Map<number, HorseScore>();
    for (const { index, score } of scoredHorses) {
      scoresMap.set(index, score);
    }
    return analyzeRaceDiamonds(horses, scoresMap, header, getOdds);
  }, [horses, header, scoredHorses, getOdds]);

  // Create a map of program number to diamond analysis for easy lookup
  const diamondsByProgram = useMemo(() => {
    const map = new Map<number, DiamondAnalysis>();
    for (const diamond of diamondSummary.diamonds) {
      map.set(diamond.programNumber, diamond);
    }
    return map;
  }, [diamondSummary]);

  // Create a map of program number to longshot analysis for easy lookup
  const longshotsByProgram = useMemo(() => {
    const map = new Map<number, LongshotAnalysisResult>();
    for (const longshot of longshotSummary.allLongshots) {
      map.set(longshot.programNumber, longshot);
    }
    return map;
  }, [longshotSummary]);

  // Handle highlight horse from value plays click
  const handleHighlightHorse = useCallback((index: number) => {
    setHighlightedHorseIndex(index);
    // Auto-clear highlight after 3 seconds
    setTimeout(() => setHighlightedHorseIndex(null), 3000);
    // Scroll to the horse row
    const row = document.querySelector(`[data-horse-index="${index}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Detect score changes and track them
  const [changedScoreIndices, setChangedScoreIndices] = useState<Set<number>>(new Set());

  // Update changed scores and previous scores after render
  useEffect(() => {
    const changed = new Set<number>();
    const newMap = new Map<number, number>();

    for (const { index, score } of scoredHorses) {
      const prevScore = prevScoresRef.current.get(index);
      if (prevScore !== undefined && prevScore !== score.total) {
        changed.add(index);
      }
      newMap.set(index, score.total);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Tracking score changes
    setChangedScoreIndices(changed);
    prevScoresRef.current = newMap;
  }, [scoredHorses]);

  // Show toast when recalculation completes (after first load)
  useEffect(() => {
    if (
      calculationState.calculationVersion > 1 &&
      calculationState.calculationVersion !== prevVersionRef.current &&
      !calculationState.isCalculating
    ) {
      addToast('Recalculated based on changes', 'success', { duration: 2000 });
    }
    prevVersionRef.current = calculationState.calculationVersion;
  }, [calculationState.calculationVersion, calculationState.isCalculating, addToast]);

  // Clear highlights after animation
  useEffect(() => {
    if (changedScoreIndices.size > 0) {
      const timer = setTimeout(() => {
        clearChangeHighlights();
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [changedScoreIndices.size, clearChangeHighlights]);

  // Calculate stats for CalculationStatus
  const activeHorses = scoredHorses.filter((h) => !h.score.isScratched).length;
  // Use centralized confidence calculation from scoring module
  const confidenceLevel = useMemo(() => {
    return calculateRaceConfidence(scoredHorses);
  }, [scoredHorses]);

  // Handle row click to open modal
  const handleRowClick = useCallback(
    (horse: HorseEntry, score: HorseScore, index: number, predictedPosition: number) => {
      setSelectedHorse({ horse, score, index, predictedPosition });
    },
    []
  );

  // Close modal
  const handleCloseModal = useCallback(() => {
    setSelectedHorse(null);
  }, []);

  // Handle reset with toast
  const handleReset = useCallback(() => {
    resetAll();
    addToast('All changes reset to original', 'info', { duration: 2500 });
  }, [resetAll, addToast]);

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
      <div className="race-table-wrapper">
        <table className="race-table">
          <thead>
            <tr>
              <th className="w-12 text-center">
                <Icon name="cancel" className="text-base text-white/40" />
              </th>
              <th className="w-16 text-center">POST</th>
              <th className="text-left">HORSE</th>
              <th className="w-20 text-center">
                <div className="th-header-cell">
                  <div className="th-label-row">
                    <span>ODDS</span>
                    <InfoTooltip
                      content="Current market odds from the tote board or morning line"
                      title="Market Odds"
                      position="bottom"
                      className="th-help-icon"
                    />
                  </div>
                  <span className="th-subtext">Market Price</span>
                </div>
              </th>
              <th className="w-20 text-center">
                <div className="th-header-cell">
                  <div className="th-label-row">
                    <span>SCORE</span>
                    <InfoTooltip
                      content="Composite score (0-240) based on 6 handicapping categories: Connections, Post Position, Speed/Class, Form, Equipment, and Pace"
                      title="Model Score"
                      position="bottom"
                      className="th-help-icon"
                    />
                  </div>
                  <span className="th-subtext">Model Score</span>
                </div>
              </th>
              <th className="w-20 text-center">
                <div className="th-header-cell">
                  <div className="th-label-row">
                    <span>WIN CONF</span>
                    <InfoTooltip
                      content="Estimated win probability based on the model's score analysis"
                      title="Win Confidence"
                      position="bottom"
                      className="th-help-icon"
                    />
                  </div>
                  <span className="th-subtext">Model Confidence</span>
                </div>
              </th>
              <th className="w-20 text-center">
                <div className="th-header-cell">
                  <div className="th-label-row">
                    <span>FAIR</span>
                    <InfoTooltip
                      content="What the odds should be based on the model's win probability calculation"
                      title="Fair Odds"
                      position="bottom"
                      className="th-help-icon"
                    />
                  </div>
                  <span className="th-subtext">Model's True Price</span>
                </div>
              </th>
              <th className="w-20 text-center">
                <div className="th-header-cell">
                  <div className="th-label-row">
                    <span>EDGE %</span>
                    <InfoTooltip
                      content="Percentage difference between market odds and fair odds. Positive means undervalued (good bet), negative means overvalued"
                      title="Edge Percentage"
                      position="bottom"
                      className="th-help-icon"
                    />
                  </div>
                  <span className="th-subtext">Above / Below Value</span>
                </div>
              </th>
              <th className="w-20 text-center">
                <div className="th-header-cell">
                  <div className="th-label-row">
                    <span>ODDS EDGE</span>
                    <InfoTooltip
                      content="Expected value per $1 wagered. Positive EV indicates a profitable long-term bet"
                      title="Odds Edge"
                      position="bottom"
                      className="th-help-icon"
                    />
                  </div>
                  <span className="th-subtext">Value vs Market</span>
                </div>
              </th>
              <th
                className="w-24 text-center hide-on-small"
                title="Class movement (↓drop ↑rise →lateral)"
              >
                Class
              </th>
              <th className="w-20 text-center hide-on-small" title="Equipment changes">
                Equip
              </th>
              <th className="text-left hide-on-small">Trainer</th>
              <th className="text-left hide-on-small">Jockey</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {scoredHorses.map(({ horse, index, score, rank }) => {
              const scratched = score.isScratched;
              const currentOdds = getOdds(index, horse.morningLineOdds);
              const oddsChanged = hasOddsChanged(index);
              const scoreChanged = changedScoreIndices.has(index);
              const oddsHighlighted = calculationState.changedOddsIndices.has(index);
              const overlay = overlaysByIndex.get(index);
              const isHighlighted = highlightedHorseIndex === index;
              const longshotAnalysis = longshotsByProgram.get(horse.programNumber);
              const isNuclear = longshotAnalysis?.classification === 'nuclear';
              const isLive = longshotAnalysis?.classification === 'live';
              const diamondAnalysis = diamondsByProgram.get(horse.programNumber);
              const isDiamond = !!diamondAnalysis;
              const diamondColor = getDiamondColor();

              return (
                <tr
                  key={index}
                  data-horse-index={index}
                  className={`race-row race-row-clickable ${scratched ? 'race-row-scratched' : ''} ${isHighlighted ? 'race-row-highlighted' : ''} ${isDiamond && !scratched ? 'race-row-diamond' : ''}`}
                  style={
                    isDiamond && !scratched
                      ? {
                          backgroundColor: getDiamondBgColor(0.08),
                          borderLeft: `3px solid ${diamondColor}`,
                        }
                      : undefined
                  }
                  onClick={() => handleRowClick(horse, score, index, rank)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(horse, score, index, rank);
                    }
                  }}
                  role="button"
                  aria-label={`View details for ${horse.horseName}`}
                >
                  {/* Scratch checkbox */}
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <ScratchCheckbox
                      checked={scratched}
                      onChange={() => toggleScratch(index)}
                      horseName={horse.horseName}
                    />
                  </td>
                  {/* POST */}
                  <td className="text-center tabular-nums font-medium">{horse.postPosition}</td>
                  {/* HORSE */}
                  <td
                    className={`font-medium ${scratched ? 'horse-name-scratched' : 'text-foreground'}`}
                  >
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
                          title={`NUCLEAR LONGSHOT: ${longshotAnalysis?.totalAnglePoints} pts - ${longshotAnalysis?.detectedAngles.map((a) => a.name).join(' + ')}`}
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
                          title={`Live Longshot: ${longshotAnalysis?.totalAnglePoints} pts - ${longshotAnalysis?.detectedAngles.map((a) => a.name).join(' + ')}`}
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
                  {/* ODDS */}
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <EditableOdds
                      value={currentOdds}
                      onChange={(newOdds) => updateOdds(index, newOdds)}
                      hasChanged={oddsChanged}
                      disabled={scratched}
                      isHighlighted={oddsHighlighted}
                    />
                  </td>
                  {/* SCORE */}
                  <td className="text-center">
                    <ScoreBadge score={score} rank={rank} hasChanged={scoreChanged} />
                  </td>
                  {/* WIN CONF */}
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <WinConfidenceDisplay overlay={overlay} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  {/* FAIR */}
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <FairOddsDisplay overlay={overlay} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  {/* EDGE % */}
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <OverlayBadge overlay={overlay} compact />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  {/* ODDS EDGE */}
                  <td className="text-center">
                    {!scratched && overlay ? (
                      <EVDisplay overlay={overlay} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  {/* Hidden columns */}
                  <td className="text-center hide-on-small">
                    {!scratched ? (
                      <ClassBadge score={score} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="text-center hide-on-small">
                    {!scratched ? (
                      <EquipmentBadge horse={horse} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="text-white/70 hide-on-small">{horse.trainerName}</td>
                  <td className="text-white/70 hide-on-small">{horse.jockeyName}</td>
                  {/* Expand chevron */}
                  <td className="row-chevron-cell">
                    <Icon name="chevron_right" className="row-chevron" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - visible below 768px */}
      <div className="mobile-cards-container">
        {scoredHorses.map(({ horse, index, score, rank }) => {
          const scratched = score.isScratched;
          const currentOdds = getOdds(index, horse.morningLineOdds);
          const oddsChanged = hasOddsChanged(index);
          const scoreChanged = changedScoreIndices.has(index);
          const oddsHighlighted = calculationState.changedOddsIndices.has(index);
          const overlay = overlaysByIndex.get(index);
          const isHighlighted = highlightedHorseIndex === index;
          const longshotAnalysisMobile = longshotsByProgram.get(horse.programNumber);
          const isNuclearMobile = longshotAnalysisMobile?.classification === 'nuclear';
          const isLiveMobile = longshotAnalysisMobile?.classification === 'live';
          const diamondAnalysisMobile = diamondsByProgram.get(horse.programNumber);
          const isDiamondMobile = !!diamondAnalysisMobile;
          const diamondColorMobile = getDiamondColor();

          return (
            <div
              key={index}
              data-horse-index={index}
              className={`mobile-horse-card mobile-card-clickable ${scratched ? 'mobile-card-scratched' : ''} ${isHighlighted ? 'mobile-card-highlighted' : ''} ${isDiamondMobile && !scratched ? 'mobile-card-diamond' : ''}`}
              style={
                isDiamondMobile && !scratched
                  ? {
                      backgroundColor: getDiamondBgColor(0.08),
                      borderLeft: `3px solid ${diamondColorMobile}`,
                    }
                  : undefined
              }
              onClick={() => handleRowClick(horse, score, index, rank)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(horse, score, index, rank);
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
                    <div className="pp-badge">{horse.postPosition}</div>
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
                  <div
                    className={`mobile-horse-name ${scratched ? 'horse-name-scratched' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {horse.horseName}
                    {isDiamondMobile && !scratched && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '22px',
                          height: '22px',
                          backgroundColor: diamondColorMobile,
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                        }}
                      >
                        💎
                      </span>
                    )}
                    {isNuclearMobile && !scratched && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          backgroundColor: '#ef4444',
                          borderRadius: '50%',
                        }}
                      >
                        <Icon name="local_fire_department" className="text-xs text-white" />
                      </span>
                    )}
                    {isLiveMobile && !scratched && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '18px',
                          height: '18px',
                          backgroundColor: '#f59e0b',
                          borderRadius: '50%',
                        }}
                      >
                        <Icon name="bolt" className="text-xs text-white" />
                      </span>
                    )}
                  </div>
                  <div className="mobile-horse-details">
                    <span className="mobile-detail-item">
                      <span className="mobile-detail-label">J:</span> {horse.jockeyName}
                    </span>
                    <span className="mobile-detail-item">
                      <span className="mobile-detail-label">T:</span> {horse.trainerName}
                    </span>
                  </div>
                  {/* Class info row for mobile */}
                  {!scratched && (
                    <div
                      className="mobile-class-row"
                      style={{
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span style={{ color: '#888', fontSize: '0.75rem' }}>Class:</span>
                      <ClassBadge score={score} />
                    </div>
                  )}
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
          );
        })}
      </div>

      {/* Calculation Status */}
      {scoredHorses.length > 0 && (
        <CalculationStatus
          calculationState={calculationState}
          horsesAnalyzed={horses.length}
          activeHorses={activeHorses}
          confidenceLevel={confidenceLevel}
        />
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
  );
}
