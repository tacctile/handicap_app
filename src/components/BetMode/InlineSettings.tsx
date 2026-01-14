/**
 * InlineSettings Component
 *
 * Inline dropdowns for budget, style, and bet type selection at the top of bet mode.
 * Replaces the multi-step wizard with instant, always-visible controls.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  BUDGET_PRESETS,
  STYLE_CONFIGS,
  USER_BET_TYPE_CONFIGS,
  type RiskStyle,
  type UserSelectableBetType,
} from '../../lib/betting/betTypes';
import './InlineSettings.css';

interface InlineSettingsProps {
  /** Current budget */
  budget: number;
  /** Callback when budget changes */
  onBudgetChange: (budget: number) => void;
  /** Current risk style */
  riskStyle: RiskStyle;
  /** Callback when style changes */
  onStyleChange: (style: RiskStyle) => void;
  /** Current bet type */
  betType?: UserSelectableBetType;
  /** Callback when bet type changes */
  onBetTypeChange?: (betType: UserSelectableBetType) => void;
  /** Callback to open day plan modal */
  onOpenDayPlan?: () => void;
  /** Whether in day plan mode (budget locked) */
  isDayPlanActive?: boolean;
  /** Day plan budget label */
  dayPlanBudgetLabel?: string;
  /** Whether to disable controls */
  disabled?: boolean;
}

export const InlineSettings: React.FC<InlineSettingsProps> = ({
  budget,
  onBudgetChange,
  riskStyle,
  onStyleChange,
  betType = 'WIN',
  onBetTypeChange,
  onOpenDayPlan,
  isDayPlanActive = false,
  dayPlanBudgetLabel,
  disabled = false,
}) => {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [betTypeOpen, setBetTypeOpen] = useState(false);
  const [customBudget, setCustomBudget] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const budgetRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const betTypeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (budgetRef.current && !budgetRef.current.contains(event.target as Node)) {
        setBudgetOpen(false);
        setShowCustomInput(false);
      }
      if (styleRef.current && !styleRef.current.contains(event.target as Node)) {
        setStyleOpen(false);
      }
      if (betTypeRef.current && !betTypeRef.current.contains(event.target as Node)) {
        setBetTypeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBudgetSelect = (amount: number) => {
    onBudgetChange(amount);
    setBudgetOpen(false);
    setShowCustomInput(false);
  };

  const handleCustomBudgetSubmit = () => {
    const value = parseInt(customBudget, 10);
    if (!isNaN(value) && value >= 2 && value <= 1000) {
      onBudgetChange(value);
      setBudgetOpen(false);
      setShowCustomInput(false);
      setCustomBudget('');
    }
  };

  const handleStyleSelect = (style: RiskStyle) => {
    onStyleChange(style);
    setStyleOpen(false);
  };

  const handleBetTypeSelect = (type: UserSelectableBetType) => {
    if (onBetTypeChange) {
      onBetTypeChange(type);
    }
    setBetTypeOpen(false);
  };

  const styleConfig = STYLE_CONFIGS[riskStyle];
  const currentBetTypeConfig = USER_BET_TYPE_CONFIGS.find((c) => c.type === betType);

  return (
    <div className="inline-settings">
      <span className="inline-settings__label">SETTINGS:</span>

      {/* Budget Dropdown */}
      <div className="inline-settings__dropdown" ref={budgetRef}>
        <button
          className={`inline-settings__trigger ${budgetOpen ? 'inline-settings__trigger--open' : ''} ${isDayPlanActive ? 'inline-settings__trigger--locked' : ''}`}
          onClick={() => !disabled && !isDayPlanActive && setBudgetOpen(!budgetOpen)}
          disabled={disabled || isDayPlanActive}
        >
          <span className="inline-settings__trigger-label">Budget:</span>
          <span className="inline-settings__trigger-value">
            {isDayPlanActive && dayPlanBudgetLabel ? dayPlanBudgetLabel : `$${budget}`}
          </span>
          {!isDayPlanActive && (
            <span className="material-icons inline-settings__trigger-icon">
              {budgetOpen ? 'expand_less' : 'expand_more'}
            </span>
          )}
          {isDayPlanActive && (
            <span className="material-icons inline-settings__lock-icon">lock</span>
          )}
        </button>

        {budgetOpen && (
          <div className="inline-settings__menu inline-settings__menu--budget">
            {BUDGET_PRESETS.map((amount) => (
              <button
                key={amount}
                className={`inline-settings__menu-item ${budget === amount ? 'inline-settings__menu-item--selected' : ''}`}
                onClick={() => handleBudgetSelect(amount)}
              >
                ${amount}
                {budget === amount && (
                  <span className="material-icons inline-settings__check">check</span>
                )}
              </button>
            ))}
            <div className="inline-settings__menu-divider" />
            {showCustomInput ? (
              <div className="inline-settings__custom-input">
                <span className="inline-settings__custom-prefix">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customBudget}
                  onChange={(e) => setCustomBudget(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomBudgetSubmit()}
                  placeholder="2-1000"
                  autoFocus
                  maxLength={4}
                />
                <button
                  className="inline-settings__custom-submit"
                  onClick={handleCustomBudgetSubmit}
                >
                  <span className="material-icons">check</span>
                </button>
              </div>
            ) : (
              <button
                className="inline-settings__menu-item inline-settings__menu-item--custom"
                onClick={() => setShowCustomInput(true)}
              >
                Custom...
              </button>
            )}
          </div>
        )}
      </div>

      {/* Style Dropdown */}
      <div className="inline-settings__dropdown" ref={styleRef}>
        <button
          className={`inline-settings__trigger ${styleOpen ? 'inline-settings__trigger--open' : ''}`}
          onClick={() => !disabled && setStyleOpen(!styleOpen)}
          disabled={disabled}
        >
          <span className="inline-settings__trigger-label">Style:</span>
          <span className="inline-settings__trigger-value">
            {styleConfig.icon} {styleConfig.name}
          </span>
          <span className="material-icons inline-settings__trigger-icon">
            {styleOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {styleOpen && (
          <div className="inline-settings__menu inline-settings__menu--style">
            {Object.values(STYLE_CONFIGS).map((config) => (
              <button
                key={config.key}
                className={`inline-settings__menu-item inline-settings__menu-item--style ${riskStyle === config.key ? 'inline-settings__menu-item--selected' : ''}`}
                onClick={() => handleStyleSelect(config.key)}
              >
                <div className="inline-settings__style-header">
                  <span className="inline-settings__style-icon">{config.icon}</span>
                  <span className="inline-settings__style-name">{config.name}</span>
                  {riskStyle === config.key && (
                    <span className="material-icons inline-settings__check">check</span>
                  )}
                </div>
                <p className="inline-settings__style-desc">{config.tagline}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bet Type Dropdown */}
      {onBetTypeChange && (
        <div className="inline-settings__dropdown" ref={betTypeRef}>
          <button
            className={`inline-settings__trigger inline-settings__trigger--bet-type ${betTypeOpen ? 'inline-settings__trigger--open' : ''}`}
            onClick={() => !disabled && setBetTypeOpen(!betTypeOpen)}
            disabled={disabled}
          >
            <span className="inline-settings__trigger-label">Bet:</span>
            <span className="inline-settings__trigger-value">
              {currentBetTypeConfig?.name || 'Win'}
            </span>
            <span className="material-icons inline-settings__trigger-icon">
              {betTypeOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {betTypeOpen && (
            <div className="inline-settings__menu inline-settings__menu--bet-type">
              {/* Straight Bets */}
              <div className="inline-settings__menu-group">
                <span className="inline-settings__menu-group-label">Straight Bets</span>
                {USER_BET_TYPE_CONFIGS.filter((c) => ['WIN', 'PLACE', 'SHOW'].includes(c.type)).map(
                  (config) => (
                    <button
                      key={config.type}
                      className={`inline-settings__menu-item ${betType === config.type ? 'inline-settings__menu-item--selected' : ''}`}
                      onClick={() => handleBetTypeSelect(config.type)}
                    >
                      <span className="inline-settings__bet-type-name">{config.name}</span>
                      <span className="inline-settings__bet-type-horses">
                        {config.minHorses} horse
                      </span>
                      {betType === config.type && (
                        <span className="material-icons inline-settings__check">check</span>
                      )}
                    </button>
                  )
                )}
              </div>

              <div className="inline-settings__menu-divider" />

              {/* Exotic Bets */}
              <div className="inline-settings__menu-group">
                <span className="inline-settings__menu-group-label">Exotic Bets</span>
                {USER_BET_TYPE_CONFIGS.filter((c) =>
                  ['EXACTA', 'EXACTA_BOX', 'QUINELLA', 'TRIFECTA', 'TRIFECTA_BOX', 'SUPERFECTA_BOX'].includes(
                    c.type
                  )
                ).map((config) => (
                  <button
                    key={config.type}
                    className={`inline-settings__menu-item ${betType === config.type ? 'inline-settings__menu-item--selected' : ''}`}
                    onClick={() => handleBetTypeSelect(config.type)}
                  >
                    <span className="inline-settings__bet-type-name">{config.name}</span>
                    <span className="inline-settings__bet-type-horses">
                      {config.isBox
                        ? `${config.minHorses}-${config.maxHorses} horses`
                        : `${config.minHorses} horses`}
                    </span>
                    {betType === config.type && (
                      <span className="material-icons inline-settings__check">check</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plan Full Day Button */}
      {onOpenDayPlan && !isDayPlanActive && (
        <button
          className="inline-settings__day-plan-btn"
          onClick={onOpenDayPlan}
          disabled={disabled}
        >
          <span>Plan Full Day</span>
          <span className="material-icons">arrow_forward</span>
        </button>
      )}

      {/* Clear Day Plan Button */}
      {isDayPlanActive && onOpenDayPlan && (
        <button
          className="inline-settings__clear-plan-btn"
          onClick={onOpenDayPlan}
        >
          <span className="material-icons">close</span>
          <span>Clear Day Plan</span>
        </button>
      )}
    </div>
  );
};

export default InlineSettings;
