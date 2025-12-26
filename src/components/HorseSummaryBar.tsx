import React, { useCallback, useState, useRef, useEffect } from 'react';
import './HorseSummaryBar.css';
import type { HorseEntry } from '../types/drf';
import { normalizeOddsFormat } from '../lib/utils/oddsStepper';

/**
 * Get VALUE badge based on edge percentage
 * Simplified 3-tier system: Overlay, Fair, Underlay
 * Uses thresholds: >20% = Overlay, -20% to +20% = Fair, <-20% = Underlay
 */
interface ValueBadgeInfo {
  label: string;
  className: string;
  color: string;
}

const getValueBadge = (valuePercent: number, isScratched: boolean): ValueBadgeInfo => {
  if (isScratched) {
    return {
      label: 'SCRATCHED',
      className: 'scratched',
      color: '#6E6E70',
    };
  }

  if (valuePercent > 20) {
    return {
      label: 'Overlay',
      className: 'overlay',
      color: '#10b981', // Green
    };
  }

  if (valuePercent >= -20) {
    return {
      label: 'Fair',
      className: 'fair',
      color: '#6E6E70', // Gray
    };
  }

  return {
    label: 'Underlay',
    className: 'underlay',
    color: '#ef4444', // Red
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
  valuePercent?: number;
  // Props for interactive controls
  isScratched: boolean;
  onScratchToggle: (scratched: boolean) => void;
  currentOdds: { numerator: number; denominator: number };
  onOddsChange: (odds: { numerator: number; denominator: number }) => void;
  // Props for compare functionality
  isCompareSelected: boolean;
  onCompareToggle: (selected: boolean) => void;
  // Props for base score rank (projected finish order)
  baseScoreRank?: number;
  baseScoreRankOrdinal?: string;
  baseScoreRankColor?: string;
  // EXPERIMENTAL: Top Beyer bonus indicators
  isTopBeyer?: boolean;
  topBeyerBonusApplied?: boolean;
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
  valuePercent = 0,
  isScratched,
  onScratchToggle,
  currentOdds,
  onOddsChange,
  isCompareSelected,
  onCompareToggle,
  // Base score rank (projected finish order)
  baseScoreRank: _baseScoreRank, // Available for future use (e.g., sorting indicators)
  baseScoreRankOrdinal,
  baseScoreRankColor,
  // EXPERIMENTAL: Top Beyer bonus indicators
  isTopBeyer = false,
  topBeyerBonusApplied = false,
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

  return (
    <div
      className={`horse-summary-bar
        horse-summary-bar--tier-${tierClass}
        ${isExpanded ? 'horse-summary-bar--expanded' : ''}
        ${isScratched ? 'horse-summary-bar--scratched' : ''}`}
      onClick={handleRowClick}
    >
      {/* Column 1: Scratch and Compare icons stacked */}
      <div className="horse-summary-bar__icons" onClick={(e) => e.stopPropagation()}>
        {/* Scratch row */}
        <div className="horse-summary-bar__icon-row">
          <button
            className={`horse-summary-bar__icon-btn horse-summary-bar__icon-btn--scratch ${isScratched ? 'horse-summary-bar__icon-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onScratchToggle(!isScratched);
            }}
            title="Mark as scratched"
            aria-label="Mark as scratched"
          >
            <span className="material-icons">
              {isScratched ? 'close' : 'remove_circle_outline'}
            </span>
          </button>
          <span className="horse-summary-bar__icon-label">Scratch</span>
        </div>

        {/* Compare row */}
        <div className="horse-summary-bar__icon-row">
          <button
            className={`horse-summary-bar__icon-btn horse-summary-bar__icon-btn--compare ${isCompareSelected ? 'horse-summary-bar__icon-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onCompareToggle(!isCompareSelected);
            }}
            title="Select for comparison"
            aria-label="Select for comparison"
            disabled={isScratched}
          >
            <span className="material-icons">
              {isCompareSelected ? 'check_box' : 'check_box_outline_blank'}
            </span>
          </button>
          <span className="horse-summary-bar__icon-label">Compare</span>
        </div>
      </div>

      {/* Column 2: POST (Program Position) */}
      <div className="horse-summary-bar__pp">#{programNumber}</div>

      {/* Column 3: HORSE Name - FULL WIDTH, NO TRUNCATION */}
      <div className="horse-summary-bar__name">
        {horseName.toUpperCase()}
        {topBeyerBonusApplied && (
          <span className="horse-summary-bar__top-beyer-badge horse-summary-bar__top-beyer-badge--boosted">
            ⚡ TOP BEYER THREAT
          </span>
        )}
        {isTopBeyer && !topBeyerBonusApplied && (
          <span className="horse-summary-bar__top-beyer-badge">
            ⚡ TOP BEYER
          </span>
        )}
      </div>

      {/* Column 4: OUR RANK - Projected Finish Order (based on base score) */}
      <div className="horse-summary-bar__rank">
        <span
          className="horse-summary-bar__rank-value"
          style={{ color: isScratched ? undefined : baseScoreRankColor }}
        >
          {isScratched ? '—' : baseScoreRankOrdinal || '—'}
        </span>
      </div>

      {/* Column 5: ODDS - Click to edit */}
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
            {!isScratched && <span className="horse-summary-bar__icon-label">Click to Edit</span>}
          </div>
        )}
      </div>

      {/* Column 6: VALUE Badge (Overlay/Fair/Underlay) */}
      <div className="horse-summary-bar__value-wrapper">
        <div
          className={`horse-summary-bar__value-badge horse-summary-bar__value-badge--${valueBadge.className}`}
          style={{
            backgroundColor: `${valueBadge.color}20`,
            borderColor: valueBadge.color,
            color: valueBadge.color,
          }}
        >
          {valueBadge.label}
        </div>
      </div>

      {/* Column 7: Expand Chevron */}
      <div className="horse-summary-bar__expand-wrapper">
        <span className="material-icons horse-summary-bar__expand">expand_more</span>
      </div>
    </div>
  );
};

export default HorseSummaryBar;
