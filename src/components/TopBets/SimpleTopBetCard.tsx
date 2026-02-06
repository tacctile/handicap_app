/**
 * SimpleTopBetCard Component
 *
 * Ultra-compact bet card for the TOP BETS simple view.
 * Shows bet type, horses, cost, return, script, and copy button.
 * NO explanations, NO expandable sections.
 */

import React from 'react';
import type { TopBet } from '../../lib/betting/topBetsGenerator';

// ============================================================================
// TYPES
// ============================================================================

export interface ScaledTopBet extends TopBet {
  scaledCost: number;
  scaledWhatToSay: string;
  scaledPayout: string;
}

export interface SimpleTopBetCardProps {
  /** The bet data */
  bet: ScaledTopBet;
  /** Display rank (1-20) */
  rank: number;
  /** Whether this card was just copied */
  isCopied: boolean;
  /** Callback when copy button is clicked */
  onCopy: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const SimpleTopBetCard: React.FC<SimpleTopBetCardProps> = ({
  bet,
  rank,
  isCopied,
  onCopy,
}) => {
  // Format horse display: #4 FREE DROP BACH or #4-#6 for multi-horse
  const horseDisplay = formatHorseDisplay(bet);

  // Get rank color styling
  const rankStyle = getRankStyle(rank);

  return (
    <div className={`simple-bet-card ${rank % 2 === 0 ? 'simple-bet-card--even' : ''}`}>
      {/* Rank Badge */}
      <div className="simple-bet-card__rank" style={rankStyle}>
        {rank}
      </div>

      {/* Content Column */}
      <div className="simple-bet-card__content">
        {/* Bet Type + Horses */}
        <div className="simple-bet-card__header">
          <span className="simple-bet-card__type">{bet.betType}</span>
          <span className="simple-bet-card__horses">{horseDisplay}</span>
        </div>

        {/* Cost + Return */}
        <div className="simple-bet-card__stats">
          <span className="simple-bet-card__cost">${bet.scaledCost}</span>
          <span className="simple-bet-card__separator">·</span>
          <span className="simple-bet-card__return">Return: {bet.scaledPayout}</span>
        </div>

        {/* Window Script */}
        <div className="simple-bet-card__script">"{bet.scaledWhatToSay}"</div>
      </div>

      {/* Copy Button */}
      <button
        className={`simple-bet-card__copy ${isCopied ? 'simple-bet-card__copy--copied' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        aria-label="Copy bet script"
      >
        {isCopied ? 'Copied!' : 'COPY'}
      </button>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format horse display based on bet type
 * Single horse: #4 FREE DROP BACH
 * Multi horse: #4-#6 or #4-#6-#1
 */
function formatHorseDisplay(bet: ScaledTopBet): string {
  if (bet.horses.length === 1) {
    const horse = bet.horses[0]!;
    return `#${horse.programNumber} ${horse.name}`;
  }

  // For multi-horse bets with positions, show different format
  if (bet.internalType === 'EXACTA_STRAIGHT' || bet.internalType === 'TRIFECTA_STRAIGHT') {
    return bet.horses.map((h) => `#${h.programNumber}`).join(' over ');
  }

  // For box bets, show hyphenated numbers
  return bet.horses.map((h) => `#${h.programNumber}`).join('-');
}

/**
 * Get rank styling (background color and text)
 */
function getRankStyle(rank: number): React.CSSProperties {
  if (rank <= 3) {
    return { backgroundColor: 'var(--color-primary)', color: '#ffffff' }; // Primary teal for top 3
  }
  if (rank <= 7) {
    return { backgroundColor: 'var(--color-primary-hover)', color: '#ffffff' }; // Darker teal for 4-7
  }
  if (rank <= 12) {
    return { backgroundColor: '#1b7583', color: '#ffffff' }; // Even darker for 8-12
  }
  return { backgroundColor: 'var(--color-border-prominent)', color: '#9CA3AF' }; // Subtle gray for 13-20
}

export default SimpleTopBetCard;
