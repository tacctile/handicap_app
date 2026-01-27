import React, { useState, useMemo } from 'react';
import { HorseRow } from './HorseRow';
import type { ScoredHorse, MAX_SCORE } from '../../../lib/scoring';

// ============================================================================
// TYPES
// ============================================================================

export type SortMode = 'rank' | 'post';

export interface HorseListProps {
  horses: ScoredHorse[];
  onSelectHorse: (postPosition: number) => void;
  bestBetPost?: number;
  /** Optional function to get value edge for a horse */
  getValueEdge?: (horseIndex: number) => number | undefined;
  /** Maximum score for display (defaults to 371) */
  maxScore?: number;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
};

const sortBarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border-subtle)',
};

const sortLabelStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const sortButtonGroupStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-1)',
};

const sortButtonStyles: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-secondary)',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  transition: 'var(--transition-fast)',
};

const sortButtonActiveStyles: React.CSSProperties = {
  backgroundColor: 'var(--bg-active)',
  color: 'var(--text-primary)',
};

const headerRowStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px 1fr 80px 100px 60px 80px',
  gap: 'var(--space-2)',
  alignItems: 'center',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--bg-card)',
  borderBottom: '1px solid var(--border-default)',
};

const headerCellStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const headerCellCenteredStyles: React.CSSProperties = {
  ...headerCellStyles,
  textAlign: 'center',
};

const headerCellRightStyles: React.CSSProperties = {
  ...headerCellStyles,
  textAlign: 'right',
};

const listContainerStyles: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  backgroundColor: 'var(--bg-card)',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HorseList component displays all horses in a race with column headers and sort toggle.
 * Designed for quick scanning with all essential data visible at a glance.
 */
export function HorseList({
  horses,
  onSelectHorse,
  bestBetPost,
  getValueEdge,
  maxScore = 371,
}: HorseListProps): React.ReactElement {
  const [sortMode, setSortMode] = useState<SortMode>('rank');

  // Sort horses based on current mode
  const sortedHorses = useMemo(() => {
    const activeHorses = horses.filter((h) => !h.score.isScratched);
    const scratchedHorses = horses.filter((h) => h.score.isScratched);

    // Sort active horses
    const sorted = [...activeHorses].sort((a, b) => {
      if (sortMode === 'rank') {
        return a.rank - b.rank;
      } else {
        return a.horse.postPosition - b.horse.postPosition;
      }
    });

    // Scratched horses at the end, sorted by post position
    const sortedScratched = [...scratchedHorses].sort(
      (a, b) => a.horse.postPosition - b.horse.postPosition
    );

    return [...sorted, ...sortedScratched];
  }, [horses, sortMode]);

  /**
   * Determine tier based on score thresholds from ALGORITHM_REFERENCE
   * Tier 1: 180-240 (Cover Chalk)
   * Tier 2: 160-179 (Logical Alternatives)
   * Tier 3: 130-159 (Value Bombs)
   */
  const determineTier = (score: number): 1 | 2 | 3 | null => {
    if (score >= 180) return 1;
    if (score >= 160) return 2;
    if (score >= 130) return 3;
    return null;
  };

  return (
    <div style={containerStyles}>
      {/* Sort toggle bar */}
      <div style={sortBarStyles}>
        <span style={sortLabelStyles}>Sort</span>
        <div style={sortButtonGroupStyles}>
          <button
            style={{
              ...sortButtonStyles,
              ...(sortMode === 'rank' ? sortButtonActiveStyles : {}),
            }}
            onClick={() => setSortMode('rank')}
          >
            By Rank
          </button>
          <button
            style={{
              ...sortButtonStyles,
              ...(sortMode === 'post' ? sortButtonActiveStyles : {}),
            }}
            onClick={() => setSortMode('post')}
          >
            By Post
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div style={headerRowStyles}>
        <div style={headerCellCenteredStyles}>Post</div>
        <div style={headerCellStyles}>Horse</div>
        <div style={headerCellRightStyles}>ML</div>
        <div style={headerCellRightStyles}>Score</div>
        <div style={headerCellCenteredStyles}>Rank</div>
        <div style={headerCellRightStyles}>Edge</div>
      </div>

      {/* Horse list */}
      <div style={listContainerStyles}>
        {sortedHorses.map((scoredHorse) => {
          const horse = scoredHorse.horse;
          const valueEdge = getValueEdge?.(scoredHorse.index);

          return (
            <HorseRow
              key={scoredHorse.index}
              postPosition={horse.postPosition}
              programNumber={horse.programNumber?.toString() || horse.postPosition.toString()}
              horseName={horse.horseName}
              jockey={horse.jockeyName || 'Unknown'}
              trainer={horse.trainerName || 'Unknown'}
              morningLineOdds={horse.morningLineOdds || '—'}
              score={scoredHorse.score.baseScore}
              maxScore={maxScore}
              rank={scoredHorse.rank}
              valueEdge={valueEdge}
              tier={determineTier(scoredHorse.score.baseScore)}
              isScratched={scoredHorse.score.isScratched}
              isBestBet={bestBetPost === horse.postPosition}
              onClick={() => onSelectHorse(horse.postPosition)}
            />
          );
        })}
      </div>
    </div>
  );
}
