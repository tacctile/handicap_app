import React from 'react';
import type { HorseEntry } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

export interface HorseProfileProps {
  horse: HorseEntry;
}

// ============================================================================
// STYLES
// ============================================================================

const sectionStyles: React.CSSProperties = {
  marginBottom: 'var(--space-6)',
};

const sectionHeaderStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 'var(--space-3)',
};

const cardStyles: React.CSSProperties = {
  backgroundColor: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4)',
  border: '1px solid var(--border-subtle)',
};

const rowStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-2)',
};

const labelStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
};

const valueStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
  textAlign: 'right',
};

const earningsStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  textAlign: 'right',
};

const recordRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--space-2) 0',
  borderBottom: '1px solid var(--border-subtle)',
};

const recordLabelStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
};

const recordValueStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
};

const connectionNameStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
  fontWeight: 'var(--font-medium)' as unknown as number,
};

const connectionStatsStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
  fontFamily: 'var(--font-mono)',
};

const compactGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-3)',
};

const compactItemStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map sex code to full display name
 */
function mapSexCode(sex: string, sexFull?: string): string {
  if (sexFull && sexFull.length > 1) {
    return sexFull;
  }

  const sexMap: Record<string, string> = {
    'c': 'Colt',
    'f': 'Filly',
    'g': 'Gelding',
    'h': 'Horse',
    'm': 'Mare',
    'r': 'Ridgling',
  };

  return sexMap[sex.toLowerCase()] || sex;
}

/**
 * Map color code to full display name
 */
function mapColorCode(color: string): string {
  if (!color) return '—';

  const colorMap: Record<string, string> = {
    'b': 'Bay',
    'br': 'Brown',
    'blk': 'Black',
    'ch': 'Chestnut',
    'dk b': 'Dark Bay',
    'dk b/br': 'Dark Bay/Brown',
    'gr': 'Gray',
    'gr/ro': 'Gray/Roan',
    'ro': 'Roan',
    'wh': 'White',
  };

  // Try exact match first
  const lower = color.toLowerCase().trim();
  if (colorMap[lower]) {
    return colorMap[lower];
  }

  // If it's already a full name (more than 3 chars), capitalize it
  if (color.length > 3) {
    return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
  }

  return color;
}

/**
 * Format earnings as currency
 */
function formatEarnings(earnings: number): string {
  if (earnings === 0) return '$0';
  return '$' + earnings.toLocaleString();
}

/**
 * Format W-P-S record
 * Format: starts-wins-places-shows
 */
function formatRecord(starts: number, wins: number, places: number, shows: number): string {
  return `${starts}-${wins}-${places}-${shows}`;
}

/**
 * Format record with earnings
 * Format: starts-wins-places-shows (earnings)
 */
function formatRecordWithEarnings(
  starts: number,
  wins: number,
  places: number,
  shows: number,
  earnings: number
): string {
  const record = formatRecord(starts, wins, places, shows);
  if (earnings > 0) {
    return `${record} (${formatEarnings(earnings)})`;
  }
  return record;
}

/**
 * Format connection stats: "Name (W-P-S from starts)"
 */
function formatConnectionStats(
  name: string,
  starts: number,
  wins: number,
  places: number,
  shows: number
): { name: string; stats: string } {
  if (starts === 0) {
    return { name, stats: '' };
  }
  return {
    name,
    stats: `(${wins}-${places}-${shows} from ${starts})`,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HorseProfile displays reference information about a horse including
 * identity, breeding, connections, and performance records.
 */
export function HorseProfile({ horse }: HorseProfileProps): React.ReactElement {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Format trainer stats
  const trainerStats = formatConnectionStats(
    horse.trainerName,
    horse.trainerMeetStarts,
    horse.trainerMeetWins,
    horse.trainerMeetPlaces,
    horse.trainerMeetShows
  );

  // Format jockey stats
  const jockeyStats = formatConnectionStats(
    horse.jockeyName,
    horse.jockeyMeetStarts,
    horse.jockeyMeetWins,
    horse.jockeyMeetPlaces,
    horse.jockeyMeetShows
  );

  return (
    <div>
      {/* SECTION A — Identity */}
      <section style={sectionStyles}>
        <h4 style={sectionHeaderStyles}>Identity</h4>
        <div style={cardStyles}>
          <div style={rowStyles}>
            <span style={labelStyles}>Age</span>
            <span style={valueStyles}>{horse.age} yo</span>
          </div>
          <div style={rowStyles}>
            <span style={labelStyles}>Sex</span>
            <span style={valueStyles}>{mapSexCode(horse.sex, horse.sexFull)}</span>
          </div>
          {horse.color && (
            <div style={rowStyles}>
              <span style={labelStyles}>Color</span>
              <span style={valueStyles}>{mapColorCode(horse.color)}</span>
            </div>
          )}
          {horse.breeding.whereBred && (
            <div style={{ ...rowStyles, marginBottom: 0 }}>
              <span style={labelStyles}>State/Country Bred</span>
              <span style={valueStyles}>{horse.breeding.whereBred}</span>
            </div>
          )}
        </div>
      </section>

      {/* SECTION B — Breeding */}
      <section style={sectionStyles}>
        <h4 style={sectionHeaderStyles}>Breeding</h4>
        <div style={cardStyles}>
          <div style={rowStyles}>
            <span style={labelStyles}>Sire</span>
            <span style={valueStyles}>{horse.breeding.sire || '—'}</span>
          </div>
          <div style={rowStyles}>
            <span style={labelStyles}>Dam</span>
            <span style={valueStyles}>{horse.breeding.dam || '—'}</span>
          </div>
          <div style={rowStyles}>
            <span style={labelStyles}>Dam's Sire</span>
            <span style={valueStyles}>{horse.breeding.damSire || '—'}</span>
          </div>
          {horse.breeding.breeder && (
            <div style={{ ...rowStyles, marginBottom: 0 }}>
              <span style={labelStyles}>Breeder</span>
              <span style={valueStyles}>{horse.breeding.breeder}</span>
            </div>
          )}
        </div>
      </section>

      {/* SECTION C — Connections */}
      <section style={sectionStyles}>
        <h4 style={sectionHeaderStyles}>Connections</h4>
        <div style={cardStyles}>
          {/* Owner */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <span style={labelStyles}>Owner</span>
            <div style={connectionNameStyles}>{horse.owner || '—'}</div>
          </div>

          {/* Trainer */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <span style={labelStyles}>Trainer</span>
            <div style={connectionNameStyles}>
              {trainerStats.name}
              {trainerStats.stats && (
                <span style={{ ...connectionStatsStyles, marginLeft: 'var(--space-2)' }}>
                  {trainerStats.stats}
                </span>
              )}
            </div>
          </div>

          {/* Jockey */}
          <div>
            <span style={labelStyles}>Jockey</span>
            <div style={connectionNameStyles}>
              {jockeyStats.name}
              {jockeyStats.stats && (
                <span style={{ ...connectionStatsStyles, marginLeft: 'var(--space-2)' }}>
                  {jockeyStats.stats}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION D — Record */}
      <section style={sectionStyles}>
        <h4 style={sectionHeaderStyles}>Record</h4>
        <div style={cardStyles}>
          {/* Current Year */}
          <div style={recordRowStyles}>
            <span style={recordLabelStyles}>{currentYear}</span>
            <span style={recordValueStyles}>
              {formatRecordWithEarnings(
                horse.currentYearStarts,
                horse.currentYearWins,
                horse.currentYearPlaces,
                horse.currentYearShows,
                horse.currentYearEarnings
              )}
            </span>
          </div>

          {/* Previous Year */}
          <div style={recordRowStyles}>
            <span style={recordLabelStyles}>{previousYear}</span>
            <span style={recordValueStyles}>
              {formatRecordWithEarnings(
                horse.previousYearStarts,
                horse.previousYearWins,
                horse.previousYearPlaces,
                horse.previousYearShows,
                horse.previousYearEarnings
              )}
            </span>
          </div>

          {/* Lifetime */}
          <div style={recordRowStyles}>
            <span style={recordLabelStyles}>Lifetime</span>
            <span style={recordValueStyles}>
              {formatRecordWithEarnings(
                horse.lifetimeStarts,
                horse.lifetimeWins,
                horse.lifetimePlaces,
                horse.lifetimeShows,
                horse.lifetimeEarnings
              )}
            </span>
          </div>

          {/* Track Record - only show if has starts */}
          {horse.trackStarts > 0 && (
            <div style={{ ...recordRowStyles, borderBottom: 'none' }}>
              <span style={recordLabelStyles}>This Track</span>
              <span style={recordValueStyles}>
                {formatRecord(
                  horse.trackStarts,
                  horse.trackWins,
                  horse.trackPlaces,
                  horse.trackShows
                )}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* SECTION E — Surface/Distance (compact) */}
      <section style={{ ...sectionStyles, marginBottom: 0 }}>
        <h4 style={sectionHeaderStyles}>Surface / Distance</h4>
        <div style={cardStyles}>
          <div style={compactGridStyles}>
            {/* Turf Record */}
            {horse.turfStarts > 0 && (
              <div style={compactItemStyles}>
                <span style={labelStyles}>Turf</span>
                <span style={earningsStyles}>
                  {formatRecord(
                    horse.turfStarts,
                    horse.turfWins,
                    horse.turfPlaces,
                    horse.turfShows
                  )}
                </span>
              </div>
            )}

            {/* Wet Track Record */}
            {horse.wetStarts > 0 && (
              <div style={compactItemStyles}>
                <span style={labelStyles}>Wet</span>
                <span style={earningsStyles}>
                  {formatRecord(
                    horse.wetStarts,
                    horse.wetWins,
                    horse.wetPlaces,
                    horse.wetShows
                  )}
                </span>
              </div>
            )}

            {/* Distance Record */}
            {horse.distanceStarts > 0 && (
              <div style={compactItemStyles}>
                <span style={labelStyles}>Distance</span>
                <span style={earningsStyles}>
                  {formatRecord(
                    horse.distanceStarts,
                    horse.distanceWins,
                    horse.distancePlaces,
                    horse.distanceShows
                  )}
                </span>
              </div>
            )}

            {/* Surface Record (current surface) */}
            {horse.surfaceStarts > 0 && (
              <div style={compactItemStyles}>
                <span style={labelStyles}>Surface</span>
                <span style={earningsStyles}>
                  {horse.surfaceStarts}-{horse.surfaceWins}
                </span>
              </div>
            )}
          </div>

          {/* Show message if no surface/distance data */}
          {horse.turfStarts === 0 &&
            horse.wetStarts === 0 &&
            horse.distanceStarts === 0 &&
            horse.surfaceStarts === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                No surface/distance records available
              </div>
            )}
        </div>
      </section>
    </div>
  );
}
