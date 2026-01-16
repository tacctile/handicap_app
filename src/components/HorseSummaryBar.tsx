import React, { useCallback, useState, useRef, useEffect } from 'react';
import './HorseSummaryBar.css';
import type { HorseEntry } from '../types/drf';
import type { TrendScore } from '../lib/scoring/trendAnalysis';
import type { BlendedRankResult } from '../lib/scoring/blendedRank';
import { normalizeOddsFormat } from '../lib/utils/oddsStepper';
import {
  getValueTag,
  getScratchedValueTag,
  type ValueTagResult,
} from '../lib/value/valueTagMatrix';

/**
 * NOTE: The old getValueLabel function and ValueLabelInfo interface have been removed.
 * The new 15-tag value matrix system (valueTagMatrix.ts) provides:
 * - Combined rank + edge analysis (15 distinct tags)
 * - Two-line stacked labels (plain English + handicapper term)
 * - Unified color gradient across PROJECTED FINISH, VALUE badge, and EDGE columns
 */

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
  /** Total number of active (non-scratched) horses in the field */
  fieldSize?: number;
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
  // Field size for value calculations
  fieldSize = 10, // Default to 10 if not provided
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
  isFavorite: _isFavorite = false, // Kept for compatibility but now using value matrix
}) => {
  // Extract horse data from HorseEntry type
  const programNumber = horse.programNumber;
  const horseName = horse.horseName || 'UNKNOWN';

  // Get tier class for left border styling
  const tierClass = getTierClass(valuePercent, isScratched);

  // Use edgePercent for display if provided, otherwise fall back to valuePercent
  const displayEdge = edgePercent !== undefined ? edgePercent : valuePercent;

  // Get 15-tag value result based on rank, field size, and edge percentage
  // Uses new value matrix system combining projected finish rank with edge
  const valueTagResult: ValueTagResult = isScratched
    ? getScratchedValueTag()
    : getValueTag(baseScoreRank ?? 10, fieldSize, displayEdge);

  // Unified color for PROJECTED FINISH, VALUE badge, and EDGE columns
  const unifiedColor = valueTagResult.color;

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

      {/* Column 4: ODDS - Click to edit (left side - price data) */}
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

      {/* Column 5: FAIR - Calculated fair odds (left side - price data) */}
      <div className="horse-summary-bar__fair-odds">
        <span className="horse-summary-bar__fair-odds-value">
          {isScratched ? '—' : fairOddsDisplay}
        </span>
      </div>

      {/* Column 6: PROJECTED FINISH - Model Ranking (#1, #2, etc. based on base score) - right side */}
      {/* Uses unified color from value matrix */}
      <div className="horse-summary-bar__rank">
        <span
          className={`horse-summary-bar__rank-value ${!isScratched && baseScoreRank && baseScoreRank <= 3 ? 'horse-summary-bar__rank-value--top' : ''}`}
          style={{ color: isScratched ? undefined : unifiedColor }}
        >
          {isScratched ? '—' : baseScoreRank ? `#${baseScoreRank}` : '—'}
        </span>
      </div>

      {/* Column 7: VALUE BADGE - Two-line stacked label (right side - fixed 180px width, 48px height) */}
      {/* Uses 15-tag value matrix with unified color */}
      <div className="horse-summary-bar__value-label-wrapper">
        {valueTagResult.tag.plainLabel && (
          <div
            className="value-badge"
            style={{
              backgroundColor: unifiedColor,
              color: valueTagResult.textColor,
            }}
          >
            <span className="value-badge__plain">{valueTagResult.tag.plainLabel}</span>
            <div className="value-badge__divider"></div>
            <span className="value-badge__tech">{valueTagResult.tag.techLabel}</span>
          </div>
        )}
      </div>

      {/* Column 8: EDGE - Value gap percentage (right side - far right, no chevron after) */}
      {/* Uses unified color from value matrix */}
      <div className="horse-summary-bar__edge">
        <span
          className={`horse-summary-bar__edge-value ${displayEdge >= 75 ? 'horse-summary-bar__edge-value--hot' : ''}`}
          style={{ color: isScratched ? undefined : unifiedColor }}
        >
          {isScratched ? '—' : formatEdgeDisplay(displayEdge)}
        </span>
      </div>
    </div>
  );
};

export default HorseSummaryBar;
