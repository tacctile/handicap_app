/**
 * StyleStep Component
 *
 * Step 2 of the betting flow: User selects their risk style.
 * Offers three clear options with plain English descriptions.
 */

import React from 'react';
import { STYLE_CONFIGS, type RiskStyle } from '../../lib/betting/betTypes';
import './StyleStep.css';

interface StyleStepProps {
  /** User's budget for display */
  budget: number;
  /** Currently selected style */
  selectedStyle: RiskStyle | null;
  /** Callback when style changes */
  onStyleChange: (style: RiskStyle) => void;
  /** Callback to go back to budget step */
  onBack: () => void;
  /** Callback when user clicks "Show My Bets" */
  onShowBets: () => void;
}

export const StyleStep: React.FC<StyleStepProps> = ({
  budget,
  selectedStyle,
  onStyleChange,
  onBack,
  onShowBets,
}) => {
  const styles = Object.values(STYLE_CONFIGS);

  return (
    <div className="style-step">
      <div className="style-step__header">
        <span className="style-step__icon">🎯</span>
        <h2 className="style-step__title">HOW DO YOU WANT TO PLAY?</h2>
      </div>

      {/* Budget display with change option */}
      <div className="style-step__budget-bar">
        <span className="style-step__budget-label">Budget:</span>
        <span className="style-step__budget-value">${budget}</span>
        <button className="style-step__change-btn" onClick={onBack}>
          <span className="material-icons">edit</span>
          <span>Change</span>
        </button>
      </div>

      {/* Style cards */}
      <div className="style-step__cards">
        {styles.map((style) => (
          <button
            key={style.key}
            className={`style-card ${selectedStyle === style.key ? 'style-card--selected' : ''}`}
            onClick={() => onStyleChange(style.key)}
          >
            <div className="style-card__header">
              <span className="style-card__icon">{style.icon}</span>
              <span className="style-card__name">{style.name}</span>
            </div>

            <p className="style-card__tagline">"{style.tagline}"</p>

            <ul className="style-card__bullets">
              {style.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>

            <div className="style-card__best-for">
              <span className="style-card__best-for-label">Best for:</span>
              <span className="style-card__best-for-value">{style.bestFor}</span>
            </div>

            {selectedStyle === style.key && (
              <div className="style-card__selected-indicator">
                <span className="material-icons">check_circle</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="style-step__actions">
        <button className="style-step__back-btn" onClick={onBack}>
          <span className="material-icons">arrow_back</span>
          <span>BACK</span>
        </button>

        <button className="style-step__submit-btn" onClick={onShowBets} disabled={!selectedStyle}>
          <span>SHOW MY BETS</span>
          <span className="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

export default StyleStep;
