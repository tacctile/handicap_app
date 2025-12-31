/**
 * ExplanationTooltip Component
 *
 * Expandable tooltip for explaining betting terms and bet rationale.
 * Designed to be beginner-friendly with plain English explanations.
 */

import React, { useState } from 'react';
import './ExplanationTooltip.css';

interface ExplanationTooltipProps {
  /** Question/title shown when collapsed */
  question: string;
  /** Full explanation shown when expanded */
  explanation: string;
  /** Optional icon (default: ❓) */
  icon?: string;
  /** Start expanded */
  defaultExpanded?: boolean;
  /** Compact mode (smaller text) */
  compact?: boolean;
}

export const ExplanationTooltip: React.FC<ExplanationTooltipProps> = ({
  question,
  explanation,
  icon = '❓',
  defaultExpanded = false,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`explanation-tooltip ${compact ? 'explanation-tooltip--compact' : ''}`}>
      <button
        className={`explanation-tooltip__trigger ${isExpanded ? 'explanation-tooltip__trigger--expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="explanation-tooltip__icon">{icon}</span>
        <span className="explanation-tooltip__question">{question}</span>
        <span className="material-icons explanation-tooltip__chevron">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isExpanded && (
        <div className="explanation-tooltip__content">
          <p className="explanation-tooltip__text">{explanation}</p>
        </div>
      )}
    </div>
  );
};

/**
 * BetTypeTooltip - Specialized tooltip for explaining bet types
 */
interface BetTypeTooltipProps {
  betType: string;
  description: string;
  howToRead: string;
  example: string;
}

export const BetTypeTooltip: React.FC<BetTypeTooltipProps> = ({
  betType,
  description,
  howToRead,
  example,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bet-type-tooltip">
      <button
        className={`bet-type-tooltip__trigger ${isExpanded ? 'bet-type-tooltip__trigger--expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="bet-type-tooltip__icon">❓</span>
        <span className="bet-type-tooltip__question">What's a {betType}?</span>
        <span className="material-icons bet-type-tooltip__chevron">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isExpanded && (
        <div className="bet-type-tooltip__content">
          <div className="bet-type-tooltip__section">
            <strong>What it means:</strong>
            <p>{description}</p>
          </div>
          <div className="bet-type-tooltip__section">
            <strong>How to read it:</strong>
            <p>{howToRead}</p>
          </div>
          <div className="bet-type-tooltip__section">
            <strong>Example:</strong>
            <p>{example}</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * WhyBetTooltip - Explains why we're making a specific bet
 */
interface WhyBetTooltipProps {
  explanation: string;
  compact?: boolean;
}

export const WhyBetTooltip: React.FC<WhyBetTooltipProps> = ({ explanation, compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`why-bet-tooltip ${compact ? 'why-bet-tooltip--compact' : ''}`}>
      <button
        className={`why-bet-tooltip__trigger ${isExpanded ? 'why-bet-tooltip__trigger--expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="why-bet-tooltip__icon">❓</span>
        <span className="why-bet-tooltip__question">WHY THIS BET?</span>
        <span className="material-icons why-bet-tooltip__chevron">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isExpanded && (
        <div className="why-bet-tooltip__content">
          <p className="why-bet-tooltip__text">{explanation}</p>
        </div>
      )}
    </div>
  );
};

export default ExplanationTooltip;
