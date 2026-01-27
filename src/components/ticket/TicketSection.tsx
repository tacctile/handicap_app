import React from 'react';
import { TicketLine, type TicketLineProps } from './TicketLine';

// ============================================================================
// TYPES
// ============================================================================

export interface TicketSectionProps {
  /** Section title (e.g., "STRAIGHT BETS", "EXOTIC BETS") */
  title: string;
  /** Array of ticket lines to display */
  lines: TicketLineProps[];
  /** Subtotal for this section */
  subtotal: number;
}

// ============================================================================
// STYLES
// ============================================================================

const sectionContainerStyles: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)',
  marginBottom: 'var(--space-3)',
  overflow: 'hidden',
};

const sectionHeaderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border-subtle)',
};

const sectionTitleStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.75px',
};

const sectionContentStyles: React.CSSProperties = {
  padding: '0 var(--space-3)',
};

const subtotalRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--bg-elevated)',
  borderTop: '1px solid var(--border-subtle)',
};

const subtotalLabelStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-secondary)',
};

const subtotalAmountStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
};

const emptyStateStyles: React.CSSProperties = {
  padding: 'var(--space-3)',
  textAlign: 'center',
  color: 'var(--text-tertiary)',
  fontSize: 'var(--text-sm)',
  fontStyle: 'italic',
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
 * TicketSection component groups related bet lines under a header.
 * Displays section title, all lines, and a subtotal row.
 */
export function TicketSection({
  title,
  lines,
  subtotal,
}: TicketSectionProps): React.ReactElement {
  const hasLines = lines.length > 0;

  return (
    <div style={sectionContainerStyles}>
      {/* Section Header */}
      <div style={sectionHeaderStyles}>
        <span style={sectionTitleStyles}>{title}</span>
        {hasLines && (
          <span style={{ ...sectionTitleStyles, color: 'var(--text-secondary)' }}>
            {lines.length} {lines.length === 1 ? 'bet' : 'bets'}
          </span>
        )}
      </div>

      {/* Section Content */}
      {hasLines ? (
        <>
          <div style={sectionContentStyles}>
            {lines.map((line, index) => (
              <TicketLine
                key={`${line.betType}-${line.selections}-${index}`}
                {...line}
              />
            ))}
          </div>

          {/* Subtotal Row */}
          <div style={subtotalRowStyles}>
            <span style={subtotalLabelStyles}>Subtotal</span>
            <span style={subtotalAmountStyles}>{formatDollarAmount(subtotal)}</span>
          </div>
        </>
      ) : (
        <div style={emptyStateStyles}>No bets in this section</div>
      )}
    </div>
  );
}

export default TicketSection;
