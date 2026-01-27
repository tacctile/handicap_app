import React from 'react';
import { PPRow } from './PPRow';
import type { PastPerformance } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

export interface HorsePastPerformancesProps {
  /** Array of past performances from HorseEntry */
  pastPerformances: PastPerformance[];
  /** Maximum number of rows to display (default 10) */
  maxRows?: number;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
};

const headerRowStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70px 40px 50px 30px 1fr 44px 44px 44px minmax(60px, 80px)',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border-prominent)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
};

const headerCellStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const headerCellCenterStyles: React.CSSProperties = {
  ...headerCellStyles,
  textAlign: 'center',
};

const scrollContainerStyles: React.CSSProperties = {
  maxHeight: '400px',
  overflowY: 'auto',
  overflowX: 'hidden',
};

const emptyStateStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '120px',
  color: 'var(--text-tertiary)',
  fontSize: 'var(--text-sm)',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map surface type to single character display
 */
function mapSurface(surface: string | undefined): string {
  if (!surface) return '—';
  const lower = surface.toLowerCase();
  if (lower === 'dirt') return 'D';
  if (lower === 'turf') return 'T';
  if (lower === 'synthetic' || lower === 'all-weather') return 'S';
  return surface.charAt(0).toUpperCase();
}

/**
 * Format distance from furlongs to compact string
 */
function formatDistance(furlongs: number | undefined): string {
  if (!furlongs || furlongs <= 0) return '—';

  // Common distances
  if (furlongs === 4.5) return '4½f';
  if (furlongs === 5) return '5f';
  if (furlongs === 5.5) return '5½f';
  if (furlongs === 6) return '6f';
  if (furlongs === 6.5) return '6½f';
  if (furlongs === 7) return '7f';
  if (furlongs === 8) return '1m';
  if (furlongs === 8.5) return '1m70y';
  if (furlongs === 9) return '1⅛m';
  if (furlongs === 10) return '1¼m';
  if (furlongs === 11) return '1⅜m';
  if (furlongs === 12) return '1½m';

  // Generic handling
  if (furlongs < 8) {
    const whole = Math.floor(furlongs);
    const frac = furlongs - whole;
    if (frac === 0) return `${whole}f`;
    if (frac === 0.5) return `${whole}½f`;
    return `${furlongs}f`;
  }

  // Miles
  const miles = furlongs / 8;
  if (Number.isInteger(miles)) return `${miles}m`;
  return `${miles.toFixed(2)}m`;
}

/**
 * Format race class/type for compact display
 */
function formatRaceType(pp: PastPerformance): string {
  const classification = pp.classification || '';
  const purse = pp.purse || 0;
  const claiming = pp.claimingPrice;

  // Graded stakes
  if (classification.includes('graded-1')) return 'G1';
  if (classification.includes('graded-2')) return 'G2';
  if (classification.includes('graded-3')) return 'G3';
  if (classification.includes('listed')) return 'Listed';
  if (classification.includes('stakes')) return 'Stk';

  // Claiming
  if (claiming) {
    const priceK = Math.round(claiming / 1000);
    return `Clm ${priceK}K`;
  }

  // Allowance types
  if (classification.includes('allowance-optional')) {
    return 'AOC';
  }
  if (classification.includes('starter-allowance')) {
    return 'Str Alw';
  }
  if (classification.includes('allowance')) {
    const purseK = purse >= 1000 ? Math.round(purse / 1000) : purse;
    return `Alw ${purseK}K`;
  }

  // Maiden types
  if (classification.includes('maiden-claiming')) {
    const priceK = claiming ? Math.round(claiming / 1000) : '';
    return priceK ? `MCL ${priceK}K` : 'MCL';
  }
  if (classification.includes('maiden')) {
    return 'Msw';
  }

  // Handicap
  if (classification.includes('handicap')) {
    return 'Hcp';
  }

  // Fallback - capitalize first word
  if (classification) {
    return classification.charAt(0).toUpperCase() + classification.slice(1, 8);
  }

  return '—';
}

/**
 * Map PastPerformance running line to PPRow running line format
 */
function mapRunningLine(pp: PastPerformance):
  | {
      start?: number;
      firstCall?: number;
      secondCall?: number;
      stretch?: number;
      finish?: number;
    }
  | undefined {
  if (!pp.runningLine) return undefined;

  const rl = pp.runningLine;
  const result: {
    start?: number;
    firstCall?: number;
    secondCall?: number;
    stretch?: number;
    finish?: number;
  } = {};

  // Map from PastPerformance RunningLine to PPRow format
  if (rl.start !== null && rl.start !== undefined) {
    result.start = rl.start;
  }
  if (rl.quarterMile !== null && rl.quarterMile !== undefined) {
    result.firstCall = rl.quarterMile;
  }
  if (rl.halfMile !== null && rl.halfMile !== undefined) {
    result.secondCall = rl.halfMile;
  }
  if (rl.stretch !== null && rl.stretch !== undefined) {
    result.stretch = rl.stretch;
  }
  if (rl.finish !== null && rl.finish !== undefined) {
    result.finish = rl.finish;
  }

  // Only return if we have at least one position
  if (Object.keys(result).length === 0) return undefined;

  return result;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HorsePastPerformances displays a table of the horse's recent race history.
 * Shows date, track, distance, surface, condition, class, finish, lengths,
 * speed figure, and running line in a scannable format.
 */
export function HorsePastPerformances({
  pastPerformances,
  maxRows = 10,
}: HorsePastPerformancesProps): React.ReactElement {
  // Limit to maxRows (most recent at top - assuming already sorted)
  const displayPPs = pastPerformances.slice(0, maxRows);

  // Empty state
  if (!displayPPs || displayPPs.length === 0) {
    return (
      <div style={containerStyles}>
        <div style={emptyStateStyles}>No past performances available</div>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Column Headers */}
      <div style={headerRowStyles}>
        <span style={headerCellStyles}>Date</span>
        <span style={headerCellCenterStyles}>Trk</span>
        <span style={headerCellCenterStyles}>Dist</span>
        <span style={headerCellCenterStyles}>Cnd</span>
        <span style={headerCellStyles}>Class</span>
        <span style={headerCellCenterStyles}>Fin</span>
        <span style={headerCellCenterStyles}>Len</span>
        <span style={headerCellCenterStyles}>Fig</span>
        <span style={headerCellCenterStyles}>Run</span>
      </div>

      {/* Scrollable Rows */}
      <div style={scrollContainerStyles}>
        {displayPPs.map((pp, index) => {
          const isWin = pp.finishPosition === 1;

          return (
            <PPRow
              key={`${pp.date}-${pp.track}-${index}`}
              date={pp.date}
              track={pp.track}
              distance={formatDistance(pp.distanceFurlongs)}
              surface={mapSurface(pp.surface)}
              condition={pp.trackCondition || ''}
              raceType={formatRaceType(pp)}
              purse={pp.purse}
              fieldSize={pp.fieldSize}
              postPosition={0} // Not displayed in compact view
              finishPosition={pp.finishPosition}
              beatenLengths={pp.lengthsBehind}
              speedFigure={pp.speedFigures?.beyer ?? undefined}
              odds={pp.odds !== null ? String(pp.odds) : undefined}
              comment={pp.tripComment || pp.comment}
              runningLine={mapRunningLine(pp)}
              isWin={isWin}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
}
