/**
 * RaceOverview Component Tests
 *
 * Tests race card rendering, verdict display, horse sort order,
 * keyboard shortcuts, and scratched horse handling.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RaceOverview } from '../../components/RaceOverview';
import type { ParsedDRFFile, ParsedRace, HorseEntry, RaceHeader } from '../../types/drf';
import type { ScoredHorse } from '../../lib/scoring';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterProps(props)}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...filterProps(props)}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...filterProps(props)}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  memo: (fn: any) => fn,
}));

// Filter out framer-motion specific props
function filterProps(props: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (
      !['whileHover', 'whileTap', 'initial', 'animate', 'exit', 'transition', 'variants'].includes(
        key
      )
    ) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// Mock useValueDetection
vi.mock('../../hooks/useValueDetection', () => ({
  analyzeRaceValue: vi.fn(() => ({
    verdict: 'BET' as const,
    overlayCount: 2,
    totalHorses: 8,
    topOverlay: null,
    secondOverlay: null,
    fieldQuality: 'good',
    separationScore: 50,
    reasons: [],
  })),
}));

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockHorseEntry(programNumber: number, name: string): HorseEntry {
  return {
    programNumber,
    horseName: name,
    morningLineOdds: `${programNumber * 2}-1`,
    postPosition: programNumber,
    weight: 120,
    jockey: `Jockey ${programNumber}`,
    trainer: `Trainer ${programNumber}`,
    owner: `Owner ${programNumber}`,
    sex: 'C',
    age: 4,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimeSeconds: 3,
    lifetimeThirds: 2,
    lifetimeEarnings: 50000,
    lastRaceDistance: '6f',
    lastRaceTrack: 'CD',
    pastPerformances: [],
  } as HorseEntry;
}

function createMockRaceHeader(raceNumber: number): RaceHeader {
  return {
    trackCode: 'CD',
    raceNumber,
    raceDate: '2024-01-15',
    surface: 'dirt',
    distance: '6 Furlongs',
    classification: 'allowance',
    purse: 50000,
    ageRestriction: '3yo+',
    fieldSize: 8,
    isAbout: false,
  } as RaceHeader;
}

function createMockScoredHorse(
  programNumber: number,
  name: string,
  baseScore: number,
  isScratched = false
): ScoredHorse {
  return {
    index: programNumber - 1,
    horse: createMockHorseEntry(programNumber, name),
    score: {
      baseScore,
      overlayScore: 0,
      total: baseScore,
      isScratched,
      breakdown: {} as any,
      confidenceLevel: 'high',
      dataQuality: 85,
      dataCompleteness: { score: 85, completenessPercent: 85, missingFields: [], reasoning: '' },
      lowConfidencePenaltyApplied: false,
      lowConfidencePenaltyAmount: 0,
      paperTigerPenaltyApplied: false,
      paperTigerPenaltyAmount: 0,
      keyRaceIndexBonus: 0,
      fieldSpreadAdjustment: 0,
    },
  } as ScoredHorse;
}

function createMockRace(raceNumber: number, horses: HorseEntry[]): ParsedRace {
  return {
    header: createMockRaceHeader(raceNumber),
    horses,
  } as ParsedRace;
}

function createMockParsedData(raceCount: number): ParsedDRFFile {
  const races: ParsedRace[] = [];
  for (let i = 0; i < raceCount; i++) {
    const horses = [
      createMockHorseEntry(1, `Horse A R${i + 1}`),
      createMockHorseEntry(2, `Horse B R${i + 1}`),
      createMockHorseEntry(3, `Horse C R${i + 1}`),
    ];
    races.push(createMockRace(i + 1, horses));
  }
  return {
    trackCode: 'CD',
    raceDate: '2024-01-15',
    races,
  } as ParsedDRFFile;
}

function createTopHorsesMap(raceCount: number): Map<number, ScoredHorse[]> {
  const map = new Map<number, ScoredHorse[]>();
  for (let i = 0; i < raceCount; i++) {
    map.set(i, [
      createMockScoredHorse(1, `Top Horse R${i + 1}`, 250),
      createMockScoredHorse(2, `Second Horse R${i + 1}`, 220),
      createMockScoredHorse(3, `Third Horse R${i + 1}`, 200),
    ]);
  }
  return map;
}

// ============================================================================
// TESTS
// ============================================================================

describe('RaceOverview', () => {
  const onRaceSelect = vi.fn();

  beforeEach(() => {
    onRaceSelect.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Race Card Rendering', () => {
    it('renders correct number of race cards', () => {
      const parsedData = createMockParsedData(5);
      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(5)}
          onRaceSelect={onRaceSelect}
        />
      );

      // Each race card shows "R{number}"
      expect(screen.getByText('R1')).toBeInTheDocument();
      expect(screen.getByText('R2')).toBeInTheDocument();
      expect(screen.getByText('R3')).toBeInTheDocument();
      expect(screen.getByText('R4')).toBeInTheDocument();
      expect(screen.getByText('R5')).toBeInTheDocument();
    });

    it('renders race conditions on each card', () => {
      const parsedData = createMockParsedData(1);
      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(1)}
          onRaceSelect={onRaceSelect}
        />
      );

      // Should show conditions: distance, surface, classification, horse count
      expect(screen.getByText(/6F/)).toBeInTheDocument();
      expect(screen.getByText(/Dirt/)).toBeInTheDocument();
      expect(screen.getByText(/Allowance/)).toBeInTheDocument();
      expect(screen.getByText(/3 horses/)).toBeInTheDocument();
    });

    it('shows top 3 projected finish horses', () => {
      const parsedData = createMockParsedData(1);
      const topHorses = createTopHorsesMap(1);
      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={topHorses}
          onRaceSelect={onRaceSelect}
        />
      );

      expect(screen.getByText('1st:')).toBeInTheDocument();
      expect(screen.getByText('2nd:')).toBeInTheDocument();
      expect(screen.getByText('3rd:')).toBeInTheDocument();
      expect(screen.getByText('Top Horse R1')).toBeInTheDocument();
      expect(screen.getByText('Second Horse R1')).toBeInTheDocument();
      expect(screen.getByText('Third Horse R1')).toBeInTheDocument();
    });
  });

  describe('Verdict Display', () => {
    it('renders verdict badge on each race card', () => {
      const parsedData = createMockParsedData(1);
      const allScoredHorses = [
        [
          createMockScoredHorse(1, 'Horse A', 250),
          createMockScoredHorse(2, 'Horse B', 220),
          createMockScoredHorse(3, 'Horse C', 200),
        ],
      ];

      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(1)}
          allScoredHorses={allScoredHorses}
          onRaceSelect={onRaceSelect}
        />
      );

      // The mocked analyzeRaceValue returns 'BET'
      expect(screen.getByText('BET')).toBeInTheDocument();
    });

    it('shows PASS when no scored horses for a race', () => {
      const parsedData = createMockParsedData(1);
      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(1)}
          allScoredHorses={[[]]}
          onRaceSelect={onRaceSelect}
        />
      );

      expect(screen.getByText('PASS')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('calls onRaceSelect when number key is pressed', () => {
      const parsedData = createMockParsedData(5);
      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(5)}
          onRaceSelect={onRaceSelect}
        />
      );

      // Simulate pressing "1" key
      fireEvent.keyDown(window, { key: '1' });
      expect(onRaceSelect).toHaveBeenCalledWith(0);

      // Simulate pressing "3" key
      fireEvent.keyDown(window, { key: '3' });
      expect(onRaceSelect).toHaveBeenCalledWith(2);
    });

    it('does not call onRaceSelect for number beyond race count', () => {
      const parsedData = createMockParsedData(3);
      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(3)}
          onRaceSelect={onRaceSelect}
        />
      );

      fireEvent.keyDown(window, { key: '5' });
      expect(onRaceSelect).not.toHaveBeenCalled();
    });
  });

  describe('Race Card Click', () => {
    it('calls onRaceSelect with correct index when card is clicked', () => {
      const parsedData = createMockParsedData(3);
      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(3)}
          onRaceSelect={onRaceSelect}
        />
      );

      // Click the second race card - find it via its aria-label
      const raceCards = screen.getAllByRole('button', { name: /Race \d/ });
      fireEvent.click(raceCards[1]!);
      expect(onRaceSelect).toHaveBeenCalledWith(1);
    });
  });

  describe('Scratched Horse Count', () => {
    it('adjusts active horse count when scratches exist', () => {
      const parsedData = createMockParsedData(1);
      // 3 horses, 1 scratched = 2 active
      const scratchedCountByRace = new Map([[0, 1]]);

      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(1)}
          scratchedCountByRace={scratchedCountByRace}
          onRaceSelect={onRaceSelect}
        />
      );

      expect(screen.getByText(/2 horses/)).toBeInTheDocument();
    });
  });

  describe('No Projections Available', () => {
    it('shows no projections message when topHorses is empty', () => {
      const parsedData = createMockParsedData(1);
      const emptyTopHorses = new Map<number, ScoredHorse[]>([[0, []]]);

      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={emptyTopHorses}
          onRaceSelect={onRaceSelect}
        />
      );

      expect(screen.getByText('No projections available')).toBeInTheDocument();
    });
  });

  describe('Race Classification Formatting', () => {
    it('formats claiming race with price', () => {
      const parsedData = createMockParsedData(1);
      parsedData.races[0]!.header.classification = 'claiming';
      parsedData.races[0]!.header.raceType = '';
      parsedData.races[0]!.header.claimingPriceMax = 25000;

      render(
        <RaceOverview
          parsedData={parsedData}
          raceConfidences={new Map()}
          topHorsesByRace={createTopHorsesMap(1)}
          onRaceSelect={onRaceSelect}
        />
      );

      expect(screen.getByText(/Clm \$25K/)).toBeInTheDocument();
    });
  });
});
