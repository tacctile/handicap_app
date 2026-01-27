import React from 'react';
import { Card } from '../ui';

// ============================================================================
// TYPES
// ============================================================================

export interface HorseScoreCardProps {
  horseName: string;
  score: number;           // e.g., 189
  maxScore: number;        // 371
  baseScore: number;       // e.g., 175
  maxBaseScore: number;    // 331
  overlay: number;         // e.g., +14 or -8
  tier: 1 | 2 | 3 | null;
  confidence: number;      // percentage, e.g., 72
  rank?: number;           // predicted finish position, e.g., 1, 2, 3
  valueEdge?: number;      // percentage, e.g., +86 or -23
  morningLineOdds: string;
  fairOdds?: string;       // calculated fair odds
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
};

const horseNameStyles: React.CSSProperties = {
  fontSize: 'var(--text-2xl)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  color: 'var(--text-primary)',
  margin: 0,
};

const scoreDisplayContainerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const scoreDisplayRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
};

const scoreValueStyles: React.CSSProperties = {
  fontSize: 'var(--text-4xl)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
};

const scoreMaxStyles: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-tertiary)',
  fontVariantNumeric: 'tabular-nums',
};

const progressBarContainerStyles: React.CSSProperties = {
  height: '8px',
  backgroundColor: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-full)',
  overflow: 'hidden',
};

const breakdownRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  fontVariantNumeric: 'tabular-nums',
};

const statsRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
};

const statItemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

const tierBadgeStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-1) var(--space-3)',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const confidenceStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  fontVariantNumeric: 'tabular-nums',
};

const valueSectionStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-3)',
  backgroundColor: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-md)',
  marginTop: 'var(--space-2)',
};

const oddsRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
};

const edgeValueStyles: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  fontVariantNumeric: 'tabular-nums',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get tier color based on tier number
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
 * Get tier background color (with alpha)
 */
function getTierBgColor(tier: 1 | 2 | 3 | null): string {
  switch (tier) {
    case 1:
      return 'rgba(16, 185, 129, 0.15)'; // --tier-1 with alpha
    case 2:
      return 'rgba(59, 130, 246, 0.15)'; // --tier-2 with alpha
    case 3:
      return 'rgba(245, 158, 11, 0.15)'; // --tier-3 with alpha
    default:
      return 'var(--bg-elevated)';
  }
}

/**
 * Get tier label
 */
function getTierLabel(tier: 1 | 2 | 3 | null): string {
  switch (tier) {
    case 1:
      return 'TIER 1';
    case 2:
      return 'TIER 2';
    case 3:
      return 'TIER 3';
    default:
      return 'NO TIER';
  }
}

/**
 * Format overlay with sign
 */
function formatOverlay(overlay: number): string {
  if (overlay >= 0) {
    return `+${overlay}`;
  }
  return String(overlay);
}

/**
 * Get overlay color
 */
function getOverlayColor(overlay: number): string {
  if (overlay > 0) {
    return 'var(--status-success)';
  } else if (overlay < 0) {
    return 'var(--status-error)';
  }
  return 'var(--text-secondary)';
}

/**
 * Get value edge color
 */
function getValueEdgeColor(edge: number): string {
  if (edge >= 25) {
    return 'var(--status-success)';
  } else if (edge <= -10) {
    return 'var(--status-error)';
  }
  return 'var(--text-secondary)';
}

/**
 * Format value edge with sign and %
 */
function formatValueEdge(edge: number): string {
  const sign = edge >= 0 ? '+' : '';
  return `${sign}${edge.toFixed(0)}%`;
}

/**
 * Convert number to ordinal (1st, 2nd, 3rd, etc.)
 */
function toOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0] ?? 'th');
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HorseScoreCard displays the main score overview for a horse.
 * Shows the large score, progress bar, tier badge, and value analysis.
 */
export function HorseScoreCard({
  horseName,
  score,
  maxScore,
  baseScore,
  maxBaseScore,
  overlay,
  tier,
  confidence,
  rank,
  valueEdge,
  morningLineOdds,
  fairOdds,
}: HorseScoreCardProps): React.ReactElement {
  const scorePercentage = Math.min((score / maxScore) * 100, 100);
  const tierColor = getTierColor(tier);
  const tierBgColor = getTierBgColor(tier);
  const overlayColor = getOverlayColor(overlay);

  return (
    <Card padding="lg">
      <div style={containerStyles}>
        {/* Horse Name */}
        <h2 style={horseNameStyles}>{horseName}</h2>

        {/* Large Score Display */}
        <div style={scoreDisplayContainerStyles}>
          <div style={scoreDisplayRowStyles}>
            <span style={{ ...scoreValueStyles, color: tierColor }}>{score}</span>
            <span style={scoreMaxStyles}>/ {maxScore}</span>
          </div>

          {/* Progress Bar */}
          <div style={progressBarContainerStyles}>
            <div
              style={{
                width: `${scorePercentage}%`,
                height: '100%',
                backgroundColor: tierColor,
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>
        </div>

        {/* Score Breakdown Row */}
        <div style={breakdownRowStyles}>
          <span>Base: {baseScore}/{maxBaseScore}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ color: overlayColor }}>
            Overlay: {formatOverlay(overlay)}
          </span>
        </div>

        {/* Stats Row: Rank + Tier Badge + Confidence */}
        <div style={statsRowStyles}>
          {rank !== undefined && rank > 0 && (
            <span style={{ ...confidenceStyles, fontWeight: 'var(--font-semibold)' as unknown as number }}>
              {toOrdinal(rank)}
            </span>
          )}
          <div style={statItemStyles}>
            <span
              style={{
                ...tierBadgeStyles,
                color: tierColor,
                backgroundColor: tierBgColor,
                borderColor: tierColor,
              }}
            >
              {getTierLabel(tier)}
            </span>
          </div>
          <span style={confidenceStyles}>
            {confidence}% confidence
          </span>
        </div>

        {/* Value Section (if valueEdge provided) */}
        {valueEdge !== undefined && (
          <div style={valueSectionStyles}>
            <div style={oddsRowStyles}>
              <span>ML: {morningLineOdds}</span>
              {fairOdds && (
                <>
                  <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                  <span>Fair: {fairOdds}</span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Edge:
              </span>
              <span style={{ ...edgeValueStyles, color: getValueEdgeColor(valueEdge) }}>
                {formatValueEdge(valueEdge)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
