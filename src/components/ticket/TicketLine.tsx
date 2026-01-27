import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface TicketLineProps {
  /** Bet type label (e.g., "WIN", "PLACE", "EXACTA BOX") */
  betType: string;
  /** Selection display (e.g., "#3 PHOBIA" or "#3/#5" or "#3/#5/#7") */
  selections: string;
  /** Dollar amount for this bet */
  amount: number;
  /** Odds display if available (e.g., "8-1") */
  odds?: string;
  /** Potential payout if calculable */
  potentialPayout?: number;
}

// ============================================================================
// STYLES
// ============================================================================

const lineContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) 0',
  borderBottom: '1px solid var(--border-subtle)',
};

const leftSectionStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  flex: 1,
  minWidth: 0,
};

const betTypeStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const selectionsStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const rightSectionStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '2px',
  marginLeft: 'var(--space-3)',
};

const amountStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
};

const oddsStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  fontVariantNumeric: 'tabular-nums',
};

const payoutStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--status-success)',
  fontVariantNumeric: 'tabular-nums',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format dollar amount for display
 */
function formatDollarAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TicketLine component displays a single bet line in receipt-style format.
 * Shows bet type, selections, and amount with optional odds and payout.
 */
export function TicketLine({
  betType,
  selections,
  amount,
  odds,
  potentialPayout,
}: TicketLineProps): React.ReactElement {
  return (
    <div style={lineContainerStyles}>
      <div style={leftSectionStyles}>
        <span style={betTypeStyles}>{betType}</span>
        <span style={selectionsStyles}>{selections}</span>
      </div>
      <div style={rightSectionStyles}>
        <span style={amountStyles}>{formatDollarAmount(amount)}</span>
        {odds && <span style={oddsStyles}>{odds}</span>}
        {potentialPayout !== undefined && potentialPayout > 0 && (
          <span style={payoutStyles}>→ {formatDollarAmount(potentialPayout)}</span>
        )}
      </div>
    </div>
  );
}

export default TicketLine;
