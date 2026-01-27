import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface TicketSummaryProps {
  /** Total investment amount */
  totalInvestment: number;
  /** Expected return amount (optional) */
  expectedReturn?: number;
  /** Template used for ticket construction */
  templateUsed: 'A' | 'B' | 'C' | 'PASS';
  /** Race verdict */
  verdict: 'BET' | 'PASS' | 'CAUTION';
  /** Confidence percentage (0-100) */
  confidence: number;
}

// ============================================================================
// STYLES
// ============================================================================

const summaryContainerStyles: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)',
  padding: 'var(--space-4)',
  marginTop: 'var(--space-3)',
};

const totalRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-3)',
  paddingBottom: 'var(--space-3)',
  borderBottom: '2px solid var(--border-prominent)',
};

const totalLabelStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const totalAmountStyles: React.CSSProperties = {
  fontSize: 'var(--text-2xl)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
};

const expectedReturnRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-3)',
};

const expectedReturnLabelStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
};

const expectedReturnAmountStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--status-success)',
  fontVariantNumeric: 'tabular-nums',
};

const badgesRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
};

const badgeBaseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const confidenceBarContainerStyles: React.CSSProperties = {
  marginTop: 'var(--space-3)',
  paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--border-subtle)',
};

const confidenceLabelRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-1)',
};

const confidenceLabelStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
};

const confidenceValueStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-secondary)',
  fontVariantNumeric: 'tabular-nums',
};

const confidenceBarBackgroundStyles: React.CSSProperties = {
  height: '4px',
  backgroundColor: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-full)',
  overflow: 'hidden',
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

/**
 * Format expected return with + sign
 */
function formatExpectedReturn(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

/**
 * Get template badge styles
 */
function getTemplateBadgeStyles(template: 'A' | 'B' | 'C' | 'PASS'): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    A: { bg: 'rgba(25, 171, 181, 0.15)', text: '#19abb5' },
    B: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    C: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    PASS: { bg: 'rgba(110, 110, 112, 0.15)', text: '#6E6E70' },
  };

  const color = colors[template] || colors.PASS;

  return {
    ...badgeBaseStyles,
    backgroundColor: color.bg,
    color: color.text,
  };
}

/**
 * Get verdict badge styles
 */
function getVerdictBadgeStyles(verdict: 'BET' | 'PASS' | 'CAUTION'): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    BET: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
    PASS: { bg: 'rgba(110, 110, 112, 0.15)', text: '#6E6E70' },
    CAUTION: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  };

  const color = colors[verdict] || colors.PASS;

  return {
    ...badgeBaseStyles,
    backgroundColor: color.bg,
    color: color.text,
  };
}

/**
 * Get confidence bar fill color
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'var(--status-success)';
  if (confidence >= 50) return 'var(--status-warning)';
  return 'var(--status-error)';
}

/**
 * Get template description
 */
function getTemplateDescription(template: 'A' | 'B' | 'C' | 'PASS'): string {
  const descriptions: Record<string, string> = {
    A: 'Solid Favorite',
    B: 'Vulnerable Favorite',
    C: 'Wide Open',
    PASS: 'No Bet',
  };
  return descriptions[template] || '';
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TicketSummary component displays the ticket totals and verdict.
 * Shows total investment, expected return, template, verdict, and confidence.
 */
export function TicketSummary({
  totalInvestment,
  expectedReturn,
  templateUsed,
  verdict,
  confidence,
}: TicketSummaryProps): React.ReactElement {
  const confidenceBarFillStyles: React.CSSProperties = {
    height: '100%',
    width: `${Math.min(100, Math.max(0, confidence))}%`,
    backgroundColor: getConfidenceColor(confidence),
    borderRadius: 'var(--radius-full)',
    transition: 'width 0.3s ease-out',
  };

  return (
    <div style={summaryContainerStyles}>
      {/* Total Investment */}
      <div style={totalRowStyles}>
        <span style={totalLabelStyles}>Total Investment</span>
        <span style={totalAmountStyles}>{formatDollarAmount(totalInvestment)}</span>
      </div>

      {/* Expected Return (if available) */}
      {expectedReturn !== undefined && (
        <div style={expectedReturnRowStyles}>
          <span style={expectedReturnLabelStyles}>Expected Return</span>
          <span
            style={{
              ...expectedReturnAmountStyles,
              color: expectedReturn >= 0 ? 'var(--status-success)' : 'var(--status-error)',
            }}
          >
            {formatExpectedReturn(expectedReturn)}
          </span>
        </div>
      )}

      {/* Badges Row */}
      <div style={badgesRowStyles}>
        <div style={getTemplateBadgeStyles(templateUsed)}>
          <span className="material-icons" style={{ fontSize: '14px' }}>
            {templateUsed === 'PASS' ? 'block' : 'receipt_long'}
          </span>
          <span>Template {templateUsed}</span>
          <span style={{ opacity: 0.7, fontSize: '10px' }}>
            {getTemplateDescription(templateUsed)}
          </span>
        </div>

        <div style={getVerdictBadgeStyles(verdict)}>
          <span className="material-icons" style={{ fontSize: '14px' }}>
            {verdict === 'BET' ? 'check_circle' : verdict === 'CAUTION' ? 'warning' : 'cancel'}
          </span>
          <span>{verdict}</span>
        </div>
      </div>

      {/* Confidence Bar */}
      <div style={confidenceBarContainerStyles}>
        <div style={confidenceLabelRowStyles}>
          <span style={confidenceLabelStyles}>Confidence</span>
          <span style={confidenceValueStyles}>{confidence}%</span>
        </div>
        <div style={confidenceBarBackgroundStyles}>
          <div style={confidenceBarFillStyles} />
        </div>
      </div>
    </div>
  );
}

export default TicketSummary;
