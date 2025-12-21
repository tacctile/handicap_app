import { useCallback } from 'react';

/**
 * RaceTabsBar - Horizontal tab bar for race navigation (R1, R2, R3... up to R12)
 *
 * Features:
 * - Horizontal scroll if races exceed viewport width
 * - Each tab shows: race number, surface icon (dirt/turf), distance shorthand
 * - Active tab highlighted with primary color border-bottom (2px)
 * - Right side: race metadata summary placeholder
 */

export interface RaceMetadata {
  raceNumber: number;
  surface: 'dirt' | 'turf' | 'synthetic' | 'unknown';
  distance: string; // e.g., "6f", "1m", "1 1/16m"
  trackCode?: string;
  raceDate?: string;
  raceType?: string;
}

interface RaceTabsBarProps {
  /** Array of race metadata for each race */
  races: RaceMetadata[];
  /** Currently active race index (0-based) */
  activeRaceIndex: number;
  /** Callback when a race tab is selected */
  onRaceSelect: (raceIndex: number) => void;
  /** Optional className for custom styling */
  className?: string;
}

export function RaceTabsBar({
  races,
  activeRaceIndex,
  onRaceSelect,
  className = '',
}: RaceTabsBarProps) {
  const handleTabClick = useCallback(
    (index: number) => {
      onRaceSelect(index);
    },
    [onRaceSelect]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onRaceSelect(index);
      }
    },
    [onRaceSelect]
  );

  // Get surface icon based on surface type
  const getSurfaceIcon = (surface: RaceMetadata['surface']): string => {
    switch (surface) {
      case 'dirt':
        return 'terrain';
      case 'turf':
        return 'grass';
      case 'synthetic':
        return 'layers';
      default:
        return 'help_outline';
    }
  };

  // Get first race's metadata for the summary display
  const activeRace = races[activeRaceIndex];

  return (
    <div className={`race-tabs-bar ${className}`} style={containerStyles}>
      {/* Tabs container - scrollable */}
      <div className="race-tabs-bar__tabs" style={tabsContainerStyles}>
        {races.map((race, index) => {
          const isActive = index === activeRaceIndex;
          return (
            <button
              key={race.raceNumber}
              className={`race-tabs-bar__tab ${isActive ? 'active' : ''}`}
              style={{
                ...tabStyles,
                ...(isActive ? activeTabStyles : {}),
              }}
              onClick={() => handleTabClick(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              aria-selected={isActive}
              aria-label={`Race ${race.raceNumber}, ${race.surface}, ${race.distance}`}
              role="tab"
            >
              <span className="race-tabs-bar__tab-number" style={tabNumberStyles}>
                R{race.raceNumber}
              </span>
              <span className="material-icons race-tabs-bar__tab-surface" style={tabSurfaceStyles}>
                {getSurfaceIcon(race.surface)}
              </span>
              <span className="race-tabs-bar__tab-distance" style={tabDistanceStyles}>
                {race.distance}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right side - Race metadata summary (placeholder) */}
      <div className="race-tabs-bar__summary" style={summaryStyles}>
        {activeRace && (
          <>
            <span className="race-tabs-bar__summary-track" style={summaryTextStyles}>
              {activeRace.trackCode || '[Track Code]'}
            </span>
            <span className="race-tabs-bar__summary-divider" style={summaryDividerStyles}>
              |
            </span>
            <span className="race-tabs-bar__summary-date" style={summaryTextStyles}>
              {activeRace.raceDate || '[Date]'}
            </span>
            <span className="race-tabs-bar__summary-divider" style={summaryDividerStyles}>
              |
            </span>
            <span className="race-tabs-bar__summary-type" style={summaryTextStyles}>
              {activeRace.raceType || '[Race Type]'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Styles using CSS custom properties
const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '48px',
  width: '100%',
  backgroundColor: 'var(--color-cards, #0F0F10)',
  borderBottom: '1px solid var(--color-border-subtle, #2A2A2C)',
  padding: '0 var(--space-4, 16px)',
};

const tabsContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--gap-element, 8px)',
  overflowX: 'auto',
  overflowY: 'hidden',
  flexShrink: 1,
  minWidth: 0,
  // Hide scrollbar but allow scrolling
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const tabStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--gap-tight, 4px)',
  padding: '0 var(--space-3, 12px)',
  height: '40px',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  borderRadius: 'var(--radius-md, 6px)',
  color: 'var(--color-text-secondary, #B4B4B6)',
  cursor: 'pointer',
  transition: 'all 150ms ease-out',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const activeTabStyles: React.CSSProperties = {
  borderBottomColor: 'var(--color-primary, #19abb5)',
  color: 'var(--color-text-primary, #EEEFF1)',
  backgroundColor: 'rgba(25, 171, 181, 0.1)',
};

const tabNumberStyles: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '14px',
  fontVariantNumeric: 'tabular-nums',
};

const tabSurfaceStyles: React.CSSProperties = {
  fontSize: '16px',
  opacity: 0.7,
};

const tabDistanceStyles: React.CSSProperties = {
  fontSize: '12px',
  opacity: 0.8,
};

const summaryStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--gap-element, 8px)',
  marginLeft: 'var(--space-4, 16px)',
  flexShrink: 0,
};

const summaryTextStyles: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-tertiary, #6E6E70)',
};

const summaryDividerStyles: React.CSSProperties = {
  color: 'var(--color-border-subtle, #2A2A2C)',
  fontSize: '12px',
};

export default RaceTabsBar;
