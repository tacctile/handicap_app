/**
 * RaceTableSimple - Progressive Disclosure Race Table
 *
 * Clean, simple interface that reveals complexity as users drill down:
 * - Level 0 (Row): Scratch/Compare | PP | Name | Odds | Rank | Tier | Expand
 * - Level 1 (First Expand): Why this horse + Value assessment
 * - Level 2 (Full Breakdown): Tabbed detailed analysis
 */

import { useState, useCallback, useMemo, memo } from 'react';
import './RaceTableSimple.css';
import type { ParsedRace, HorseEntry } from '../types/drf';
import type { UseRaceStateReturn } from '../hooks/useRaceState';
import {
  calculateRaceScores,
  analyzeOverlay,
  formatOverlayPercent,
  type HorseScore,
  type OverlayAnalysis,
  SCORE_LIMITS,
} from '../lib/scoring';
import {
  getTierInfo,
  getRankColor,
  sortHorses,
  getNextSortDirection,
  type SortConfig,
  type SortField,
  type TierInfo,
} from '../lib/scoring/tierUtils';
import {
  incrementOdds,
  decrementOdds,
  canIncrementOdds,
  canDecrementOdds,
} from '../lib/utils/oddsStepper';

// ============================================================================
// TYPES
// ============================================================================

interface RaceTableSimpleProps {
  race: ParsedRace;
  raceState: UseRaceStateReturn;
}

interface ScoredHorseData {
  horse: HorseEntry;
  index: number;
  score: HorseScore;
  rank: number;
  overlay: OverlayAnalysis;
  tier: TierInfo;
  rankColor: { color: string; bgColor: string };
}

type ExpandLevel = 0 | 1 | 2;

// ============================================================================
// ICON COMPONENT
// ============================================================================

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

// ============================================================================
// EDITABLE ODDS COMPONENT
// ============================================================================

interface EditableOddsProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const EditableOdds = memo(function EditableOdds({ value, onChange, disabled }: EditableOddsProps) {
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
      <input
        type="text"
        className="simple-odds-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    );
  }

  return (
    <div className="simple-odds-display" onClick={handleClick}>
      <button
        className="odds-btn"
        onClick={handleDecrement}
        disabled={disabled || !canDecrementOdds(value)}
        title="Decrease odds"
      >
        −
      </button>
      <span className="odds-value">{value}</span>
      <button
        className="odds-btn"
        onClick={handleIncrement}
        disabled={disabled || !canIncrementOdds(value)}
        title="Increase odds"
      >
        +
      </button>
    </div>
  );
});

// ============================================================================
// LEVEL 1 EXPAND - WHY THIS HORSE
// ============================================================================

interface WhyThisHorseProps {
  data: ScoredHorseData;
  onExpandMore: () => void;
}

function WhyThisHorse({ data, onExpandMore }: WhyThisHorseProps) {
  const { score, overlay, tier } = data;
  const breakdown = score.breakdown;

  // Determine key strengths and weaknesses
  const factors: Array<{ icon: string; text: string; type: 'strength' | 'weakness' | 'neutral' }> =
    [];

  // Speed/Class analysis
  const speedPct = breakdown.speedClass.total / SCORE_LIMITS.speedClass;
  if (speedPct >= 0.7) {
    factors.push({
      icon: 'speed',
      text: `Strong speed figures (${breakdown.speedClass.total}/${SCORE_LIMITS.speedClass})`,
      type: 'strength',
    });
  } else if (speedPct <= 0.4) {
    factors.push({ icon: 'speed', text: `Below-par speed figures`, type: 'weakness' });
  }

  // Class movement
  if (breakdown.speedClass.classMovement === 'drop') {
    factors.push({ icon: 'trending_down', text: 'Dropping in class', type: 'strength' });
  } else if (breakdown.speedClass.classMovement === 'rise') {
    factors.push({ icon: 'trending_up', text: 'Rising in class - testing', type: 'weakness' });
  }

  // Form
  const formPct = breakdown.form.total / SCORE_LIMITS.form;
  if (formPct >= 0.7) {
    factors.push({
      icon: 'whatshot',
      text: `Good recent form (${breakdown.form.formTrend})`,
      type: 'strength',
    });
  } else if (formPct <= 0.35) {
    factors.push({ icon: 'ac_unit', text: 'Poor recent form', type: 'weakness' });
  }

  // Pace fit
  const pacePct = breakdown.pace.total / SCORE_LIMITS.pace;
  if (pacePct >= 0.7) {
    factors.push({
      icon: 'directions_run',
      text: `Good pace fit (${breakdown.pace.runningStyle})`,
      type: 'strength',
    });
  }

  // Value assessment
  const valueColor =
    overlay.overlayPercent >= 25 ? '#22c55e' : overlay.overlayPercent >= 0 ? '#eab308' : '#ef4444';

  return (
    <div className="why-this-horse">
      <div className="why-header">
        <h4>Why {tier.level === 'top-pick' ? 'This Pick?' : `#${data.rank}?`}</h4>
      </div>

      <div className="why-factors">
        {factors.length > 0 ? (
          factors.map((factor, i) => (
            <div key={i} className={`factor factor-${factor.type}`}>
              <Icon name={factor.icon} className="factor-icon" />
              <span>{factor.text}</span>
            </div>
          ))
        ) : (
          <div className="factor factor-neutral">
            <Icon name="info" className="factor-icon" />
            <span>Average profile across categories</span>
          </div>
        )}
      </div>

      <div className="value-assessment">
        <h5>Value Assessment</h5>
        <div className="value-row">
          <span className="value-label">Fair Odds:</span>
          <span className="value-data">{overlay.fairOddsDisplay}</span>
        </div>
        <div className="value-row">
          <span className="value-label">Current:</span>
          <span className="value-data">{overlay.actualOddsDecimal.toFixed(1)}</span>
        </div>
        <div className="value-row">
          <span className="value-label">Edge:</span>
          <span className="value-data" style={{ color: valueColor }}>
            {formatOverlayPercent(overlay.overlayPercent)}
            {overlay.overlayPercent >= 10 && ' OVERLAY'}
            {overlay.overlayPercent <= -10 && ' UNDERLAY'}
          </span>
        </div>
      </div>

      <button className="expand-more-btn" onClick={onExpandMore}>
        <Icon name="analytics" />
        See Full Breakdown
      </button>
    </div>
  );
}

// ============================================================================
// LEVEL 2 EXPAND - TABBED BREAKDOWN
// ============================================================================

interface FullBreakdownProps {
  data: ScoredHorseData;
}

type BreakdownTab = 'speed' | 'pace' | 'form' | 'connections' | 'value';

function FullBreakdown({ data }: FullBreakdownProps) {
  const [activeTab, setActiveTab] = useState<BreakdownTab>('speed');
  const { score, overlay } = data;
  const breakdown = score.breakdown;

  const tabs: Array<{ id: BreakdownTab; label: string; icon: string }> = [
    { id: 'speed', label: 'Speed', icon: 'speed' },
    { id: 'pace', label: 'Pace', icon: 'directions_run' },
    { id: 'form', label: 'Form', icon: 'trending_up' },
    { id: 'connections', label: 'Connections', icon: 'people' },
    { id: 'value', label: 'Value', icon: 'attach_money' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'speed':
        return (
          <div className="tab-content">
            <div className="stat-row">
              <span className="stat-label">Speed/Class Score</span>
              <span className="stat-value">
                {breakdown.speedClass.total}/{SCORE_LIMITS.speedClass}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Best Figure</span>
              <span className="stat-value">{breakdown.speedClass.bestFigure ?? 'N/A'}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Class Movement</span>
              <span className="stat-value">{breakdown.speedClass.classMovement}</span>
            </div>
            <div className="stat-detail">{breakdown.speedClass.reasoning}</div>
          </div>
        );

      case 'pace':
        return (
          <div className="tab-content">
            <div className="stat-row">
              <span className="stat-label">Pace Score</span>
              <span className="stat-value">
                {breakdown.pace.total}/{SCORE_LIMITS.pace}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Running Style</span>
              <span className="stat-value">{breakdown.pace.runningStyle}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Pace Fit</span>
              <span className="stat-value">{breakdown.pace.paceFit}</span>
            </div>
            <div className="stat-detail">{breakdown.pace.reasoning}</div>
          </div>
        );

      case 'form':
        return (
          <div className="tab-content">
            <div className="stat-row">
              <span className="stat-label">Form Score</span>
              <span className="stat-value">
                {breakdown.form.total}/{SCORE_LIMITS.form}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Form Trend</span>
              <span className="stat-value">{breakdown.form.formTrend}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Recent Form</span>
              <span className="stat-value">{breakdown.form.recentFormScore}</span>
            </div>
            <div className="stat-detail">{breakdown.form.reasoning}</div>
          </div>
        );

      case 'connections':
        return (
          <div className="tab-content">
            <div className="stat-row">
              <span className="stat-label">Connections Score</span>
              <span className="stat-value">
                {breakdown.connections.total}/{SCORE_LIMITS.connections}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Trainer</span>
              <span className="stat-value">{breakdown.connections.trainer}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Jockey</span>
              <span className="stat-value">{breakdown.connections.jockey}</span>
            </div>
            <div className="stat-detail">{breakdown.connections.reasoning}</div>
          </div>
        );

      case 'value':
        return (
          <div className="tab-content">
            <div className="stat-row">
              <span className="stat-label">Win Probability</span>
              <span className="stat-value">{overlay.winProbability.toFixed(1)}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Fair Odds</span>
              <span className="stat-value">{overlay.fairOddsDisplay}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Edge</span>
              <span
                className="stat-value"
                style={{ color: overlay.overlayPercent >= 0 ? '#22c55e' : '#ef4444' }}
              >
                {formatOverlayPercent(overlay.overlayPercent)}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">EV per $1</span>
              <span className="stat-value">${overlay.evPerDollar.toFixed(2)}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="full-breakdown">
      <div className="breakdown-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`breakdown-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {renderTabContent()}
    </div>
  );
}

// ============================================================================
// HORSE ROW COMPONENT
// ============================================================================

interface HorseRowProps {
  data: ScoredHorseData;
  isScratched: boolean;
  compareChecked: boolean;
  onScratchToggle: () => void;
  onCompareToggle: () => void;
  onOddsChange: (odds: string) => void;
  currentOdds: string;
}

const HorseRow = memo(function HorseRow({
  data,
  isScratched,
  compareChecked,
  onScratchToggle,
  onCompareToggle,
  onOddsChange,
  currentOdds,
}: HorseRowProps) {
  const [expandLevel, setExpandLevel] = useState<ExpandLevel>(0);
  const { horse, rank, tier, rankColor } = data;

  const handleRowClick = useCallback(() => {
    if (!isScratched) {
      setExpandLevel((prev) => (prev === 0 ? 1 : prev === 1 ? 0 : prev));
    }
  }, [isScratched]);

  const handleExpandMore = useCallback(() => {
    setExpandLevel(2);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpandLevel(0);
  }, []);

  return (
    <div
      className={`simple-horse-row ${isScratched ? 'scratched' : ''} ${expandLevel > 0 ? 'expanded' : ''}`}
    >
      {/* Main Row */}
      <div className="row-main" onClick={handleRowClick}>
        {/* Scratch & Compare Checkboxes */}
        <div className="row-checkboxes">
          <label className="checkbox-wrapper" title="Scratch" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={isScratched} onChange={onScratchToggle} />
            <Icon name="cancel" className="checkbox-icon scratch-icon" />
          </label>
          <label className="checkbox-wrapper" title="Compare" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={compareChecked}
              onChange={onCompareToggle}
              disabled={isScratched}
            />
            <Icon name="compare_arrows" className="checkbox-icon compare-icon" />
          </label>
        </div>

        {/* Post Position */}
        <div className="row-pp">
          <span className="pp-badge">#{horse.postPosition}</span>
        </div>

        {/* Horse Name */}
        <div className="row-name">
          <span className="horse-name">{horse.horseName}</span>
        </div>

        {/* Odds */}
        <div className="row-odds" onClick={(e) => e.stopPropagation()}>
          <EditableOdds value={currentOdds} onChange={onOddsChange} disabled={isScratched} />
        </div>

        {/* Rank */}
        <div className="row-rank">
          {!isScratched && (
            <span
              className="rank-badge"
              style={{ backgroundColor: rankColor.bgColor, color: rankColor.color }}
            >
              #{rank}
            </span>
          )}
        </div>

        {/* Tier */}
        <div className="row-tier">
          {!isScratched && (
            <span
              className="tier-badge"
              style={{ backgroundColor: tier.bgColor, color: tier.color }}
            >
              {tier.shortLabel}
            </span>
          )}
          {isScratched && <span className="tier-badge scratched-badge">SCRATCHED</span>}
        </div>

        {/* Expand Icon */}
        <div className="row-expand">
          <Icon name={expandLevel > 0 ? 'expand_less' : 'expand_more'} className="expand-icon" />
        </div>
      </div>

      {/* Level 1 Expand - Why This Horse */}
      {expandLevel >= 1 && (
        <div className="expand-content level-1">
          <WhyThisHorse data={data} onExpandMore={handleExpandMore} />
        </div>
      )}

      {/* Level 2 Expand - Full Breakdown */}
      {expandLevel === 2 && (
        <div className="expand-content level-2">
          <FullBreakdown data={data} />
          <button className="collapse-btn" onClick={handleCollapse}>
            <Icon name="keyboard_arrow_up" />
            Collapse
          </button>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RaceTableSimple({ race, raceState }: RaceTableSimpleProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'pp', direction: 'asc' });
  const [compareSet, setCompareSet] = useState<Set<number>>(new Set());

  const { trackCondition, updateOdds, toggleScratch, isScratched, getOdds } = raceState;

  // Calculate scores and prepare data
  const scoredHorses = useMemo(() => {
    const scored = calculateRaceScores(
      race.horses,
      race.header,
      (idx, orig) => getOdds(idx, orig),
      (idx) => isScratched(idx),
      trackCondition
    );

    // Get active horse count for tier calculation
    const activeCount = scored.filter((h) => !h.score.isScratched).length;

    // Add overlay, tier, and color info
    return scored.map((item) => {
      const currentOdds = getOdds(item.index, item.horse.morningLineOdds);
      const overlay = analyzeOverlay(item.score.total, currentOdds);
      const tier = getTierInfo(item.rank, activeCount, overlay.overlayPercent);
      const rankColor = getRankColor(item.rank, activeCount);

      return {
        ...item,
        overlay,
        tier,
        rankColor,
      } as ScoredHorseData;
    });
  }, [race.horses, race.header, getOdds, isScratched, trackCondition]);

  // Sort horses
  const sortedHorses = useMemo(() => {
    return sortHorses(scoredHorses, sortConfig);
  }, [scoredHorses, sortConfig]);

  // Handle sort column click
  const handleSortClick = useCallback((field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction: getNextSortDirection(prev.field, prev.direction, field),
    }));
  }, []);

  // Handle compare toggle
  const handleCompareToggle = useCallback((index: number) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < 2) {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div className="race-table-simple">
      {/* Header */}
      <div className="simple-table-header">
        <div className="header-checkboxes">
          <Icon name="cancel" className="header-icon" />
        </div>
        <div
          className={`header-pp sortable ${sortConfig.field === 'pp' ? 'active' : ''}`}
          onClick={() => handleSortClick('pp')}
        >
          PP
          <Icon
            name={
              sortConfig.field === 'pp' && sortConfig.direction === 'desc'
                ? 'arrow_drop_down'
                : 'arrow_drop_up'
            }
            className="sort-icon"
          />
        </div>
        <div className="header-name">Horse</div>
        <div className="header-odds">Odds</div>
        <div
          className={`header-rank sortable ${sortConfig.field === 'rank' ? 'active' : ''}`}
          onClick={() => handleSortClick('rank')}
        >
          Rank
          <Icon
            name={
              sortConfig.field === 'rank' && sortConfig.direction === 'desc'
                ? 'arrow_drop_down'
                : 'arrow_drop_up'
            }
            className="sort-icon"
          />
        </div>
        <div className="header-tier">Tier</div>
        <div className="header-expand"></div>
      </div>

      {/* Horse Rows */}
      <div className="simple-table-body">
        {sortedHorses.map((data) => (
          <HorseRow
            key={data.index}
            data={data}
            isScratched={data.score.isScratched}
            compareChecked={compareSet.has(data.index)}
            onScratchToggle={() => toggleScratch(data.index)}
            onCompareToggle={() => handleCompareToggle(data.index)}
            onOddsChange={(odds) => updateOdds(data.index, odds)}
            currentOdds={getOdds(data.index, data.horse.morningLineOdds)}
          />
        ))}
      </div>

      {/* Compare Panel (when 2 horses selected) */}
      {compareSet.size === 2 && (
        <ComparePanel
          horses={sortedHorses.filter((h) => compareSet.has(h.index))}
          onClose={() => setCompareSet(new Set())}
        />
      )}
    </div>
  );
}

// ============================================================================
// COMPARE PANEL
// ============================================================================

interface ComparePanelProps {
  horses: ScoredHorseData[];
  onClose: () => void;
}

function ComparePanel({ horses, onClose }: ComparePanelProps) {
  if (horses.length !== 2) return null;

  const [horse1, horse2] = horses;
  if (!horse1 || !horse2) return null;

  const compareRow = (
    label: string,
    val1: string | number,
    val2: string | number,
    higherBetter = true
  ) => {
    const num1 = typeof val1 === 'number' ? val1 : parseFloat(val1) || 0;
    const num2 = typeof val2 === 'number' ? val2 : parseFloat(val2) || 0;
    const winner1 = higherBetter ? num1 > num2 : num1 < num2;
    const winner2 = higherBetter ? num2 > num1 : num2 < num1;

    return (
      <div className="compare-row">
        <span className={`compare-val ${winner1 ? 'winner' : ''}`}>{val1}</span>
        <span className="compare-label">{label}</span>
        <span className={`compare-val ${winner2 ? 'winner' : ''}`}>{val2}</span>
      </div>
    );
  };

  return (
    <div className="compare-panel">
      <div className="compare-header">
        <h3>Compare Horses</h3>
        <button onClick={onClose} className="compare-close">
          <Icon name="close" />
        </button>
      </div>
      <div className="compare-body">
        <div className="compare-horses">
          <span className="compare-horse-name">{horse1.horse.horseName}</span>
          <span className="compare-vs">vs</span>
          <span className="compare-horse-name">{horse2.horse.horseName}</span>
        </div>
        {compareRow('Rank', `#${horse1.rank}`, `#${horse2.rank}`, false)}
        {compareRow(
          'Speed/Class',
          horse1.score.breakdown.speedClass.total,
          horse2.score.breakdown.speedClass.total
        )}
        {compareRow('Pace', horse1.score.breakdown.pace.total, horse2.score.breakdown.pace.total)}
        {compareRow('Form', horse1.score.breakdown.form.total, horse2.score.breakdown.form.total)}
        {compareRow(
          'Edge %',
          `${horse1.overlay.overlayPercent.toFixed(0)}%`,
          `${horse2.overlay.overlayPercent.toFixed(0)}%`
        )}
      </div>
    </div>
  );
}

export default RaceTableSimple;
