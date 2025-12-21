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
  // New props for interactive controls
  isScratched: boolean;
  onScratchToggle: (scratched: boolean) => void;
  currentOdds: { numerator: number; denominator: number };
  onOddsChange: (odds: { numerator: number; denominator: number }) => void;
}

// OddsInput component for adjusting live odds
interface OddsInputProps {
  numerator: number;
  denominator: number;
  onChange: (odds: { numerator: number; denominator: number }) => void;
  disabled?: boolean;
}

const OddsInput: React.FC<OddsInputProps> = ({ numerator, denominator, onChange, disabled }) => {
  const handleNumeratorChange = (delta: number) => {
    const newVal = Math.max(1, numerator + delta);
    onChange({ numerator: newVal, denominator });
  };

  const handleDenominatorChange = (delta: number) => {
    const newVal = Math.max(1, denominator + delta);
    onChange({ numerator, denominator: newVal });
  };

  const handleNumeratorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 1;
    onChange({ numerator: Math.max(1, val), denominator });
  };

  const handleDenominatorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 1;
    onChange({ numerator, denominator: Math.max(1, val) });
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="odds-input" onClick={stopPropagation}>
      {/* Left number controls - stacked on LEFT side */}
      <div className="odds-input__control">
        <button
          type="button"
          onClick={() => handleNumeratorChange(1)}
          disabled={disabled}
          className="odds-input__btn"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handleNumeratorChange(-1)}
          disabled={disabled}
          className="odds-input__btn"
        >
          −
        </button>
      </div>

      {/* Left number input */}
      <input
        type="number"
        value={numerator}
        onChange={handleNumeratorInput}
        disabled={disabled}
        className="odds-input__number"
        min="1"
      />

      {/* Separator */}
      <span className="odds-input__separator">-</span>

      {/* Right number input */}
      <input
        type="number"
        value={denominator}
        onChange={handleDenominatorInput}
        disabled={disabled}
        className="odds-input__number"
        min="1"
      />

      {/* Right number controls - stacked on RIGHT side */}
      <div className="odds-input__control">
        <button
          type="button"
          onClick={() => handleDenominatorChange(1)}
          disabled={disabled}
          className="odds-input__btn"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handleDenominatorChange(-1)}
          disabled={disabled}
          className="odds-input__btn"
        >
          −
        </button>
      </div>
    </div>
  );
};

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
  onOddsChange,
}) => {
  // Extract horse data from HorseEntry type
  const programNumber = horse.programNumber;
  const horseName = horse.horseName || 'UNKNOWN';
  const trainer = horse.trainerName || '—';
  const weight = horse.weight || '—';

  // Lifetime record from HorseEntry
  const lifetimeStarts = horse.lifetimeStarts || 0;
  const lifetimeWins = horse.lifetimeWins || 0;
  const lifetimePlaces = horse.lifetimePlaces || 0;
  const lifetimeShows = horse.lifetimeShows || 0;

  // Format trainer name (Last, First Initial)
  const formatTrainer = (name: string): string => {
    if (!name || name === '—') return '—';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstInitial = parts[0]?.[0] || '';
      return `${lastName} ${firstInitial}`;
    }
    return name;
  };

  // Get tier info for styling
  const tier = getValueTier(valuePercent, isScratched);

  const handleRowClick = () => {
    if (!isScratched) {
      onToggleExpand();
    }
  };

  const handleScratchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onScratchToggle(e.target.checked);
  };

  const handleScratchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`horse-summary-bar
        horse-summary-bar--tier-${tier.className}
        ${isExpanded ? 'horse-summary-bar--expanded' : ''}
        ${isScratched ? 'horse-summary-bar--scratched' : ''}`}
      onClick={handleRowClick}
    >
      {/* Scratch checkbox */}
      <div className="horse-summary-bar__scratch" onClick={handleScratchClick}>
        <input
          type="checkbox"
          checked={isScratched}
          onChange={handleScratchChange}
          title="Mark as scratched"
          className="horse-summary-bar__scratch-input"
        />
      </div>

      {/* Program number */}
      <div className="horse-summary-bar__pp">#{programNumber}</div>

      {/* Horse name */}
      <div className="horse-summary-bar__name">{horseName.toUpperCase()}</div>

      {/* Trainer */}
      <div className="horse-summary-bar__trainer">{formatTrainer(trainer)}</div>

      {/* Weight */}
      <div className="horse-summary-bar__weight">{weight}</div>

      {/* Live odds input */}
      <OddsInput
        numerator={currentOdds.numerator}
        denominator={currentOdds.denominator}
        onChange={onOddsChange}
        disabled={isScratched}
      />

      {/* Lifetime record */}
      <div className="horse-summary-bar__lifetime">
        <span className="horse-summary-bar__label">Life:</span>
        <span className="horse-summary-bar__value">
          {lifetimeStarts}-{lifetimeWins}-{lifetimePlaces}-{lifetimeShows}
        </span>
      </div>

      {/* Furlong score */}
      <div className="horse-summary-bar__score">
        <span className="horse-summary-bar__label">Score:</span>
        <span className="horse-summary-bar__value horse-summary-bar__value--score">
          {score}/{maxScore}
        </span>
      </div>

      {/* Fair odds */}
      <div className="horse-summary-bar__fair">
        <span className="horse-summary-bar__label">Fair:</span>
        <span className="horse-summary-bar__value">
          {fairOddsNum}-{fairOddsDen}
        </span>
      </div>

      {/* Value percentage - color matches tier */}
      <div className="horse-summary-bar__value-percent">
        <span className="horse-summary-bar__label">Value:</span>
        <span
          className={`horse-summary-bar__data horse-summary-bar__data--value horse-summary-bar__data--${tier.className}`}
        >
          {valuePercent >= 0 ? '+' : ''}
          {valuePercent.toFixed(0)}%
        </span>
        <span className="horse-summary-bar__suffix">
          ({valuePercent >= 0 ? 'overlay' : 'underlay'})
        </span>
      </div>

      {/* Tier badge with optional diamond */}
      <div className={`horse-summary-bar__tier horse-summary-bar__tier--${tier.className}`}>
        {tier.isElite && <span className="horse-summary-bar__diamond">◆</span>}
        <span className="horse-summary-bar__tier-label">{tier.label}</span>
      </div>

      {/* Expand indicator */}
      <span className="material-icons horse-summary-bar__expand">expand_more</span>
    </div>
  );
};

export default HorseSummaryBar;
