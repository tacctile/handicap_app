/**
 * BetModeHeader Component
 *
 * Header for the bet mode full-screen interface.
 * Shows race info and close button.
 */

import React from 'react';

interface BetModeHeaderProps {
  /** Race number for display */
  raceNumber: number;
  /** Track name for display */
  trackName?: string;
  /** Callback when close button is clicked */
  onClose: () => void;
}

export const BetModeHeader: React.FC<BetModeHeaderProps> = ({
  raceNumber,
  trackName,
  onClose,
}) => {
  return (
    <header className="bet-mode-header">
      <div className="bet-mode-header__left">
        <span className="bet-mode-header__icon">🎯</span>
        <span className="bet-mode-header__title">BET MODE</span>
        <span className="bet-mode-header__separator">—</span>
        <span className="bet-mode-header__race">
          {trackName ? `${trackName} ` : ''}Race {raceNumber}
        </span>
      </div>

      <button
        className="bet-mode-header__close-btn"
        onClick={onClose}
        aria-label="Close bet mode and return to analysis"
      >
        <span className="material-icons">close</span>
        <span className="bet-mode-header__close-text">CLOSE</span>
      </button>
    </header>
  );
};

export default BetModeHeader;
