/**
 * DayProgress Component
 *
 * Progress bar shown at the top when a day session is active.
 * Shows race progress, amount wagered, and remaining budget.
 */

import React from 'react';
import type { DaySession } from '../../../lib/betting/daySession';
import { getSessionProgress } from '../../../lib/betting/daySession';
import './DaySetup.css';

interface DayProgressProps {
  /** The active day session */
  session: DaySession;
  /** Callback when user clicks "View Plan" */
  onViewPlan: () => void;
}

export const DayProgress: React.FC<DayProgressProps> = ({ session, onViewPlan }) => {
  const progress = getSessionProgress(session);

  return (
    <div className="day-progress">
      <div className="day-progress__left">
        <span className="day-progress__icon">📅</span>
        <span className="day-progress__label">DAY PROGRESS</span>
      </div>

      <div className="day-progress__center">
        <div className="day-progress__bar-container">
          <div
            className="day-progress__bar-fill"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
        <span className="day-progress__races">
          {progress.completedRaces}/{progress.totalRaces} races
        </span>
      </div>

      <div className="day-progress__right">
        <div className="day-progress__stats">
          <span className="day-progress__stat">
            ${progress.amountWagered} wagered
          </span>
          <span className="day-progress__stat-separator">•</span>
          <span className="day-progress__stat day-progress__stat--remaining">
            ${progress.amountRemaining} remaining
          </span>
        </div>
        <button className="day-progress__view-btn" onClick={onViewPlan}>
          View Plan
        </button>
      </div>
    </div>
  );
};

export default DayProgress;
