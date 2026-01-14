/**
 * TopBetsView Component
 *
 * Ultra-simple betting view showing top 20 algorithm-generated betting suggestions.
 * No customization, no horse selection — just a ranked list of bets with copy buttons.
 * Single-race bets only.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { SimpleTopBetCard, type ScaledTopBet } from './SimpleTopBetCard';
import { generateTopBets, type TopBetsResult } from '../../lib/betting/topBetsGenerator';
import type { ScoredHorse } from '../../lib/scoring';
import type { RaceHeader } from '../../types/drf';
import './TopBetsView.css';

// ============================================================================
// TYPES
// ============================================================================

export type SortOption = 'confidence' | 'payout' | 'cost';

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

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_AMOUNTS = [1, 2, 5, 10];
const DEFAULT_BASE = 1;
const MAX_BETS = 20;

// ============================================================================
// COMPONENT
// ============================================================================

export const TopBetsView: React.FC<TopBetsViewProps> = ({
  raceNumber,
  trackName = 'Track',
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // ============================================================================
  // GENERATE TOP BETS
  // ============================================================================

  const topBetsResult: TopBetsResult | null = useMemo(() => {
    if (scoredHorses.length === 0) return null;
    return generateTopBets(scoredHorses, raceHeader, raceNumber, getOdds, isScratched);
  }, [scoredHorses, raceHeader, raceNumber, getOdds, isScratched]);

  // ============================================================================
  // SORT AND SCALE BETS
  // ============================================================================

  const sortedBets = useMemo((): ScaledTopBet[] => {
    if (!topBetsResult) return [];

    // Get effective base amount
    const effectiveBase =
      isCustom && customAmount ? parseInt(customAmount, 10) || DEFAULT_BASE : baseAmount;

    // Scale costs and payouts by base amount
    const scaledBets: ScaledTopBet[] = topBetsResult.topBets.map((bet) => ({
      ...bet,
      scaledCost: bet.cost * effectiveBase,
      scaledWhatToSay: scaleWhatToSay(bet.whatToSay, effectiveBase),
      scaledPayout: scalePayoutEstimate(bet.estimatedPayout, effectiveBase),
    }));

    // Sort by selected option
    const sorted = [...scaledBets];
    switch (sortBy) {
      case 'payout':
        // Sort by max potential payout (descending)
        sorted.sort((a, b) => {
          const aMax = parseMaxPayout(a.scaledPayout);
          const bMax = parseMaxPayout(b.scaledPayout);
          return bMax - aMax;
        });
        break;
      case 'cost':
        // Sort by cost (ascending)
        sorted.sort((a, b) => a.scaledCost - b.scaledCost);
        break;
      case 'confidence':
      default:
        // Keep original EV-based ranking (already sorted by generateTopBets)
        break;
    }

    // Limit to MAX_BETS
    return sorted.slice(0, MAX_BETS);
  }, [topBetsResult, baseAmount, customAmount, isCustom, sortBy]);

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

  const handleCopySingle = useCallback(async (index: number, script: string) => {
    try {
      await navigator.clipboard.writeText(script);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  const handleCopyAll = useCallback(async () => {
    if (sortedBets.length === 0) return;

    try {
      const allScripts = sortedBets.map((bet) => bet.scaledWhatToSay).join('\n');
      await navigator.clipboard.writeText(allScripts);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (error) {
      console.error('Failed to copy all:', error);
    }
  }, [sortedBets]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="top-bets-view">
      {/* Header */}
      <div className="top-bets-header">
        <div className="top-bets-header__title">
          <h2>TOP BETS — Race {raceNumber}</h2>
          <span className="top-bets-header__track">{trackName}</span>
        </div>
        <button className="top-bets-header__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {/* Controls Bar */}
      <div className="top-bets-controls">
        {/* Base Amount Selector */}
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

        {/* Sort Dropdown */}
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
            <option value="cost">Lowest Cost</option>
          </select>
        </div>
      </div>

      {/* Bet List */}
      <div className="top-bets-list">
        {sortedBets.length > 0 ? (
          sortedBets.map((bet, index) => (
            <SimpleTopBetCard
              key={`${bet.internalType}-${bet.horseNumbers.join('-')}`}
              bet={bet}
              rank={index + 1}
              isCopied={copiedIndex === index}
              onCopy={() => handleCopySingle(index, bet.scaledWhatToSay)}
            />
          ))
        ) : (
          <div className="top-bets-empty">
            <span className="top-bets-empty__icon">🏇</span>
            <p>No bets available for this race.</p>
          </div>
        )}
      </div>

      {/* Copy All Button */}
      {sortedBets.length > 0 && (
        <div className="top-bets-footer">
          <button
            className={`top-bets-copy-all ${copiedAll ? 'top-bets-copy-all--copied' : ''}`}
            onClick={handleCopyAll}
          >
            {copiedAll ? 'Copied!' : 'COPY ALL'}
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Scale the "what to say" script with a new base amount
 */
function scaleWhatToSay(original: string, baseAmount: number): string {
  // Replace $1 with $baseAmount
  return original.replace(/\$1/g, `$${baseAmount}`);
}

/**
 * Scale payout estimate string with base amount
 */
function scalePayoutEstimate(original: string, baseAmount: number): string {
  // Parse and scale dollar amounts in the string
  return original.replace(/\$(\d+)/g, (_, num) => {
    const scaled = parseInt(num, 10) * baseAmount;
    return `$${scaled}`;
  });
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
