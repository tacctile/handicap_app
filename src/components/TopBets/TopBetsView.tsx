/**
 * TopBetsView Component
 *
 * 7-column betting view showing algorithm-generated betting suggestions.
 * Columns: WIN, PLACE, SHOW, EXACTA, TRIFECTA, SUPERFECTA, YOUR BETS
 * Features bordered bet cards for clear visual separation.
 * YOUR BETS column is a placeholder for building bet slips (Phase 1).
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { generateTopBets, type TopBet, type TopBetType, type TopBetHorse } from '../../lib/betting/topBetsGenerator';
import type { ScoredHorse } from '../../lib/scoring';
import type { RaceHeader } from '../../types/drf';
import './TopBetsView.css';

// ============================================================================
// TYPES
// ============================================================================

export type SortOption = 'confidence' | 'payout' | 'price_low' | 'price_high';
export type ExactaVariant = 'straight' | 'box';
export type TrifectaVariant = 'straight' | 'box' | 'key';
export type SuperfectaVariant = 'straight' | 'box' | 'key';

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

// Selected bet with custom amount
export interface SelectedBet {
  bet: ScaledTopBet;
  betId: string;
  customAmount: number; // User-editable amount
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
const SUPERFECTA_STRAIGHT_TYPES: TopBetType[] = ['SUPERFECTA_STRAIGHT'];
const SUPERFECTA_BOX_TYPES: TopBetType[] = ['SUPERFECTA_BOX_4', 'SUPERFECTA_BOX_5'];
const SUPERFECTA_KEY_TYPES: TopBetType[] = ['SUPERFECTA_KEY'];

// Column configuration
type ColumnId = 'win' | 'place' | 'show' | 'exacta' | 'trifecta' | 'superfecta' | 'your-bets';

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
  {
    id: 'superfecta',
    title: 'SUPERFECTA',
    hasDropdown: true,
    dropdownOptions: [
      { value: 'straight', label: 'Straight' },
      { value: 'box', label: 'Box' },
      { value: 'key', label: 'Key' },
    ],
    defaultVariant: 'straight',
  },
  { id: 'your-bets', title: 'YOUR BETS', hasDropdown: false },
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
  const [superfectaVariant, setSuperfectaVariant] = useState<SuperfectaVariant>('straight');

  // Selected bets state (bet slip)
  const [selectedBets, setSelectedBets] = useState<Map<string, SelectedBet>>(new Map());
  const [raceBudget, setRaceBudget] = useState<string>('50');

  // Track race number to clear selections when race changes
  const prevRaceNumberRef = useRef<number>(raceNumber);

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
  // CLEAR SELECTIONS WHEN RACE CHANGES
  // ============================================================================

  useEffect(() => {
    if (prevRaceNumberRef.current !== raceNumber) {
      setSelectedBets(new Map());
      prevRaceNumberRef.current = raceNumber;
    }
  }, [raceNumber]);

  // ============================================================================
  // BET SELECTION HELPERS
  // ============================================================================

  // Generate unique ID for a bet
  const generateBetId = useCallback((bet: ScaledTopBet): string => {
    return `${bet.internalType}-${bet.horseNumbers.join('-')}`;
  }, []);

  // Check if a bet is selected
  const isBetSelected = useCallback(
    (bet: ScaledTopBet): boolean => {
      const betId = generateBetId(bet);
      return selectedBets.has(betId);
    },
    [selectedBets, generateBetId]
  );

  // Toggle bet selection
  const toggleBetSelection = useCallback(
    (bet: ScaledTopBet) => {
      const betId = generateBetId(bet);
      setSelectedBets((prev) => {
        const newMap = new Map(prev);
        if (newMap.has(betId)) {
          newMap.delete(betId);
        } else {
          newMap.set(betId, {
            bet,
            betId,
            customAmount: bet.scaledCost,
          });
        }
        return newMap;
      });
    },
    [generateBetId]
  );

  // Remove a bet from selection
  const removeBetSelection = useCallback((betId: string) => {
    setSelectedBets((prev) => {
      const newMap = new Map(prev);
      newMap.delete(betId);
      return newMap;
    });
  }, []);

  // Update custom amount for a selected bet
  const updateBetAmount = useCallback((betId: string, amount: number) => {
    setSelectedBets((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(betId);
      if (existing) {
        newMap.set(betId, { ...existing, customAmount: amount });
      }
      return newMap;
    });
  }, []);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setSelectedBets(new Map());
  }, []);

  // ============================================================================
  // COMPUTED: TOTALS
  // ============================================================================

  const totals = useMemo(() => {
    const total = Array.from(selectedBets.values()).reduce(
      (sum, sb) => sum + sb.customAmount,
      0
    );
    const budget = parseInt(raceBudget, 10) || 0;
    const remaining = budget - total;
    return { total, budget, remaining };
  }, [selectedBets, raceBudget]);

  // ============================================================================
  // FILTER BETS BY COLUMN TYPE
  // ============================================================================

  const getBetsForColumn = useCallback(
    (columnId: ColumnId): ScaledTopBet[] => {
      let typesToInclude: TopBetType[];
      // WIN/PLACE/SHOW show ALL horses, exotic bets are limited to 6
      const isWinPlaceShow = columnId === 'win' || columnId === 'place' || columnId === 'show';

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
          if (superfectaVariant === 'straight') {
            typesToInclude = SUPERFECTA_STRAIGHT_TYPES;
          } else if (superfectaVariant === 'box') {
            typesToInclude = SUPERFECTA_BOX_TYPES;
          } else {
            typesToInclude = SUPERFECTA_KEY_TYPES;
          }
          break;
        default:
          typesToInclude = [];
      }

      // Filter bets by type
      let filtered = allScaledBets.filter((bet) => typesToInclude.includes(bet.internalType));

      // Apply sorting
      filtered = sortBets(filtered, sortBy);

      // WIN/PLACE/SHOW show ALL horses, exotic bets limited to 6
      return isWinPlaceShow ? filtered : filtered.slice(0, 6);
    },
    [allScaledBets, exactaVariant, trifectaVariant, superfectaVariant, sortBy]
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
    } else if (columnId === 'superfecta') {
      setSuperfectaVariant(value as SuperfectaVariant);
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

        {/* Horse Reference List (Middle) */}
        <div className="top-bets-controls__horses">
          {scoredHorses
            .filter((h) => !isScratched(h.index) && !h.score.isScratched)
            .sort((a, b) => a.horse.programNumber - b.horse.programNumber)
            .map((h) => (
              <div key={h.index} className="top-bets-controls__horse">
                <span className="top-bets-controls__horse-num">#{h.horse.programNumber}</span>
                <span className="top-bets-controls__horse-name">{h.horse.horseName}</span>
              </div>
            ))}
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

      {/* 7-Column Grid */}
      <div className="top-bets-columns">
        {COLUMNS.map((column) => {
          // YOUR BETS column - shows selected bets and totals
          if (column.id === 'your-bets') {
            const selectedBetsArray = Array.from(selectedBets.values());
            return (
              <div key={column.id} className="top-bets-column top-bets-column--your-bets">
                {/* Column Header with Budget */}
                <div className="top-bets-column__header your-bets-header">
                  <h3 className="top-bets-column__title">{column.title}</h3>
                  <div className="your-bets-budget">
                    <span className="your-bets-budget__label">BUDGET:</span>
                    <div className="your-bets-budget__input-wrapper">
                      <span className="your-bets-budget__dollar">$</span>
                      <input
                        type="text"
                        className="your-bets-budget__input"
                        value={raceBudget}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setRaceBudget(value);
                        }}
                        placeholder="50"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>

                {/* Selected Bets List */}
                <div className="top-bets-column__list your-bets-list">
                  {selectedBetsArray.length > 0 ? (
                    <>
                      {selectedBetsArray.map((selectedBet) => (
                        <YourBetItem
                          key={selectedBet.betId}
                          selectedBet={selectedBet}
                          onUpdateAmount={updateBetAmount}
                          onRemove={removeBetSelection}
                        />
                      ))}

                      {/* Totals Section */}
                      <div className="your-bets-totals">
                        <div className="your-bets-totals__row">
                          <span className="your-bets-totals__label">TOTAL:</span>
                          <span className="your-bets-totals__value">${totals.total}</span>
                        </div>
                        <div className="your-bets-totals__row">
                          <span className="your-bets-totals__label">BUDGET:</span>
                          <span className="your-bets-totals__value">${totals.budget}</span>
                        </div>
                        <div className={`your-bets-totals__row your-bets-totals__row--remaining ${totals.remaining < 0 ? 'your-bets-totals__row--over' : ''}`}>
                          <span className="your-bets-totals__label">REMAINING:</span>
                          <span className="your-bets-totals__value">${totals.remaining}</span>
                        </div>
                        {totals.remaining < 0 && (
                          <div className="your-bets-totals__warning">
                            OVER BUDGET
                          </div>
                        )}
                      </div>

                      {/* Clear All Button */}
                      <button
                        className="your-bets-clear-btn"
                        onClick={clearAllSelections}
                      >
                        CLEAR ALL
                      </button>
                    </>
                  ) : (
                    <div className="your-bets-placeholder">
                      <span className="your-bets-placeholder__text">Select bets to add here</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          const bets = getBetsForColumn(column.id);
          const currentVariant =
            column.id === 'exacta'
              ? exactaVariant
              : column.id === 'trifecta'
                ? trifectaVariant
                : column.id === 'superfecta'
                  ? superfectaVariant
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
                      isSelected={isBetSelected(bet)}
                      onToggleSelect={toggleBetSelection}
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
// EXOTIC BET TOOLTIP COMPONENT
// ============================================================================

interface ExoticBetTooltipProps {
  horses: TopBetHorse[];
  children: React.ReactNode;
}

const ExoticBetTooltip: React.FC<ExoticBetTooltipProps> = ({ horses, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    // Start showing after 500ms delay
    timeoutRef.current = setTimeout(() => {
      setShouldRender(true);
      // Small delay to allow DOM to render before animating
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }, 500);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Clear the show timeout if mouse leaves before delay
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Start fade out
    setIsVisible(false);
    // Remove from DOM after fade out animation completes
    hideTimeoutRef.current = setTimeout(() => {
      setShouldRender(false);
    }, 150);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className="exotic-bet-tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {shouldRender && (
        <div className={`exotic-bet-tooltip ${isVisible ? 'exotic-bet-tooltip--visible' : ''}`}>
          {horses.map((horse, idx) => (
            <div key={`${horse.programNumber}-${idx}`} className="exotic-bet-tooltip__horse">
              #{horse.programNumber} {horse.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// YOUR BET ITEM COMPONENT (for the Your Bets column)
// ============================================================================

interface YourBetItemProps {
  selectedBet: SelectedBet;
  onUpdateAmount: (betId: string, amount: number) => void;
  onRemove: (betId: string) => void;
}

const YourBetItem: React.FC<YourBetItemProps> = ({ selectedBet, onUpdateAmount, onRemove }) => {
  const { bet, betId, customAmount } = selectedBet;
  const [inputValue, setInputValue] = useState<string>(customAmount.toString());

  // Sync input value when customAmount changes externally
  useEffect(() => {
    setInputValue(customAmount.toString());
  }, [customAmount]);

  // Format bet type for display (e.g., "WIN #4" or "EXACTA #4-#6")
  const betTypeDisplay = useMemo(() => {
    // Get simplified bet type name
    const typeName = bet.internalType
      .replace(/_STRAIGHT/g, '')
      .replace(/_BOX_\d/g, ' BOX')
      .replace(/_KEY/g, ' KEY')
      .replace(/_/g, ' ');

    // Format horse numbers
    const horseNums = bet.horseNumbers.map((n) => `#${n}`).join('-');

    return `${typeName} ${horseNums}`;
  }, [bet]);

  // Get horse name for single-horse bets
  const horseName = bet.horses.length === 1 ? bet.horses[0]?.name?.toUpperCase() : null;

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '');
      setInputValue(value);
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        onUpdateAmount(betId, numValue);
      } else if (value === '') {
        onUpdateAmount(betId, 0);
      }
    },
    [betId, onUpdateAmount]
  );

  const handleRemove = useCallback(() => {
    onRemove(betId);
  }, [betId, onRemove]);

  return (
    <div className="your-bet-item">
      <div className="your-bet-item__header">
        <span className="your-bet-item__type">{betTypeDisplay}</span>
        <button
          className="your-bet-item__remove"
          onClick={handleRemove}
          aria-label="Remove bet"
        >
          ×
        </button>
      </div>
      {horseName && <div className="your-bet-item__horse-name">{horseName}</div>}
      <div className="your-bet-item__amount-row">
        <div className="your-bet-item__amount-wrapper">
          <span className="your-bet-item__dollar">$</span>
          <input
            type="text"
            className="your-bet-item__amount-input"
            value={inputValue}
            onChange={handleAmountChange}
            maxLength={4}
          />
        </div>
        <span className="your-bet-item__cost">→ ${customAmount}</span>
      </div>
    </div>
  );
};

// ============================================================================
// COMPACT BET CARD COMPONENT
// ============================================================================

interface CompactBetCardProps {
  bet: ScaledTopBet;
  isSelected: boolean;
  onToggleSelect: (bet: ScaledTopBet) => void;
}

const CompactBetCard: React.FC<CompactBetCardProps> = ({ bet, isSelected, onToggleSelect }) => {
  // Format horse display based on bet type
  const horseDisplay = formatHorseDisplay(bet);
  const showTooltip = isExoticBet(bet.internalType);

  // Calculate confidence display (show decimal for low probabilities to reveal variation)
  // For exotic bets with low probability, integer rounding hides meaningful differences
  const rawProbability = Math.min(bet.probability, 99);
  const confidenceDisplay =
    rawProbability < 10 && rawProbability > 0
      ? `${Math.max(0.1, rawProbability).toFixed(1)}%`
      : `${Math.round(rawProbability)}%`;

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onToggleSelect(bet);
    },
    [bet, onToggleSelect]
  );

  const handleCardClick = useCallback(() => {
    onToggleSelect(bet);
  }, [bet, onToggleSelect]);

  return (
    <div
      className={`compact-bet-card ${isSelected ? 'compact-bet-card--selected' : ''}`}
      onClick={handleCardClick}
    >
      {/* Row 1: Checkbox + Horse numbers */}
      <div className="compact-bet-card__header">
        <label className="compact-bet-card__checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="compact-bet-card__checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
          />
          <span className="compact-bet-card__checkbox-custom" />
        </label>
        {showTooltip ? (
          <ExoticBetTooltip horses={bet.horses}>
            <span className="compact-bet-card__horses compact-bet-card__horses--hoverable">{horseDisplay}</span>
          </ExoticBetTooltip>
        ) : (
          <span className="compact-bet-card__horses">{horseDisplay}</span>
        )}
      </div>

      {/* Row 2: Cost only (payout removed - based on inaccurate odds) */}
      <div className="compact-bet-card__stats">
        <span className="compact-bet-card__cost">
          <span className="compact-bet-card__label">COST:</span>
          <span className="compact-bet-card__value">${bet.scaledCost}</span>
        </span>
      </div>

      {/* Row 3: Confidence */}
      <div className="compact-bet-card__confidence">
        <span className="compact-bet-card__label">CONFIDENCE:</span>
        <span className="compact-bet-card__value">{confidenceDisplay}</span>
      </div>

      {/* Row 4: Window script (last row) */}
      <div className="compact-bet-card__script">"{bet.scaledWhatToSay}"</div>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format horse display based on bet type
 * For WIN/PLACE/SHOW: includes horse name (e.g., "#4 FREE DROP BACH")
 * For exotic bets: just numbers (tooltip shows names)
 */
function formatHorseDisplay(bet: ScaledTopBet): string {
  // For single horse bets (WIN/PLACE/SHOW), include horse name in uppercase
  if (bet.horses.length === 1) {
    const horse = bet.horses[0];
    return `#${horse?.programNumber} ${horse?.name?.toUpperCase() ?? ''}`;
  }

  // For exacta straight / trifecta straight - use "over" notation
  if (bet.internalType === 'EXACTA_STRAIGHT') {
    return bet.horses.map((h) => `#${h.programNumber}`).join(' over ');
  }

  if (bet.internalType === 'TRIFECTA_STRAIGHT') {
    return bet.horses.map((h) => `#${h.programNumber}`).join('-');
  }

  // For superfecta straight - hyphenated numbers
  if (bet.internalType === 'SUPERFECTA_STRAIGHT') {
    return bet.horses.map((h) => `#${h.programNumber}`).join('-');
  }

  // For key bets (trifecta and superfecta)
  if (bet.internalType === 'TRIFECTA_KEY' && bet.horses.length > 0) {
    const keyHorse = bet.horses[0];
    const withHorses = bet.horses.slice(1);
    return `#${keyHorse?.programNumber} ALL with ${withHorses.map((h) => `#${h.programNumber}`).join(', ')}`;
  }

  if (bet.internalType === 'SUPERFECTA_KEY' && bet.horses.length > 0) {
    const keyHorse = bet.horses[0];
    const withHorses = bet.horses.slice(1);
    return `#${keyHorse?.programNumber} ALL with ${withHorses.map((h) => `#${h.programNumber}`).join(', ')}`;
  }

  // For box bets, show hyphenated numbers
  return bet.horses.map((h) => `#${h.programNumber}`).join('-');
}

/**
 * Check if bet type is an exotic bet (multi-horse)
 */
function isExoticBet(internalType: TopBetType): boolean {
  return !['WIN', 'PLACE', 'SHOW'].includes(internalType);
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
