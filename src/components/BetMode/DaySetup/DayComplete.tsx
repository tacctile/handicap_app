/**
 * DayComplete Component
 *
 * End of day summary shown when all races are complete
 * or when user explicitly ends their day.
 */

import React from 'react';
import type { DaySession } from '../../../lib/betting/daySession';
import { getDaySummary } from '../../../lib/betting/daySession';
import './DaySetup.css';

interface DayCompleteProps {
  /** The completed day session */
  session: DaySession;
  /** Callback to start a new day */
  onStartNewDay: () => void;
  /** Callback to exit bet mode */
  onExitBetMode: () => void;
}

export const DayComplete: React.FC<DayCompleteProps> = ({
  session,
  onStartNewDay,
  onExitBetMode,
}) => {
  const summary = getDaySummary(session);

  return (
    <div className="day-complete">
      {/* Header */}
      <div className="day-complete__header">
        <span className="day-complete__icon">📅</span>
        <h2 className="day-complete__title">DAY COMPLETE!</h2>
      </div>

      {/* Stats card */}
      <div className="day-complete__stats-card">
        <h3 className="day-complete__section-title">FINAL STATS:</h3>

        <div className="day-complete__stat-row">
          <span className="day-complete__stat-label">Bankroll:</span>
          <span className="day-complete__stat-value">${summary.bankroll}</span>
        </div>

        <div className="day-complete__stat-row">
          <span className="day-complete__stat-label">Total wagered:</span>
          <span className="day-complete__stat-value">${summary.totalWagered}</span>
        </div>

        <div className="day-complete__stat-row">
          <span className="day-complete__stat-label">Races bet:</span>
          <span className="day-complete__stat-value">{summary.racesBet}/{summary.totalRaces}</span>
        </div>
      </div>

      {/* Value plays section */}
      <div className="day-complete__value-card">
        <h3 className="day-complete__section-title">VALUE PLAYS:</h3>

        <div className="day-complete__stat-row">
          <span className="day-complete__stat-label">Value races identified:</span>
          <span className="day-complete__stat-value">
            {session.raceAllocations.filter((r) => r.verdict === 'BET').length}
          </span>
        </div>

        <div className="day-complete__stat-row">
          <span className="day-complete__stat-label">You bet on value plays:</span>
          <span className="day-complete__stat-value">${summary.valueRacesBudget}</span>
        </div>
      </div>

      {/* Future feature teaser */}
      <div className="day-complete__future-card">
        <span className="day-complete__future-icon">💡</span>
        <div className="day-complete__future-content">
          <strong>HOW'D YOU DO?</strong>
          <p>
            Track your results to see your actual ROI!<br />
            <span className="day-complete__coming-soon">(Coming soon: Enter results to calculate profit/loss)</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="day-complete__actions">
        <button className="day-complete__new-day-btn" onClick={onStartNewDay}>
          <span className="material-icons">refresh</span>
          <span>START NEW DAY</span>
        </button>

        <button className="day-complete__exit-btn" onClick={onExitBetMode}>
          <span>EXIT BET MODE</span>
          <span className="material-icons">close</span>
        </button>
      </div>
    </div>
  );
};

export default DayComplete;
