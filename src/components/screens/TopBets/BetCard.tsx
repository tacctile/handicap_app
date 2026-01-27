import React from 'react';
import { Card, Badge } from '../../ui';

// ============================================================================
// TYPES
// ============================================================================

export interface BetCardProps {
  /** Race number for badge display */
  raceNumber: number;
  /** Primary horse name */
  horseName: string;
  /** Horse program number */
  horseNumber: number;
  /** Type of bet */
  betType: 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA' | 'SUPERFECTA';
  /** Current odds (e.g., "8-1") */
  odds: string;
  /** Confidence percentage (0-100) */
  confidence: number;
  /** Kelly-suggested bet amount */
  kellyBet?: number;
  /** Expected value per dollar */
  expectedValue?: number;
  /** Tier classification */
  tier: 1 | 2 | 3 | null;
  /** Second horse for exacta/trifecta */
  secondHorse?: string;
  /** Third horse for trifecta */
  thirdHorse?: string;
  /** Click handler to navigate to race detail */
  onClick?: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const cardContainerStyles: React.CSSProperties = {
  position: 'relative',
  minHeight: '80px',
};

const raceBadgeStyles: React.CSSProperties = {
  position: 'absolute',
  top: 'var(--space-2)',
  right: 'var(--space-2)',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--bg-hover)',
  color: 'var(--text-tertiary)',
};

const contentStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const headerRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  paddingRight: 'var(--space-8)', // Room for race badge
};

const horseNameStyles: React.CSSProperties = {
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: 1,
};

const exoticStructureStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  marginTop: '2px',
};

const statsRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
};

const oddsStyles: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  fontVariantNumeric: 'tabular-nums',
};

const confidenceContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flex: 1,
};

const confidenceBarContainerStyles: React.CSSProperties = {
  flex: 1,
  height: '4px',
  backgroundColor: 'var(--bg-hover)',
  borderRadius: '2px',
  overflow: 'hidden',
};

const confidenceTextStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: '32px',
  textAlign: 'right',
};

const kellyStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--accent-primary)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  fontVariantNumeric: 'tabular-nums',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the confidence bar color based on tier
 */
function getTierColor(tier: 1 | 2 | 3 | null): string {
  switch (tier) {
    case 1:
      return 'var(--tier-1)';
    case 2:
      return 'var(--tier-2)';
    case 3:
      return 'var(--tier-3)';
    default:
      return 'var(--text-tertiary)';
  }
}

/**
 * Get tier badge variant
 */
function getTierVariant(tier: 1 | 2 | 3 | null): 'tier1' | 'tier2' | 'tier3' | 'default' {
  switch (tier) {
    case 1:
      return 'tier1';
    case 2:
      return 'tier2';
    case 3:
      return 'tier3';
    default:
      return 'default';
  }
}

/**
 * Format exotic bet structure display
 */
function formatExoticStructure(
  horseNumber: number,
  secondHorse?: string,
  thirdHorse?: string
): string {
  if (thirdHorse && secondHorse) {
    return `${horseNumber}-${secondHorse}-${thirdHorse}`;
  }
  if (secondHorse) {
    return `${horseNumber}-${secondHorse}`;
  }
  return `#${horseNumber}`;
}

/**
 * Check if this is an exotic bet type
 */
function isExoticBet(betType: BetCardProps['betType']): boolean {
  return betType === 'EXACTA' || betType === 'TRIFECTA' || betType === 'SUPERFECTA';
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * BetCard displays a single bet recommendation in a compact card format.
 * Shows horse info, odds, confidence level, and Kelly bet sizing.
 */
export function BetCard({
  raceNumber,
  horseName,
  horseNumber,
  betType,
  odds,
  confidence,
  kellyBet,
  tier,
  secondHorse,
  thirdHorse,
  onClick,
}: BetCardProps): React.ReactElement {
  const isExotic = isExoticBet(betType);
  const confidenceClamped = Math.min(Math.max(confidence, 0), 100);

  return (
    <Card padding="sm" hoverable={!!onClick} onClick={onClick}>
      <div style={cardContainerStyles}>
        {/* Race Badge */}
        <span style={raceBadgeStyles}>R{raceNumber}</span>

        <div style={contentStyles}>
          {/* Horse Name Row */}
          <div style={headerRowStyles}>
            <span style={horseNameStyles}>
              {isExotic ? `#${horseNumber}` : `#${horseNumber} ${horseName}`}
            </span>
            {tier && (
              <Badge variant={getTierVariant(tier)} size="sm">
                T{tier}
              </Badge>
            )}
          </div>

          {/* Exotic Structure (for multi-horse bets) */}
          {isExotic && (secondHorse || thirdHorse) && (
            <div style={exoticStructureStyles}>
              {formatExoticStructure(horseNumber, secondHorse, thirdHorse)}
            </div>
          )}

          {/* Stats Row: Odds, Confidence, Kelly */}
          <div style={statsRowStyles}>
            <span style={oddsStyles}>{odds}</span>

            <div style={confidenceContainerStyles}>
              <div style={confidenceBarContainerStyles}>
                <div
                  style={{
                    width: `${confidenceClamped}%`,
                    height: '100%',
                    backgroundColor: getTierColor(tier),
                    borderRadius: '2px',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span style={confidenceTextStyles}>{Math.round(confidence)}%</span>
            </div>

            {kellyBet !== undefined && kellyBet > 0 && (
              <span style={kellyStyles}>${kellyBet.toFixed(2)}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default BetCard;
