import React from 'react';
import { Button, Badge } from '../../ui';

// ============================================================================
// TYPES
// ============================================================================

export interface RaceHeaderProps {
  raceNumber: number;
  trackCode: string;
  distance: string;
  surface: string;
  raceType: string;
  purse?: string;
  fieldSize: number;
  postTime?: string;
  verdict: 'BET' | 'PASS' | 'CAUTION';
  onBack: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  padding: 'var(--space-3) var(--space-4)',
  backgroundColor: 'var(--bg-card)',
  borderBottom: '1px solid var(--border-subtle)',
  position: 'sticky',
  top: 0,
  zIndex: 'var(--z-sticky)' as unknown as number,
};

const backButtonStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  fontSize: 'var(--text-sm)',
  whiteSpace: 'nowrap',
};

const raceInfoStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
};

const raceNumberStyles: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

const detailsStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const separatorStyles: React.CSSProperties = {
  color: 'var(--text-tertiary)',
};

const postTimeStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-tertiary)',
  whiteSpace: 'nowrap',
  marginLeft: 'auto',
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
 * RaceHeader component displays race info at the top of RaceDetail screen.
 * Includes back button, race details, verdict badge, and post time.
 */
export function RaceHeader({
  raceNumber,
  distance,
  surface,
  raceType,
  purse,
  fieldSize,
  postTime,
  verdict,
  onBack,
}: RaceHeaderProps): React.ReactElement {
  const badgeVariant = getVerdictBadgeVariant(verdict);
  const surfaceDisplay = formatSurface(surface);

  // Build race details string
  const detailsParts: string[] = [];
  if (distance) detailsParts.push(distance);
  if (surfaceDisplay) detailsParts.push(surfaceDisplay);
  if (raceType) detailsParts.push(raceType);
  if (purse) detailsParts.push(purse);
  detailsParts.push(`${fieldSize} horse${fieldSize !== 1 ? 's' : ''}`);

  return (
    <header style={containerStyles}>
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack}>
        <span style={backButtonStyles}>
          <span style={{ fontSize: 'var(--text-base)' }}>←</span>
          <span>All Races</span>
        </span>
      </Button>

      {/* Race info */}
      <div style={raceInfoStyles}>
        <span style={raceNumberStyles}>R{raceNumber}</span>
        <span style={separatorStyles}>·</span>
        <span style={detailsStyles}>
          {detailsParts.map((part, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={separatorStyles}> · </span>}
              <span>{part}</span>
            </React.Fragment>
          ))}
        </span>
      </div>

      {/* Verdict badge */}
      <Badge variant={badgeVariant} size="sm">
        {verdict}
      </Badge>

      {/* Post time */}
      {postTime && <div style={postTimeStyles}>{postTime}</div>}
    </header>
  );
}
