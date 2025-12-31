/**
 * BudgetStep Component
 *
 * Step 1 of the betting flow: User selects their budget for this race.
 * Offers preset amounts and custom input.
 */

import React, { useState } from 'react';
import { BUDGET_PRESETS, MIN_BET_AMOUNT, MAX_BUDGET } from '../../lib/betting/betTypes';
import './BudgetStep.css';

interface BudgetStepProps {
  /** Current budget value */
  budget: number | null;
  /** Callback when budget changes */
  onBudgetChange: (budget: number | null) => void;
  /** Callback when user clicks Next */
  onNext: () => void;
}

export const BudgetStep: React.FC<BudgetStepProps> = ({ budget, onBudgetChange, onNext }) => {
  const [customValue, setCustomValue] = useState<string>(
    budget && !BUDGET_PRESETS.includes(budget) ? String(budget) : ''
  );
  const [selectedPreset, setSelectedPreset] = useState<number | null>(
    budget && BUDGET_PRESETS.includes(budget) ? budget : null
  );

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    setCustomValue('');
    onBudgetChange(amount);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCustomValue(value);
    setSelectedPreset(null);

    if (value) {
      const numValue = parseInt(value, 10);
      if (numValue >= MIN_BET_AMOUNT && numValue <= MAX_BUDGET) {
        onBudgetChange(numValue);
      } else {
        onBudgetChange(null);
      }
    } else {
      onBudgetChange(null);
    }
  };

  const handleCustomFocus = () => {
    // Clear preset selection when focusing custom input
    if (selectedPreset !== null) {
      setSelectedPreset(null);
      if (budget) {
        setCustomValue(String(budget));
      }
    }
  };

  const isValidBudget = budget !== null && budget >= MIN_BET_AMOUNT;

  return (
    <div className="budget-step">
      <div className="budget-step__header">
        <span className="budget-step__icon">💰</span>
        <h2 className="budget-step__title">HOW MUCH FOR THIS RACE?</h2>
      </div>

      <p className="budget-step__subtitle">Pick your budget or enter a custom amount.</p>

      {/* Preset buttons */}
      <div className="budget-step__presets">
        {BUDGET_PRESETS.map((amount) => (
          <button
            key={amount}
            className={`budget-step__preset ${selectedPreset === amount ? 'budget-step__preset--selected' : ''}`}
            onClick={() => handlePresetClick(amount)}
          >
            ${amount}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="budget-step__custom">
        <label className="budget-step__custom-label">Custom:</label>
        <div className="budget-step__custom-input-wrapper">
          <span className="budget-step__custom-prefix">$</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="budget-step__custom-input"
            placeholder="Enter amount"
            value={customValue}
            onChange={handleCustomChange}
            onFocus={handleCustomFocus}
            maxLength={4}
          />
        </div>
      </div>

      {/* Help tip */}
      <div className="budget-step__help">
        <div className="budget-step__help-icon">❓</div>
        <div className="budget-step__help-content">
          <strong>HOW MUCH SHOULD I BET?</strong>
          <p>
            Only bet what you can afford to lose. A good rule: your race budget should be 5-10% of
            your total bankroll. If you have $200 for the day and 10 races, that's $20/race.
          </p>
        </div>
      </div>

      {/* Next button */}
      <div className="budget-step__actions">
        <button className="budget-step__next-btn" onClick={onNext} disabled={!isValidBudget}>
          <span>NEXT</span>
          <span className="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

export default BudgetStep;
