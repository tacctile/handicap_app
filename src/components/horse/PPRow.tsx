import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface PPRowProps {
  /** Race date (e.g., "Aug 15, 2025" or raw "20250815") */
  date: string;
  /** Track code (e.g., "SAR", "CD") */
  track: string;
  /** Distance formatted (e.g., "6f", "1m") */
  distance: string;
  /** Surface code (e.g., "D" for dirt, "T" for turf) */
  surface: string;
  /** Track condition (e.g., "FT" fast, "MY" muddy, "GD" good) */
  condition: string;
  /** Race type/class (e.g., "Clm 10000", "Alw", "Msw") */
  raceType: string;
  /** Purse amount */
  purse?: number;
  /** Number of starters */
  fieldSize: number;
  /** Post position */
  postPosition: number;
  /** Finish position */
  finishPosition: number;
  /** Lengths behind winner (0 or undefined if won) */
  beatenLengths?: number;
  /** Beyer speed figure */
  speedFigure?: number;
  /** Odds in the race */
  odds?: string;
  /** Trip note or comment */
  comment?: string;
  /** Running line at each call */
  runningLine?: {
    start?: number;
    firstCall?: number;
    secondCall?: number;
    stretch?: number;
    finish?: number;
  };
  /** Whether this race was a win */
  isWin: boolean;
  /** Index for alternating row colors */
  index?: number;
  /** Optional click handler for expanding details */
  onClick?: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const rowBaseStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70px 40px 50px 30px 1fr 44px 44px 44px minmax(60px, 80px)',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) var(--space-3)',
  minHeight: '40px',
  fontSize: 'var(--text-xs)',
  borderBottom: '1px solid var(--border-subtle)',
  transition: 'var(--transition-fast)',
  cursor: 'default',
};

const rowEvenStyles: React.CSSProperties = {
  ...rowBaseStyles,
  backgroundColor: 'var(--bg-base)',
};

const rowOddStyles: React.CSSProperties = {
  ...rowBaseStyles,
  backgroundColor: 'var(--bg-elevated)',
};

const rowWinStyles: React.CSSProperties = {
  borderLeft: '3px solid var(--success)',
  paddingLeft: 'calc(var(--space-3) - 3px)',
};

const cellStyles: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--text-secondary)',
};

const dateCellStyles: React.CSSProperties = {
  ...cellStyles,
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-primary)',
};

const trackCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
};

const distSurfCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontFamily: 'var(--font-mono)',
};

const conditionCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  textTransform: 'lowercase',
};

const classCellStyles: React.CSSProperties = {
  ...cellStyles,
  fontSize: 'var(--text-xs)',
};

const finishCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  fontFamily: 'var(--font-mono)',
};

const finishWinStyles: React.CSSProperties = {
  ...finishCellStyles,
  color: 'var(--success)',
  fontWeight: 'var(--font-bold)' as unknown as number,
};

const lengthsCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

const figureCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--text-primary)',
};

const figureBoldStyles: React.CSSProperties = {
  ...figureCellStyles,
  fontWeight: 'var(--font-bold)' as unknown as number,
  color: 'var(--primary)',
};

const runningLineCellStyles: React.CSSProperties = {
  ...cellStyles,
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '-0.02em',
  textAlign: 'center',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date to compact display: "9Aug25"
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';

  const str = String(dateStr).trim();
  if (!str || str === 'undefined' || str === 'null') return '—';

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  try {
    // Handle YYYYMMDD format
    if (/^\d{8}$/.test(str)) {
      const year = str.slice(2, 4);
      const monthIdx = parseInt(str.slice(4, 6), 10) - 1;
      const day = parseInt(str.slice(6, 8), 10);
      const month = months[monthIdx] || '???';
      return `${day}${month}${year}`;
    }

    // Handle ISO or other date formats
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = String(date.getFullYear()).slice(-2);
      return `${day}${month}${year}`;
    }

    // If already formatted, return as-is (truncated)
    if (/^\d{1,2}[A-Za-z]{3}\d{2}/.test(str)) {
      return str.slice(0, 7);
    }

    return str.slice(0, 8) || '—';
  } catch {
    return '—';
  }
}

/**
 * Format track code to uppercase 3-letter code
 */
function formatTrack(track: string | undefined): string {
  if (!track) return '—';
  const str = String(track).trim();
  if (!str || str.toLowerCase() === 'nan') return '—';
  return str.toUpperCase().slice(0, 3);
}

/**
 * Format track condition to 2-letter abbreviation
 */
function formatCondition(condition: string | undefined): string {
  if (!condition) return '—';

  const abbrevs: Record<string, string> = {
    fast: 'ft',
    good: 'gd',
    sloppy: 'sy',
    muddy: 'my',
    firm: 'fm',
    yielding: 'yl',
    soft: 'sf',
    heavy: 'hy',
    'wet fast': 'wf',
    slow: 'sl',
  };

  return abbrevs[condition.toLowerCase()] || condition.slice(0, 2).toLowerCase();
}

/**
 * Format finish position for display
 */
function formatFinish(position: number): string {
  if (!position || position <= 0) return '—';

  if (position === 1) return '1st';
  if (position === 2) return '2nd';
  if (position === 3) return '3rd';
  return `${position}th`;
}

/**
 * Format beaten lengths for display
 */
function formatLengths(lengths: number | undefined, isWin: boolean): string {
  if (isWin) return '—';
  if (lengths === undefined || lengths === null) return '—';
  if (lengths === 0) return '—';

  // Common text abbreviations
  if (lengths < 0.25) return 'nk';
  if (lengths === 0.5) return '½';
  if (lengths === 0.75) return '¾';

  // Whole numbers with fractions
  const whole = Math.floor(lengths);
  const frac = lengths - whole;

  if (frac === 0) return String(whole);
  if (frac === 0.5) return whole > 0 ? `${whole}½` : '½';
  if (frac === 0.25) return whole > 0 ? `${whole}¼` : '¼';
  if (frac === 0.75) return whole > 0 ? `${whole}¾` : '¾';

  return lengths.toFixed(1);
}

/**
 * Format running line to compact "5-4-3-2" format
 */
function formatRunningLine(runningLine: PPRowProps['runningLine'] | undefined): string {
  if (!runningLine) return '—';

  const positions: number[] = [];

  // Collect available positions in order
  if (runningLine.start !== undefined && runningLine.start !== null) {
    positions.push(runningLine.start);
  }
  if (runningLine.firstCall !== undefined && runningLine.firstCall !== null) {
    positions.push(runningLine.firstCall);
  }
  if (runningLine.secondCall !== undefined && runningLine.secondCall !== null) {
    positions.push(runningLine.secondCall);
  }
  if (runningLine.stretch !== undefined && runningLine.stretch !== null) {
    positions.push(runningLine.stretch);
  }
  if (runningLine.finish !== undefined && runningLine.finish !== null) {
    positions.push(runningLine.finish);
  }

  if (positions.length === 0) return '—';

  return positions.join('-');
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PPRow displays a single past performance as a compact row.
 * Designed for dense data display in the Horse Detail Drawer.
 */
export function PPRow({
  date,
  track,
  distance,
  surface,
  condition,
  raceType,
  finishPosition,
  beatenLengths,
  speedFigure,
  runningLine,
  isWin,
  index = 0,
  onClick,
}: PPRowProps): React.ReactElement {
  const isEven = index % 2 === 0;

  // Combine distance and surface
  const distSurf = `${distance} ${surface.charAt(0).toUpperCase()}`;

  // Get row styles
  const baseStyle = isEven ? rowEvenStyles : rowOddStyles;
  const rowStyle: React.CSSProperties = {
    ...baseStyle,
    ...(isWin ? rowWinStyles : {}),
    ...(onClick ? { cursor: 'pointer' } : {}),
  };

  // Determine if speed figure is "high" (≥85)
  const isHighFigure = speedFigure !== undefined && speedFigure >= 85;

  return (
    <div
      style={rowStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isEven ? 'var(--bg-base)' : 'var(--bg-elevated)';
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Date */}
      <span style={dateCellStyles}>{formatDate(date)}</span>

      {/* Track */}
      <span style={trackCellStyles}>{formatTrack(track)}</span>

      {/* Distance + Surface */}
      <span style={distSurfCellStyles}>{distSurf}</span>

      {/* Condition */}
      <span style={conditionCellStyles}>{formatCondition(condition)}</span>

      {/* Class/Race Type */}
      <span style={classCellStyles} title={raceType}>
        {raceType}
      </span>

      {/* Finish Position */}
      <span style={isWin ? finishWinStyles : finishCellStyles}>{formatFinish(finishPosition)}</span>

      {/* Beaten Lengths */}
      <span style={lengthsCellStyles}>{formatLengths(beatenLengths, isWin)}</span>

      {/* Speed Figure */}
      <span style={isHighFigure ? figureBoldStyles : figureCellStyles}>
        {speedFigure !== undefined && speedFigure !== null ? speedFigure : '—'}
      </span>

      {/* Running Line */}
      <span style={runningLineCellStyles}>{formatRunningLine(runningLine)}</span>
    </div>
  );
}
