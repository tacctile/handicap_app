import React, { useCallback, useState, useRef, useEffect } from 'react';
import './HorseSummaryBar.css';
import type { HorseEntry } from '../types/drf';
import { getScoreColor } from '../lib/scoring';
import { scoreToWinProbability } from '../lib/scoring/overlayAnalysis';
import { normalizeOddsFormat } from '../lib/utils/oddsStepper';

interface TierInfo {
  label: string;
  className: string;
  isElite: boolean;
}

interface WinConfidenceInfo {
  label: string;
  className: string;
  probability: number;
}

/**
 * Get odds edge tier based on overlay percentage
 * These labels reflect ODDS EDGE, not win probability
 */
const getOddsEdgeTier = (valuePercent: number, isScratched: boolean): TierInfo => {
  if (isScratched) {
    return {
      label: 'SCRATCHED',
      className: 'scratched',
      isElite: false,
    };
  }

  if (valuePercent >= 100) {
    return {
      label: 'OVERLAY',
      className: 'elite',
      isElite: true,
    };
  }

  if (valuePercent >= 50) {
    return {
      label: 'OVERLAY',
      className: 'good',
      isElite: false,
    };
  }

  if (valuePercent >= 10) {
    return {
      label: 'FAIR ODDS',
      className: 'fair',
      isElite: false,
    };
  }

  if (valuePercent >= -10) {
    return {
      label: 'FAIR PRICE',
      className: 'neutral',
      isElite: false,
    };
  }

  return {
    label: 'UNDERLAY',
    className: 'bad',
    isElite: false,
  };
};

/**
 * Get WIN CONFIDENCE tier based on score
 * This reflects actual win probability from the algorithm
 */
const getWinConfidence = (score: number, isScratched: boolean): WinConfidenceInfo => {
  if (isScratched) {
    return {
      label: '—',
      className: 'scratched',
      probability: 0,
    };
  }

  const probability = scoreToWinProbability(score);

  if (probability >= 55) {
    return {
      label: 'HIGH',
      className: 'high',
      probability,
    };
  }

  if (probability >= 40) {
    return {
      label: 'MEDIUM',
      className: 'medium',
      probability,
    };
  }

  if (probability >= 25) {
    return {
      label: 'PLAYABLE',
      className: 'playable',
      probability,
    };
  }

  return {
    label: 'LOW',
    className: 'low',
    probability,
  };
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
  maxScore,
  score,
  fairOddsNum = 2,
  fairOddsDen = 1,
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
}) => {
  // Extract horse data from HorseEntry type
  const programNumber = horse.programNumber;
  const horseName = horse.horseName || 'UNKNOWN';

  // Note: These will be shown in expanded view, not summary bar
  // const trainer = horse.trainerName || '—';
  // const weight = horse.weight || '—';
  // const lifetimeStarts = horse.lifetimeStarts || 0;
  // const lifetimeWins = horse.lifetimeWins || 0;
  // const lifetimePlaces = horse.lifetimePlaces || 0;
  // const lifetimeShows = horse.lifetimeShows || 0;

  // Get odds edge tier for styling (based on overlay %)
  const tier = getOddsEdgeTier(valuePercent, isScratched);

  // Get WIN CONFIDENCE tier (based on score/win probability)
  const winConfidence = getWinConfidence(score, isScratched);

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
        horse-summary-bar--tier-${tier.className}
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

      {/* Column 2: Program Position */}
      <div className="horse-summary-bar__pp">#{programNumber}</div>

      {/* Column 3: Horse Name - FULL WIDTH, NO TRUNCATION */}
      <div className="horse-summary-bar__name">{horseName.toUpperCase()}</div>

      {/* Column 4: Rank - Projected Finish Order (based on base score) */}
      <div className="horse-summary-bar__rank">
        <span
          className="horse-summary-bar__rank-value"
          style={{ color: isScratched ? undefined : baseScoreRankColor }}
        >
          {isScratched ? '—' : baseScoreRankOrdinal || '—'}
        </span>
      </div>

      {/* Column 5: Live Odds - Click to edit */}
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

      {/* Column 5: Score */}
      <div className="horse-summary-bar__score">
        <span
          className="horse-summary-bar__score-value"
          style={{ color: getScoreColor(score, isScratched) }}
        >
          {score}/{maxScore}
        </span>
      </div>

      {/* Column 6: Win Confidence (based on score) */}
      <div
        className={`horse-summary-bar__confidence horse-summary-bar__confidence--${winConfidence.className}`}
      >
        <span className="horse-summary-bar__confidence-label">{winConfidence.label}</span>
      </div>

      {/* Column 7: Fair Odds */}
      <div className="horse-summary-bar__fair">
        {Number.isFinite(fairOddsNum) && Number.isFinite(fairOddsDen)
          ? `${fairOddsNum}-${fairOddsDen}`
          : '—'}
      </div>

      {/* Column 8: Edge Percentage (overlay %) */}
      <div className={`horse-summary-bar__value horse-summary-bar__value--${tier.className}`}>
        {Number.isFinite(valuePercent)
          ? `${valuePercent >= 0 ? '+' : ''}${valuePercent.toFixed(0)}%`
          : '—'}
      </div>

      {/* Column 9: Odds Edge Badge */}
      <div className="horse-summary-bar__tier-wrapper">
        <div className={`horse-summary-bar__tier horse-summary-bar__tier--${tier.className}`}>
          {tier.isElite && <span className="horse-summary-bar__diamond">◆</span>}
          {tier.label}
        </div>
      </div>

      {/* Column 10: Expand Chevron */}
      <div className="horse-summary-bar__expand-wrapper">
        <span className="material-icons horse-summary-bar__expand">expand_more</span>
      </div>
    </div>
  );
};

export default HorseSummaryBar;
