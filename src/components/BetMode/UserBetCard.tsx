/**
 * UserBetCard Component
 *
 * Displays the user's custom-built bet with:
 * - Bet type and selected horses
 * - Cost and potential return
 * - "What to say" script with copy button
 */

import React, { useState } from 'react';
import { formatReturnRange } from '../../lib/betting/returnEstimates';
import type { SingleBet, BetTypeConfig } from '../../lib/betting/betTypes';
import './UserBetCard.css';

interface UserBetCardProps {
  /** The user's bet */
  bet: SingleBet;
  /** Bet type configuration */
  betTypeConfig: BetTypeConfig;
}

export const UserBetCard: React.FC<UserBetCardProps> = ({ bet, betTypeConfig }) => {
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

  const formattedReturn = formatReturnRange(bet.potentialReturn);

  return (
    <div className="user-bet-card">
      {/* Header */}
      <div className="user-bet-card__header">
        <div className="user-bet-card__type">
          <span className="user-bet-card__type-name">{betTypeConfig.name}</span>
          {bet.combinations > 1 && (
            <span className="user-bet-card__combinations">
              {bet.combinations} combinations
            </span>
          )}
        </div>
        <div className="user-bet-card__cost">${bet.totalCost}</div>
      </div>

      {/* Horse Info */}
      <div className="user-bet-card__horses">
        <div className="user-bet-card__horses-label">
          {bet.horses.length === 1 ? 'Horse:' : 'Horses:'}
        </div>
        <div className="user-bet-card__horses-list">
          {bet.horses.map((pp, i) => (
            <span key={pp} className="user-bet-card__horse">
              <span className="user-bet-card__horse-pp">#{pp}</span>
              {bet.horseNames[i] && (
                <span className="user-bet-card__horse-name">{bet.horseNames[i]}</span>
              )}
              {i < bet.horses.length - 1 && (
                <span className="user-bet-card__horse-separator">
                  {betTypeConfig.isBox ? ', ' : ' → '}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Potential Return */}
      <div className="user-bet-card__return">
        <span className="user-bet-card__return-label">Potential return:</span>
        <span className="user-bet-card__return-value">{formattedReturn}</span>
      </div>

      {/* What to Say */}
      <div className="user-bet-card__what-to-say">
        <div className="user-bet-card__what-to-say-header">
          <span className="user-bet-card__what-to-say-icon">📝</span>
          <span className="user-bet-card__what-to-say-label">WHAT TO SAY AT THE WINDOW:</span>
        </div>
        <div className="user-bet-card__what-to-say-box">
          <span className="user-bet-card__what-to-say-text">"{bet.whatToSay}"</span>
          <button
            className={`user-bet-card__copy-btn ${copied ? 'user-bet-card__copy-btn--copied' : ''}`}
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            <span className="material-icons">{copied ? 'check' : 'content_copy'}</span>
            <span className="user-bet-card__copy-text">{copied ? 'COPIED' : 'COPY'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserBetCard;
