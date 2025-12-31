/**
 * RaceNavigation Component
 *
 * Race selector and copy all button at the bottom of bet mode.
 * Allows quick navigation between races while staying in bet mode.
 */

import React, { useState } from 'react';
import type { RaceAllocation } from '../../lib/betting/daySession';
import './RaceNavigation.css';

interface RaceNavigationProps {
  /** Current race number (1-indexed) */
  currentRace: number;
  /** Total number of races */
  totalRaces: number;
  /** Callback when race is selected */
  onRaceSelect: (raceNumber: number) => void;
  /** Callback to copy all bets */
  onCopyAll: () => void;
  /** Whether copy was successful (for feedback) */
  copySuccess?: boolean;
  /** Race allocations for showing verdict colors (optional) */
  raceAllocations?: RaceAllocation[];
  /** Completed race numbers (for day mode) */
  completedRaces?: number[];
}

export const RaceNavigation: React.FC<RaceNavigationProps> = ({
  currentRace,
  totalRaces,
  onRaceSelect,
  onCopyAll,
  copySuccess = false,
  raceAllocations,
  completedRaces = [],
}) => {
  const [scrollPosition, setScrollPosition] = useState(0);

  // Get verdict for a race (if allocations provided)
  const getVerdictClass = (raceNum: number): string => {
    if (!raceAllocations) return '';
    const allocation = raceAllocations.find((a) => a.raceNumber === raceNum);
    if (!allocation) return '';
    return `race-nav__race--${allocation.verdict.toLowerCase()}`;
  };

  // Check if race is completed
  const isCompleted = (raceNum: number): boolean => {
    return completedRaces.includes(raceNum);
  };

  // Handle scroll for mobile
  const handleScroll = (direction: 'left' | 'right') => {
    const container = document.querySelector('.race-nav__races');
    if (container) {
      const scrollAmount = direction === 'left' ? -150 : 150;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setScrollPosition(container.scrollLeft + scrollAmount);
    }
  };

  return (
    <div className="race-nav">
      {/* Scroll left button (mobile) */}
      <button
        className="race-nav__scroll race-nav__scroll--left"
        onClick={() => handleScroll('left')}
        aria-label="Scroll left"
      >
        <span className="material-icons">chevron_left</span>
      </button>

      {/* Race buttons */}
      <div className="race-nav__races">
        {Array.from({ length: totalRaces }, (_, i) => i + 1).map((raceNum) => (
          <button
            key={raceNum}
            className={`race-nav__race ${currentRace === raceNum ? 'race-nav__race--active' : ''} ${getVerdictClass(raceNum)} ${isCompleted(raceNum) ? 'race-nav__race--completed' : ''}`}
            onClick={() => onRaceSelect(raceNum)}
          >
            <span className="race-nav__race-label">R{raceNum}</span>
            {isCompleted(raceNum) && (
              <span className="material-icons race-nav__race-check">check</span>
            )}
          </button>
        ))}
      </div>

      {/* Scroll right button (mobile) */}
      <button
        className="race-nav__scroll race-nav__scroll--right"
        onClick={() => handleScroll('right')}
        aria-label="Scroll right"
      >
        <span className="material-icons">chevron_right</span>
      </button>

      {/* Copy All button */}
      <button
        className={`race-nav__copy-all ${copySuccess ? 'race-nav__copy-all--success' : ''}`}
        onClick={onCopyAll}
      >
        <span className="material-icons">
          {copySuccess ? 'check' : 'content_copy'}
        </span>
        <span className="race-nav__copy-text">
          {copySuccess ? 'COPIED!' : 'COPY ALL'}
        </span>
      </button>
    </div>
  );
};

export default RaceNavigation;
