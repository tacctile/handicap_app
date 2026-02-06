/**
 * TopBetsView Component
 *
 * 6-column betting view showing algorithm-generated betting suggestions.
 * Columns: WIN, PLACE, SHOW, EXACTA, TRIFECTA, SUPERFECTA
 * Features bordered bet cards for clear visual separation.
 *
 * Updated to use useEnhancedBetting hook for:
 * - Softmax probabilities (coherent, sum to ~100%)
 * - True overlay calculations
 * - Kelly-based bet sizing recommendations
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import {
  generateTopBets,
  type TopBet,
  type TopBetType,
  type TopBetHorse,
} from '../../lib/betting/topBetsGenerator';
import { useEnhancedBetting, type EnhancedHorseData } from '../../hooks/useEnhancedBetting';
import type { ScoredHorse } from '../../lib/scoring';
import type { RaceHeader } from '../../types/drf';
import './TopBetsView.css';

// ============================================================================
// TYPES
// ============================================================================

export type SortOption =
  | 'confidence'
  | 'roi'
  | 'itm'
  | 'ev'
  | 'payout'
  | 'price_low'
  | 'price_high';
export type ExactaVariant = 'straight' | 'box' | 'wheel';
export type TrifectaVariant = 'straight' | 'box' | 'key' | 'wheel';
export type SuperfectaVariant = 'straight' | 'box' | 'key' | 'wheel';

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
  /** Value horse program number (from AI analysis) - optional until wired */
  valueHorseNumber?: number | null;
}

export interface ScaledTopBet extends TopBet {
  scaledCost: number;
  scaledWhatToSay: string;
  scaledPayout: string;
  /** Kelly-suggested bet amount (if available from enhanced betting) */
  kellyAmount?: number;
  /** Historical ROI from validation data (to be wired in future) */
  historicalROI?: number;
  /** Historical hit rate / ITM% from validation data (to be wired in future) */
  historicalHitRate?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_AMOUNTS = [1, 2, 5, 10];
const DEFAULT_BASE = 1;

// Bet types per column - All box depths and wheel types
const WIN_TYPES: TopBetType[] = ['WIN'];
const PLACE_TYPES: TopBetType[] = ['PLACE'];
const SHOW_TYPES: TopBetType[] = ['SHOW'];

// Exacta types
const EXACTA_STRAIGHT_TYPES: TopBetType[] = ['EXACTA_STRAIGHT'];
const EXACTA_BOX_TYPES: TopBetType[] = [
  'EXACTA_BOX_2',
  'EXACTA_BOX_3',
  'EXACTA_BOX_4',
  'EXACTA_BOX_5',
  'EXACTA_BOX_6',
];
const EXACTA_WHEEL_TYPES: TopBetType[] = ['EXACTA_WHEEL'];

// Trifecta types
const TRIFECTA_STRAIGHT_TYPES: TopBetType[] = ['TRIFECTA_STRAIGHT'];
const TRIFECTA_BOX_TYPES: TopBetType[] = [
  'TRIFECTA_BOX_3',
  'TRIFECTA_BOX_4',
  'TRIFECTA_BOX_5',
  'TRIFECTA_BOX_6',
];
const TRIFECTA_KEY_TYPES: TopBetType[] = ['TRIFECTA_KEY'];
const TRIFECTA_WHEEL_TYPES: TopBetType[] = ['TRIFECTA_WHEEL'];

// Superfecta types
const SUPERFECTA_STRAIGHT_TYPES: TopBetType[] = ['SUPERFECTA_STRAIGHT'];
const SUPERFECTA_BOX_TYPES: TopBetType[] = [
  'SUPERFECTA_BOX_4',
  'SUPERFECTA_BOX_5',
  'SUPERFECTA_BOX_6',
];
const SUPERFECTA_KEY_TYPES: TopBetType[] = ['SUPERFECTA_KEY'];
const SUPERFECTA_WHEEL_TYPES: TopBetType[] = ['SUPERFECTA_WHEEL'];

// Depth requirements for field size filtering
const DEPTH_REQUIREMENTS: Record<string, number> = {
  EXACTA_BOX_2: 2,
  EXACTA_BOX_3: 3,
  EXACTA_BOX_4: 4,
  EXACTA_BOX_5: 5,
  EXACTA_BOX_6: 6,
  EXACTA_WHEEL: 3,
  TRIFECTA_BOX_3: 3,
  TRIFECTA_BOX_4: 4,
  TRIFECTA_BOX_5: 5,
  TRIFECTA_BOX_6: 6,
  TRIFECTA_KEY: 4,
  TRIFECTA_WHEEL: 4,
  SUPERFECTA_BOX_4: 4,
  SUPERFECTA_BOX_5: 5,
  SUPERFECTA_BOX_6: 6,
  SUPERFECTA_KEY: 5,
  SUPERFECTA_WHEEL: 5,
};

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
      { value: 'wheel', label: 'Wheel' },
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
      { value: 'wheel', label: 'Wheel' },
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
      { value: 'wheel', label: 'Wheel' },
    ],
    defaultVariant: 'straight',
  },
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
  valueHorseNumber = null,
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
  const [showValueHorseOnly, setShowValueHorseOnly] = useState(false);

  // ============================================================================
  // ENHANCED BETTING HOOK (Softmax probabilities + Kelly sizing)
  // ============================================================================

  const {
    enhancedHorses,
    recommendations: kellyRecommendations,
    bankroll,
    setBankroll,
    calibrationActive,
    isProcessing,
    error: enhancedError,
    // fieldMetrics available if needed for future enhancements
    fieldMetrics: _fieldMetrics,
  } = useEnhancedBetting({
    scoredHorses,
    raceHeader,
    raceNumber,
    getOdds,
    isScratched,
  });

  // Create lookup map for enhanced probabilities (programNumber → EnhancedHorseData)
  const enhancedProbabilityMap = useMemo(() => {
    const map = new Map<number, EnhancedHorseData>();
    for (const horse of enhancedHorses) {
      map.set(horse.programNumber, horse);
    }
    return map;
  }, [enhancedHorses]);

  // ============================================================================
  // GENERATE TOP BETS (uses existing generator for exotic bets)
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

  // Note: scratchedCount and oddsSignature are intentionally included as dependencies
  // to force recalculation when odds/scratches change (cache invalidation pattern)

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
  // SCALE AND SORT BETS (with enhanced softmax probabilities)
  // ============================================================================

  const allScaledBets = useMemo((): ScaledTopBet[] => {
    if (!topBetsResult) return [];

    return topBetsResult.topBets.map((bet) => {
      // For WIN/PLACE/SHOW bets, use softmax probability from enhanced betting
      // For exotic bets, keep existing probability calculation
      let enhancedProbability = bet.probability;
      let kellyAmount: number | undefined;

      if (['WIN', 'PLACE', 'SHOW'].includes(bet.internalType) && bet.horseNumbers.length === 1) {
        const programNumber = bet.horseNumbers[0];
        if (programNumber !== undefined) {
          const enhancedHorse = enhancedProbabilityMap.get(programNumber);
          if (enhancedHorse) {
            // Use softmax-based probability (× 100 for percentage display)
            if (bet.internalType === 'WIN') {
              enhancedProbability = enhancedHorse.confidencePercent;
            } else if (bet.internalType === 'PLACE') {
              // Estimate place probability: ~1.6× win probability, capped at 95%
              enhancedProbability = Math.min(95, enhancedHorse.confidencePercent * 1.6);
            } else if (bet.internalType === 'SHOW') {
              // Estimate show probability: ~2.0× win probability, capped at 98%
              enhancedProbability = Math.min(98, enhancedHorse.confidencePercent * 2.0);
            }

            // Get Kelly-sized bet amount if available
            if (kellyRecommendations) {
              const kellyRec = kellyRecommendations.recommendations.find(
                (r) => r.programNumber === programNumber && r.betType === bet.internalType
              );
              if (kellyRec) {
                // Scale Kelly amount by base amount (Kelly is typically calculated on $1 base)
                kellyAmount = kellyRec.suggestedAmount * effectiveBase;
              }
            }
          }
        }
      }

      return {
        ...bet,
        probability: enhancedProbability,
        scaledCost: bet.cost * effectiveBase,
        scaledWhatToSay: scaleWhatToSay(bet.whatToSay, effectiveBase),
        scaledPayout: scalePayoutEstimate(bet.estimatedPayout, effectiveBase),
        // Add Kelly-suggested amount if available (optional enhancement)
        kellyAmount,
      };
    });
  }, [topBetsResult, effectiveBase, enhancedProbabilityMap, kellyRecommendations]);

  // ============================================================================
  // FILTER BETS BY COLUMN TYPE
  // ============================================================================

  // Get field size from active horses
  const fieldSize = useMemo(() => {
    return scoredHorses.filter((h) => !isScratched(h.index) && !h.score.isScratched).length;
  }, [scoredHorses, isScratched]);

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
          if (exactaVariant === 'straight') {
            typesToInclude = EXACTA_STRAIGHT_TYPES;
          } else if (exactaVariant === 'box') {
            typesToInclude = EXACTA_BOX_TYPES;
          } else {
            typesToInclude = EXACTA_WHEEL_TYPES;
          }
          break;
        case 'trifecta':
          if (trifectaVariant === 'straight') {
            typesToInclude = TRIFECTA_STRAIGHT_TYPES;
          } else if (trifectaVariant === 'box') {
            typesToInclude = TRIFECTA_BOX_TYPES;
          } else if (trifectaVariant === 'key') {
            typesToInclude = TRIFECTA_KEY_TYPES;
          } else {
            typesToInclude = TRIFECTA_WHEEL_TYPES;
          }
          break;
        case 'superfecta':
          if (superfectaVariant === 'straight') {
            typesToInclude = SUPERFECTA_STRAIGHT_TYPES;
          } else if (superfectaVariant === 'box') {
            typesToInclude = SUPERFECTA_BOX_TYPES;
          } else if (superfectaVariant === 'key') {
            typesToInclude = SUPERFECTA_KEY_TYPES;
          } else {
            typesToInclude = SUPERFECTA_WHEEL_TYPES;
          }
          break;
        default:
          typesToInclude = [];
      }

      // Filter bets by type
      let filtered = allScaledBets.filter((bet) => typesToInclude.includes(bet.internalType));

      // Filter by field size - exclude bets that require more horses than available
      filtered = filtered.filter((bet) => {
        const requiredHorses = DEPTH_REQUIREMENTS[bet.internalType] ?? 0;
        return fieldSize >= requiredHorses;
      });

      // Filter by value horse if toggle is enabled
      if (showValueHorseOnly && valueHorseNumber !== null) {
        filtered = filtered.filter((bet) => bet.horseNumbers.includes(valueHorseNumber));
      }

      // Apply sorting
      filtered = sortBets(filtered, sortBy);

      // WIN/PLACE/SHOW show ALL horses, exotic bets limited to 6
      return isWinPlaceShow ? filtered : filtered.slice(0, 6);
    },
    [
      allScaledBets,
      exactaVariant,
      trifectaVariant,
      superfectaVariant,
      sortBy,
      fieldSize,
      showValueHorseOnly,
      valueHorseNumber,
    ]
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

  // Bankroll input handler
  const [bankrollInput, setBankrollInput] = useState<string>(bankroll.toString());
  const [showBankrollInput, setShowBankrollInput] = useState(false);

  const handleBankrollChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setBankrollInput(value);
  }, []);

  const handleBankrollBlur = useCallback(() => {
    const newBankroll = parseInt(bankrollInput, 10);
    if (newBankroll >= 10 && newBankroll <= 100000) {
      setBankroll(newBankroll);
    } else {
      setBankrollInput(bankroll.toString());
    }
    setShowBankrollInput(false);
  }, [bankrollInput, setBankroll, bankroll]);

  const handleBankrollKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleBankrollBlur();
      } else if (e.key === 'Escape') {
        setBankrollInput(bankroll.toString());
        setShowBankrollInput(false);
      }
    },
    [handleBankrollBlur, bankroll]
  );

  // Sync bankroll input with hook's bankroll
  useEffect(() => {
    setBankrollInput(bankroll.toString());
  }, [bankroll]);

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

  // Show loading state while enhanced betting is processing
  if (isProcessing && !topBetsResult) {
    return (
      <div className="top-bets-view">
        <div className="top-bets-loading">
          <div className="top-bets-loading__spinner" />
          <p>Calculating enhanced probabilities...</p>
        </div>
      </div>
    );
  }

  // Show error message if enhanced betting has an error (but still render if we have fallback data)
  const showEnhancedError = enhancedError && !topBetsResult;
  if (showEnhancedError) {
    return (
      <div className="top-bets-view">
        <div className="top-bets-error">
          <span className="top-bets-error__icon">⚠️</span>
          <p>{enhancedError}</p>
          <button className="top-bets-error__close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

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

        {/* Bankroll Input */}
        <div className="top-bets-controls__bankroll">
          <span className="top-bets-controls__label">Bankroll:</span>
          {showBankrollInput ? (
            <input
              type="text"
              className="top-bets-custom-input"
              value={bankrollInput}
              onChange={handleBankrollChange}
              onBlur={handleBankrollBlur}
              onKeyDown={handleBankrollKeyDown}
              autoFocus
              maxLength={6}
            />
          ) : (
            <button
              className="top-bets-base-btn"
              onClick={() => setShowBankrollInput(true)}
              title="Click to change bankroll for Kelly sizing"
            >
              ${bankroll}
            </button>
          )}
          {calibrationActive && (
            <span
              className="top-bets-calibration-badge"
              title="Calibration active - probabilities are calibrated"
            >
              CAL
            </span>
          )}
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

        {/* Value Horse Filter Toggle */}
        {valueHorseNumber !== null && (
          <div className="top-bets-controls__value-filter">
            <label className="top-bets-value-toggle">
              <input
                type="checkbox"
                checked={showValueHorseOnly}
                onChange={(e) => setShowValueHorseOnly(e.target.checked)}
              />
              <span className="top-bets-value-toggle__label">
                <span className="top-bets-value-toggle__icon">◆</span>
                Value Only
              </span>
            </label>
          </div>
        )}

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
            <option value="ev">Expected Value</option>
            <option value="roi">ROI</option>
            <option value="itm">ITM %</option>
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
                      isBestBet={index === 0}
                      includesValueHorse={
                        valueHorseNumber !== null && bet.horseNumbers.includes(valueHorseNumber)
                      }
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
// COMPACT BET CARD COMPONENT
// ============================================================================

interface CompactBetCardProps {
  bet: ScaledTopBet;
  isBestBet?: boolean;
  includesValueHorse?: boolean;
}

const CompactBetCard: React.FC<CompactBetCardProps> = ({
  bet,
  isBestBet = false,
  includesValueHorse = false,
}) => {
  // State for whyThisBet tooltip
  const [showWhyTooltip, setShowWhyTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Check if this is a WIN/PLACE/SHOW bet with Kelly sizing available
  const hasKellySizing = bet.kellyAmount !== undefined && bet.kellyAmount > 0;
  const isWinPlaceShow = ['WIN', 'PLACE', 'SHOW'].includes(bet.internalType);

  // Handle tooltip show/hide with delay
  const handleTooltipEnter = useCallback(() => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowWhyTooltip(true);
    }, 300);
  }, []);

  const handleTooltipLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setShowWhyTooltip(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Get simplified explanation
  const explanation = simplifyExplanation(bet.whyThisBet);

  return (
    <div className={`compact-bet-card ${isBestBet ? 'compact-bet-card--best' : ''}`}>
      {/* Badges Row */}
      <div className="compact-bet-card__badges">
        {isBestBet && (
          <span className="compact-bet-card__best-badge" title="Best bet in this category">
            BEST
          </span>
        )}
        {includesValueHorse && (
          <span className="compact-bet-card__value-badge" title="Includes value horse">
            ◆
          </span>
        )}
        {/* Help icon for tooltip */}
        <span
          className="compact-bet-card__help-icon"
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
          onClick={(e) => {
            e.stopPropagation();
            setShowWhyTooltip(!showWhyTooltip);
          }}
        >
          ?
        </span>
        {/* Tooltip */}
        {showWhyTooltip && <div className="compact-bet-card__why-tooltip">{explanation}</div>}
      </div>

      {/* Row 1: Horse numbers (full width) */}
      <div className="compact-bet-card__header">
        {showTooltip ? (
          <ExoticBetTooltip horses={bet.horses}>
            <span className="compact-bet-card__horses compact-bet-card__horses--hoverable">
              {horseDisplay}
            </span>
          </ExoticBetTooltip>
        ) : (
          <span className="compact-bet-card__horses">{horseDisplay}</span>
        )}
      </div>

      {/* Row 2: Cost (and Kelly sizing for WIN/PLACE/SHOW) */}
      <div className="compact-bet-card__stats">
        <span className="compact-bet-card__cost">
          <span className="compact-bet-card__label">COST:</span>
          <span className="compact-bet-card__value">${bet.scaledCost}</span>
        </span>
        {hasKellySizing && isWinPlaceShow && (
          <span className="compact-bet-card__kelly">
            <span className="compact-bet-card__label">KELLY:</span>
            <span className="compact-bet-card__value compact-bet-card__value--kelly">
              ${Math.round(bet.kellyAmount!)}
            </span>
          </span>
        )}
      </div>

      {/* Row 3: Confidence (with softmax indicator for WIN/PLACE/SHOW) */}
      <div className="compact-bet-card__confidence">
        <span className="compact-bet-card__label">CONFIDENCE:</span>
        <span className="compact-bet-card__value">{confidenceDisplay}</span>
        {isWinPlaceShow && (
          <span
            className="compact-bet-card__softmax-indicator"
            title="Softmax probability (coherent)"
          >
            ✓
          </span>
        )}
      </div>

      {/* Row 4: Window script (last row) */}
      <div className="compact-bet-card__script">"{bet.scaledWhatToSay}"</div>
    </div>
  );
};

/**
 * Simplify the explanation to ensure it's easy to understand
 */
function simplifyExplanation(explanation: string | undefined): string {
  if (!explanation) {
    return "This bet has good value based on today's race.";
  }

  // Keep it under 2 sentences
  const sentences = explanation.split('. ');
  if (sentences.length > 2) {
    return sentences.slice(0, 2).join('. ') + '.';
  }

  return explanation;
}

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

  // For wheel bets - key horse with "WITH ALL"
  if (
    bet.internalType === 'EXACTA_WHEEL' ||
    bet.internalType === 'TRIFECTA_WHEEL' ||
    bet.internalType === 'SUPERFECTA_WHEEL'
  ) {
    const keyHorse = bet.horses[0];
    return `#${keyHorse?.programNumber} WITH ALL`;
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
    case 'roi':
      // Sort by historical ROI descending (placeholder - shows N/A for now)
      // Historical data to be wired in future prompt
      sorted.sort((a, b) => (b.historicalROI ?? 0) - (a.historicalROI ?? 0));
      break;
    case 'itm':
      // Sort by historical hit rate (ITM%) descending
      // Historical data to be wired in future prompt
      sorted.sort((a, b) => (b.historicalHitRate ?? 0) - (a.historicalHitRate ?? 0));
      break;
    case 'ev':
      // Sort by expected value descending
      sorted.sort((a, b) => b.expectedValue - a.expectedValue);
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

function TopBetsViewFallback() {
  return (
    <div
      style={{
        padding: '1.5rem',
        textAlign: 'center',
        background: '#0F0F10',
        borderRadius: '8px',
        border: '1px solid #2A2A2C',
      }}
    >
      <span
        className="material-icons"
        style={{ fontSize: '2rem', color: '#ef4444', marginBottom: '0.5rem', display: 'block' }}
      >
        error
      </span>
      <h3 style={{ color: '#EEEFF1', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
        Something went wrong
      </h3>
      <p style={{ color: '#B4B4B6', fontSize: '0.875rem', margin: 0 }}>
        Unable to load top bets view. Try refreshing the page.
      </p>
    </div>
  );
}

export function TopBetsViewWithBoundary(props: TopBetsViewProps) {
  return (
    <ErrorBoundary componentName="TopBetsView" fallback={<TopBetsViewFallback />}>
      <TopBetsView {...props} />
    </ErrorBoundary>
  );
}

export default TopBetsViewWithBoundary;
