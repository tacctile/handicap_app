/**
 * DayStyleStep Component
 *
 * Step 3 of day setup: User sets their risk style.
 * This determines bet size allocation across races.
 */

import React from 'react';
import type { RiskStyle, ExperienceLevel } from '../../../lib/betting/betTypes';
import './DaySetup.css';

interface StyleConfig {
  key: RiskStyle;
  icon: string;
  name: string;
  quote: string;
  bullets: string[];
}

const STYLE_CONFIGS: StyleConfig[] = [
  {
    key: 'safe',
    icon: '🛡️',
    name: 'SAFE',
    quote: 'I want to cash tickets and make my money last.',
    bullets: [
      'Mostly Place and Show bets',
      'Smaller bets spread across more races',
      'Lower highs, but fewer losses',
    ],
  },
  {
    key: 'balanced',
    icon: '⚖️',
    name: 'BALANCED',
    quote: 'Mix it up. Some safe bets, some swings.',
    bullets: [
      'Place bets plus exactas and trifectas',
      'More on value races, less on pass races',
      'Best of both worlds',
    ],
  },
  {
    key: 'aggressive',
    icon: '🔥',
    name: 'AGGRESSIVE',
    quote: "I'm here for big scores. Swing for the fences.",
    bullets: [
      'Heavy on exactas, trifectas, superfectas',
      'Bigger bets on value plays',
      'High risk, high reward',
    ],
  },
];

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  standard: 'Standard',
  expert: 'Expert',
};

interface DayStyleStepProps {
  /** User's bankroll for display */
  bankroll: number;
  /** User's experience level for display */
  experienceLevel: ExperienceLevel;
  /** Selected risk style */
  riskStyle: RiskStyle | null;
  /** Callback when risk style changes */
  onStyleChange: (style: RiskStyle) => void;
  /** Callback to go back to experience step */
  onBack: () => void;
  /** Callback when user clicks "See My Plan" */
  onSeePlan: () => void;
}

export const DayStyleStep: React.FC<DayStyleStepProps> = ({
  bankroll,
  experienceLevel,
  riskStyle,
  onStyleChange,
  onBack,
  onSeePlan,
}) => {
  return (
    <div className="day-step">
      {/* Step indicator */}
      <div className="day-step__indicator">
        📅 PLAN YOUR DAY — STEP 3 OF 3
      </div>

      {/* Header */}
      <div className="day-step__header">
        <span className="day-step__icon">🎯</span>
        <h2 className="day-step__title">HOW DO YOU LIKE TO PLAY?</h2>
      </div>

      {/* Context bar */}
      <div className="day-step__context-bar day-step__context-bar--wide">
        <div className="day-step__context-group">
          <span className="day-step__context-label">Bankroll:</span>
          <span className="day-step__context-value">${bankroll}</span>
          <span className="day-step__context-separator">•</span>
          <span className="day-step__context-label">Level:</span>
          <span className="day-step__context-value">{EXPERIENCE_LABELS[experienceLevel]}</span>
        </div>
        <button className="day-step__context-change" onClick={onBack}>
          <span className="material-icons">edit</span>
          <span>Change</span>
        </button>
      </div>

      {/* Style cards */}
      <div className="day-step__cards">
        {STYLE_CONFIGS.map((config) => (
          <button
            key={config.key}
            className={`day-card ${riskStyle === config.key ? 'day-card--selected' : ''}`}
            onClick={() => onStyleChange(config.key)}
          >
            <div className="day-card__header">
              <span className="day-card__icon">{config.icon}</span>
              <span className="day-card__name">{config.name}</span>
            </div>

            <p className="day-card__quote">"{config.quote}"</p>

            <ul className="day-card__bullets">
              {config.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>

            {riskStyle === config.key && (
              <div className="day-card__selected-indicator">
                <span className="material-icons">check_circle</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="day-step__actions">
        <button className="day-step__back-btn" onClick={onBack}>
          <span className="material-icons">arrow_back</span>
          <span>BACK</span>
        </button>

        <button
          className="day-step__next-btn day-step__next-btn--primary"
          onClick={onSeePlan}
          disabled={!riskStyle}
        >
          <span>SEE MY PLAN</span>
          <span className="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

export default DayStyleStep;
