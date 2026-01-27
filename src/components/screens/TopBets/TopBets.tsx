import React, { useMemo, useState, useCallback } from 'react';
import { TopBetsHeader } from './TopBetsHeader';
import { BetColumn, type BetRecommendation } from './BetColumn';
import {
  generateTopBets,
  type TopBet,
  type TopBetType,
} from '../../../lib/betting/topBetsGenerator';
import type { ParsedRace } from '../../../types/drf';
import type { ScoredHorse } from '../../../lib/scoring';

// ============================================================================
// TYPES
// ============================================================================

export interface TopBetsProps {
  /** All races from the parsed DRF file */
  races: ParsedRace[];
  /** Scored horses organized by race number (1-indexed) */
  scoredHorses: Map<number, ScoredHorse[]>;
  /** Handler to navigate to a specific race */
  onSelectRace: (raceNumber: number) => void;
  /** Handler for back navigation */
  onBack: () => void;
  /** Optional function to get current odds */
  getOdds?: (raceNumber: number, horseIndex: number, originalOdds: string) => string;
  /** Optional function to check if horse is scratched */
  isScratched?: (raceNumber: number, horseIndex: number) => boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BET_TYPES: Array<'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA'> = [
  'WIN',
  'PLACE',
  'SHOW',
  'EXACTA',
  'TRIFECTA',
];

const MAX_BETS_PER_COLUMN = 8;
const MIN_CONFIDENCE_THRESHOLD = 10; // Filter out very low confidence bets

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: 'var(--bg-base)',
};

const columnsContainerStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-4)',
  padding: 'var(--space-4)',
  flex: 1,
  overflow: 'auto',
};

const columnsGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 'var(--space-4)',
  width: '100%',
  minWidth: '1000px', // Ensure columns don't get too narrow
};

const emptyStateStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  gap: 'var(--space-4)',
  color: 'var(--text-tertiary)',
  textAlign: 'center',
  padding: 'var(--space-8)',
};

const emptyTitleStyles: React.CSSProperties = {
  fontSize: 'var(--text-xl)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-secondary)',
};

const emptyDescStyles: React.CSSProperties = {
  fontSize: 'var(--text-base)',
  maxWidth: '400px',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map TopBetType to simplified bet type for columns
 */
function mapBetType(
  internalType: TopBetType
): 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA' | 'SUPERFECTA' {
  if (internalType === 'WIN') return 'WIN';
  if (internalType === 'PLACE') return 'PLACE';
  if (internalType === 'SHOW') return 'SHOW';
  if (internalType.startsWith('EXACTA')) return 'EXACTA';
  if (internalType.startsWith('TRIFECTA')) return 'TRIFECTA';
  return 'SUPERFECTA';
}

/**
 * Determine tier based on confidence level
 */
function getTierFromConfidence(confidence: number): 1 | 2 | 3 | null {
  if (confidence >= 70) return 1;
  if (confidence >= 60) return 2;
  if (confidence >= 40) return 3;
  return null;
}

/**
 * Convert TopBet to BetRecommendation for display
 */
function convertToBetRecommendation(bet: TopBet, raceNumber: number): BetRecommendation {
  const simplifiedType = mapBetType(bet.internalType);
  const primaryHorse = bet.horses[0];
  const secondHorse = bet.horses[1];
  const thirdHorse = bet.horses[2];

  return {
    raceNumber,
    horseName: primaryHorse?.name || `#${primaryHorse?.programNumber || 0}`,
    horseNumber: primaryHorse?.programNumber || 0,
    betType: simplifiedType,
    odds: bet.estimatedPayout.split('-')[0] || '?',
    confidence: bet.probability,
    kellyBet: bet.cost,
    expectedValue: bet.expectedValue,
    tier: getTierFromConfidence(bet.probability),
    secondHorse: secondHorse ? String(secondHorse.programNumber) : undefined,
    thirdHorse: thirdHorse ? String(thirdHorse.programNumber) : undefined,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TopBets screen displays the best betting opportunities across all races,
 * organized by bet type in a 5-column layout.
 */
export function TopBets({
  races,
  scoredHorses,
  onSelectRace,
  onBack,
  getOdds,
  isScratched,
}: TopBetsProps): React.ReactElement {
  const [baseBet, setBaseBet] = useState(2);
  const [bankroll, setBankroll] = useState(250);

  // Generate top bets for each race and aggregate
  const allBets = useMemo(() => {
    const bets: Array<{ bet: TopBet; raceNumber: number }> = [];

    for (const race of races) {
      const raceNumber = race.header?.raceNumber || 1;
      const horses = scoredHorses.get(raceNumber);

      if (!horses || horses.length < 2) continue;

      // Get odds and scratched functions for this race
      const raceGetOdds = getOdds
        ? (index: number, original: string) => getOdds(raceNumber, index, original)
        : (_index: number, original: string) => original;

      const raceIsScratched = isScratched
        ? (index: number) => isScratched(raceNumber, index)
        : () => false;

      try {
        const result = generateTopBets(
          horses,
          race.header,
          raceNumber,
          raceGetOdds,
          raceIsScratched
        );

        for (const bet of result.topBets) {
          bets.push({ bet, raceNumber });
        }
      } catch (error) {
        // Skip races that fail to generate bets
        console.warn(`Failed to generate bets for race ${raceNumber}:`, error);
      }
    }

    return bets;
  }, [races, scoredHorses, getOdds, isScratched]);

  // Organize bets by column type and sort by confidence/EV
  const columnBets = useMemo(() => {
    const columns: Record<string, BetRecommendation[]> = {
      WIN: [],
      PLACE: [],
      SHOW: [],
      EXACTA: [],
      TRIFECTA: [],
    };

    // Convert and categorize all bets
    for (const { bet, raceNumber } of allBets) {
      const recommendation = convertToBetRecommendation(bet, raceNumber);
      const category = mapBetType(bet.internalType);

      // Only include bet types we're displaying (skip SUPERFECTA for now)
      if (category in columns) {
        columns[category].push(recommendation);
      }
    }

    // Sort each column by confidence (descending) and limit
    for (const key of Object.keys(columns)) {
      columns[key] = columns[key]
        .filter((b) => b.confidence >= MIN_CONFIDENCE_THRESHOLD)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, MAX_BETS_PER_COLUMN);
    }

    return columns;
  }, [allBets]);

  // Calculate totals for header
  const totals = useMemo(() => {
    let totalInvestment = 0;
    let expectedReturn = 0;

    for (const key of Object.keys(columnBets)) {
      for (const bet of columnBets[key]) {
        const adjustedBet = (bet.kellyBet || 1) * baseBet;
        totalInvestment += adjustedBet;
        if (bet.expectedValue) {
          expectedReturn += bet.expectedValue * adjustedBet;
        }
      }
    }

    return { totalInvestment, expectedReturn };
  }, [columnBets, baseBet]);

  // Handler for bet selection
  const handleSelectBet = useCallback(
    (raceNumber: number) => {
      onSelectRace(raceNumber);
    },
    [onSelectRace]
  );

  // Handler for bankroll change
  const handleBankrollChange = useCallback((value: number) => {
    setBankroll(value);
  }, []);

  // Handler for base bet change
  const handleBaseBetChange = useCallback((value: number) => {
    setBaseBet(value);
  }, []);

  // Check if we have any bets to display
  const hasBets = Object.values(columnBets).some((bets) => bets.length > 0);

  // Empty state if no races or no bets
  if (races.length === 0) {
    return (
      <div style={containerStyles}>
        <TopBetsHeader
          bankroll={bankroll}
          baseBet={baseBet}
          onBankrollChange={handleBankrollChange}
          onBaseBetChange={handleBaseBetChange}
          totalInvestment={0}
          expectedReturn={0}
          onBack={onBack}
        />
        <div style={emptyStateStyles}>
          <div style={emptyTitleStyles}>No Races Loaded</div>
          <div style={emptyDescStyles}>
            Upload a DRF file to see your top betting opportunities across all races.
          </div>
        </div>
      </div>
    );
  }

  if (!hasBets) {
    return (
      <div style={containerStyles}>
        <TopBetsHeader
          bankroll={bankroll}
          baseBet={baseBet}
          onBankrollChange={handleBankrollChange}
          onBaseBetChange={handleBaseBetChange}
          totalInvestment={0}
          expectedReturn={0}
          onBack={onBack}
        />
        <div style={emptyStateStyles}>
          <div style={emptyTitleStyles}>No Value Plays Found</div>
          <div style={emptyDescStyles}>
            The algorithm didn&apos;t find any bets meeting the confidence threshold across
            today&apos;s races. This can happen with small fields or when the market is efficient.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Sticky Header */}
      <TopBetsHeader
        bankroll={bankroll}
        baseBet={baseBet}
        onBankrollChange={handleBankrollChange}
        onBaseBetChange={handleBaseBetChange}
        totalInvestment={totals.totalInvestment}
        expectedReturn={totals.expectedReturn}
        onBack={onBack}
      />

      {/* 5-Column Grid */}
      <div style={columnsContainerStyles}>
        <div style={columnsGridStyles}>
          {BET_TYPES.map((betType) => (
            <BetColumn
              key={betType}
              betType={betType}
              bets={columnBets[betType] || []}
              onSelectBet={handleSelectBet}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default TopBets;
