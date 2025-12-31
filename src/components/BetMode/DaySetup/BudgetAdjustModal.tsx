/**
 * BudgetAdjustModal Component
 *
 * Modal for adjusting a specific race's budget.
 * Shows impact on other races.
 */

import React, { useState, useMemo } from 'react';
import type { RaceAllocation } from '../../../lib/betting/allocateDayBudget';
import { getAdjustmentImpact } from '../../../lib/betting/allocateDayBudget';
import './DaySetup.css';

const BUDGET_ADJUSTMENTS = [50, 60, 70, 80, 100, 120, 150];

interface BudgetAdjustModalProps {
  /** Current allocation for the race */
  allocation: RaceAllocation;
  /** All allocations (for impact calculation) */
  allAllocations: RaceAllocation[];
  /** Index of the race being adjusted */
  raceIndex: number;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback when user applies changes */
  onApply: (newBudget: number) => void;
}

export const BudgetAdjustModal: React.FC<BudgetAdjustModalProps> = ({
  allocation,
  allAllocations,
  raceIndex,
  onCancel,
  onApply,
}) => {
  const [selectedBudget, setSelectedBudget] = useState(allocation.allocatedBudget);
  const [customValue, setCustomValue] = useState('');

  // Calculate impact of the change
  const impact = useMemo(() => {
    return getAdjustmentImpact(allAllocations, raceIndex, selectedBudget);
  }, [allAllocations, raceIndex, selectedBudget]);

  const handlePresetClick = (amount: number) => {
    setSelectedBudget(amount);
    setCustomValue('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCustomValue(value);

    if (value) {
      const numValue = parseInt(value, 10);
      if (numValue >= 10) {
        setSelectedBudget(numValue);
      }
    }
  };

  const hasChanges = selectedBudget !== allocation.allocatedBudget;

  return (
    <div className="budget-modal__overlay">
      <div className="budget-modal">
        {/* Header */}
        <div className="budget-modal__header">
          <span className="budget-modal__icon">✏️</span>
          <h3 className="budget-modal__title">ADJUST RACE {allocation.raceNumber} BUDGET</h3>
        </div>

        {/* Current allocation */}
        <div className="budget-modal__current">
          <span className="budget-modal__current-label">Current allocation:</span>
          <span className="budget-modal__current-value">${allocation.allocatedBudget}</span>
        </div>

        {/* Preset buttons */}
        <div className="budget-modal__presets">
          {BUDGET_ADJUSTMENTS.map((amount) => (
            <button
              key={amount}
              className={`budget-modal__preset ${selectedBudget === amount ? 'budget-modal__preset--selected' : ''}`}
              onClick={() => handlePresetClick(amount)}
            >
              ${amount}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="budget-modal__custom">
          <label className="budget-modal__custom-label">Custom:</label>
          <div className="budget-modal__custom-input-wrapper">
            <span className="budget-modal__custom-prefix">$</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="budget-modal__custom-input"
              placeholder="Amount"
              value={customValue}
              onChange={handleCustomChange}
              maxLength={4}
            />
          </div>
        </div>

        {/* Impact warning */}
        {hasChanges && impact.affectedRaces.length > 0 && (
          <div className="budget-modal__impact">
            <span className="budget-modal__impact-icon">⚠️</span>
            <div className="budget-modal__impact-content">
              <strong>IMPACT:</strong>
              <p>
                {selectedBudget > allocation.allocatedBudget
                  ? `If you increase to $${selectedBudget}, we'll reduce other races by $${selectedBudget - allocation.allocatedBudget}.`
                  : `If you decrease to $${selectedBudget}, we'll add $${allocation.allocatedBudget - selectedBudget} to other races.`}
              </p>
              <p className="budget-modal__impact-races">
                This comes from: {impact.affectedRaces.map((r) => (
                  <span key={r.raceNumber}>
                    R{r.raceNumber} ({r.change > 0 ? '+' : ''}{r.change})
                  </span>
                )).reduce((prev, curr, i) => (
                  <>{prev}{i > 0 && ', '}{curr}</>
                ), <></>)}
              </p>
            </div>
          </div>
        )}

        {/* Cannot apply warning */}
        {hasChanges && !impact.canApply && (
          <div className="budget-modal__warning">
            <span className="budget-modal__warning-icon">❌</span>
            <span className="budget-modal__warning-text">
              Cannot adjust this much. Other races would go below minimum.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="budget-modal__actions">
          <button className="budget-modal__cancel-btn" onClick={onCancel}>
            CANCEL
          </button>

          <button
            className="budget-modal__apply-btn"
            onClick={() => onApply(selectedBudget)}
            disabled={!hasChanges || !impact.canApply}
          >
            APPLY CHANGES
          </button>
        </div>
      </div>
    </div>
  );
};

export default BudgetAdjustModal;
