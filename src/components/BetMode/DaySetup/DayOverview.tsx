/**
 * DayOverview Component
 *
 * Shows the complete day plan with all race allocations.
 * User can drill into individual races or adjust budgets.
 */

import React from 'react';
import type { DaySession } from '../../../lib/betting/daySession';
import type { RaceAllocation } from '../../../lib/betting/allocateDayBudget';
import './DaySetup.css';

interface DayOverviewProps {
  /** The day session data */
  session: DaySession;
  /** Callback when user wants to edit settings */
  onEdit: () => void;
  /** Callback when user taps a race row */
  onSelectRace: (raceNumber: number) => void;
  /** Callback to start betting */
  onStartBetting: () => void;
}

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  standard: 'Standard',
  expert: 'Expert',
};

const STYLE_LABELS: Record<string, string> = {
  safe: 'Safe',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

const VERDICT_EMOJI: Record<string, string> = {
  BET: '🟢',
  CAUTION: '🟡',
  PASS: '🔴',
};

const VERDICT_LABEL: Record<string, string> = {
  BET: 'BET',
  CAUTION: 'CAUTION',
  PASS: 'PASS',
};

export const DayOverview: React.FC<DayOverviewProps> = ({
  session,
  onEdit,
  onSelectRace,
  onStartBetting,
}) => {
  const { raceAllocations, totalBankroll, experienceLevel, riskStyle, trackName } = session;

  // Count verdicts
  const betRaces = raceAllocations.filter((r) => r.verdict === 'BET');
  const cautionRaces = raceAllocations.filter((r) => r.verdict === 'CAUTION');
  const passRaces = raceAllocations.filter((r) => r.verdict === 'PASS');

  // Calculate budgets by verdict
  const betBudget = betRaces.reduce((sum, r) => sum + r.allocatedBudget, 0);
  const cautionBudget = cautionRaces.reduce((sum, r) => sum + r.allocatedBudget, 0);
  const passBudget = passRaces.reduce((sum, r) => sum + r.allocatedBudget, 0);
  const totalAllocated = betBudget + cautionBudget + passBudget;

  return (
    <div className="day-overview">
      {/* Header */}
      <div className="day-overview__header">
        <div className="day-overview__header-left">
          <span className="day-overview__icon">📅</span>
          <h2 className="day-overview__title">YOUR DAY PLAN</h2>
        </div>
        <button className="day-overview__edit-btn" onClick={onEdit}>
          <span className="material-icons">edit</span>
          <span>EDIT</span>
        </button>
      </div>

      {/* Settings summary */}
      <div className="day-overview__settings">
        <span className="day-overview__setting">
          Bankroll: <strong>${totalBankroll}</strong>
        </span>
        <span className="day-overview__setting-separator">•</span>
        <span className="day-overview__setting">
          <strong>{EXPERIENCE_LABELS[experienceLevel]}</strong>
        </span>
        <span className="day-overview__setting-separator">•</span>
        <span className="day-overview__setting">
          <strong>{STYLE_LABELS[riskStyle]}</strong>
        </span>
      </div>

      {/* Track info */}
      <div className="day-overview__track-info">
        TODAY'S RACES: {raceAllocations.length} races at {trackName}
      </div>

      {/* Verdict summary cards */}
      <div className="day-overview__summary-cards">
        <div className="day-overview__summary-card day-overview__summary-card--bet">
          <div className="day-overview__summary-header">
            <span className="day-overview__summary-icon">🟢</span>
            <span className="day-overview__summary-label">VALUE RACES: {betRaces.length}</span>
          </div>
          <div className="day-overview__summary-budget">Budget: ${betBudget}</div>
          <div className="day-overview__summary-desc">These races have overlays. Bet heavy.</div>
        </div>

        <div className="day-overview__summary-card day-overview__summary-card--caution">
          <div className="day-overview__summary-header">
            <span className="day-overview__summary-icon">🟡</span>
            <span className="day-overview__summary-label">CAUTION RACES: {cautionRaces.length}</span>
          </div>
          <div className="day-overview__summary-budget">Budget: ${cautionBudget}</div>
          <div className="day-overview__summary-desc">Marginal value. Bet light.</div>
        </div>

        <div className="day-overview__summary-card day-overview__summary-card--pass">
          <div className="day-overview__summary-header">
            <span className="day-overview__summary-icon">🔴</span>
            <span className="day-overview__summary-label">PASS RACES: {passRaces.length}</span>
          </div>
          <div className="day-overview__summary-budget">Budget: ${passBudget}</div>
          <div className="day-overview__summary-desc">No value. Minimal bets to stay in action.</div>
        </div>
      </div>

      {/* Race-by-race breakdown */}
      <div className="day-overview__breakdown">
        <div className="day-overview__breakdown-header">
          RACE-BY-RACE BREAKDOWN:
        </div>

        <div className="day-overview__race-list">
          {raceAllocations.map((allocation) => (
            <RaceRow
              key={allocation.raceNumber}
              allocation={allocation}
              isCompleted={session.racesCompleted.includes(allocation.raceNumber)}
              onClick={() => onSelectRace(allocation.raceNumber)}
            />
          ))}
        </div>

        <div className="day-overview__total-row">
          <span className="day-overview__total-label">TOTAL ALLOCATED:</span>
          <span className="day-overview__total-value">${totalAllocated}</span>
        </div>
      </div>

      {/* Help tip */}
      <div className="day-overview__help">
        <div className="day-overview__help-icon">❓</div>
        <div className="day-overview__help-content">
          <strong>HOW WE SPLIT YOUR MONEY:</strong>
          <p>
            We put more money on races with value plays (+75% edge or higher) and less on races
            without value. This maximizes your expected return while keeping you in action all day.
          </p>
        </div>
      </div>

      {/* Start betting button */}
      <div className="day-overview__actions">
        <button className="day-overview__start-btn" onClick={onStartBetting}>
          <span>LET'S START BETTING</span>
          <span className="day-overview__start-icon">🎯</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// RACE ROW COMPONENT
// ============================================================================

interface RaceRowProps {
  allocation: RaceAllocation;
  isCompleted: boolean;
  onClick: () => void;
}

const RaceRow: React.FC<RaceRowProps> = ({ allocation, isCompleted, onClick }) => {
  const { raceNumber, verdict, valuePlay, edge, allocatedBudget } = allocation;

  return (
    <button
      className={`day-overview__race-row ${isCompleted ? 'day-overview__race-row--completed' : ''}`}
      onClick={onClick}
    >
      <div className="day-overview__race-number">
        R{raceNumber}
      </div>

      <div className="day-overview__race-verdict">
        <span className="day-overview__verdict-emoji">{VERDICT_EMOJI[verdict]}</span>
        <span className="day-overview__verdict-label">{VERDICT_LABEL[verdict]}</span>
      </div>

      <div className="day-overview__race-value">
        {valuePlay ? (
          <>
            <span className="day-overview__value-horse">
              #{valuePlay.programNumber} {valuePlay.horseName.substring(0, 15)}
              {valuePlay.horseName.length > 15 ? '...' : ''}
            </span>
            <span className="day-overview__value-odds">({valuePlay.currentOdds})</span>
          </>
        ) : (
          <span className="day-overview__no-value">No value play</span>
        )}
      </div>

      <div className="day-overview__race-edge">
        {edge !== null ? (
          <span className={`day-overview__edge-value ${edge >= 75 ? 'day-overview__edge-value--high' : ''}`}>
            +{Math.round(edge)}%
          </span>
        ) : (
          <span className="day-overview__edge-dash">—</span>
        )}
      </div>

      <div className="day-overview__race-budget">
        ${allocatedBudget}
      </div>

      {isCompleted && (
        <div className="day-overview__completed-check">
          <span className="material-icons">check_circle</span>
        </div>
      )}
    </button>
  );
};

export default DayOverview;
