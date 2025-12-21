import React from 'react';
import './HorseSummaryBar.css';
import type { HorseEntry } from '../types/drf';

interface TierInfo {
  label: string;
  className: string;
  isElite: boolean;
}

const getValueTier = (valuePercent: number, isScratched: boolean): TierInfo => {
  if (isScratched) {
    return {
      label: 'SCRATCHED',
      className: 'scratched',
      isElite: false,
    };
  }

  if (valuePercent >= 100) {
    return {
      label: 'STRONG OVERLAY',
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
      label: 'FAIR VALUE',
      className: 'fair',
      isElite: false,
    };
  }

  if (valuePercent >= -10) {
    return {
      label: 'NEUTRAL',
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
}

// OddsInput component removed - odds now displayed as simple text
// Can be re-added later with edit popup functionality

export const HorseSummaryBar: React.FC<HorseSummaryBarProps> = ({
  horse,
  rank: _rank, // Not displayed currently, will be used for rank badge in future
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
  onOddsChange: _onOddsChange, // Not used for now - odds displayed as simple text
  isCompareSelected,
  onCompareToggle,
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

  // Get tier info for styling
  const tier = getValueTier(valuePercent, isScratched);

  const handleRowClick = () => {
    if (!isScratched) {
      onToggleExpand();
    }
  };

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

      {/* Column 4: Live Odds - simple text display */}
      <div className="horse-summary-bar__odds">
        {currentOdds.numerator}-{currentOdds.denominator}
      </div>

      {/* Column 5: Score */}
      <div className="horse-summary-bar__score">
        <span className="horse-summary-bar__score-value">
          {score}/{maxScore}
        </span>
      </div>

      {/* Column 6: Fair Odds */}
      <div className="horse-summary-bar__fair">
        {fairOddsNum}-{fairOddsDen}
      </div>

      {/* Column 7: Value Percentage */}
      <div className={`horse-summary-bar__value horse-summary-bar__value--${tier.className}`}>
        {valuePercent >= 0 ? '+' : ''}
        {valuePercent.toFixed(0)}%
      </div>

      {/* Column 8: Rating Badge */}
      <div className="horse-summary-bar__tier-wrapper">
        <div className={`horse-summary-bar__tier horse-summary-bar__tier--${tier.className}`}>
          {tier.isElite && <span className="horse-summary-bar__diamond">◆</span>}
          {tier.label}
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
