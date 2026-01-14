/**
 * BetBuilder Component
 *
 * A complete, single-screen two-column Bet Builder interface.
 * Left column: All user inputs (budget, risk style, bet type, horse selection)
 * Right column: All outputs (bet card, what to say, explanations)
 *
 * Features:
 * - Live reactive calculations on any input change
 * - Duplicate horse prevention in selection
 * - Auto-fill with projected top horses
 * - Copy to clipboard for window scripts
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ParsedRace } from '../../../types/drf';
import type { ScoredHorse } from '../../../lib/scoring';
import type { RiskStyle } from '../../../lib/betting/betTypes';
import './BetBuilder.css';

// ============================================================================
// TYPES
// ============================================================================

export type BetBuilderBetType =
  | 'WIN'
  | 'PLACE'
  | 'SHOW'
  | 'EXACTA'
  | 'EXACTA_BOX'
  | 'TRIFECTA'
  | 'TRIFECTA_BOX'
  | 'SUPERFECTA_BOX'
  | 'QUINELLA';

interface BetBuilderProps {
  /** Current race data */
  race: ParsedRace;
  /** Race number (1-indexed) */
  raceNumber: number;
  /** Track name */
  trackName: string;
  /** Scored horses with rankings */
  scoredHorses: ScoredHorse[];
  /** Function to check if horse is scratched */
  isScratched?: (index: number) => boolean;
  /** Callback to close bet builder */
  onClose: () => void;
}

interface HorseOption {
  index: number;
  programNumber: number;
  name: string;
  projectedFinish: number;
  edge: number;
  morningLineOdds: string;
}

interface BetCalculation {
  combinations: number;
  totalCost: number;
  potentialReturn: { min: number; max: number };
  windowScript: string;
  isValid: boolean;
  errorMessage?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BUDGET_OPTIONS = [1, 2, 5, 10];

const BET_TYPE_OPTIONS: { value: BetBuilderBetType; label: string; category: string }[] = [
  { value: 'WIN', label: 'Win', category: 'Straight' },
  { value: 'PLACE', label: 'Place', category: 'Straight' },
  { value: 'SHOW', label: 'Show', category: 'Straight' },
  { value: 'EXACTA', label: 'Exacta', category: 'Exotic' },
  { value: 'EXACTA_BOX', label: 'Exacta Box', category: 'Exotic' },
  { value: 'TRIFECTA', label: 'Trifecta', category: 'Exotic' },
  { value: 'TRIFECTA_BOX', label: 'Trifecta Box', category: 'Exotic' },
  { value: 'SUPERFECTA_BOX', label: 'Superfecta Box', category: 'Exotic' },
  { value: 'QUINELLA', label: 'Quinella', category: 'Exotic' },
];

const BET_TYPE_EXPLANATIONS: Record<BetBuilderBetType, string> = {
  WIN: 'Your horse must finish 1st to win. Highest risk, highest reward.',
  PLACE: 'Your horse must finish 1st or 2nd to cash. Good balance of risk/reward.',
  SHOW: 'Your horse must finish 1st, 2nd, or 3rd to cash. Safest straight bet.',
  EXACTA: 'Pick the 1st and 2nd place finishers in exact order.',
  EXACTA_BOX: "Pick horses to finish 1st and 2nd in either order. You're betting any two of your horses finish 1-2 in either order.",
  TRIFECTA: 'Pick the 1st, 2nd, and 3rd place finishers in exact order.',
  TRIFECTA_BOX: 'Pick horses to finish 1st, 2nd, and 3rd in any order. With 3 horses: 6 combinations. With 4 horses: 24 combinations.',
  SUPERFECTA_BOX: 'Pick horses to finish 1st through 4th in any order. Gets expensive fast but big payouts.',
  QUINELLA: 'Pick two horses to finish 1st and 2nd in either order. Single bet (cheaper than Exacta Box).',
};

const RISK_STYLE_DESCRIPTIONS: Record<RiskStyle, string> = {
  safe: 'Top-ranked horses, fewer combinations',
  balanced: 'Mix of favorites and value plays',
  aggressive: 'Longshots with high edge',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRequiredHorseCount(betType: BetBuilderBetType): { min: number; max: number } {
  switch (betType) {
    case 'WIN':
    case 'PLACE':
    case 'SHOW':
      return { min: 1, max: 1 };
    case 'EXACTA':
    case 'QUINELLA':
      return { min: 2, max: 2 };
    case 'EXACTA_BOX':
      return { min: 2, max: 6 };
    case 'TRIFECTA':
      return { min: 3, max: 3 };
    case 'TRIFECTA_BOX':
      return { min: 3, max: 6 };
    case 'SUPERFECTA_BOX':
      return { min: 4, max: 8 };
    default:
      return { min: 1, max: 1 };
  }
}

function calculateCombinations(betType: BetBuilderBetType, horseCount: number): number {
  switch (betType) {
    case 'WIN':
    case 'PLACE':
    case 'SHOW':
      return 1;
    case 'EXACTA':
      return 1;
    case 'EXACTA_BOX':
      // n * (n - 1)
      return horseCount * (horseCount - 1);
    case 'TRIFECTA':
      return 1;
    case 'TRIFECTA_BOX':
      // n * (n - 1) * (n - 2)
      return horseCount * (horseCount - 1) * (horseCount - 2);
    case 'SUPERFECTA_BOX':
      // n * (n - 1) * (n - 2) * (n - 3)
      return horseCount * (horseCount - 1) * (horseCount - 2) * (horseCount - 3);
    case 'QUINELLA':
      return 1;
    default:
      return 1;
  }
}

function generateWindowScript(
  betType: BetBuilderBetType,
  horses: number[],
  amount: number
): string {
  const horseList = horses.join('-');

  switch (betType) {
    case 'WIN':
      return `$${amount} WIN on number ${horses[0]}`;
    case 'PLACE':
      return `$${amount} PLACE on number ${horses[0]}`;
    case 'SHOW':
      return `$${amount} SHOW on number ${horses[0]}`;
    case 'EXACTA':
      return `$${amount} EXACTA, ${horses[0]} over ${horses[1]}`;
    case 'EXACTA_BOX':
      return `$${amount} EXACTA BOX, ${horseList}`;
    case 'TRIFECTA':
      return `$${amount} TRIFECTA, ${horseList}`;
    case 'TRIFECTA_BOX':
      return `$${amount} TRIFECTA BOX, ${horseList}`;
    case 'SUPERFECTA_BOX':
      return `$${amount} SUPERFECTA BOX, ${horseList}`;
    case 'QUINELLA':
      return `$${amount} QUINELLA, ${horses[0]}-${horses[1]}`;
    default:
      return `$${amount} ${betType} on ${horseList}`;
  }
}

function parseOddsToDecimal(odds: string): number {
  const cleaned = odds.trim().toUpperCase();
  if (cleaned === 'EVEN' || cleaned === 'EVN') return 1.0;
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    return parseFloat(parts[0] || '10') || 10;
  }
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parseFloat(parts[0] || '1');
    const denom = parseFloat(parts[1] || '1');
    return num / (denom || 1);
  }
  return parseFloat(cleaned) || 10;
}

function estimateReturn(
  betType: BetBuilderBetType,
  horses: HorseOption[],
  totalCost: number
): { min: number; max: number } {
  if (horses.length === 0) return { min: 0, max: 0 };

  // Calculate average odds of selected horses
  const avgOdds = horses.reduce((sum, h) => sum + parseOddsToDecimal(h.morningLineOdds), 0) / horses.length;

  // Estimate based on bet type
  let multiplier = { min: 1, max: 1 };
  switch (betType) {
    case 'WIN':
      multiplier = { min: avgOdds * 0.8, max: avgOdds * 1.2 };
      break;
    case 'PLACE':
      multiplier = { min: avgOdds * 0.4, max: avgOdds * 0.6 };
      break;
    case 'SHOW':
      multiplier = { min: avgOdds * 0.2, max: avgOdds * 0.4 };
      break;
    case 'EXACTA':
    case 'EXACTA_BOX':
      multiplier = { min: avgOdds * 2, max: avgOdds * 8 };
      break;
    case 'TRIFECTA':
    case 'TRIFECTA_BOX':
      multiplier = { min: avgOdds * 5, max: avgOdds * 30 };
      break;
    case 'SUPERFECTA_BOX':
      multiplier = { min: avgOdds * 20, max: avgOdds * 200 };
      break;
    case 'QUINELLA':
      multiplier = { min: avgOdds * 1.5, max: avgOdds * 5 };
      break;
  }

  return {
    min: Math.round(totalCost * multiplier.min),
    max: Math.round(totalCost * multiplier.max),
  };
}

function calculateEdge(scoredHorse: ScoredHorse): number {
  // Calculate edge based on model rank vs implied odds probability
  const rank = scoredHorse.rank;
  const odds = parseOddsToDecimal(scoredHorse.horse.morningLineOdds);

  // Model probability based on rank (rough estimate)
  const modelProb = rank <= 1 ? 0.35 : rank <= 2 ? 0.25 : rank <= 3 ? 0.18 : rank <= 4 ? 0.12 : 0.08;

  // Implied probability from odds
  const impliedProb = 1 / (odds + 1);

  // Edge = (Model - Implied) / Implied * 100
  return ((modelProb - impliedProb) / impliedProb) * 100;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BetBuilder: React.FC<BetBuilderProps> = ({
  race: _race, // Reserved for future use (e.g., race-specific conditions)
  raceNumber,
  trackName,
  scoredHorses,
  isScratched = () => false,
  onClose,
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [budget, setBudget] = useState(1);
  const [customBudget, setCustomBudget] = useState('');
  const [showCustomBudget, setShowCustomBudget] = useState(false);
  const [riskStyle, setRiskStyle] = useState<RiskStyle>('balanced');
  const [betType, setBetType] = useState<BetBuilderBetType>('WIN');
  const [selectedHorses, setSelectedHorses] = useState<number[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Build horse options from scored horses
  const horseOptions = useMemo((): HorseOption[] => {
    return scoredHorses
      .filter((sh, idx) => !isScratched(idx) && !sh.score.isScratched)
      .sort((a, b) => a.rank - b.rank)
      .map((sh) => ({
        index: sh.index,
        programNumber: sh.horse.programNumber,
        name: sh.horse.horseName,
        projectedFinish: sh.rank,
        edge: calculateEdge(sh),
        morningLineOdds: sh.horse.morningLineOdds,
      }));
  }, [scoredHorses, isScratched]);

  // Get required horse count for current bet type
  const { min: minHorses, max: maxHorses } = useMemo(
    () => getRequiredHorseCount(betType),
    [betType]
  );

  // Auto-fill horses when bet type changes
  useEffect(() => {
    const topHorses = horseOptions.slice(0, minHorses).map((h) => h.programNumber);
    setSelectedHorses(topHorses);
  }, [betType, minHorses, horseOptions]);

  // Get selected horse details
  const selectedHorseDetails = useMemo((): HorseOption[] => {
    return selectedHorses
      .map((pn) => horseOptions.find((h) => h.programNumber === pn))
      .filter((h): h is HorseOption => h !== undefined);
  }, [selectedHorses, horseOptions]);

  // Calculate bet result
  const calculation = useMemo((): BetCalculation => {
    const horseCount = selectedHorses.length;

    // Validation
    if (horseCount < minHorses) {
      return {
        combinations: 0,
        totalCost: 0,
        potentialReturn: { min: 0, max: 0 },
        windowScript: '',
        isValid: false,
        errorMessage: `Select at least ${minHorses} horse${minHorses > 1 ? 's' : ''}`,
      };
    }

    // Check for duplicates
    const uniqueHorses = new Set(selectedHorses);
    if (uniqueHorses.size !== selectedHorses.length) {
      return {
        combinations: 0,
        totalCost: 0,
        potentialReturn: { min: 0, max: 0 },
        windowScript: '',
        isValid: false,
        errorMessage: 'Duplicate horse selection detected',
      };
    }

    const combinations = calculateCombinations(betType, horseCount);
    const totalCost = combinations * budget;
    const potentialReturn = estimateReturn(betType, selectedHorseDetails, totalCost);
    const windowScript = generateWindowScript(betType, selectedHorses, budget);

    return {
      combinations,
      totalCost,
      potentialReturn,
      windowScript,
      isValid: true,
    };
  }, [selectedHorses, betType, budget, minHorses, selectedHorseDetails]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleBudgetSelect = (amount: number) => {
    setBudget(amount);
    setShowCustomBudget(false);
  };

  const handleCustomBudgetSubmit = () => {
    const value = parseInt(customBudget, 10);
    if (!isNaN(value) && value >= 1 && value <= 100) {
      setBudget(value);
      setShowCustomBudget(false);
      setCustomBudget('');
    }
  };

  const handleBetTypeChange = (type: BetBuilderBetType) => {
    setBetType(type);
    // Selection will auto-update via useEffect
  };

  const handleHorseSelect = (slotIndex: number, programNumber: number) => {
    setSelectedHorses((prev) => {
      const newSelection = [...prev];
      newSelection[slotIndex] = programNumber;
      return newSelection;
    });
  };

  const handleAddHorse = () => {
    if (selectedHorses.length < maxHorses) {
      // Find next best horse not already selected
      const nextHorse = horseOptions.find(
        (h) => !selectedHorses.includes(h.programNumber)
      );
      if (nextHorse) {
        setSelectedHorses((prev) => [...prev, nextHorse.programNumber]);
      }
    }
  };

  const handleRemoveHorse = () => {
    if (selectedHorses.length > minHorses) {
      setSelectedHorses((prev) => prev.slice(0, -1));
    }
  };

  const handleCopy = useCallback(async () => {
    if (!calculation.isValid) return;
    try {
      await navigator.clipboard.writeText(calculation.windowScript);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [calculation]);

  // Get dropdown options for a slot (excludes horses in other slots)
  const getDropdownOptions = useCallback(
    (slotIndex: number): HorseOption[] => {
      const otherSelectedHorses = selectedHorses.filter((_, idx) => idx !== slotIndex);
      return horseOptions.filter((h) => !otherSelectedHorses.includes(h.programNumber));
    },
    [horseOptions, selectedHorses]
  );

  // Check if can add/remove horses
  const canAddHorse = selectedHorses.length < maxHorses &&
    horseOptions.some((h) => !selectedHorses.includes(h.programNumber));
  const canRemoveHorse = selectedHorses.length > minHorses;
  const isBoxBet = betType.includes('BOX');

  // Format projected finish with emoji
  const formatProjectedFinish = (horse: HorseOption) => {
    const edgeEmoji = horse.edge >= 50 ? ' \ud83d\udd25' : horse.projectedFinish >= 5 ? ' \u26a0\ufe0f' : '';
    return `#${horse.programNumber} ${horse.name} \u2014 Proj: ${horse.projectedFinish}${getOrdinalSuffix(horse.projectedFinish)}, ${horse.edge >= 0 ? '+' : ''}${Math.round(horse.edge)}%${edgeEmoji}`;
  };

  function getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const suffix = s[(v - 20) % 10] ?? s[v] ?? s[0];
    return suffix ?? 'th';
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="bet-builder">
      {/* Header */}
      <header className="bet-builder__header">
        <div className="bet-builder__header-title">
          <span className="bet-builder__header-icon">\ud83c\udfc7</span>
          <span>BET BUILDER</span>
          <span className="bet-builder__header-sep">\u2014</span>
          <span className="bet-builder__header-race">
            Race {raceNumber} at {trackName}
          </span>
        </div>
        <button className="bet-builder__close-btn" onClick={onClose}>
          <span className="material-icons">close</span>
        </button>
      </header>

      {/* Main two-column layout */}
      <div className="bet-builder__content">
        {/* LEFT COLUMN - Inputs */}
        <div className="bet-builder__left">
          {/* Budget Per Way */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">BUDGET PER WAY</h3>
            <div className="bet-builder__budget-buttons">
              {BUDGET_OPTIONS.map((amount) => (
                <button
                  key={amount}
                  className={`bet-builder__budget-btn ${budget === amount && !showCustomBudget ? 'bet-builder__budget-btn--selected' : ''}`}
                  onClick={() => handleBudgetSelect(amount)}
                >
                  ${amount}
                </button>
              ))}
            </div>
            {showCustomBudget ? (
              <div className="bet-builder__custom-budget">
                <span className="bet-builder__custom-prefix">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customBudget}
                  onChange={(e) => setCustomBudget(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomBudgetSubmit()}
                  placeholder="1-100"
                  autoFocus
                />
                <button onClick={handleCustomBudgetSubmit}>
                  <span className="material-icons">check</span>
                </button>
              </div>
            ) : (
              <button
                className="bet-builder__custom-trigger"
                onClick={() => setShowCustomBudget(true)}
              >
                Custom amount...
              </button>
            )}
            <p className="bet-builder__helper-text">Your base bet amount per combination</p>
          </section>

          {/* Risk Style */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">RISK STYLE</h3>
            <div className="bet-builder__style-buttons">
              {(['safe', 'balanced', 'aggressive'] as RiskStyle[]).map((style) => (
                <button
                  key={style}
                  className={`bet-builder__style-btn bet-builder__style-btn--${style} ${riskStyle === style ? 'bet-builder__style-btn--selected' : ''}`}
                  onClick={() => setRiskStyle(style)}
                >
                  <span className="bet-builder__style-name">
                    {style === 'safe' ? '\ud83d\udee1\ufe0f Safe' : style === 'balanced' ? '\u2696\ufe0f Balanced' : '\ud83d\udd25 Aggressive'}
                  </span>
                </button>
              ))}
            </div>
            <div className="bet-builder__style-descriptions">
              {(['safe', 'balanced', 'aggressive'] as RiskStyle[]).map((style) => (
                <div
                  key={style}
                  className={`bet-builder__style-desc ${riskStyle === style ? 'bet-builder__style-desc--active' : ''}`}
                >
                  {RISK_STYLE_DESCRIPTIONS[style]}
                </div>
              ))}
            </div>
          </section>

          {/* Bet Type */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">BET TYPE</h3>
            <select
              className="bet-builder__bet-type-select"
              value={betType}
              onChange={(e) => handleBetTypeChange(e.target.value as BetBuilderBetType)}
            >
              <optgroup label="Straight">
                {BET_TYPE_OPTIONS.filter((opt) => opt.category === 'Straight').map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Exotic">
                {BET_TYPE_OPTIONS.filter((opt) => opt.category === 'Exotic').map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </section>

          {/* Horse Selection */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">
              YOUR HORSES <span className="bet-builder__auto-fill-badge">(auto-filled by Furlong)</span>
            </h3>
            <div className="bet-builder__horse-slots">
              {selectedHorses.map((programNumber, slotIndex) => (
                <div key={slotIndex} className="bet-builder__horse-slot">
                  <label className="bet-builder__slot-label">
                    {minHorses > 1 ? `${slotIndex === 0 ? '1st' : slotIndex === 1 ? '2nd' : slotIndex === 2 ? '3rd' : `${slotIndex + 1}th`}:` : 'Horse:'}
                  </label>
                  <select
                    className="bet-builder__horse-select"
                    value={programNumber}
                    onChange={(e) => handleHorseSelect(slotIndex, parseInt(e.target.value, 10))}
                  >
                    {getDropdownOptions(slotIndex).map((h) => (
                      <option key={h.programNumber} value={h.programNumber}>
                        {formatProjectedFinish(h)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Add/Remove buttons for box bets */}
            {isBoxBet && (
              <div className="bet-builder__horse-actions">
                <button
                  className="bet-builder__add-horse-btn"
                  onClick={handleAddHorse}
                  disabled={!canAddHorse}
                >
                  + Add Horse
                </button>
                <button
                  className="bet-builder__remove-horse-btn"
                  onClick={handleRemoveHorse}
                  disabled={!canRemoveHorse}
                >
                  - Remove Horse
                </button>
              </div>
            )}
          </section>

          {/* Projected Finish Reference */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">PROJECTED FINISH (Reference)</h3>
            <div className="bet-builder__projected-list">
              {horseOptions.slice(0, 6).map((h, idx) => (
                <div
                  key={h.programNumber}
                  className={`bet-builder__projected-item ${selectedHorses.includes(h.programNumber) ? 'bet-builder__projected-item--selected' : ''}`}
                >
                  <span className="bet-builder__projected-rank">{idx + 1}{getOrdinalSuffix(idx + 1)}:</span>
                  <span className="bet-builder__projected-horse">
                    #{h.programNumber} {h.name}
                  </span>
                  <span className={`bet-builder__projected-edge ${h.edge >= 50 ? 'bet-builder__projected-edge--hot' : h.edge < 0 ? 'bet-builder__projected-edge--negative' : ''}`}>
                    {h.edge >= 0 ? '+' : ''}{Math.round(h.edge)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN - Outputs */}
        <div className="bet-builder__right">
          {/* Current Selection Header */}
          <div className="bet-builder__selection-header">
            Based on: ${budget} per way / {riskStyle.charAt(0).toUpperCase() + riskStyle.slice(1)} / {BET_TYPE_OPTIONS.find((o) => o.value === betType)?.label}
          </div>

          {/* Your Bet Card */}
          <section className="bet-builder__bet-card">
            <div className="bet-builder__bet-card-header">
              <span className="bet-builder__bet-card-icon">\ud83c\udfaf</span>
              <span>YOUR BET</span>
            </div>

            {calculation.isValid ? (
              <>
                <div className="bet-builder__bet-type-display">
                  {BET_TYPE_OPTIONS.find((o) => o.value === betType)?.label.toUpperCase()}:{' '}
                  #{selectedHorses.join(', #')}
                </div>

                <div className="bet-builder__bet-math">
                  {calculation.combinations > 1
                    ? `${calculation.combinations} combinations \u00d7 $${budget} = $${calculation.totalCost} total`
                    : `$${calculation.totalCost} total`}
                </div>

                <div className="bet-builder__bet-return">
                  Potential return: ${calculation.potentialReturn.min} - ${calculation.potentialReturn.max}
                </div>

                {/* What to Say Box */}
                <div className="bet-builder__what-to-say">
                  <div className="bet-builder__what-to-say-label">
                    \ud83d\udcdd WHAT TO SAY AT THE WINDOW:
                  </div>
                  <div className="bet-builder__what-to-say-box">
                    <span className="bet-builder__what-to-say-text">
                      "{calculation.windowScript}"
                    </span>
                    <button
                      className={`bet-builder__copy-btn ${copySuccess ? 'bet-builder__copy-btn--success' : ''}`}
                      onClick={handleCopy}
                    >
                      {copySuccess ? 'Copied!' : 'COPY'}
                    </button>
                  </div>
                </div>

                {/* Why This Bet */}
                <div className="bet-builder__why-bet">
                  <div className="bet-builder__why-bet-label">\ud83e\udde0 WHY THIS BET?</div>
                  <p className="bet-builder__why-bet-text">
                    {selectedHorseDetails.length > 0 && (
                      <>
                        {selectedHorseDetails.map((h, idx) => (
                          <span key={h.programNumber}>
                            {idx > 0 && ', '}
                            <strong>#{h.programNumber} {h.name}</strong> is projected {h.projectedFinish}{getOrdinalSuffix(h.projectedFinish)}
                            {h.edge >= 50 && ' \ud83d\udd25 (hot pick!)'}
                            {h.edge < 0 && ' (chalk)'}
                          </span>
                        ))}
                        . {betType.includes('BOX')
                          ? `Boxing ${selectedHorses.length} horses gives you ${calculation.combinations} ways to win.`
                          : 'Good luck!'}
                      </>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="bet-builder__bet-error">
                <span className="bet-builder__bet-error-icon">\u26a0\ufe0f</span>
                <span>{calculation.errorMessage}</span>
              </div>
            )}
          </section>

          {/* What's a [Bet Type] */}
          <section className="bet-builder__explanation">
            <div className="bet-builder__explanation-label">
              \u2753 WHAT'S A {BET_TYPE_OPTIONS.find((o) => o.value === betType)?.label.toUpperCase()}?
            </div>
            <p className="bet-builder__explanation-text">
              {BET_TYPE_EXPLANATIONS[betType]}
            </p>
            {betType === 'EXACTA_BOX' && (
              <p className="bet-builder__explanation-math">
                With {selectedHorses.length} horses: {calculation.combinations} combinations.
              </p>
            )}
            {betType === 'TRIFECTA_BOX' && (
              <p className="bet-builder__explanation-math">
                With {selectedHorses.length} horses: {calculation.combinations} combinations.
              </p>
            )}
            {betType === 'SUPERFECTA_BOX' && (
              <p className="bet-builder__explanation-math">
                With {selectedHorses.length} horses: {calculation.combinations} combinations.
              </p>
            )}
          </section>

          {/* Footer */}
          <footer className="bet-builder__footer">
            <div className="bet-builder__footer-total">
              <span className="bet-builder__footer-label">TOTAL COST:</span>
              <span className="bet-builder__footer-amount">${calculation.totalCost}</span>
            </div>
            <button
              className={`bet-builder__footer-copy ${copySuccess ? 'bet-builder__footer-copy--success' : ''}`}
              onClick={handleCopy}
              disabled={!calculation.isValid}
            >
              <span className="material-icons">{copySuccess ? 'check' : 'content_copy'}</span>
              <span>{copySuccess ? 'Copied!' : 'COPY BET'}</span>
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default BetBuilder;
