/**
 * DayBankrollStep Component
 *
 * Step 1 of day setup: User sets their total bankroll for the day.
 */

import React, { useState } from 'react';
import './DaySetup.css';

const DAY_BUDGET_PRESETS = [100, 200, 300, 500, 1000];
const MIN_DAY_BUDGET = 50;
const MAX_DAY_BUDGET = 10000;

interface DayBankrollStepProps {
  /** Current bankroll value */
  bankroll: number | null;
  /** Callback when bankroll changes */
  onBankrollChange: (amount: number | null) => void;
  /** Callback to go back to mode selection */
  onBack: () => void;
  /** Callback when user clicks Next */
  onNext: () => void;
}

export const DayBankrollStep: React.FC<DayBankrollStepProps> = ({
  bankroll,
  onBankrollChange,
  onBack,
  onNext,
}) => {
  const [customValue, setCustomValue] = useState<string>(
    bankroll && !DAY_BUDGET_PRESETS.includes(bankroll) ? String(bankroll) : ''
  );
  const [selectedPreset, setSelectedPreset] = useState<number | null>(
    bankroll && DAY_BUDGET_PRESETS.includes(bankroll) ? bankroll : null
  );

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    setCustomValue('');
    onBankrollChange(amount);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCustomValue(value);
    setSelectedPreset(null);

    if (value) {
      const numValue = parseInt(value, 10);
      if (numValue >= MIN_DAY_BUDGET && numValue <= MAX_DAY_BUDGET) {
        onBankrollChange(numValue);
      } else {
        onBankrollChange(null);
      }
    } else {
      onBankrollChange(null);
    }
  };

  const handleCustomFocus = () => {
    if (selectedPreset !== null) {
      setSelectedPreset(null);
      if (bankroll) {
        setCustomValue(String(bankroll));
      }
    }
  };

  const isValidBankroll = bankroll !== null && bankroll >= MIN_DAY_BUDGET;

  return (
    <div className="day-step">
      {/* Step indicator */}
      <div className="day-step__indicator">
        📅 PLAN YOUR DAY — STEP 1 OF 3
      </div>

      {/* Header */}
      <div className="day-step__header">
        <span className="day-step__icon">💰</span>
        <h2 className="day-step__title">WHAT'S YOUR BANKROLL FOR TODAY?</h2>
      </div>

      <p className="day-step__subtitle">
        This is the TOTAL amount you're willing to bet today.<br />
        We'll help you spread it across all the races.
      </p>

      {/* Preset buttons */}
      <div className="day-step__presets">
        {DAY_BUDGET_PRESETS.map((amount) => (
          <button
            key={amount}
            className={`day-step__preset ${selectedPreset === amount ? 'day-step__preset--selected' : ''}`}
            onClick={() => handlePresetClick(amount)}
          >
            ${amount}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="day-step__custom">
        <label className="day-step__custom-label">Custom:</label>
        <div className="day-step__custom-input-wrapper">
          <span className="day-step__custom-prefix">$</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="day-step__custom-input"
            placeholder="Enter amount"
            value={customValue}
            onChange={handleCustomChange}
            onFocus={handleCustomFocus}
            maxLength={5}
          />
        </div>
      </div>

      {/* Help tip */}
      <div className="day-step__help">
        <div className="day-step__help-icon">❓</div>
        <div className="day-step__help-content">
          <strong>HOW MUCH SHOULD I BRING?</strong>
          <p>
            Only bring what you can afford to lose completely. A fun day at the track
            shouldn't break the bank. Most casual bettors bring $100-300. Serious players
            bring $500+.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="day-step__actions">
        <button className="day-step__back-btn" onClick={onBack}>
          <span className="material-icons">arrow_back</span>
          <span>BACK</span>
        </button>

        <button
          className="day-step__next-btn"
          onClick={onNext}
          disabled={!isValidBankroll}
        >
          <span>NEXT</span>
          <span className="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

export default DayBankrollStep;
