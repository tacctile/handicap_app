/**
 * Value Action Bar Component
 *
 * A persistent bottom bar showing the current race's value verdict at a glance.
 * Stays visible as the user scrolls through the horse list.
 * Positioned ABOVE the existing footer buttons.
 */

import React, { useCallback } from 'react';
import type { RaceValueAnalysis, RaceVerdict } from '../hooks/useValueDetection';
import {
  formatEdge,
  getEdgeColor,
  getVerdictColor,
  getBetTypeDisplay,
} from '../hooks/useValueDetection';
import './ValueActionBar.css';

interface ValueActionBarProps {
  /** Race value analysis from useValueDetection */
  valueAnalysis: RaceValueAnalysis | null;
  /** Race number for display */
  raceNumber: number;
  /** Callback when "View Value Play" button is clicked */
  onViewValuePlay?: (horseIndex: number) => void;
  /** Whether race data is loaded */
  hasRaceData: boolean;
}

/**
 * Get verdict icon emoji
 */
function getVerdictIcon(verdict: RaceVerdict): string {
  switch (verdict) {
    case 'BET':
      return '\u{1F7E2}'; // Green circle
    case 'CAUTION':
      return '\u{1F7E1}'; // Yellow circle
    case 'PASS':
      return '\u{1F534}'; // Red circle
  }
}

export const ValueActionBar: React.FC<ValueActionBarProps> = ({
  valueAnalysis,
  raceNumber,
  onViewValuePlay,
  hasRaceData,
}) => {
  const handleViewClick = useCallback(() => {
    if (valueAnalysis?.primaryValuePlay && onViewValuePlay) {
      onViewValuePlay(valueAnalysis.primaryValuePlay.horseIndex);
    }
  }, [valueAnalysis, onViewValuePlay]);

  // No race data - show placeholder
  if (!hasRaceData || !valueAnalysis) {
    return (
      <div className="value-action-bar value-action-bar--empty">
        <div className="value-action-bar__content">
          <span className="value-action-bar__placeholder">
            Upload a race to see value analysis
          </span>
        </div>
      </div>
    );
  }

  const { verdict, primaryValuePlay } = valueAnalysis;
  const verdictColor = getVerdictColor(verdict);

  return (
    <div
      className={`value-action-bar value-action-bar--${verdict.toLowerCase()}`}
      style={{ borderTopColor: verdictColor }}
    >
      <div className="value-action-bar__content">
        {/* Verdict badge */}
        <div
          className="value-action-bar__verdict"
          style={{ color: verdictColor }}
        >
          <span className="value-action-bar__icon">
            {getVerdictIcon(verdict)}
          </span>
          <span className="value-action-bar__race">R{raceNumber}:</span>
          <span className="value-action-bar__verdict-text">{verdict}</span>
        </div>

        {/* Separator */}
        <div className="value-action-bar__separator" />

        {verdict === 'PASS' ? (
          /* PASS verdict - no value play */
          <div className="value-action-bar__pass-message">
            No value plays \u2014 skip this race
          </div>
        ) : primaryValuePlay ? (
          /* BET or CAUTION verdict with value play */
          <>
            {/* Horse name and odds */}
            <div className="value-action-bar__horse-info">
              <span className="value-action-bar__horse-name">
                {primaryValuePlay.horseName}
              </span>
              <span className="value-action-bar__odds">
                ({primaryValuePlay.currentOdds})
              </span>
            </div>

            {/* Separator */}
            <div className="value-action-bar__separator" />

            {/* Edge percentage */}
            <div className="value-action-bar__edge-section">
              <span className="value-action-bar__edge-label">Edge:</span>
              <span
                className="value-action-bar__edge-value"
                style={{ color: getEdgeColor(primaryValuePlay.valueEdge) }}
              >
                {formatEdge(primaryValuePlay.valueEdge)}
              </span>
            </div>

            {/* Separator */}
            <div className="value-action-bar__separator" />

            {/* Bet type */}
            <div className="value-action-bar__bet-type">
              {getBetTypeDisplay(primaryValuePlay.betType)}
            </div>

            {/* View button */}
            <button
              className="value-action-bar__view-btn"
              onClick={handleViewClick}
              title="Scroll to value play horse"
            >
              <span className="value-action-bar__view-text">View Value Play</span>
              <span className="material-icons value-action-bar__view-icon">
                arrow_upward
              </span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ValueActionBar;
