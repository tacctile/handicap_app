/**
 * DayPlanModal Component
 *
 * Modal for setting up full day bankroll allocation.
 * Shows how budget will be distributed across all races.
 */

import React, { useState } from 'react';
import type { RaceAllocation } from '../../lib/betting/allocateDayBudget';
import type { RiskStyle } from '../../lib/betting/betTypes';
import './DayPlanModal.css';

interface DayPlanModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Race allocations to display */
  raceAllocations: RaceAllocation[];
  /** Total bankroll */
  totalBankroll: number;
  /** Callback when bankroll changes */
  onBankrollChange: (bankroll: number) => void;
  /** Current risk style */
  riskStyle: RiskStyle;
  /** Multi-race reserve amount */
  multiRaceReserve: number;
  /** Callback when user applies the day plan */
  onApply: () => void;
  /** Callback when user clears the day plan */
  onClear?: () => void;
  /** Whether this is showing an existing plan */
  isExisting?: boolean;
}

export const DayPlanModal: React.FC<DayPlanModalProps> = ({
  isOpen,
  onClose,
  raceAllocations,
  totalBankroll,
  onBankrollChange,
  riskStyle: _riskStyle,
  multiRaceReserve,
  onApply,
  onClear,
  isExisting = false,
}) => {
  const [bankrollInput, setBankrollInput] = useState(String(totalBankroll));

  if (!isOpen) return null;

  const handleBankrollChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setBankrollInput(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      onBankrollChange(num);
    }
  };

  // Get verdict emoji
  const getVerdictEmoji = (verdict: 'BET' | 'CAUTION' | 'PASS'): string => {
    switch (verdict) {
      case 'BET':
        return '🟢';
      case 'CAUTION':
        return '🟡';
      case 'PASS':
        return '🔴';
    }
  };

  // Count races by verdict
  const betRaces = raceAllocations.filter((a) => a.verdict === 'BET').length;
  const passRaces = raceAllocations.filter((a) => a.verdict === 'PASS').length;

  return (
    <div className="day-plan-modal__overlay" onClick={onClose}>
      <div className="day-plan-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="day-plan-modal__header">
          <span className="day-plan-modal__icon">📅</span>
          <h2 className="day-plan-modal__title">
            {isExisting ? 'YOUR DAY PLAN' : 'PLAN YOUR FULL DAY'}
          </h2>
          <button className="day-plan-modal__close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Bankroll Input */}
        <div className="day-plan-modal__bankroll">
          <label className="day-plan-modal__bankroll-label">Total Bankroll:</label>
          <div className="day-plan-modal__bankroll-input">
            <span className="day-plan-modal__bankroll-prefix">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={bankrollInput}
              onChange={handleBankrollChange}
              placeholder="500"
              disabled={isExisting}
            />
          </div>
        </div>

        {/* Explanation */}
        <p className="day-plan-modal__desc">
          This will allocate your bankroll across all {raceAllocations.length} races:
        </p>
        <ul className="day-plan-modal__bullets">
          <li>
            <span className="day-plan-modal__bullet-icon">💰</span>
            More money on VALUE races ({betRaces} races)
          </li>
          <li>
            <span className="day-plan-modal__bullet-icon">📉</span>
            Less money on PASS races ({passRaces} races)
          </li>
          <li>
            <span className="day-plan-modal__bullet-icon">🎯</span>
            Reserve for multi-race bets (${multiRaceReserve})
          </li>
        </ul>

        {/* Race allocations table */}
        <div className="day-plan-modal__races">
          {raceAllocations.map((allocation) => (
            <div
              key={allocation.raceNumber}
              className={`day-plan-modal__race day-plan-modal__race--${allocation.verdict.toLowerCase()}`}
            >
              <span className="day-plan-modal__race-num">R{allocation.raceNumber}</span>
              <span className="day-plan-modal__race-verdict">
                {getVerdictEmoji(allocation.verdict)} {allocation.verdict}
              </span>
              <span className="day-plan-modal__race-budget">
                ${allocation.allocatedBudget}
              </span>
              {allocation.valuePlay && (
                <span className="day-plan-modal__race-value">
                  ← Value play
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="day-plan-modal__summary">
          <div className="day-plan-modal__summary-row">
            <span>Race allocations:</span>
            <span>
              ${raceAllocations.reduce((sum, a) => sum + a.allocatedBudget, 0)}
            </span>
          </div>
          <div className="day-plan-modal__summary-row">
            <span>Multi-race reserve:</span>
            <span>${multiRaceReserve}</span>
          </div>
          <div className="day-plan-modal__summary-row day-plan-modal__summary-row--total">
            <span>Total:</span>
            <span>${totalBankroll}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="day-plan-modal__actions">
          <button className="day-plan-modal__cancel" onClick={onClose}>
            CANCEL
          </button>
          {isExisting && onClear ? (
            <button className="day-plan-modal__clear" onClick={onClear}>
              <span className="material-icons">close</span>
              CLEAR DAY PLAN
            </button>
          ) : (
            <button className="day-plan-modal__apply" onClick={onApply}>
              <span className="material-icons">check</span>
              APPLY DAY PLAN
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayPlanModal;
