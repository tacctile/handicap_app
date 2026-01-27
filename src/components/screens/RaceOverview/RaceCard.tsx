import React from 'react';
import { Card, Badge } from '../../ui';

// ============================================================================
// TYPES
// ============================================================================

export interface RaceCardProps {
  raceNumber: number;
  trackCode: string;
  distance: string; // e.g., "6f", "1m", "1 1/16m"
  surface: string; // e.g., "Dirt", "Turf"
  raceType: string; // e.g., "Clm $10,000", "Alw", "Msw"
  fieldSize: number; // number of horses
  postTime?: string; // e.g., "1:30 PM"
  verdict: 'BET' | 'PASS' | 'CAUTION';
  topHorses?: Array<{ rank: number; name: string }>; // top 3 horses
  onClick: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const cardContainerStyles: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  minHeight: '180px',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};

const raceNumberStyles: React.CSSProperties = {
  fontSize: 'var(--text-xl)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  color: 'var(--text-primary)',
  lineHeight: 'var(--leading-tight)',
};

const detailsRowStyles: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-1)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  lineHeight: 'var(--leading-normal)',
};

const separatorStyles: React.CSSProperties = {
  color: 'var(--text-tertiary)',
};

const fieldSizeStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
};

const postTimeStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-tertiary)',
};

const topHorsesContainerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  marginTop: 'auto',
};

const topHorsesHeaderStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const topHorseRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
};

const rankStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-secondary)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: '24px',
};

const horseNameStyles: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map verdict to Badge variant
 */
function getVerdictBadgeVariant(
  verdict: 'BET' | 'PASS' | 'CAUTION'
): 'success' | 'default' | 'warning' {
  switch (verdict) {
    case 'BET':
      return 'success';
    case 'PASS':
      return 'default';
    case 'CAUTION':
      return 'warning';
  }
}

/**
 * Format rank as ordinal (1st, 2nd, 3rd)
 */
function formatOrdinal(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

/**
 * Format surface for display
 */
function formatSurface(surface: string): string {
  const s = surface.toLowerCase();
  if (s === 'turf') return 'Turf';
  if (s === 'dirt') return 'Dirt';
  if (s === 'synthetic' || s === 'all-weather') return 'Synth';
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RaceCard component displays a single race summary in the race overview grid.
 * Shows race basics, verdict badge, and top 3 projected horses.
 */
export function RaceCard({
  raceNumber,
  distance,
  surface,
  raceType,
  fieldSize,
  postTime,
  verdict,
  topHorses,
  onClick,
}: RaceCardProps): React.ReactElement {
  const badgeVariant = getVerdictBadgeVariant(verdict);
  const surfaceDisplay = formatSurface(surface);

  // Build race details parts
  const detailsParts: string[] = [];
  if (distance) detailsParts.push(distance);
  if (surfaceDisplay) detailsParts.push(surfaceDisplay);
  if (raceType) detailsParts.push(raceType);

  return (
    <Card hoverable={true} onClick={onClick} padding="md">
      <div style={cardContainerStyles}>
        {/* Header: Race number + Verdict badge */}
        <div style={headerStyles}>
          <span style={raceNumberStyles}>R{raceNumber}</span>
          <Badge variant={badgeVariant} size="sm">
            {verdict}
          </Badge>
        </div>

        {/* Race details row: distance · surface · raceType */}
        <div style={detailsRowStyles}>
          {detailsParts.map((part, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={separatorStyles}>·</span>}
              <span>{part}</span>
            </React.Fragment>
          ))}
        </div>

        {/* Field size */}
        <div style={fieldSizeStyles}>
          {fieldSize} horse{fieldSize !== 1 ? 's' : ''}
        </div>

        {/* Post time if available */}
        {postTime && <div style={postTimeStyles}>{postTime}</div>}

        {/* Top 3 horses */}
        {topHorses && topHorses.length > 0 && (
          <div style={topHorsesContainerStyles}>
            <div style={topHorsesHeaderStyles}>Top Picks</div>
            {topHorses.slice(0, 3).map((horse) => (
              <div key={horse.rank} style={topHorseRowStyles}>
                <span style={rankStyles}>{formatOrdinal(horse.rank)}</span>
                <span style={horseNameStyles}>{horse.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
