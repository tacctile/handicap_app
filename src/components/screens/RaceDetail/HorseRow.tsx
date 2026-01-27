import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface HorseRowProps {
  postPosition: number;
  programNumber: string;
  horseName: string;
  jockey: string;
  trainer: string;
  morningLineOdds: string;
  currentOdds?: string;
  score: number;
  maxScore: number;
  rank: number;
  valueEdge?: number;
  tier: 1 | 2 | 3 | null;
  isScratched: boolean;
  isBestBet?: boolean;
  onClick: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const rowStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px 1fr 80px 100px 60px 80px',
  gap: 'var(--space-2)',
  alignItems: 'center',
  minHeight: 'var(--touch-target-min)',
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
  transition: 'var(--transition-fast)',
};

const rowHoverStyles: React.CSSProperties = {
  backgroundColor: 'var(--bg-hover)',
};

const scratchedRowStyles: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
  textDecoration: 'line-through',
};

const postStyles: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
};

const horseInfoStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  minWidth: 0,
  overflow: 'hidden',
};

const horseNameStyles: React.CSSProperties = {
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const connectionsStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-tertiary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const oddsStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const scoreStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const rankContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-1)',
};

const rankStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
};

const edgeStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const bestBetIndicatorStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--tier-1)',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get color for tier ranking
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
      return 'var(--tier-none)';
  }
}

/**
 * Get color for value edge
 */
function getEdgeColor(edge: number | undefined): string {
  if (edge === undefined) return 'var(--text-tertiary)';
  if (edge >= 50) return 'var(--value-positive)';
  if (edge >= 0) return 'var(--text-secondary)';
  return 'var(--value-negative)';
}

/**
 * Format value edge for display
 */
function formatEdge(edge: number | undefined): string {
  if (edge === undefined) return '—';
  const rounded = Math.round(edge);
  return rounded >= 0 ? `+${rounded}%` : `${rounded}%`;
}

/**
 * Determine tier based on score thresholds from ALGORITHM_REFERENCE
 * Tier 1: 180-240 (Cover Chalk)
 * Tier 2: 160-179 (Logical Alternatives)
 * Tier 3: 130-159 (Value Bombs)
 */
function determineTier(score: number): 1 | 2 | 3 | null {
  if (score >= 180) return 1;
  if (score >= 160) return 2;
  if (score >= 130) return 3;
  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HorseRow component displays a single horse's key info in a table-like row.
 * Designed for quick scanning - all essential data visible at a glance.
 */
export function HorseRow({
  postPosition,
  programNumber,
  horseName,
  jockey,
  trainer,
  morningLineOdds,
  currentOdds,
  score,
  maxScore,
  rank,
  valueEdge,
  tier,
  isScratched,
  isBestBet,
  onClick,
}: HorseRowProps): React.ReactElement {
  const [isHovered, setIsHovered] = React.useState(false);

  // Determine display tier from score if not provided
  const displayTier = tier ?? determineTier(score);
  const tierColor = getTierColor(displayTier);
  const edgeColor = getEdgeColor(valueEdge);
  const displayOdds = currentOdds || morningLineOdds;

  // Combine styles
  const combinedRowStyles: React.CSSProperties = {
    ...rowStyles,
    ...(isHovered && !isScratched ? rowHoverStyles : {}),
    ...(isScratched ? scratchedRowStyles : {}),
  };

  const handleClick = () => {
    if (!isScratched) {
      onClick();
    }
  };

  return (
    <div
      style={combinedRowStyles}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={isScratched ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isScratched) {
          onClick();
        }
      }}
      aria-disabled={isScratched}
    >
      {/* Post Position */}
      <div style={postStyles}>{programNumber || postPosition}</div>

      {/* Horse Name + Jockey/Trainer */}
      <div style={horseInfoStyles}>
        <div style={horseNameStyles}>
          {horseName}
          {isBestBet && <span style={bestBetIndicatorStyles}> ★</span>}
        </div>
        <div style={connectionsStyles}>
          {jockey} / {trainer}
        </div>
      </div>

      {/* ML Odds */}
      <div style={oddsStyles}>{displayOdds}</div>

      {/* Score */}
      <div style={scoreStyles}>
        {score}/{maxScore}
      </div>

      {/* Rank with tier color */}
      <div style={rankContainerStyles}>
        <span style={{ ...rankStyles, color: tierColor }}>#{rank}</span>
      </div>

      {/* Value Edge */}
      <div style={{ ...edgeStyles, color: edgeColor }}>{formatEdge(valueEdge)}</div>
    </div>
  );
}
