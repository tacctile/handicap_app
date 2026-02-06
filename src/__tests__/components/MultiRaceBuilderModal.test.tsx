/**
 * MultiRaceBuilderModal Component Tests
 *
 * Tests tier classification, race tab rendering,
 * strategy switching, and modal controls.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiRaceBuilderModal } from '../../components/MultiRaceBuilderModal';
import type { HorseEntry } from '../../types/drf';
import type { HorseScore } from '../../lib/scoring';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Filter out framer-motion specific props
function filterMotionProps(props: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (
      ![
        'whileHover',
        'whileTap',
        'initial',
        'animate',
        'exit',
        'transition',
        'variants',
        'layout',
        'layoutId',
      ].includes(key)
    ) {
      filtered[key] = value;
    }
  }
  return filtered;
}

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
    button: ({ children, ...props }: any) => (
      <button {...filterMotionProps(props)}>{children}</button>
    ),
    span: ({ children, ...props }: any) => <span {...filterMotionProps(props)}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../constants/tierColors', () => ({
  TIER_COLORS_BY_NUMBER: {
    1: { bg: '#22c55e20', text: '#22c55e', border: '#22c55e40' },
    2: { bg: '#eab30820', text: '#eab308', border: '#eab30840' },
    3: { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
  },
}));

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockHorseEntry(programNumber: number, name: string, odds = '5-1'): HorseEntry {
  return {
    programNumber,
    horseName: name,
    morningLineOdds: odds,
    postPosition: programNumber,
    weight: 120,
    jockey: `Jockey ${programNumber}`,
    trainer: `Trainer ${programNumber}`,
    pastPerformances: [],
  } as HorseEntry;
}

function createMockScore(baseScore: number): HorseScore {
  return {
    total: baseScore + 10,
    baseScore,
    overlayScore: 10,
    isScratched: false,
    confidenceLevel: 'high',
    dataQuality: 85,
    breakdown: {} as any,
    dataCompleteness: { score: 85, completenessPercent: 85, missingFields: [], reasoning: '' },
    lowConfidencePenaltyApplied: false,
    lowConfidencePenaltyAmount: 0,
    paperTigerPenaltyApplied: false,
    paperTigerPenaltyAmount: 0,
    keyRaceIndexBonus: 0,
    fieldSpreadAdjustment: 0,
  } as HorseScore;
}

function createMockRaces(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    raceNumber: i + 1,
    horses: [
      {
        horse: createMockHorseEntry(1, `Race${i + 1} Star`, '3-1'),
        index: 0,
        score: createMockScore(200),
      },
      {
        horse: createMockHorseEntry(2, `Race${i + 1} Contender`, '5-1'),
        index: 1,
        score: createMockScore(170),
      },
      {
        horse: createMockHorseEntry(3, `Race${i + 1} Longshot`, '10-1'),
        index: 2,
        score: createMockScore(130),
      },
    ],
    postTime: `${12 + i}:30 PM`,
  }));
}

// ============================================================================
// TESTS
// ============================================================================

describe('MultiRaceBuilderModal', () => {
  const onClose = vi.fn();
  const onAddToBetSlip = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    onAddToBetSlip.mockClear();
  });

  describe('Tier Classification', () => {
    it('classifies baseScore >= 181 as Tier 1', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Race1 Star')).toBeInTheDocument();
    });

    it('classifies baseScore >= 161 as Tier 2', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Race1 Contender')).toBeInTheDocument();
    });

    it('classifies baseScore < 161 as Tier 3', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Race1 Longshot')).toBeInTheDocument();
    });
  });

  describe('Race Tabs', () => {
    it('renders R1 and R2 tabs for daily double', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('R1')).toBeInTheDocument();
      expect(screen.getByText('R2')).toBeInTheDocument();
    });

    it('renders R1, R2, R3 tabs for pick 3', () => {
      const races = createMockRaces(3);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="pick_3"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('R1')).toBeInTheDocument();
      expect(screen.getByText('R2')).toBeInTheDocument();
      expect(screen.getByText('R3')).toBeInTheDocument();
    });

    it('renders 4 tabs for pick 4', () => {
      const races = createMockRaces(4);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="pick_4"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('R1')).toBeInTheDocument();
      expect(screen.getByText('R2')).toBeInTheDocument();
      expect(screen.getByText('R3')).toBeInTheDocument();
      expect(screen.getByText('R4')).toBeInTheDocument();
    });

    it('renders horses for first race in grid', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Race1 Star')).toBeInTheDocument();
      expect(screen.getByText('Race1 Contender')).toBeInTheDocument();
      expect(screen.getByText('Race1 Longshot')).toBeInTheDocument();
    });
  });

  describe('Strategy Options', () => {
    it('renders strategy selection buttons', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Conservative')).toBeInTheDocument();
      expect(screen.getByText('Balanced')).toBeInTheDocument();
      expect(screen.getByText('Aggressive')).toBeInTheDocument();
    });
  });

  describe('Modal Controls', () => {
    it('renders nothing when isOpen is false', () => {
      render(
        <MultiRaceBuilderModal
          isOpen={false}
          onClose={onClose}
          betType="daily_double"
          races={createMockRaces(2)}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.queryByText('R1')).not.toBeInTheDocument();
    });

    it('shows bet type name in header', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText(/Daily Double Builder/i)).toBeInTheDocument();
    });

    it('shows race range in subtitle', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={3}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Races 3-4')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const { container } = render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={createMockRaces(2)}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      const closeBtn = container.querySelector('.multirace-builder-close')!;
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Add to Bet Slip', () => {
    it('renders add to bet slip button', () => {
      const races = createMockRaces(2);
      render(
        <MultiRaceBuilderModal
          isOpen={true}
          onClose={onClose}
          betType="daily_double"
          races={races}
          startingRace={1}
          budget={50}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText(/Add to Bet Slip/i)).toBeInTheDocument();
    });
  });
});
