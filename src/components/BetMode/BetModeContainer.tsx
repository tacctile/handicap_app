/**
 * BetModeContainer Component
 *
 * Full-screen container for the betting interface.
 * Takes over the main content area when bet mode is active.
 * This is the foundation for the betting suggestions system.
 */

import React from 'react';
import { BetModeHeader } from './BetModeHeader';
import type { ParsedRace } from '../../types/drf';
import type { RaceValueAnalysis } from '../../hooks/useValueDetection';
import './BetModeContainer.css';

interface BetModeContainerProps {
  /** Current race data */
  race: ParsedRace | undefined;
  /** Race number (1-indexed) */
  raceNumber: number;
  /** Track name for display */
  trackName?: string;
  /** Value analysis for the race */
  valueAnalysis?: RaceValueAnalysis | null;
  /** Callback to close bet mode */
  onClose: () => void;
}

/**
 * Get verdict display info
 */
function getVerdictInfo(verdict: string | undefined): {
  label: string;
  color: string;
  icon: string;
} {
  switch (verdict) {
    case 'BET':
      return { label: 'BETTABLE', color: 'var(--color-success)', icon: '🟢' };
    case 'CAUTION':
      return { label: 'CAUTION', color: 'var(--color-warning)', icon: '🟡' };
    case 'PASS':
      return { label: 'PASS', color: 'var(--color-error)', icon: '🔴' };
    default:
      return { label: 'ANALYZING...', color: 'var(--color-text-secondary)', icon: '⏳' };
  }
}

/**
 * Format edge percentage for display
 */
function formatEdge(edge: number | undefined): string {
  if (edge === undefined || isNaN(edge)) return '--';
  const sign = edge >= 0 ? '+' : '';
  return `${sign}${Math.round(edge)}%`;
}

export const BetModeContainer: React.FC<BetModeContainerProps> = ({
  race,
  raceNumber,
  trackName,
  valueAnalysis,
  onClose,
}) => {
  const primaryValuePlay = valueAnalysis?.primaryValuePlay;
  const verdictInfo = getVerdictInfo(valueAnalysis?.verdict);

  return (
    <div className="bet-mode-container">
      <BetModeHeader raceNumber={raceNumber} trackName={trackName} onClose={onClose} />

      <div className="bet-mode-content">
        <div className="bet-mode-placeholder">
          <div className="bet-mode-placeholder__header">
            <span className="bet-mode-placeholder__icon">🎯</span>
            <h2 className="bet-mode-placeholder__title">BET MODE COMING SOON</h2>
          </div>

          <p className="bet-mode-placeholder__subtitle">
            Betting suggestions will appear here.
          </p>

          {/* Race context info */}
          <div className="bet-mode-placeholder__info">
            <div className="bet-mode-placeholder__info-row">
              <span className="bet-mode-placeholder__label">Race:</span>
              <span className="bet-mode-placeholder__value">
                {trackName || 'Unknown Track'} Race {raceNumber}
              </span>
            </div>

            {race?.header?.distance && (
              <div className="bet-mode-placeholder__info-row">
                <span className="bet-mode-placeholder__label">Distance:</span>
                <span className="bet-mode-placeholder__value">{race.header.distance}</span>
              </div>
            )}

            <div className="bet-mode-placeholder__info-row">
              <span className="bet-mode-placeholder__label">Verdict:</span>
              <span
                className="bet-mode-placeholder__value bet-mode-placeholder__verdict"
                style={{ color: verdictInfo.color }}
              >
                {verdictInfo.icon} {verdictInfo.label}
              </span>
            </div>

            {primaryValuePlay && (
              <>
                <div className="bet-mode-placeholder__info-row bet-mode-placeholder__info-row--highlight">
                  <span className="bet-mode-placeholder__label">Value Play:</span>
                  <span className="bet-mode-placeholder__value bet-mode-placeholder__horse-name">
                    {primaryValuePlay.horseName}
                    {primaryValuePlay.programNumber ? ` (#${primaryValuePlay.programNumber})` : ''}
                  </span>
                </div>

                <div className="bet-mode-placeholder__info-row bet-mode-placeholder__info-row--highlight">
                  <span className="bet-mode-placeholder__label">Edge:</span>
                  <span
                    className="bet-mode-placeholder__value bet-mode-placeholder__edge"
                    style={{
                      color:
                        (primaryValuePlay.valueEdge ?? 0) >= 100
                          ? 'var(--color-tier-elite)'
                          : (primaryValuePlay.valueEdge ?? 0) >= 50
                            ? 'var(--color-tier-good)'
                            : 'var(--color-tier-fair)',
                    }}
                  >
                    {formatEdge(primaryValuePlay.valueEdge)}
                  </span>
                </div>

                <div className="bet-mode-placeholder__info-row">
                  <span className="bet-mode-placeholder__label">Current Odds:</span>
                  <span className="bet-mode-placeholder__value">
                    {primaryValuePlay.currentOdds || '--'}
                  </span>
                </div>

                <div className="bet-mode-placeholder__info-row">
                  <span className="bet-mode-placeholder__label">Win Probability:</span>
                  <span className="bet-mode-placeholder__value">
                    {primaryValuePlay.modelWinProb ? `${Math.round(primaryValuePlay.modelWinProb)}%` : '--'}
                  </span>
                </div>
              </>
            )}

            {!primaryValuePlay && valueAnalysis?.verdict === 'PASS' && (
              <div className="bet-mode-placeholder__info-row">
                <span className="bet-mode-placeholder__label">Suggestion:</span>
                <span className="bet-mode-placeholder__value bet-mode-placeholder__pass-message">
                  No value plays identified — consider skipping this race
                </span>
              </div>
            )}
          </div>

          {/* Back to analysis button */}
          <button className="bet-mode-placeholder__back-btn" onClick={onClose}>
            <span className="material-icons">arrow_back</span>
            <span>BACK TO ANALYSIS</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BetModeContainer;
