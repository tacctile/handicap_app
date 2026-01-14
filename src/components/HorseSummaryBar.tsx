import React, { useCallback, useState, useRef, useEffect } from 'react';
import './HorseSummaryBar.css';
import type { HorseEntry } from '../types/drf';
import type { TrendScore } from '../lib/scoring/trendAnalysis';
import type { BlendedRankResult } from '../lib/scoring/blendedRank';
import { normalizeOddsFormat } from '../lib/utils/oddsStepper';

/**
 * Get VALUE badge based on edge percentage
 * Enhanced to show edge percentage with color coding:
 * - +75% or higher: Bright green, bold
 * - +50% to +74%: Green
 * - +25% to +49%: Yellow-green
 * - -25% to +24%: Gray (fair)
 * - -25% or lower: Red (underlay)
 */
interface ValueBadgeInfo {
  label: string;
  className: string;
  color: string;
  showEdge: boolean;
}

/**
 * Get edge color based on percentage
 */
const getEdgeColor = (edgePercent: number): string => {
  if (edgePercent >= 75) return '#10b981'; // Bright green
  if (edgePercent >= 50) return '#22c55e'; // Green
  if (edgePercent >= 25) return '#84cc16'; // Yellow-green
  if (edgePercent >= -25) return '#6B7280'; // Gray (fair)
  return '#ef4444'; // Red (underlay)
};

/**
 * Get rank display color based on position
 * Top 3 are green, 4th is yellow, 5th+ is gray
 */
const getRankColor = (rank: number | undefined): string => {
  if (!rank) return '#6B7280';
  if (rank === 1) return '#10b981'; // Bright green, top pick
  if (rank <= 3) return '#22c55e'; // Green, contender
  if (rank === 4) return '#eab308'; // Yellow, playable
  return '#6B7280'; // Gray, longshot
};

/**
 * Format edge percentage for the EDGE column display
 * Shows ±X% for neutral, +X% for positive, -X% for negative
 */
const formatEdgeDisplay = (edgePercent: number): string => {
  const rounded = Math.round(edgePercent);
  if (rounded >= -5 && rounded <= 5) return '±5%';
  if (rounded >= 0) return `+${rounded}%`;
  return `${rounded}%`;
};

const getValueBadge = (valuePercent: number, isScratched: boolean): ValueBadgeInfo => {
  if (isScratched) {
    return {
      label: 'SCRATCHED',
      className: 'scratched',
      color: '#6E6E70',
      showEdge: false,
    };
  }

  if (valuePercent > 20) {
    return {
      label: 'Overlay',
      className: 'overlay',
      color: '#10b981', // Green
      showEdge: true,
    };
  }

  if (valuePercent >= -20) {
    return {
      label: 'Fair',
      className: 'fair',
      color: '#6E6E70', // Gray
      showEdge: false, // Don't show edge for fair (close to 0)
    };
  }

  return {
    label: 'Underlay',
    className: 'underlay',
    color: '#ef4444', // Red
    showEdge: true,
  };
};

/**
 * Get tier info for left border color (kept for visual indicator)
 */
const getTierClass = (valuePercent: number, isScratched: boolean): string => {
  if (isScratched) return 'scratched';
  if (valuePercent > 20) return 'overlay';
  if (valuePercent >= -20) return 'fair';
  return 'underlay';
};

interface HorseSummaryBarProps {
  horse: HorseEntry;
  rank: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  maxScore: number;
  score: number;
  fairOddsNum?: number;
  fairOddsDen?: number;
  fairOddsDisplay?: string;
  valuePercent?: number;
  // Props for interactive controls
  isScratched: boolean;
  onScratchToggle: (scratched: boolean) => void;
  currentOdds: { numerator: number; denominator: number };
  onOddsChange: (odds: { numerator: number; denominator: number }) => void;
  // Props for base score rank (projected finish order)
  baseScoreRank?: number;
  baseScoreRankOrdinal?: string;
  baseScoreRankColor?: string;
  // Props for trend rank
  trendRank?: number;
  trendRankOrdinal?: string;
  trendRankColor?: string;
  trendScore?: TrendScore;
  onTrendClick?: () => void;
  // Props for blended rank
  blendedRank?: number;
  blendedRankOrdinal?: string;
  blendedRankColor?: string;
  blendedResult?: BlendedRankResult;
  // Props for value play highlighting
  isValuePlay?: boolean;
  isPrimaryValuePlay?: boolean;
  edgePercent?: number;
  /** HTML id for scroll targeting */
  rowId?: string;
}

// Helper to convert odds object to string
const oddsToString = (odds: { numerator: number; denominator: number }): string => {
  return `${odds.numerator}-${odds.denominator}`;
};

// Helper to parse odds string to object - accepts flexible formats
const parseOddsString = (oddsStr: string): { numerator: number; denominator: number } | null => {
  // Normalize the format first (handles "/", ":", spaces)
  const normalized = normalizeOddsFormat(oddsStr.trim());
  const match = normalized.match(/^(\d+)-(\d+)$/);
  if (match && match[1] && match[2]) {
    return { numerator: parseInt(match[1], 10), denominator: parseInt(match[2], 10) };
  }
  return null; // Return null for invalid input
};

export const HorseSummaryBar: React.FC<HorseSummaryBarProps> = ({
  horse,
  rank: _rank, // Legacy rank based on total score, kept for compatibility
  isExpanded,
  onToggleExpand,
  maxScore: _maxScore, // Used in expanded view
  score: _score, // Used in expanded view
  fairOddsNum: _fairOddsNum, // Used in expanded view
  fairOddsDen: _fairOddsDen, // Used in expanded view
  fairOddsDisplay = '—',
  valuePercent = 0,
  isScratched,
  onScratchToggle,
  currentOdds,
  onOddsChange,
  // Base score rank (projected finish order)
  baseScoreRank,
  baseScoreRankOrdinal: _baseScoreRankOrdinal, // Kept for compatibility but not used
  baseScoreRankColor: _baseScoreRankColor, // Kept for compatibility but not used
  // Trend rank (form trajectory) - kept for compatibility but not displayed
  trendRank: _trendRank,
  trendRankOrdinal: _trendRankOrdinal,
  trendRankColor: _trendRankColor,
  trendScore: _trendScore,
  onTrendClick: _onTrendClick,
  // Blended rank (combined base + trend) - kept for compatibility but not displayed
  blendedRank: _blendedRank,
  blendedRankOrdinal: _blendedRankOrdinal,
  blendedRankColor: _blendedRankColor,
  blendedResult: _blendedResult,
  // Value play props
  isValuePlay = false,
  isPrimaryValuePlay = false,
  edgePercent,
  rowId,
}) => {
  // Extract horse data from HorseEntry type
  const programNumber = horse.programNumber;
  const horseName = horse.horseName || 'UNKNOWN';

  // Get tier class for left border styling
  const tierClass = getTierClass(valuePercent, isScratched);

  // Get VALUE badge info (Overlay/Fair/Underlay)
  const valueBadge = getValueBadge(valuePercent, isScratched);

  const handleRowClick = () => {
    if (!isScratched) {
      onToggleExpand();
    }
  };

  // Click-to-edit odds state
  const [isEditingOdds, setIsEditingOdds] = useState(false);
  const [oddsInputValue, setOddsInputValue] = useState('');
  const oddsInputRef = useRef<HTMLInputElement>(null);
  const currentOddsStr = oddsToString(currentOdds);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingOdds && oddsInputRef.current) {
      oddsInputRef.current.focus();
      oddsInputRef.current.select();
    }
  }, [isEditingOdds]);

  const handleOddsClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isScratched) {
        setOddsInputValue(currentOddsStr);
        setIsEditingOdds(true);
      }
    },
    [isScratched, currentOddsStr]
  );

  const handleOddsInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOddsInputValue(e.target.value);
  }, []);

  const handleOddsSubmit = useCallback(() => {
    const parsed = parseOddsString(oddsInputValue);
    if (parsed) {
      onOddsChange(parsed);
    }
    setIsEditingOdds(false);
  }, [oddsInputValue, onOddsChange]);

  const handleOddsKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleOddsSubmit();
      } else if (e.key === 'Escape') {
        setIsEditingOdds(false);
      }
    },
    [handleOddsSubmit]
  );

  const handleOddsBlur = useCallback(() => {
    handleOddsSubmit();
  }, [handleOddsSubmit]);

  // Use edgePercent for display if provided, otherwise fall back to valuePercent
  const displayEdge = edgePercent !== undefined ? edgePercent : valuePercent;

  return (
    <div
      id={rowId}
      className={`horse-summary-bar
        horse-summary-bar--tier-${tierClass}
        ${isExpanded ? 'horse-summary-bar--expanded' : ''}
        ${isScratched ? 'horse-summary-bar--scratched' : ''}
        ${isValuePlay ? 'horse-summary-bar--value-play' : ''}
        ${isPrimaryValuePlay ? 'horse-summary-bar--primary-value-play' : ''}`}
      onClick={handleRowClick}
    >
      {/* Column 1: Scratch button - larger touch target */}
      <div className="horse-summary-bar__scratch-col" onClick={(e) => e.stopPropagation()}>
        <button
          className={`horse-summary-bar__scratch-btn ${isScratched ? 'horse-summary-bar__scratch-btn--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onScratchToggle(!isScratched);
          }}
          title={isScratched ? 'Unscratch horse' : 'Scratch horse from race'}
          aria-label={isScratched ? 'Unscratch horse' : 'Scratch horse from race'}
        >
          <span className="material-icons horse-summary-bar__scratch-icon">
            {isScratched ? 'undo' : 'block'}
          </span>
          <span className="horse-summary-bar__scratch-label">{isScratched ? 'UNDO' : 'SCR'}</span>
        </button>
      </div>

      {/* Column 2: POST (Program Position) */}
      <div className="horse-summary-bar__pp">#{programNumber}</div>

      {/* Column 3: HORSE Name - FULL WIDTH, NO TRUNCATION */}
      <div className="horse-summary-bar__name">{horseName.toUpperCase()}</div>

      {/* Column 4: RANK - Model Ranking (#1, #2, etc. based on base score) */}
      <div className="horse-summary-bar__rank">
        <span
          className={`horse-summary-bar__rank-value ${!isScratched && baseScoreRank && baseScoreRank <= 3 ? 'horse-summary-bar__rank-value--top' : ''}`}
          style={{ color: isScratched ? undefined : getRankColor(baseScoreRank) }}
        >
          {isScratched ? '—' : baseScoreRank ? `#${baseScoreRank}` : '—'}
        </span>
      </div>

      {/* Column 7: ODDS - Click to edit */}
      <div className="horse-summary-bar__odds" onClick={(e) => e.stopPropagation()}>
        {isEditingOdds ? (
          <div className="odds-edit-wrapper">
            <input
              ref={oddsInputRef}
              type="text"
              className="odds-edit-input"
              value={oddsInputValue}
              onChange={handleOddsInputChange}
              onKeyDown={handleOddsKeyDown}
              onBlur={handleOddsBlur}
              placeholder="e.g. 7-2"
              aria-label="Enter odds"
            />
          </div>
        ) : (
          <div className="odds-edit-wrapper">
            <button
              type="button"
              className={`odds-edit-value ${isScratched ? 'odds-edit-value--disabled' : ''}`}
              onClick={handleOddsClick}
              disabled={isScratched}
              title="Click to edit odds"
              aria-label={`Current odds ${currentOddsStr}, click to edit`}
            >
              {currentOddsStr}
            </button>
            {!isScratched && <span className="odds-edit-hint">Edit</span>}
          </div>
        )}
      </div>

      {/* Column 6: FAIR - Calculated fair odds */}
      <div className="horse-summary-bar__fair-odds">
        <span className="horse-summary-bar__fair-odds-value">
          {isScratched ? '—' : fairOddsDisplay}
        </span>
      </div>

      {/* Column 7: EDGE - Value gap percentage */}
      <div className="horse-summary-bar__edge">
        <span
          className={`horse-summary-bar__edge-value ${displayEdge >= 75 ? 'horse-summary-bar__edge-value--hot' : ''}`}
          style={{ color: isScratched ? undefined : getEdgeColor(displayEdge) }}
        >
          {isScratched ? '—' : formatEdgeDisplay(displayEdge)}
        </span>
      </div>

      {/* Column 8: VALUE Badge (Overlay/Fair/Underlay) */}
      <div className="horse-summary-bar__value-wrapper">
        <div
          className={`horse-summary-bar__value-badge horse-summary-bar__value-badge--${valueBadge.className} ${isPrimaryValuePlay && !isScratched ? 'horse-summary-bar__value-badge--primary' : ''}`}
          style={{
            backgroundColor: `${valueBadge.color}20`,
            borderColor: valueBadge.color,
            color: valueBadge.color,
          }}
        >
          <span className="horse-summary-bar__value-label">{valueBadge.label}</span>
        </div>
      </div>

      {/* Column 9: Expand Chevron */}
      <div className="horse-summary-bar__expand-wrapper">
        <span className="material-icons horse-summary-bar__expand">expand_more</span>
      </div>
    </div>
  );
};

export default HorseSummaryBar;
