import React, { useCallback, useState, useRef, useEffect } from 'react';
import './HorseSummaryBar.css';
import type { HorseEntry } from '../types/drf';
import type { TrendScore } from '../lib/scoring/trendAnalysis';
import type { BlendedRankResult } from '../lib/scoring/blendedRank';
import { normalizeOddsFormat } from '../lib/utils/oddsStepper';

/**
 * Plain-English value label based on edge percentage
 * Uses clear, human-readable labels instead of racing jargon:
 * - +50% or higher: "BETTER THAN ODDS SUGGEST" (Green #10b981)
 * - +20% to +49%: "GETTING EXTRA VALUE" (Teal #19abb5)
 * - -19% to +19%: "FAIR VALUE HORSE" (Grey #6E6E70)
 * - -20% to -49%: "OVERBET BY PUBLIC" (Yellow #f59e0b)
 * - -50% or worse AND is favorite: "FALSE FAVORITE" (Red #ef4444)
 * - -50% or worse AND not favorite: "OVERBET BY PUBLIC" (Red #ef4444)
 */
interface ValueLabelInfo {
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Get plain-English value label based on edge percentage and favorite status
 */
const getValueLabel = (
  edgePercent: number,
  isFavorite: boolean,
  isScratched: boolean
): ValueLabelInfo => {
  if (isScratched) {
    return {
      label: '',
      color: '#6E6E70',
      bgColor: 'transparent',
    };
  }

  if (edgePercent >= 50) {
    return {
      label: 'BETTER THAN ODDS SUGGEST',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.15)',
    };
  }

  if (edgePercent >= 20) {
    return {
      label: 'GETTING EXTRA VALUE',
      color: '#19abb5',
      bgColor: 'rgba(25, 171, 181, 0.15)',
    };
  }

  if (edgePercent >= -19) {
    return {
      label: 'FAIR VALUE HORSE',
      color: '#6E6E70',
      bgColor: 'rgba(110, 110, 112, 0.15)',
    };
  }

  if (edgePercent >= -49) {
    return {
      label: 'OVERBET BY PUBLIC',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.15)',
    };
  }

  // Edge is -50% or worse
  if (isFavorite) {
    return {
      label: 'FALSE FAVORITE',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
    };
  }

  return {
    label: 'OVERBET BY PUBLIC',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  };
};

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
  /** Whether this horse is the favorite (lowest odds in the field) */
  isFavorite?: boolean;
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
  isFavorite = false,
}) => {
  // Extract horse data from HorseEntry type
  const programNumber = horse.programNumber;
  const horseName = horse.horseName || 'UNKNOWN';

  // Get tier class for left border styling
  const tierClass = getTierClass(valuePercent, isScratched);

  // Use edgePercent for display if provided, otherwise fall back to valuePercent
  const displayEdge = edgePercent !== undefined ? edgePercent : valuePercent;

  // Get plain-English value label based on edge percentage and favorite status
  const valueLabelInfo = getValueLabel(displayEdge, isFavorite, isScratched);

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

      {/* Column 4: VALUE LABEL - Plain-English value description */}
      <div className="horse-summary-bar__value-label-wrapper">
        {valueLabelInfo.label && (
          <span
            className="horse-summary-bar__value-label-badge"
            style={{
              backgroundColor: valueLabelInfo.bgColor,
              color: valueLabelInfo.color,
              borderColor: valueLabelInfo.color,
            }}
          >
            {valueLabelInfo.label}
          </span>
        )}
      </div>

      {/* Column 5: PROJECTED FINISH - Model Ranking (#1, #2, etc. based on base score) */}
      <div className="horse-summary-bar__rank">
        <span
          className={`horse-summary-bar__rank-value ${!isScratched && baseScoreRank && baseScoreRank <= 3 ? 'horse-summary-bar__rank-value--top' : ''}`}
          style={{ color: isScratched ? undefined : getRankColor(baseScoreRank) }}
        >
          {isScratched ? '—' : baseScoreRank ? `#${baseScoreRank}` : '—'}
        </span>
      </div>

      {/* Column 6: ODDS - Click to edit */}
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

      {/* Column 8: EDGE - Value gap percentage */}
      <div className="horse-summary-bar__edge">
        <span
          className={`horse-summary-bar__edge-value ${displayEdge >= 75 ? 'horse-summary-bar__edge-value--hot' : ''}`}
          style={{ color: isScratched ? undefined : getEdgeColor(displayEdge) }}
        >
          {isScratched ? '—' : formatEdgeDisplay(displayEdge)}
        </span>
      </div>

      {/* Column 9: Expand Chevron */}
      <div className="horse-summary-bar__expand-wrapper">
        <span className="material-icons horse-summary-bar__expand">expand_more</span>
      </div>
    </div>
  );
};

export default HorseSummaryBar;
