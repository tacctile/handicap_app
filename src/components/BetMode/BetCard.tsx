/**
 * BetCard Component
 *
 * Displays a single bet recommendation with all details:
 * - Bet type and horses
 * - Amount and potential return
 * - "What to say" script with copy button
 * - Expandable explanation
 */

import React, { useState } from 'react';
import { WhyBetTooltip, BetTypeTooltip } from './ExplanationTooltip';
import { BET_EXPLANATIONS, type SingleBet } from '../../lib/betting/betTypes';
import { formatReturnRange } from '../../lib/betting/returnEstimates';
import './BetCard.css';

interface BetCardProps {
  /** Bet data */
  bet: SingleBet;
  /** Bet number for display (1, 2, 3...) */
  betNumber: number;
}

export const BetCard: React.FC<BetCardProps> = ({ bet, betNumber }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bet.whatToSay);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const betTypeInfo = BET_EXPLANATIONS[bet.type] || BET_EXPLANATIONS.PLACE;
  const formattedReturn = formatReturnRange(bet.potentialReturn);

  // Format the horses display
  const horsesDisplay =
    bet.combinations > 1
      ? `${bet.horseNames[0]} WITH ${bet.horseNames.slice(1).join(', ')} (${bet.combinations} combinations × $${bet.amount})`
      : bet.horseNames[0];

  return (
    <div className={`bet-card ${bet.skip ? 'bet-card--skip' : ''}`}>
      {/* Header */}
      <div className="bet-card__header">
        <div className="bet-card__title">
          <span className="bet-card__label">BET {betNumber}:</span>
          <span className="bet-card__type">{bet.type.replace('_', ' ')}</span>
        </div>
        <div className="bet-card__cost">${bet.totalCost}</div>
      </div>

      {/* Divider */}
      <div className="bet-card__divider"></div>

      {/* Horse info */}
      <div className="bet-card__info">
        <div className="bet-card__row">
          <span className="bet-card__info-label">
            {bet.combinations > 1 ? 'Horses:' : 'Horse:'}
          </span>
          <span className="bet-card__info-value">
            #{bet.horses.join(', #')} {bet.horses.length === 1 ? bet.horseNames[0] : ''}
          </span>
        </div>

        {bet.combinations > 1 && (
          <div className="bet-card__row">
            <span className="bet-card__info-label">Coverage:</span>
            <span className="bet-card__info-value">{horsesDisplay}</span>
          </div>
        )}

        <div className="bet-card__row">
          <span className="bet-card__info-label">Potential return:</span>
          <span className="bet-card__info-value bet-card__info-value--highlight">
            {formattedReturn}
          </span>
        </div>
      </div>

      {/* What to say */}
      <div className="bet-card__what-to-say">
        <div className="bet-card__what-to-say-header">
          <span className="bet-card__what-to-say-icon">📝</span>
          <span className="bet-card__what-to-say-label">WHAT TO SAY AT THE WINDOW:</span>
        </div>
        <div className="bet-card__what-to-say-box">
          <span className="bet-card__what-to-say-text">"{bet.whatToSay}"</span>
          <button
            className={`bet-card__copy-btn ${copied ? 'bet-card__copy-btn--copied' : ''}`}
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            <span className="material-icons">{copied ? 'check' : 'content_copy'}</span>
            <span className="bet-card__copy-text">{copied ? 'COPIED' : 'COPY'}</span>
          </button>
        </div>
      </div>

      {/* Expandable explanations */}
      <div className="bet-card__explanations">
        <WhyBetTooltip explanation={bet.explanation} />

        {/* Bet type explanation for exotic bets */}
        {['EXACTA', 'EXACTA_BOX', 'TRIFECTA_KEY', 'TRIFECTA_BOX', 'SUPERFECTA_KEY'].includes(
          bet.type
        ) && (
          <BetTypeTooltip
            betType={betTypeInfo.name}
            description={betTypeInfo.description}
            howToRead={betTypeInfo.howToRead}
            example={betTypeInfo.example}
          />
        )}
      </div>
    </div>
  );
};

/**
 * SkipCard - Shows a horse to skip with explanation
 */
interface SkipCardProps {
  horseName: string;
  programNumber: number;
  odds: string;
  explanation: string;
}

export const SkipCard: React.FC<SkipCardProps> = ({
  horseName,
  programNumber,
  odds,
  explanation,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="skip-card">
      <div className="skip-card__header">
        <span className="skip-card__icon">⚠️</span>
        <span className="skip-card__title">
          SKIP: #{programNumber} {horseName} ({odds})
        </span>
      </div>

      <button className="skip-card__toggle" onClick={() => setIsExpanded(!isExpanded)}>
        <span>{isExpanded ? 'Hide reason' : 'Why skip?'}</span>
        <span className="material-icons">{isExpanded ? 'expand_less' : 'expand_more'}</span>
      </button>

      {isExpanded && (
        <div className="skip-card__content">
          <p>{explanation}</p>
        </div>
      )}
    </div>
  );
};

export default BetCard;
