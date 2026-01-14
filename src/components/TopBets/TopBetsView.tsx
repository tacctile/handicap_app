/**
 * TopBetsView Component
 *
 * 6-column betting view showing algorithm-generated betting suggestions.
 * Columns: WIN, PLACE, SHOW, EXACTA, TRIFECTA, SUPERFECTA
 * Features bordered bet cards with rank numbers for easy reference.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { generateTopBets, type TopBet, type TopBetType } from '../../lib/betting/topBetsGenerator';
import type { ScoredHorse } from '../../lib/scoring';
import type { RaceHeader } from '../../types/drf';
import './TopBetsView.css';

// ============================================================================
// TYPES
// ============================================================================

export type SortOption = 'confidence' | 'payout' | 'price_low' | 'price_high';
export type ExactaVariant = 'straight' | 'box';
export type TrifectaVariant = 'straight' | 'box' | 'key';

export interface TopBetsViewProps {
  /** Race number (1-indexed) */
  raceNumber: number;
  /** Track name for display */
  trackName?: string;
  /** Race header data */
  raceHeader: RaceHeader;
  /** Scored horses with rankings */
  scoredHorses: ScoredHorse[];
  /** Function to get current odds for a horse */
  getOdds?: (index: number, defaultOdds: string) => string;
  /** Function to check if horse is scratched */
  isScratched?: (index: number) => boolean;
  /** Callback to close the view */
  onClose: () => void;
}

export interface ScaledTopBet extends TopBet {
  scaledCost: number;
  scaledWhatToSay: string;
  scaledPayout: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_AMOUNTS = [1, 2, 5, 10];
const DEFAULT_BASE = 1;

// Bet types per column
const WIN_TYPES: TopBetType[] = ['WIN'];
const PLACE_TYPES: TopBetType[] = ['PLACE'];
const SHOW_TYPES: TopBetType[] = ['SHOW'];
const EXACTA_STRAIGHT_TYPES: TopBetType[] = ['EXACTA_STRAIGHT'];
const EXACTA_BOX_TYPES: TopBetType[] = ['EXACTA_BOX_2', 'EXACTA_BOX_3'];
const TRIFECTA_STRAIGHT_TYPES: TopBetType[] = ['TRIFECTA_STRAIGHT'];
const TRIFECTA_BOX_TYPES: TopBetType[] = ['TRIFECTA_BOX_3', 'TRIFECTA_BOX_4'];
const TRIFECTA_KEY_TYPES: TopBetType[] = ['TRIFECTA_KEY'];
const SUPERFECTA_TYPES: TopBetType[] = ['SUPERFECTA_BOX_4', 'SUPERFECTA_BOX_5'];

// Column configuration
type ColumnId = 'win' | 'place' | 'show' | 'exacta' | 'trifecta' | 'superfecta';

interface ColumnConfig {
  id: ColumnId;
  title: string;
  hasDropdown: boolean;
  dropdownOptions?: { value: string; label: string }[];
  defaultVariant?: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: 'win', title: 'WIN', hasDropdown: false },
  { id: 'place', title: 'PLACE', hasDropdown: false },
  { id: 'show', title: 'SHOW', hasDropdown: false },
  {
    id: 'exacta',
    title: 'EXACTA',
    hasDropdown: true,
    dropdownOptions: [
      { value: 'straight', label: 'Straight' },
      { value: 'box', label: 'Box' },
    ],
    defaultVariant: 'straight',
  },
  {
    id: 'trifecta',
    title: 'TRIFECTA',
    hasDropdown: true,
    dropdownOptions: [
      { value: 'straight', label: 'Straight' },
      { value: 'box', label: 'Box' },
      { value: 'key', label: 'Key' },
    ],
    defaultVariant: 'straight',
  },
  { id: 'superfecta', title: 'SUPERFECTA', hasDropdown: false },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const TopBetsView: React.FC<TopBetsViewProps> = ({
  raceNumber,
  raceHeader,
  scoredHorses,
  getOdds = (_index, defaultOdds) => defaultOdds,
  isScratched = () => false,
  onClose,
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [baseAmount, setBaseAmount] = useState<number>(DEFAULT_BASE);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('confidence');
  const [exactaVariant, setExactaVariant] = useState<ExactaVariant>('straight');
  const [trifectaVariant, setTrifectaVariant] = useState<TrifectaVariant>('straight');

  // ============================================================================
  // GENERATE TOP BETS
  // ============================================================================

  // Calculate derived state to ensure reactivity when scratches/odds change
  const scratchedCount = useMemo(
    () => scoredHorses.filter((h) => isScratched(h.index) || h.score.isScratched).length,
    [scoredHorses, isScratched]
  );

  // Create a stable key that changes when odds are modified
  const oddsSignature = useMemo(() => {
    return scoredHorses
      .map((h) => `${h.index}:${getOdds(h.index, h.horse.morningLineOdds)}`)
      .join('|');
  }, [scoredHorses, getOdds]);

  const topBetsResult = useMemo(() => {
    if (scoredHorses.length === 0) return null;
    return generateTopBets(scoredHorses, raceHeader, raceNumber, getOdds, isScratched);
  }, [scoredHorses, raceHeader, raceNumber, getOdds, isScratched, scratchedCount, oddsSignature]);

  // ============================================================================
  // COMPUTED: EFFECTIVE BASE AMOUNT
  // ============================================================================

  const effectiveBase = useMemo(() => {
    return isCustom && customAmount ? parseInt(customAmount, 10) || DEFAULT_BASE : baseAmount;
  }, [isCustom, customAmount, baseAmount]);

  // ============================================================================
  // SCALE AND SORT BETS
  // ============================================================================

  const allScaledBets = useMemo((): ScaledTopBet[] => {
    if (!topBetsResult) return [];

    return topBetsResult.topBets.map((bet) => ({
      ...bet,
      scaledCost: bet.cost * effectiveBase,
      scaledWhatToSay: scaleWhatToSay(bet.whatToSay, effectiveBase),
      scaledPayout: scalePayoutEstimate(bet.estimatedPayout, effectiveBase),
    }));
  }, [topBetsResult, effectiveBase]);

  // ============================================================================
  // FILTER BETS BY COLUMN TYPE
  // ============================================================================

  const getBetsForColumn = useCallback(
    (columnId: ColumnId): ScaledTopBet[] => {
      let typesToInclude: TopBetType[];

      switch (columnId) {
        case 'win':
          typesToInclude = WIN_TYPES;
          break;
        case 'place':
          typesToInclude = PLACE_TYPES;
          break;
        case 'show':
          typesToInclude = SHOW_TYPES;
          break;
        case 'exacta':
          typesToInclude = exactaVariant === 'straight' ? EXACTA_STRAIGHT_TYPES : EXACTA_BOX_TYPES;
          break;
        case 'trifecta':
          if (trifectaVariant === 'straight') {
            typesToInclude = TRIFECTA_STRAIGHT_TYPES;
          } else if (trifectaVariant === 'box') {
            typesToInclude = TRIFECTA_BOX_TYPES;
          } else {
            typesToInclude = TRIFECTA_KEY_TYPES;
          }
          break;
        case 'superfecta':
          typesToInclude = SUPERFECTA_TYPES;
          break;
        default:
          typesToInclude = [];
      }

      // Filter bets by type
      let filtered = allScaledBets.filter((bet) => typesToInclude.includes(bet.internalType));

      // Apply sorting
      filtered = sortBets(filtered, sortBy);

      // Limit to reasonable number per column (6 bets)
      return filtered.slice(0, 6);
    },
    [allScaledBets, exactaVariant, trifectaVariant, sortBy]
  );

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleBaseAmountChange = useCallback((amount: number) => {
    setBaseAmount(amount);
    setIsCustom(false);
  }, []);

  const handleCustomClick = useCallback(() => {
    setIsCustom(true);
  }, []);

  const handleCustomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value === '' || (parseInt(value, 10) >= 1 && parseInt(value, 10) <= 100)) {
      setCustomAmount(value);
    }
  }, []);

  const handleColumnVariantChange = useCallback((columnId: ColumnId, value: string) => {
    if (columnId === 'exacta') {
      setExactaVariant(value as ExactaVariant);
    } else if (columnId === 'trifecta') {
      setTrifectaVariant(value as TrifectaVariant);
    }
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="top-bets-view">
      {/* Controls Bar */}
      <div className="top-bets-controls">
        {/* Base Amount Selector (Left) */}
        <div className="top-bets-controls__base">
          <span className="top-bets-controls__label">Base:</span>
          <div className="top-bets-controls__buttons">
            {BASE_AMOUNTS.map((amount) => (
              <button
                key={amount}
                className={`top-bets-base-btn ${baseAmount === amount && !isCustom ? 'top-bets-base-btn--active' : ''}`}
                onClick={() => handleBaseAmountChange(amount)}
              >
                ${amount}
              </button>
            ))}
            {isCustom ? (
              <input
                type="text"
                className="top-bets-custom-input"
                value={customAmount}
                onChange={handleCustomChange}
                placeholder="$"
                autoFocus
                maxLength={3}
              />
            ) : (
              <button className="top-bets-base-btn" onClick={handleCustomClick}>
                Custom
              </button>
            )}
          </div>
        </div>

        {/* Sort Dropdown (Right) */}
        <div className="top-bets-controls__sort">
          <label htmlFor="sort-select" className="top-bets-controls__label">
            Sort:
          </label>
          <select
            id="sort-select"
            className="top-bets-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="confidence">Confidence</option>
            <option value="payout">Biggest Payout</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
        </div>

        {/* Close button */}
        <button className="top-bets-controls__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {/* 6-Column Grid */}
      <div className="top-bets-columns">
        {COLUMNS.map((column) => {
          const bets = getBetsForColumn(column.id);
          const currentVariant =
            column.id === 'exacta'
              ? exactaVariant
              : column.id === 'trifecta'
                ? trifectaVariant
                : undefined;

          return (
            <div key={column.id} className="top-bets-column">
              {/* Column Header */}
              <div className="top-bets-column__header">
                <h3 className="top-bets-column__title">{column.title}</h3>
                {column.hasDropdown && column.dropdownOptions && (
                  <select
                    className="top-bets-column__dropdown"
                    value={currentVariant}
                    onChange={(e) => handleColumnVariantChange(column.id, e.target.value)}
                  >
                    {column.dropdownOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Bets List */}
              <div className="top-bets-column__list">
                {bets.length > 0 ? (
                  bets.map((bet, index) => (
                    <CompactBetCard
                      key={`${bet.internalType}-${bet.horseNumbers.join('-')}-${index}`}
                      bet={bet}
                      rank={index + 1}
                    />
                  ))
                ) : (
                  <div className="top-bets-column__empty">No bets</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// COMPACT BET CARD COMPONENT
// ============================================================================

interface CompactBetCardProps {
  bet: ScaledTopBet;
  rank: number;
}

const CompactBetCard: React.FC<CompactBetCardProps> = ({ bet, rank }) => {
  // Format horse display based on bet type
  const horseDisplay = formatHorseDisplay(bet);

  // Calculate confidence display (show decimal for low probabilities to reveal variation)
  // For exotic bets with low probability, integer rounding hides meaningful differences
  const rawProbability = Math.min(bet.probability, 99);
  const confidenceDisplay =
    rawProbability < 10 && rawProbability > 0
      ? `${Math.max(0.1, rawProbability).toFixed(1)}%`
      : `${Math.round(rawProbability)}%`;

  // Use rounded value for color class thresholds
  const confidencePercent = Math.round(rawProbability);

  // Determine confidence color class
  const confidenceClass =
    confidencePercent >= 70
      ? 'compact-bet-card__confidence--high'
      : confidencePercent >= 40
        ? 'compact-bet-card__confidence--medium'
        : 'compact-bet-card__confidence--low';

  return (
    <div className="compact-bet-card">
      {/* Row 1: Rank + Horse numbers + Confidence label and value */}
      <div className="compact-bet-card__header">
        <span className="compact-bet-card__rank">{rank}</span>
        <span className="compact-bet-card__horses">{horseDisplay}</span>
        <span className={`compact-bet-card__confidence ${confidenceClass}`}>
          <span className="compact-bet-card__label">CONFIDENCE:</span>
          <span className="compact-bet-card__value">{confidenceDisplay}</span>
        </span>
      </div>

      {/* Row 2: Cost and Payout with labels */}
      <div className="compact-bet-card__stats">
        <span className="compact-bet-card__cost">
          <span className="compact-bet-card__label">COST:</span>
          <span className="compact-bet-card__value">${bet.scaledCost}</span>
        </span>
        <span className="compact-bet-card__payout">
          <span className="compact-bet-card__label">PAYOUT:</span>
          <span className="compact-bet-card__value">{bet.scaledPayout}</span>
        </span>
      </div>

      {/* Row 3: Window script */}
      <div className="compact-bet-card__script">"{bet.scaledWhatToSay}"</div>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format horse display based on bet type
 */
function formatHorseDisplay(bet: ScaledTopBet): string {
  if (bet.horses.length === 1) {
    return `#${bet.horses[0]?.programNumber}`;
  }

  // For exacta straight / trifecta straight - use "over" notation
  if (bet.internalType === 'EXACTA_STRAIGHT') {
    return bet.horses.map((h) => `#${h.programNumber}`).join(' over ');
  }

  if (bet.internalType === 'TRIFECTA_STRAIGHT') {
    return bet.horses.map((h) => `#${h.programNumber}`).join('-');
  }

  // For key bets
  if (bet.internalType === 'TRIFECTA_KEY' && bet.horses.length > 0) {
    const keyHorse = bet.horses[0];
    const withHorses = bet.horses.slice(1);
    return `#${keyHorse?.programNumber} ALL with ${withHorses.map((h) => `#${h.programNumber}`).join(', ')}`;
  }

  // For box bets, show hyphenated numbers
  return bet.horses.map((h) => `#${h.programNumber}`).join('-');
}

/**
 * Scale the "what to say" script with a new base amount
 */
function scaleWhatToSay(original: string, baseAmount: number): string {
  return original.replace(/\$1/g, `$${baseAmount}`);
}

/**
 * Scale payout estimate string with base amount
 */
function scalePayoutEstimate(original: string, baseAmount: number): string {
  return original.replace(/\$(\d+)/g, (_, num) => {
    const scaled = parseInt(num, 10) * baseAmount;
    return `$${scaled}`;
  });
}

/**
 * Sort bets by selected option
 */
function sortBets(bets: ScaledTopBet[], sortBy: SortOption): ScaledTopBet[] {
  const sorted = [...bets];

  switch (sortBy) {
    case 'confidence':
      // Sort by probability (confidence) descending
      sorted.sort((a, b) => b.probability - a.probability);
      break;
    case 'payout':
      // Sort by max potential payout (descending)
      sorted.sort((a, b) => {
        const aMax = parseMaxPayout(a.scaledPayout);
        const bMax = parseMaxPayout(b.scaledPayout);
        return bMax - aMax;
      });
      break;
    case 'price_low':
      // Sort by cost (ascending)
      sorted.sort((a, b) => a.scaledCost - b.scaledCost);
      break;
    case 'price_high':
      // Sort by cost (descending)
      sorted.sort((a, b) => b.scaledCost - a.scaledCost);
      break;
    default:
      // Default to confidence
      sorted.sort((a, b) => b.probability - a.probability);
      break;
  }

  return sorted;
}

/**
 * Parse max payout from payout string (e.g., "$50-$150" -> 150)
 */
function parseMaxPayout(payoutStr: string): number {
  const matches = payoutStr.match(/\$(\d+)/g);
  if (!matches) return 0;
  const numbers = matches.map((m) => parseInt(m.replace('$', ''), 10));
  return Math.max(...numbers);
}

export default TopBetsView;
