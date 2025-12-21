import { memo, useRef, useEffect } from 'react';

interface RaceTabInfo {
  raceNumber: number;
  surface: string;
  distance: string;
  confidence: number;
}

interface RaceTabsBarProps {
  races: RaceTabInfo[];
  activeRaceIndex: number;
  onRaceSelect: (index: number) => void;
  trackCode: string;
  raceDate: string;
}

// Surface icon mapping
function getSurfaceIcon(surface: string): string {
  const s = surface.toLowerCase();
  if (s.includes('turf')) return 'grass';
  if (s.includes('dirt')) return 'terrain';
  if (s.includes('synthetic') || s.includes('poly')) return 'blur_on';
  return 'terrain';
}

// Format distance for compact display
function formatDistanceShort(distance: string): string {
  // Try to extract just the number of furlongs or miles
  const match = distance.match(/(\d+(?:\.\d+)?)\s*(f|furlongs?|m|miles?)/i);
  if (match) {
    const num = match[1];
    const unit = match[2]?.toLowerCase();
    if (unit?.startsWith('m')) {
      return `${num}m`;
    }
    return `${num}f`;
  }
  // Fallback: return first part
  return distance.split(' ')[0] || distance;
}

export const RaceTabsBar = memo(function RaceTabsBar({
  races,
  activeRaceIndex,
  onRaceSelect,
  trackCode,
  raceDate,
}: RaceTabsBarProps) {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (activeTabRef.current && tabsContainerRef.current) {
      const container = tabsContainerRef.current;
      const tab = activeTabRef.current;
      const containerRect = container.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();

      // Check if tab is outside visible area
      if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
        tab.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeRaceIndex]);

  return (
    <div className="race-tabs-bar">
      <div className="race-tabs-container" ref={tabsContainerRef}>
        {races.map((race, index) => {
          const isActive = index === activeRaceIndex;
          return (
            <button
              key={race.raceNumber}
              ref={isActive ? activeTabRef : undefined}
              className={`race-tab ${isActive ? 'active' : ''}`}
              onClick={() => onRaceSelect(index)}
              aria-selected={isActive}
              aria-label={`Race ${race.raceNumber}, ${race.distance} ${race.surface}`}
            >
              <span className="race-tab-number">R{race.raceNumber}</span>
              <span className="race-tab-details">
                <span className="material-icons race-tab-surface-icon">
                  {getSurfaceIcon(race.surface)}
                </span>
                <span className="race-tab-distance">{formatDistanceShort(race.distance)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="race-tabs-info">
        <span className="race-tabs-track">{trackCode}</span>
        <span className="race-tabs-date">{raceDate}</span>
      </div>
    </div>
  );
});

export default RaceTabsBar;
