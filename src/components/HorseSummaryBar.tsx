import React from 'react';
import './HorseSummaryBar.css';
import type { HorseEntry } from '../types/drf';

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
}

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
}) => {
  // Extract horse data from HorseEntry type
  const programNumber = horse.programNumber;
  const horseName = horse.horseName || 'UNKNOWN';
  const trainer = horse.trainerName || '—';
  const weight = horse.weight || '—';
  const morningLine = horse.morningLineOdds || '2-1';

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

  // Determine tier label based on value (colors added in Prompt 3A)
  const getTierLabel = (value: number): string => {
    if (value >= 100) return 'STRONG OVERLAY';
    if (value >= 50) return 'OVERLAY';
    if (value >= 10) return 'FAIR VALUE';
    if (value >= -10) return 'NEUTRAL';
    return 'UNDERLAY';
  };

  return (
    <div
      className={`horse-summary-bar ${isExpanded ? 'horse-summary-bar--expanded' : ''}`}
      onClick={onToggleExpand}
    >
      {/* Scratch checkbox placeholder - added in Prompt 2A */}
      <div className="horse-summary-bar__scratch-placeholder"></div>

      {/* Program number */}
      <div className="horse-summary-bar__pp">#{programNumber}</div>

      {/* Horse name */}
      <div className="horse-summary-bar__name">{horseName.toUpperCase()}</div>

      {/* Trainer */}
      <div className="horse-summary-bar__trainer">{formatTrainer(trainer)}</div>

      {/* Weight */}
      <div className="horse-summary-bar__weight">{weight}</div>

      {/* Odds placeholder - replaced with input in Prompt 2A */}
      <div className="horse-summary-bar__odds-placeholder">{morningLine}</div>

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

      {/* Value percentage */}
      <div className="horse-summary-bar__value-percent">
        <span className="horse-summary-bar__label">Value:</span>
        <span className="horse-summary-bar__value">
          {valuePercent >= 0 ? '+' : ''}
          {valuePercent.toFixed(0)}%
        </span>
        <span className="horse-summary-bar__suffix">
          ({valuePercent >= 0 ? 'overlay' : 'underlay'})
        </span>
      </div>

      {/* Tier badge */}
      <div className="horse-summary-bar__tier">{getTierLabel(valuePercent)}</div>

      {/* Expand indicator */}
      <span className="material-icons horse-summary-bar__expand">expand_more</span>
    </div>
  );
};

export default HorseSummaryBar;
