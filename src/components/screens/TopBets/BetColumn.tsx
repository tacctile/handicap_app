import React from 'react';
import { BetCard } from './BetCard';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Bet recommendation structure for display in columns
 */
export interface BetRecommendation {
  /** Race number */
  raceNumber: number;
  /** Primary horse name */
  horseName: string;
  /** Horse program number */
  horseNumber: number;
  /** Bet type */
  betType: 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA' | 'SUPERFECTA';
  /** Current odds string */
  odds: string;
  /** Confidence percentage */
  confidence: number;
  /** Kelly bet amount */
  kellyBet?: number;
  /** Expected value */
  expectedValue?: number;
  /** Tier classification */
  tier: 1 | 2 | 3 | null;
  /** Second horse (for exotics) */
  secondHorse?: string;
  /** Third horse (for exotics) */
  thirdHorse?: string;
}

export interface BetColumnProps {
  /** Type of bets in this column */
  betType: 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA';
  /** Bets to display */
  bets: BetRecommendation[];
  /** Handler when user selects a bet (navigates to race) */
  onSelectBet: (raceNumber: number) => void;
}

// ============================================================================
// STYLES
// ============================================================================

const columnStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  minWidth: '200px',
  flex: 1,
};

const headerStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-secondary)',
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: 'var(--space-2) 0',
  borderBottom: '1px solid var(--border-subtle)',
};

const betListStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  flex: 1,
  overflow: 'auto',
};

const emptyStateStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  minHeight: '120px',
  color: 'var(--text-tertiary)',
  fontSize: 'var(--text-sm)',
  textAlign: 'center',
  padding: 'var(--space-4)',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * BetColumn displays a vertical column of bet recommendations
 * for a specific bet type (WIN, PLACE, SHOW, etc.)
 */
export function BetColumn({ betType, bets, onSelectBet }: BetColumnProps): React.ReactElement {
  const displayName = betType.charAt(0) + betType.slice(1).toLowerCase();

  return (
    <div style={columnStyles}>
      {/* Column Header */}
      <div style={headerStyles}>{betType}</div>

      {/* Bet List */}
      <div style={betListStyles}>
        {bets.length > 0 ? (
          bets.map((bet, index) => (
            <BetCard
              key={`${bet.raceNumber}-${bet.horseNumber}-${index}`}
              raceNumber={bet.raceNumber}
              horseName={bet.horseName}
              horseNumber={bet.horseNumber}
              betType={bet.betType}
              odds={bet.odds}
              confidence={bet.confidence}
              kellyBet={bet.kellyBet}
              expectedValue={bet.expectedValue}
              tier={bet.tier}
              secondHorse={bet.secondHorse}
              thirdHorse={bet.thirdHorse}
              onClick={() => onSelectBet(bet.raceNumber)}
            />
          ))
        ) : (
          <div style={emptyStateStyles}>No {displayName} plays</div>
        )}
      </div>
    </div>
  );
}

export default BetColumn;
