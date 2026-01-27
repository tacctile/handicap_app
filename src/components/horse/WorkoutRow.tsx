import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkoutRowProps {
  /** Workout date (e.g., "Aug 15, 2025") */
  date: string;
  /** Track code (e.g., "SAR", "CD") */
  track: string;
  /** Distance formatted (e.g., "4f", "5f", "3f") */
  distance: string;
  /** Time formatted (e.g., "48.20", "1:01.40") */
  time: string;
  /** Time of day (e.g., "M" morning, "T" training hours) */
  timeOfDay?: string;
  /** Track condition (e.g., "ft" fast, "sy" sloppy) */
  trackCondition?: string;
  /** Workout type code (e.g., "H" handily, "B" breezing, "G" gate) */
  workoutType?: string;
  /** Ranking string (e.g., "2/45") */
  ranking?: string;
  /** True if fastest workout at that distance/track that day */
  isBullet: boolean;
  /** Optional trainer comment */
  comment?: string;
  /** Index for alternating row colors */
  index?: number;
}

// ============================================================================
// STYLES
// ============================================================================

const rowBaseStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70px 45px 45px 65px 35px 55px 24px',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) var(--space-3)',
  minHeight: '36px',
  fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--border-subtle)',
  transition: 'var(--transition-fast)',
};

const rowEvenStyles: React.CSSProperties = {
  ...rowBaseStyles,
  backgroundColor: 'var(--bg-base)',
};

const rowOddStyles: React.CSSProperties = {
  ...rowBaseStyles,
  backgroundColor: 'var(--bg-elevated)',
};

const rowBulletStyles: React.CSSProperties = {
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

const distanceCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

const timeCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--text-primary)',
};

const timeBulletStyles: React.CSSProperties = {
  ...timeCellStyles,
  fontWeight: 'var(--font-bold)' as unknown as number,
  color: 'var(--success)',
};

const typeCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
};

const rankingCellStyles: React.CSSProperties = {
  ...cellStyles,
  textAlign: 'center',
  fontSize: 'var(--text-xs)',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

const bulletIndicatorStyles: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--success)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-bold)' as unknown as number,
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

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * WorkoutRow displays a single workout as a compact row.
 * Designed for dense data display in the Horse Detail Drawer.
 */
export function WorkoutRow({
  date,
  track,
  distance,
  time,
  workoutType,
  ranking,
  isBullet,
  index = 0,
}: WorkoutRowProps): React.ReactElement {
  const isEven = index % 2 === 0;

  // Get row styles
  const baseStyle = isEven ? rowEvenStyles : rowOddStyles;
  const rowStyle: React.CSSProperties = {
    ...baseStyle,
    ...(isBullet ? rowBulletStyles : {}),
  };

  return (
    <div
      style={rowStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isEven ? 'var(--bg-base)' : 'var(--bg-elevated)';
      }}
    >
      {/* Date */}
      <span style={dateCellStyles}>{formatDate(date)}</span>

      {/* Track */}
      <span style={trackCellStyles}>{formatTrack(track)}</span>

      {/* Distance */}
      <span style={distanceCellStyles}>{distance || '—'}</span>

      {/* Time */}
      <span style={isBullet ? timeBulletStyles : timeCellStyles}>{time || '—'}</span>

      {/* Workout Type */}
      <span style={typeCellStyles}>{workoutType || '—'}</span>

      {/* Ranking */}
      <span style={rankingCellStyles}>{ranking || '—'}</span>

      {/* Bullet Indicator */}
      <span style={bulletIndicatorStyles}>{isBullet ? '●' : ''}</span>
    </div>
  );
}
