import React from 'react';
import { WorkoutRow } from './WorkoutRow';
import type { Workout, WorkoutType } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

export interface HorseWorkoutsProps {
  /** Array of workouts from HorseEntry */
  workouts: Workout[];
  /** Maximum number of rows to display (default 8) */
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
  gridTemplateColumns: '70px 45px 45px 65px 35px 55px 24px',
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

const legendStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
  borderBottom: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--bg-base)',
};

const legendBulletStyles: React.CSSProperties = {
  color: 'var(--success)',
  fontWeight: 'var(--font-bold)' as unknown as number,
};

const scrollContainerStyles: React.CSSProperties = {
  maxHeight: '360px',
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
 * Map WorkoutType enum to single-letter display code
 */
function mapWorkoutType(type: WorkoutType | string | undefined, fromGate: boolean): string {
  if (fromGate) return 'G';

  if (!type) return '—';

  switch (type) {
    case 'breeze':
      return 'B';
    case 'handily':
      return 'H';
    case 'driving':
      return 'D';
    case 'easy':
      return 'E';
    case 'unknown':
    default:
      return '—';
  }
}

/**
 * Format ranking from "2 of 35" style to "2/35" compact format
 */
function formatRanking(
  ranking: string | undefined,
  rankNumber: number | null | undefined,
  totalWorks: number | null | undefined
): string {
  // If we have structured data, use it
  if (rankNumber !== null && rankNumber !== undefined && totalWorks !== null && totalWorks !== undefined) {
    return `${rankNumber}/${totalWorks}`;
  }

  // Parse ranking string like "2 of 35"
  if (ranking) {
    const str = String(ranking).trim();
    // Already in compact format
    if (/^\d+\/\d+$/.test(str)) {
      return str;
    }
    // Parse "X of Y" format
    const match = str.match(/^(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return str;
  }

  return '—';
}

/**
 * Derive isBullet from ranking if not explicitly set
 * A bullet is rank 1 (fastest workout of the day at that distance/track)
 */
function deriveBullet(
  isBullet: boolean | undefined,
  rankNumber: number | null | undefined,
  ranking: string | undefined
): boolean {
  // If explicitly set, use it
  if (isBullet !== undefined) return isBullet;

  // Check rankNumber
  if (rankNumber === 1) return true;

  // Parse from ranking string
  if (ranking) {
    const match = String(ranking).match(/^1\s*(?:of|\/)/i);
    if (match) return true;
  }

  return false;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HorseWorkouts displays a table of the horse's recent training activity.
 * Shows date, track, distance, time, workout type, ranking, and bullet indicator.
 */
export function HorseWorkouts({ workouts, maxRows = 8 }: HorseWorkoutsProps): React.ReactElement {
  // Limit to maxRows (most recent at top - assuming already sorted)
  const displayWorkouts = workouts.slice(0, maxRows);

  // Empty state
  if (!displayWorkouts || displayWorkouts.length === 0) {
    return (
      <div style={containerStyles}>
        <div style={emptyStateStyles}>No workouts available</div>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Legend */}
      <div style={legendStyles}>
        <span>
          <span style={legendBulletStyles}>●</span> = Bullet (fastest of day)
        </span>
      </div>

      {/* Column Headers */}
      <div style={headerRowStyles}>
        <span style={headerCellStyles}>Date</span>
        <span style={headerCellCenterStyles}>Trk</span>
        <span style={headerCellCenterStyles}>Dist</span>
        <span style={headerCellCenterStyles}>Time</span>
        <span style={headerCellCenterStyles}>Type</span>
        <span style={headerCellCenterStyles}>Rank</span>
        <span style={headerCellCenterStyles}></span>
      </div>

      {/* Scrollable Rows */}
      <div style={scrollContainerStyles}>
        {displayWorkouts.map((workout, index) => {
          const isBullet = deriveBullet(workout.isBullet, workout.rankNumber, workout.ranking);

          return (
            <WorkoutRow
              key={`${workout.date}-${workout.track}-${index}`}
              date={workout.date}
              track={workout.track}
              distance={workout.distance || `${workout.distanceFurlongs}f`}
              time={workout.timeFormatted}
              trackCondition={workout.trackCondition}
              workoutType={mapWorkoutType(workout.type, workout.fromGate)}
              ranking={formatRanking(workout.ranking, workout.rankNumber, workout.totalWorks)}
              isBullet={isBullet}
              comment={workout.notes}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
}
