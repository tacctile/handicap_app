/**
 * ModeSelection Component
 *
 * Initial screen when entering bet mode.
 * User chooses between "This Race Only" and "Plan My Day" betting modes.
 */

import React from 'react';
import './ModeSelection.css';

export type BetModeType = 'single' | 'day';

interface ModeSelectionProps {
  /** Whether user has an active day session that can be resumed */
  hasActiveSession: boolean;
  /** Callback when user selects a mode */
  onSelectMode: (mode: BetModeType) => void;
  /** Callback when user wants to resume existing session */
  onResumeSession: () => void;
}

export const ModeSelection: React.FC<ModeSelectionProps> = ({
  hasActiveSession,
  onSelectMode,
  onResumeSession,
}) => {
  return (
    <div className="mode-selection">
      <div className="mode-selection__header">
        <span className="mode-selection__icon">🎯</span>
        <h2 className="mode-selection__title">HOW DO YOU WANT TO BET?</h2>
      </div>

      <div className="mode-selection__cards">
        {/* This Race Only */}
        <button
          className="mode-card"
          onClick={() => onSelectMode('single')}
        >
          <div className="mode-card__icon">🎲</div>
          <h3 className="mode-card__title">THIS RACE ONLY</h3>
          <p className="mode-card__quote">"I just want to bet on the current race."</p>
          <p className="mode-card__description">
            Quick setup: Pick budget, pick style, get bets.
          </p>
        </button>

        {/* Plan My Day */}
        <button
          className="mode-card mode-card--featured"
          onClick={() => onSelectMode('day')}
        >
          <div className="mode-card__icon">📅</div>
          <h3 className="mode-card__title">PLAN MY DAY</h3>
          <p className="mode-card__quote">"I'm betting multiple races. Help me manage my money."</p>
          <p className="mode-card__description">
            Set your bankroll once, get a plan for every race.
          </p>
        </button>
      </div>

      {/* Resume Session Option */}
      {hasActiveSession && (
        <>
          <div className="mode-selection__divider">
            <span className="mode-selection__divider-line"></span>
          </div>

          <button
            className="mode-selection__resume-btn"
            onClick={onResumeSession}
          >
            Already have a day plan?{' '}
            <span className="mode-selection__resume-link">RESUME MY PLAN</span>
          </button>
        </>
      )}
    </div>
  );
};

export default ModeSelection;
