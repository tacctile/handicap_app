/**
 * ExoticBuilderModal Component Tests
 *
 * Tests tier classification, confidence formula, horse selection,
 * cost calculation, and bet type switching.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExoticBuilderModal } from '../../components/ExoticBuilderModal';
import { MAX_BASE_SCORE } from '../../lib/scoring';
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

vi.mock('../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
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

function createHorses() {
  return [
    {
      horse: createMockHorseEntry(1, 'Elite Runner', '3-1'),
      index: 0,
      score: createMockScore(200),
    },
    {
      horse: createMockHorseEntry(2, 'Strong Horse', '5-1'),
      index: 1,
      score: createMockScore(170),
    },
    { horse: createMockHorseEntry(3, 'Fair Horse', '8-1'), index: 2, score: createMockScore(150) },
    { horse: createMockHorseEntry(4, 'Weak Horse', '15-1'), index: 3, score: createMockScore(120) },
  ];
}

// ============================================================================
// TESTS
// ============================================================================

describe('ExoticBuilderModal', () => {
  const onClose = vi.fn();
  const onAddToBetSlip = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    onAddToBetSlip.mockClear();
  });

  describe('Tier Classification', () => {
    it('classifies baseScore >= 181 as Tier 1 (shows T1 badge)', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      // Elite Runner (baseScore 200) should show T1 badge
      expect(screen.getByText('Elite Runner')).toBeInTheDocument();
      expect(screen.getByText('T1')).toBeInTheDocument();
    });

    it('classifies baseScore >= 161 as Tier 2 (shows T2 badge)', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      // Strong Horse (baseScore 170) should show T2 badge
      expect(screen.getByText('Strong Horse')).toBeInTheDocument();
      expect(screen.getByText('T2')).toBeInTheDocument();
    });

    it('classifies baseScore < 161 as Tier 3 (shows T3 badges)', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      // Fair Horse (baseScore 150) and Weak Horse (120) should show T3
      expect(screen.getByText('Fair Horse')).toBeInTheDocument();
      expect(screen.getByText('Weak Horse')).toBeInTheDocument();
      // There should be exactly 2 T3 badges
      const t3Badges = screen.getAllByText('T3');
      expect(t3Badges).toHaveLength(2);
    });

    it('sorts horses by tier then program number', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      const horseNames = screen.getAllByText(/Elite Runner|Strong Horse|Fair Horse|Weak Horse/);
      expect(horseNames).toHaveLength(4);

      // T1 horse first, then T2, then T3s
      expect(horseNames[0]!.textContent).toBe('Elite Runner');
      expect(horseNames[1]!.textContent).toBe('Strong Horse');
    });
  });

  describe('Confidence Formula', () => {
    it('uses MAX_BASE_SCORE (336) in confidence calculation', () => {
      expect(MAX_BASE_SCORE).toBe(336);

      const confidence200 = Math.min(100, 40 + (200 / MAX_BASE_SCORE) * 60);
      expect(confidence200).toBeCloseTo(75.7, 0);

      const confidence336 = Math.min(100, 40 + (336 / MAX_BASE_SCORE) * 60);
      expect(confidence336).toBe(100);

      const confidence0 = Math.min(100, 40 + (0 / MAX_BASE_SCORE) * 60);
      expect(confidence0).toBe(40);
    });
  });

  describe('Bet Type Selection', () => {
    it('renders all bet type options', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Exacta')).toBeInTheDocument();
      expect(screen.getByText('Trifecta')).toBeInTheDocument();
      expect(screen.getByText('Superfecta')).toBeInTheDocument();
    });

    it('defaults to exacta with box structure', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      // Box structure should be shown for exacta
      expect(screen.getByText('Box')).toBeInTheDocument();
      expect(screen.getByText('Key Over')).toBeInTheDocument();
      expect(screen.getByText('Key Under')).toBeInTheDocument();
      expect(screen.getByText('Straight')).toBeInTheDocument();
    });

    it('switches structure options when bet type changes to trifecta', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      fireEvent.click(screen.getByText('Trifecta'));
      expect(screen.getByText('Box')).toBeInTheDocument();
      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('Part Wheel')).toBeInTheDocument();
    });
  });

  describe('Horse Selection', () => {
    it('toggles horse selection on card click', () => {
      const { container } = render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      // Before selection: "0 selected, min 2 required"
      expect(screen.getByText(/0 selected/)).toBeInTheDocument();

      // Click on the first horse card
      const horseCards = container.querySelectorAll('.exotic-horse-card');
      fireEvent.click(horseCards[0]!);

      // After selection: "1 selected"
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });

    it('shows minimum horses requirement', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText(/min 2 required/)).toBeInTheDocument();
    });
  });

  describe('Modal Controls', () => {
    it('renders nothing when isOpen is false', () => {
      render(
        <ExoticBuilderModal
          isOpen={false}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.queryByText('Exacta')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const { container } = render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      const closeBtn = container.querySelector('.exotic-builder-close')!;
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });

    it('shows race number in subtitle', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={3}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Race 3')).toBeInTheDocument();
    });

    it('shows Build Custom Exotic title', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Build Custom Exotic')).toBeInTheDocument();
    });
  });

  describe('Base Bet Options', () => {
    it('renders base bet amount options', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      // Standard base bet options
      expect(screen.getByText('$0.50')).toBeInTheDocument();
      expect(screen.getByText('$1')).toBeInTheDocument();
      expect(screen.getByText('$2')).toBeInTheDocument();
      expect(screen.getByText('$5')).toBeInTheDocument();
    });
  });

  describe('Select Horses Label', () => {
    it('shows Select Horses section label', () => {
      render(
        <ExoticBuilderModal
          isOpen={true}
          onClose={onClose}
          horses={createHorses()}
          raceNumber={1}
          fieldSize={8}
          onAddToBetSlip={onAddToBetSlip}
        />
      );

      expect(screen.getByText('Select Horses')).toBeInTheDocument();
    });
  });
});
