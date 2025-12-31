/**
 * DayExperienceStep Component
 *
 * Step 2 of day setup: User sets their experience level.
 * This determines which bet types will be recommended.
 */

import React from 'react';
import type { ExperienceLevel } from '../../../lib/betting/betTypes';
import './DaySetup.css';

interface ExperienceLevelConfig {
  key: ExperienceLevel;
  icon: string;
  name: string;
  quote: string;
  bullets: string[];
}

const EXPERIENCE_CONFIGS: ExperienceLevelConfig[] = [
  {
    key: 'beginner',
    icon: '🌱',
    name: 'BEGINNER',
    quote: "I'm new to horse racing.",
    bullets: [
      'We\'ll stick to simple bets: Win, Place, Show.',
      'No confusing exotic bets. Easy to understand.',
    ],
  },
  {
    key: 'standard',
    icon: '📊',
    name: 'STANDARD',
    quote: 'I know the basics. Show me more options.',
    bullets: [
      'Win, Place, Show, plus Exactas and Trifectas.',
      'Good balance of simple and exciting.',
    ],
  },
  {
    key: 'expert',
    icon: '🎓',
    name: 'EXPERT',
    quote: 'Give me everything.',
    bullets: [
      'All bet types including Superfectas, Pick 3s, Pick 4s.',
      'Maximum options, maximum flexibility.',
    ],
  },
];

interface DayExperienceStepProps {
  /** User's bankroll for display */
  bankroll: number;
  /** Selected experience level */
  experienceLevel: ExperienceLevel | null;
  /** Callback when experience level changes */
  onExperienceChange: (level: ExperienceLevel) => void;
  /** Callback to go back to bankroll step */
  onBack: () => void;
  /** Callback when user clicks Next */
  onNext: () => void;
}

export const DayExperienceStep: React.FC<DayExperienceStepProps> = ({
  bankroll,
  experienceLevel,
  onExperienceChange,
  onBack,
  onNext,
}) => {
  return (
    <div className="day-step">
      {/* Step indicator */}
      <div className="day-step__indicator">
        📅 PLAN YOUR DAY — STEP 2 OF 3
      </div>

      {/* Header */}
      <div className="day-step__header">
        <span className="day-step__icon">📚</span>
        <h2 className="day-step__title">WHAT'S YOUR EXPERIENCE LEVEL?</h2>
      </div>

      <p className="day-step__subtitle">
        This helps us show you the right bet types.
      </p>

      {/* Bankroll bar */}
      <div className="day-step__context-bar">
        <span className="day-step__context-label">Bankroll:</span>
        <span className="day-step__context-value">${bankroll}</span>
        <button className="day-step__context-change" onClick={onBack}>
          <span className="material-icons">edit</span>
          <span>Change</span>
        </button>
      </div>

      {/* Experience cards */}
      <div className="day-step__cards">
        {EXPERIENCE_CONFIGS.map((config) => (
          <button
            key={config.key}
            className={`day-card ${experienceLevel === config.key ? 'day-card--selected' : ''}`}
            onClick={() => onExperienceChange(config.key)}
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

            {experienceLevel === config.key && (
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
          className="day-step__next-btn"
          onClick={onNext}
          disabled={!experienceLevel}
        >
          <span>NEXT</span>
          <span className="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

export default DayExperienceStep;
