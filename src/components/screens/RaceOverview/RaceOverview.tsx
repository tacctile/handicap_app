import React, { useMemo } from 'react';
import { RaceCard } from './RaceCard';
import type { ParsedRace } from '../../../types/drf';
import type { ScoredHorse } from '../../../lib/scoring';
import { analyzeRaceValue, type RaceVerdict } from '../../../hooks/useValueDetection';

// ============================================================================
// TYPES
// ============================================================================

export interface RaceOverviewProps {
  /** Array of parsed race data */
  races: ParsedRace[];
  /** Track name for display */
  trackName: string;
  /** Race date for display */
  raceDate: string;
  /** Callback when a race card is selected */
  onSelectRace: (raceNumber: number) => void;
  /** Pre-scored horses for all races (optional, for verdict calculation) */
  allScoredHorses?: ScoredHorse[][];
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-base)',
};

const headerStyles: React.CSSProperties = {
  padding: 'var(--space-6)',
  paddingBottom: 'var(--space-4)',
  borderBottom: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--bg-card)',
};

const trackNameStyles: React.CSSProperties = {
  fontSize: 'var(--text-2xl)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
  margin: 0,
  lineHeight: 'var(--leading-tight)',
};

const metaRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
};

const gridContainerStyles: React.CSSProperties = {
  padding: 'var(--space-6)',
  flex: 1,
};

// Grid styles need to be CSS for responsive behavior
const gridClassName = 'race-overview-grid';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format distance for compact display
 */
function formatDistanceCompact(distance: string | undefined): string {
  if (!distance) return '';

  const d = distance.toLowerCase();

  // Handle mile distances
  if (d.includes('mile')) {
    if (d.includes('1 1/16')) return '1 1/16mi';
    if (d.includes('1 1/8')) return '1⅛mi';
    if (d.includes('1 1/4')) return '1¼mi';
    if (d.includes('1 1/2')) return '1½mi';
    if (d.includes('1 3/16')) return '1 3/16mi';
    if (d.includes('1 3/8')) return '1⅜mi';
    if (/^1\s*mile$/i.test(d.trim()) || /^about\s*1\s*mile$/i.test(d.trim())) {
      return '1mi';
    }
    return '1mi';
  }

  // Handle furlong distances
  const furlongMatch = d.match(/(\d+\.?\d*)\s*(f|furlong)/i);
  if (furlongMatch) {
    const furlongs = parseFloat(furlongMatch[1] || '6');
    if (furlongs === Math.floor(furlongs)) {
      return `${Math.floor(furlongs)}F`;
    }
    const whole = Math.floor(furlongs);
    const frac = furlongs - whole;
    if (frac >= 0.4 && frac <= 0.6) {
      return `${whole}½F`;
    }
    return `${furlongs}F`;
  }

  return distance;
}

/**
 * Format race classification for display
 */
function formatRaceClass(
  classification: string | undefined,
  raceType: string | undefined,
  claimingPriceMin?: number | null,
  claimingPriceMax?: number | null
): string {
  // Try raceType first if it's meaningful
  if (raceType && raceType.trim() && raceType.trim().toUpperCase() !== 'UNKNOWN') {
    return raceType.trim();
  }

  if (!classification || classification === 'unknown') {
    return '';
  }

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${Math.round(price / 1000)}K`;
    }
    return `$${price}`;
  };

  const claimingPrice = claimingPriceMax || claimingPriceMin;

  const classMap: Record<string, string> = {
    maiden: 'Maiden',
    'maiden-claiming': claimingPrice ? `Mdn Clm ${formatPrice(claimingPrice)}` : 'Mdn Clm',
    claiming: claimingPrice ? `Clm ${formatPrice(claimingPrice)}` : 'Claiming',
    allowance: 'Allowance',
    'allowance-optional-claiming': 'AOC',
    'starter-allowance': 'Starter Alw',
    stakes: 'Stakes',
    'stakes-listed': 'Listed Stakes',
    'stakes-graded-1': 'Grade 1',
    'stakes-graded-2': 'Grade 2',
    'stakes-graded-3': 'Grade 3',
    handicap: 'Handicap',
  };

  return classMap[classification] || '';
}

/**
 * Calculate verdict for a race based on scored horses
 */
function calculateVerdict(scoredHorses: ScoredHorse[]): RaceVerdict {
  if (!scoredHorses || scoredHorses.length === 0) {
    return 'PASS';
  }

  // Use the same value analysis logic as the existing RaceOverview
  const analysis = analyzeRaceValue(
    scoredHorses,
    (index, originalOdds) => {
      const horse = scoredHorses.find((sh) => sh.index === index);
      return horse?.horse.morningLineOdds ?? originalOdds;
    },
    (index) => {
      const horse = scoredHorses.find((sh) => sh.index === index);
      return horse?.score.isScratched ?? false;
    }
  );

  return analysis.verdict;
}

/**
 * Get top 3 horses by score for a race
 */
function getTopHorsesForRace(
  scoredHorses: ScoredHorse[] | undefined
): Array<{ rank: number; name: string }> {
  if (!scoredHorses || scoredHorses.length === 0) {
    return [];
  }

  // Filter out scratched horses and sort by rank
  const activeHorses = scoredHorses
    .filter((sh) => !sh.score.isScratched)
    .sort((a, b) => a.rank - b.rank);

  return activeHorses.slice(0, 3).map((sh, idx) => ({
    rank: idx + 1,
    name: sh.horse.horseName,
  }));
}

/**
 * Placeholder verdict logic when no scored horses available
 * Based on tier classification: tier1 exists = BET, tier2 only = CAUTION, else = PASS
 */
function placeholderVerdict(_race: ParsedRace): RaceVerdict {
  // Without scoring data, default to CAUTION to indicate user should investigate
  return 'CAUTION';
}

// ============================================================================
// CSS INJECTION
// ============================================================================

// Inject CSS for responsive grid (only once)
const styleId = 'race-overview-grid-styles';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .race-overview-grid {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(3, 1fr);
    }

    /* Smaller tablets: 2 columns */
    @media (max-width: 900px) {
      .race-overview-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* Mobile: 1 column */
    @media (max-width: 600px) {
      .race-overview-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RaceOverview screen displays a grid of race cards for quick scanning.
 * Users can see all races at a glance and click to dive into race details.
 */
export function RaceOverview({
  races,
  trackName,
  raceDate,
  onSelectRace,
  allScoredHorses,
}: RaceOverviewProps): React.ReactElement {
  // Calculate verdicts and top horses for each race
  const raceData = useMemo(() => {
    return races.map((race, index) => {
      const scoredHorses = allScoredHorses?.[index];
      const verdict = scoredHorses ? calculateVerdict(scoredHorses) : placeholderVerdict(race);
      const topHorses = getTopHorsesForRace(scoredHorses);

      return {
        race,
        verdict,
        topHorses,
      };
    });
  }, [races, allScoredHorses]);

  return (
    <div style={containerStyles}>
      {/* Header Section */}
      <header style={headerStyles}>
        <h1 style={trackNameStyles}>{trackName}</h1>
        <div style={metaRowStyles}>
          <span>{raceDate}</span>
          <span>·</span>
          <span>
            {races.length} Race{races.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Race Cards Grid */}
      <div style={gridContainerStyles}>
        <div className={gridClassName}>
          {raceData.map(({ race, verdict, topHorses }, index) => {
            const header = race.header;
            const raceNumber = header?.raceNumber || index + 1;
            const fieldSize = race.horses?.length || header?.fieldSize || 0;

            return (
              <RaceCard
                key={raceNumber}
                raceNumber={raceNumber}
                trackCode={header?.trackCode || ''}
                distance={formatDistanceCompact(header?.distance)}
                surface={header?.surface || ''}
                raceType={formatRaceClass(
                  header?.classification,
                  header?.raceType,
                  header?.claimingPriceMin,
                  header?.claimingPriceMax
                )}
                fieldSize={fieldSize}
                postTime={header?.postTime}
                verdict={verdict}
                topHorses={topHorses}
                onClick={() => onSelectRace(raceNumber)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
