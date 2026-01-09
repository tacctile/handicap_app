/**
 * TopBetCard Component
 *
 * Individual bet card showing all details for a single top bet.
 * Collapsible sections for explanation and reasoning.
 */

import React, { useState, useCallback } from 'react';
import type { TopBet } from '../../lib/betting/topBetsGenerator';

interface TopBetCardProps {
  bet: TopBet;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const TopBetCard: React.FC<TopBetCardProps> = ({
  bet,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  // Handle copy to clipboard
  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(bet.whatToSay);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 1500);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    },
    [bet.whatToSay]
  );

  // Get risk tier color class
  const getRiskTierClass = () => {
    switch (bet.riskTier) {
      case 'Conservative':
        return 'top-bet-card--conservative';
      case 'Moderate':
        return 'top-bet-card--moderate';
      case 'Aggressive':
        return 'top-bet-card--aggressive';
      default:
        return '';
    }
  };

  // Get risk tier badge color
  const getRiskTierBadgeClass = () => {
    switch (bet.riskTier) {
      case 'Conservative':
        return 'top-bet-card__badge--conservative';
      case 'Moderate':
        return 'top-bet-card__badge--moderate';
      case 'Aggressive':
        return 'top-bet-card__badge--aggressive';
      default:
        return '';
    }
  };

  // Format horses display
  const formatHorses = () => {
    return bet.horses.map((h, i) => {
      const positionLabel = h.position ? ` (${h.position})` : '';
      return (
        <span key={i} className="top-bet-card__horse">
          {h.name} <span className="top-bet-card__horse-number">#{h.programNumber}</span>
          {positionLabel && <span className="top-bet-card__horse-position">{positionLabel}</span>}
        </span>
      );
    });
  };

  // Format expected value with sign
  const formatEV = (ev: number) => {
    const sign = ev >= 0 ? '+' : '';
    return `${sign}$${ev.toFixed(2)}`;
  };

  return (
    <div
      className={`top-bet-card ${getRiskTierClass()} ${isExpanded ? 'top-bet-card--expanded' : ''}`}
      onClick={onToggleExpand}
    >
      {/* Header Row */}
      <div className="top-bet-card__header">
        <span className="top-bet-card__rank">#{bet.rank} of 25</span>
        <span className={`top-bet-card__badge ${getRiskTierBadgeClass()}`}>
          {bet.riskTier.toUpperCase()}
        </span>
      </div>

      {/* Bet Type and Horses */}
      <div className="top-bet-card__main">
        <div className="top-bet-card__type">{bet.betType}</div>
        <div className="top-bet-card__horses">{formatHorses()}</div>
      </div>

      {/* Stats Row */}
      <div className="top-bet-card__stats">
        <div className="top-bet-card__stat">
          <span className="top-bet-card__stat-icon">$</span>
          <span className="top-bet-card__stat-label">Cost:</span>
          <span className="top-bet-card__stat-value">${bet.cost}</span>
        </div>
        <div className="top-bet-card__stat">
          <span className="top-bet-card__stat-icon">+</span>
          <span className="top-bet-card__stat-label">Est. Payout:</span>
          <span className="top-bet-card__stat-value">{bet.estimatedPayout}</span>
        </div>
        <div className="top-bet-card__stat">
          <span className="top-bet-card__stat-icon">%</span>
          <span className="top-bet-card__stat-label">Probability:</span>
          <span className="top-bet-card__stat-value">{bet.probability.toFixed(1)}%</span>
        </div>
        <div className="top-bet-card__stat top-bet-card__stat--ev">
          <span className="top-bet-card__stat-icon">EV</span>
          <span className="top-bet-card__stat-label">Expected Value:</span>
          <span
            className={`top-bet-card__stat-value ${bet.expectedValue >= 0 ? 'top-bet-card__stat-value--positive' : 'top-bet-card__stat-value--negative'}`}
          >
            {formatEV(bet.expectedValue)}
          </span>
        </div>
      </div>

      {/* What to Say - Always visible */}
      <div className="top-bet-card__say">
        <div className="top-bet-card__say-label">
          <span className="top-bet-card__say-icon">&#127908;</span>
          What to say at window:
        </div>
        <div className="top-bet-card__say-content">
          <span className="top-bet-card__say-text">"{bet.whatToSay}"</span>
          <button
            className={`top-bet-card__copy-btn ${copySuccess ? 'top-bet-card__copy-btn--success' : ''}`}
            onClick={handleCopy}
            aria-label="Copy to clipboard"
          >
            {copySuccess ? 'Copied!' : 'COPY'}
          </button>
        </div>
      </div>

      {/* Expandable Sections */}
      {isExpanded && (
        <div className="top-bet-card__details">
          {/* What this bet is */}
          <div className="top-bet-card__section">
            <div className="top-bet-card__section-label">
              <span className="material-icons">info</span>
              What this bet is:
            </div>
            <div className="top-bet-card__section-content">{bet.whatThisBetIs}</div>
          </div>

          {/* Why this bet */}
          <div className="top-bet-card__section">
            <div className="top-bet-card__section-label">
              <span className="material-icons">psychology</span>
              Why this bet:
            </div>
            <div className="top-bet-card__section-content top-bet-card__section-content--reason">
              {bet.whyThisBet}
            </div>
          </div>

          {/* Combinations info */}
          <div className="top-bet-card__meta">
            <span className="top-bet-card__meta-item">
              Covers {bet.combinationsInvolved} combination
              {bet.combinationsInvolved !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Expand indicator */}
      <div className="top-bet-card__expand-indicator">
        <span className="material-icons">{isExpanded ? 'expand_less' : 'expand_more'}</span>
        <span className="top-bet-card__expand-text">
          {isExpanded ? 'Show less' : 'Why this bet?'}
        </span>
      </div>
    </div>
  );
};

export default TopBetCard;
