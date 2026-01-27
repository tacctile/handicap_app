import React, { useMemo, useState } from 'react';
import { RaceHeader } from './RaceHeader';
import { HorseList } from './HorseList';
import { Button } from '../../ui';
import type { ParsedRace } from '../../../types/drf';
import type { ScoredHorse } from '../../../lib/scoring';
import { MAX_SCORE } from '../../../lib/scoring';
import { analyzeRaceValue } from '../../../hooks/useValueDetection';

// ============================================================================
// TYPES
// ============================================================================

export interface RaceDetailProps {
  race: ParsedRace;
  scoredHorses: ScoredHorse[];
  verdict: 'BET' | 'PASS' | 'CAUTION';
  onBack: () => void;
  onSelectHorse: (postPosition: number) => void;
  /** Optional callback to open ticket view */
  onViewTicket?: () => void;
  /** Optional callback to open top bets view */
  onViewTopBets?: () => void;
  /** Optional function to get current odds for a horse */
  getOdds?: (index: number, originalOdds: string) => string;
  /** Optional function to check if a horse is scratched */
  isScratched?: (index: number) => boolean;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: 'var(--bg-base)',
};

const mainContentStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
};

const aiSummaryBarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) var(--space-4)',
  backgroundColor: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border-subtle)',
};

const aiSummaryTextStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
};

const aiExpandButtonStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
  backgroundColor: 'transparent',
  border: 'none',
  padding: 'var(--space-1) var(--space-2)',
  cursor: 'pointer',
  transition: 'var(--transition-fast)',
};

const horseListContainerStyles: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const bottomBarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  backgroundColor: 'var(--bg-card)',
  borderTop: '1px solid var(--border-subtle)',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format distance for display
 */
function formatDistance(distance: string | number | undefined): string {
  if (!distance) return '';
  const d = String(distance).toLowerCase();
  // Already formatted
  if (d.includes('f') || d.includes('m')) return d;
  // Raw furlongs number
  const furlongs = parseFloat(d);
  if (isNaN(furlongs)) return d;
  if (furlongs >= 8) {
    const miles = furlongs / 8;
    if (Number.isInteger(miles)) return `${miles}m`;
    return `${miles.toFixed(2).replace(/\.?0+$/, '')}m`;
  }
  return `${furlongs}f`;
}

/**
 * Format race type for display
 */
function formatRaceType(header: ParsedRace['header']): string {
  if (!header) return '';

  // Build race type string
  const parts: string[] = [];

  // Classification/Race type
  if (header.classification) {
    const classMap: Record<string, string> = {
      'maiden': 'Msw',
      'maiden-claiming': 'Mcl',
      'claiming': 'Clm',
      'allowance': 'Alw',
      'allowance-optional-claiming': 'Aoc',
      'starter-allowance': 'Str',
      'stakes': 'Stk',
      'stakes-listed': 'LStk',
      'stakes-graded-3': 'G3',
      'stakes-graded-2': 'G2',
      'stakes-graded-1': 'G1',
      'handicap': 'Hcp',
    };
    parts.push(classMap[header.classification] || header.classification);
  }

  // Claiming price
  if (header.claimingPriceMax) {
    parts.push(`$${(header.claimingPriceMax / 1000).toFixed(0)}K`);
  }

  return parts.join(' ');
}

/**
 * Format purse for display
 */
function formatPurse(purse: number | undefined): string | undefined {
  if (!purse) return undefined;
  if (purse >= 1000000) {
    return `$${(purse / 1000000).toFixed(1)}M`;
  }
  if (purse >= 1000) {
    return `$${(purse / 1000).toFixed(0)}K`;
  }
  return `$${purse}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RaceDetail screen displays the single race view with horse list as the hero.
 * Users see all horses at a glance with scores, odds, and value indicators.
 */
export function RaceDetail({
  race,
  scoredHorses,
  verdict,
  onBack,
  onSelectHorse,
  onViewTicket,
  onViewTopBets,
  getOdds,
  isScratched,
}: RaceDetailProps): React.ReactElement {
  const [aiExpanded, setAiExpanded] = useState(false);

  const header = race.header;

  // Calculate value analysis for edge display
  const valueAnalysis = useMemo(() => {
    const defaultGetOdds = (index: number, original: string) => {
      const found = scoredHorses.find((h) => h.index === index);
      return found?.horse.morningLineOdds || original;
    };
    const defaultIsScratched = (index: number) => {
      const found = scoredHorses.find((h) => h.index === index);
      return found?.score.isScratched || false;
    };

    return analyzeRaceValue(
      scoredHorses,
      getOdds || defaultGetOdds,
      isScratched || defaultIsScratched
    );
  }, [scoredHorses, getOdds, isScratched]);

  // Create a map of horse index to value edge
  const valueEdgeMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const play of valueAnalysis.valuePlays) {
      map.set(play.horseIndex, play.valueEdge);
    }
    return map;
  }, [valueAnalysis.valuePlays]);

  // Get value edge for a horse
  const getValueEdge = (horseIndex: number): number | undefined => {
    return valueEdgeMap.get(horseIndex);
  };

  // Find best bet (primary value play or top ranked)
  const bestBetPost = useMemo(() => {
    if (valueAnalysis.primaryValuePlay) {
      return valueAnalysis.primaryValuePlay.programNumber;
    }
    // Otherwise use top ranked horse
    const topRanked = scoredHorses.find((h) => h.rank === 1 && !h.score.isScratched);
    return topRanked?.horse.postPosition;
  }, [valueAnalysis.primaryValuePlay, scoredHorses]);

  return (
    <div style={containerStyles}>
      {/* Race Header */}
      <RaceHeader
        raceNumber={header?.raceNumber || 1}
        trackCode={header?.trackCode || ''}
        distance={formatDistance(header?.distanceText || header?.distance)}
        surface={header?.surface || 'Dirt'}
        raceType={formatRaceType(header)}
        purse={formatPurse(header?.purse)}
        fieldSize={race.horses?.length || 0}
        postTime={undefined} // TODO: Format post time from header
        verdict={verdict}
        onBack={onBack}
      />

      {/* Main Content Area */}
      <div style={mainContentStyles}>
        {/* AI Summary placeholder - collapsed by default */}
        <div style={aiSummaryBarStyles}>
          <span style={aiSummaryTextStyles}>
            {aiExpanded ? 'AI Analysis' : 'AI Analysis available'}
          </span>
          <button
            style={aiExpandButtonStyles}
            onClick={() => setAiExpanded(!aiExpanded)}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            {aiExpanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>

        {/* AI Analysis content (placeholder - Phase 3) */}
        {aiExpanded && (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
            }}
          >
            AI analysis will be displayed here in Phase 3.
          </div>
        )}

        {/* Horse List - The Hero */}
        <div style={horseListContainerStyles}>
          <HorseList
            horses={scoredHorses}
            onSelectHorse={onSelectHorse}
            bestBetPost={bestBetPost}
            getValueEdge={getValueEdge}
            maxScore={MAX_SCORE}
          />
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div style={bottomBarStyles}>
        {onViewTopBets && (
          <Button variant="ghost" size="sm" onClick={onViewTopBets}>
            Top Bets
          </Button>
        )}
        {onViewTicket && (
          <Button variant="secondary" size="sm" onClick={onViewTicket}>
            View Ticket
          </Button>
        )}
      </div>
    </div>
  );
}
