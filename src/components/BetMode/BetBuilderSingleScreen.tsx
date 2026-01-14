/**
 * BetBuilderSingleScreen Component
 *
 * A single-screen reactive Bet Builder interface with left-side inputs
 * and right-side live results. No wizard, no steps — everything visible at once.
 *
 * Left column (~40%): All inputs/selections
 * Right column (~60%): All outputs/results
 * Both columns scroll independently.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ParsedRace } from '../../types/drf';
import type { ScoredHorse } from '../../lib/scoring';
import {
  type BuilderBetType,
  type BuilderRiskStyle,
  BET_TYPE_CONFIG,
  BET_TYPE_OPTIONS,
  BUDGET_PRESETS,
  RISK_STYLE_CONFIG,
  calculateCombinations,
  calculateTotalCost,
  formatWindowScript,
  getBetTypeExplanation,
  getValueLabel,
  getRequiredHorses,
} from '../../lib/betting/betTypeDefinitions';
import { parseOddsToNumber } from '../../hooks/useValueDetection';
import './BetBuilderSingleScreen.css';

// ============================================================================
// TYPES
// ============================================================================

interface BetBuilderSingleScreenProps {
  /** Current race data */
  race: ParsedRace | undefined;
  /** Race number (1-indexed) */
  raceNumber: number;
  /** Track name for display */
  trackName?: string;
  /** Scored horses with rankings */
  scoredHorses: ScoredHorse[];
  /** Function to get current odds for a horse */
  getOdds: (index: number, defaultOdds: string) => string;
  /** Function to check if horse is scratched */
  isScratched: (index: number) => boolean;
  /** Callback to close bet builder */
  onClose: () => void;
}

interface HorseOption {
  index: number;
  programNumber: number;
  name: string;
  projectedRank: number;
  edge: number;
  odds: string;
  oddsDecimal: number;
  isScratched: boolean;
}

interface GeneratedBet {
  id: string;
  medal: '🥇' | '🥈' | '🥉';
  label: string;
  betType: BuilderBetType;
  horses: number[];
  horseNames: string[];
  combinations: number;
  costPerCombo: number;
  totalCost: number;
  potentialReturn: { min: number; max: number };
  windowScript: string;
  explanation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY_BUDGET = 'betbuilder_budget';
const STORAGE_KEY_STYLE = 'betbuilder_style';
const STORAGE_KEY_BET_TYPE = 'betbuilder_bettype';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate value edge for a horse
 */
function calculateEdge(
  _rank: number,
  totalFieldScore: number,
  horseScore: number,
  oddsDecimal: number
): number {
  if (totalFieldScore === 0) return 0;
  const modelWinProb = (horseScore / totalFieldScore) * 100;
  const impliedProb = (1 / (oddsDecimal + 1)) * 100;
  return ((modelWinProb - impliedProb) / impliedProb) * 100;
}

/**
 * Estimate potential return range
 */
function estimateReturn(
  betType: BuilderBetType,
  horses: HorseOption[],
  costPerCombo: number,
  combinations: number
): { min: number; max: number } {
  const totalCost = costPerCombo * combinations;

  // Base multipliers by bet type
  const multipliers: Record<string, { min: number; max: number }> = {
    WIN: { min: 3, max: 20 },
    PLACE: { min: 2, max: 8 },
    SHOW: { min: 1.5, max: 4 },
    EXACTA: { min: 10, max: 100 },
    EXACTA_BOX: { min: 8, max: 80 },
    EXACTA_KEY: { min: 8, max: 60 },
    QUINELLA: { min: 6, max: 50 },
    TRIFECTA: { min: 50, max: 500 },
    TRIFECTA_BOX: { min: 30, max: 300 },
    TRIFECTA_KEY: { min: 30, max: 250 },
    SUPERFECTA: { min: 200, max: 5000 },
    SUPERFECTA_BOX: { min: 100, max: 2000 },
    DAILY_DOUBLE: { min: 15, max: 150 },
    PICK_3: { min: 30, max: 500 },
    PICK_4: { min: 100, max: 2000 },
  };

  const mult = multipliers[betType] || { min: 5, max: 50 };

  // Adjust based on horse odds (higher odds = higher potential)
  const avgOdds = horses.reduce((sum, h) => sum + h.oddsDecimal, 0) / (horses.length || 1);
  const oddsMultiplier = Math.min(2, Math.max(0.5, avgOdds / 10));

  return {
    min: Math.round(totalCost * mult.min * oddsMultiplier),
    max: Math.round(totalCost * mult.max * oddsMultiplier),
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BetBuilderSingleScreen: React.FC<BetBuilderSingleScreenProps> = ({
  race,
  raceNumber,
  trackName = 'Track',
  scoredHorses,
  getOdds,
  isScratched,
  onClose,
}) => {
  // ============================================================================
  // STATE - User Inputs
  // ============================================================================

  const [budgetPerWay, setBudgetPerWay] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_BUDGET);
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 1 && num <= 100) return num;
      }
    }
    return 1; // Default $1 per way
  });

  const [customBudget, setCustomBudget] = useState<string>('');
  const [isCustomBudget, setIsCustomBudget] = useState(false);

  const [riskStyle, setRiskStyle] = useState<BuilderRiskStyle>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_STYLE) as BuilderRiskStyle | null;
      if (saved && ['safe', 'balanced', 'aggressive'].includes(saved)) return saved;
    }
    return 'balanced'; // Default balanced
  });

  const [betType, setBetType] = useState<BuilderBetType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_BET_TYPE) as BuilderBetType | null;
      if (saved && BET_TYPE_CONFIG[saved]) return saved;
    }
    return 'WIN'; // Default Win
  });

  // Track user manual overrides with configuration context
  // Overrides are automatically invalidated when risk style or bet type changes
  const [userOverrideState, setUserOverrideState] = useState<{
    config: string; // riskStyle + betType combo
    indices: number[];
  } | null>(null);

  // ============================================================================
  // STATE - UI
  // ============================================================================

  const [copyToast, setCopyToast] = useState<string | null>(null);

  // ============================================================================
  // PERSIST SETTINGS
  // ============================================================================

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BUDGET, String(budgetPerWay));
    }
  }, [budgetPerWay]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_STYLE, riskStyle);
    }
  }, [riskStyle]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BET_TYPE, betType);
    }
  }, [betType]);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  // Get all horse options with calculated data
  const horseOptions: HorseOption[] = useMemo(() => {
    if (!race?.horses) return [];

    const totalFieldScore = scoredHorses
      .filter((h) => !isScratched(h.index))
      .reduce((sum, h) => sum + h.score.baseScore, 0);

    return race.horses.map((horse, index) => {
      const scored = scoredHorses.find((s) => s.index === index);
      const odds = getOdds(index, horse.morningLineOdds);
      const oddsDecimal = parseOddsToNumber(odds);
      const scratched = isScratched(index);

      const edge = scored
        ? calculateEdge(scored.rank, totalFieldScore, scored.score.baseScore, oddsDecimal)
        : 0;

      return {
        index,
        programNumber: horse.programNumber,
        name: horse.horseName,
        projectedRank: scored?.rank || 99,
        edge,
        odds,
        oddsDecimal,
        isScratched: scratched,
      };
    });
  }, [race, scoredHorses, getOdds, isScratched]);

  // Sort by projected rank for display
  const sortedByRank = useMemo(() => {
    return [...horseOptions]
      .filter((h) => !h.isScratched)
      .sort((a, b) => a.projectedRank - b.projectedRank);
  }, [horseOptions]);

  // Get required number of horses for current bet type
  const requiredHorses = useMemo(() => getRequiredHorses(betType), [betType]);

  // Compute default horse selection based on bet type and risk style
  const defaultSelectedIndices = useMemo((): number[] => {
    if (sortedByRank.length === 0) return [];

    const count = Math.max(requiredHorses.min, Math.min(requiredHorses.max, 3));

    if (riskStyle === 'safe') {
      // Pick top ranked horses
      return sortedByRank.slice(0, count).map((h) => h.index);
    } else if (riskStyle === 'aggressive') {
      // Favor horses with highest edge that are still in top 6
      const topSixByEdge = [...sortedByRank]
        .slice(0, 6)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, count);
      return topSixByEdge.map((h) => h.index);
    } else {
      // Balanced: mix of rank and edge
      const top4ByRank = sortedByRank.slice(0, 4);
      // Sort these by edge to get best value among top ranked
      const sortedByEdge = [...top4ByRank].sort((a, b) => b.edge - a.edge);
      return sortedByEdge.slice(0, count).map((h) => h.index);
    }
  }, [sortedByRank, riskStyle, requiredHorses]);

  // Configuration key for tracking overrides
  const configKey = `${riskStyle}-${betType}`;

  // Final selected horse indices - use overrides if present and config matches, else defaults
  const userOverrideIndices =
    userOverrideState?.config === configKey ? userOverrideState.indices : null;
  const selectedHorseIndices = userOverrideIndices ?? defaultSelectedIndices;

  // Get selected horses data
  const selectedHorses = useMemo(() => {
    return selectedHorseIndices
      .map((idx) => horseOptions.find((h) => h.index === idx))
      .filter((h): h is HorseOption => h !== undefined);
  }, [selectedHorseIndices, horseOptions]);

  // ============================================================================
  // BET GENERATION
  // ============================================================================

  const generatedBets = useMemo((): GeneratedBet[] => {
    if (selectedHorses.length < requiredHorses.min) return [];

    const bets: GeneratedBet[] = [];
    const horses = selectedHorses.map((h) => h.programNumber);
    const horseNames = selectedHorses.map((h) => h.name);

    // Generate 3 bet variations based on bet type
    switch (betType) {
      case 'WIN': {
        // Best: Win on highest-edge horse
        const bestHorse = selectedHorses[0];
        if (bestHorse) {
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'WIN',
            horses: [bestHorse.programNumber],
            horseNames: [bestHorse.name],
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn('WIN', [bestHorse], budgetPerWay, 1),
            windowScript: formatWindowScript('WIN', [bestHorse.programNumber], budgetPerWay),
            explanation: `You're betting ${bestHorse.name} wins outright. At ${bestHorse.odds}, this horse has ${bestHorse.edge >= 0 ? '+' : ''}${Math.round(bestHorse.edge)}% edge.`,
          });

          // Safer: Place on same horse
          bets.push({
            id: 'safer',
            medal: '🥈',
            label: 'SAFER OPTION',
            betType: 'PLACE',
            horses: [bestHorse.programNumber],
            horseNames: [bestHorse.name],
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn('PLACE', [bestHorse], budgetPerWay, 1),
            windowScript: formatWindowScript('PLACE', [bestHorse.programNumber], budgetPerWay),
            explanation: `Same horse, but betting to Place (1st or 2nd). Lower payout but easier to hit.`,
          });

          // Deeper: Win on best + Win on 2nd best
          const secondHorse = sortedByRank[1];
          if (secondHorse) {
            bets.push({
              id: 'deeper',
              medal: '🥉',
              label: 'GO DEEPER',
              betType: 'WIN',
              horses: [bestHorse.programNumber, secondHorse.programNumber],
              horseNames: [bestHorse.name, secondHorse.name],
              combinations: 2,
              costPerCombo: budgetPerWay,
              totalCost: budgetPerWay * 2,
              potentialReturn: estimateReturn('WIN', [bestHorse, secondHorse], budgetPerWay, 2),
              windowScript: `${formatWindowScript('WIN', [bestHorse.programNumber], budgetPerWay)} AND ${formatWindowScript('WIN', [secondHorse.programNumber], budgetPerWay)}`,
              explanation: `Win bets on both your top picks. If either wins, you cash.`,
            });
          }
        }
        break;
      }

      case 'PLACE': {
        const bestHorse = selectedHorses[0];
        if (bestHorse) {
          // Best: Place on selected horse
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'PLACE',
            horses: [bestHorse.programNumber],
            horseNames: [bestHorse.name],
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn('PLACE', [bestHorse], budgetPerWay, 1),
            windowScript: formatWindowScript('PLACE', [bestHorse.programNumber], budgetPerWay),
            explanation: `Place bet on ${bestHorse.name}. Cashes if horse finishes 1st or 2nd.`,
          });

          // Safer: Show on same horse
          bets.push({
            id: 'safer',
            medal: '🥈',
            label: 'SAFER OPTION',
            betType: 'SHOW',
            horses: [bestHorse.programNumber],
            horseNames: [bestHorse.name],
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn('SHOW', [bestHorse], budgetPerWay, 1),
            windowScript: formatWindowScript('SHOW', [bestHorse.programNumber], budgetPerWay),
            explanation: `Show bet instead. Cashes if horse hits the board (top 3).`,
          });

          // Deeper: Place + Win on same horse
          bets.push({
            id: 'deeper',
            medal: '🥉',
            label: 'GO DEEPER',
            betType: 'WIN',
            horses: [bestHorse.programNumber],
            horseNames: [bestHorse.name],
            combinations: 2,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay * 2,
            potentialReturn: {
              min:
                estimateReturn('PLACE', [bestHorse], budgetPerWay, 1).min +
                estimateReturn('WIN', [bestHorse], budgetPerWay, 1).min,
              max:
                estimateReturn('PLACE', [bestHorse], budgetPerWay, 1).max +
                estimateReturn('WIN', [bestHorse], budgetPerWay, 1).max,
            },
            windowScript: `${formatWindowScript('WIN', [bestHorse.programNumber], budgetPerWay)} AND ${formatWindowScript('PLACE', [bestHorse.programNumber], budgetPerWay)}`,
            explanation: `Win AND Place on same horse. If he wins, you cash both!`,
          });
        }
        break;
      }

      case 'SHOW': {
        const bestHorse = selectedHorses[0];
        if (bestHorse) {
          // Best: Show on selected horse
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'SHOW',
            horses: [bestHorse.programNumber],
            horseNames: [bestHorse.name],
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn('SHOW', [bestHorse], budgetPerWay, 1),
            windowScript: formatWindowScript('SHOW', [bestHorse.programNumber], budgetPerWay),
            explanation: `Show bet on ${bestHorse.name}. Safest bet - cashes if horse finishes top 3.`,
          });

          // Safer: Show on second horse too
          const secondHorse = sortedByRank[1];
          if (secondHorse) {
            bets.push({
              id: 'safer',
              medal: '🥈',
              label: 'SAFER OPTION',
              betType: 'SHOW',
              horses: [secondHorse.programNumber],
              horseNames: [secondHorse.name],
              combinations: 1,
              costPerCombo: budgetPerWay,
              totalCost: budgetPerWay,
              potentialReturn: estimateReturn('SHOW', [secondHorse], budgetPerWay, 1),
              windowScript: formatWindowScript('SHOW', [secondHorse.programNumber], budgetPerWay),
              explanation: `Backup show bet on your #2 ranked horse.`,
            });
          }

          // Deeper: Show parlay on both
          if (secondHorse) {
            bets.push({
              id: 'deeper',
              medal: '🥉',
              label: 'GO DEEPER',
              betType: 'SHOW',
              horses: [bestHorse.programNumber, secondHorse.programNumber],
              horseNames: [bestHorse.name, secondHorse.name],
              combinations: 2,
              costPerCombo: budgetPerWay,
              totalCost: budgetPerWay * 2,
              potentialReturn: {
                min: estimateReturn('SHOW', [bestHorse], budgetPerWay, 1).min * 2,
                max: estimateReturn('SHOW', [bestHorse], budgetPerWay, 1).max * 2,
              },
              windowScript: `${formatWindowScript('SHOW', [bestHorse.programNumber], budgetPerWay)} AND ${formatWindowScript('SHOW', [secondHorse.programNumber], budgetPerWay)}`,
              explanation: `Show bets on both top picks. Higher coverage, both likely to hit.`,
            });
          }
        }
        break;
      }

      case 'EXACTA':
      case 'EXACTA_BOX': {
        if (selectedHorses.length >= 2) {
          const h1 = selectedHorses[0]!;
          const h2 = selectedHorses[1]!;

          // Best: Exacta Box with selected horses
          const boxCombos = calculateCombinations('EXACTA_BOX', selectedHorses.length);
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'EXACTA_BOX',
            horses: horses,
            horseNames: horseNames,
            combinations: boxCombos,
            costPerCombo: budgetPerWay,
            totalCost: calculateTotalCost('EXACTA_BOX', selectedHorses.length, budgetPerWay),
            potentialReturn: estimateReturn('EXACTA_BOX', selectedHorses, budgetPerWay, boxCombos),
            windowScript: formatWindowScript('EXACTA_BOX', horses, budgetPerWay),
            explanation: `Exacta Box with your ${selectedHorses.length} horses. Any two finishing 1-2 wins.`,
          });

          // Safer: Straight Exacta #1 over #2
          bets.push({
            id: 'safer',
            medal: '🥈',
            label: 'SAFER OPTION',
            betType: 'EXACTA',
            horses: [h1.programNumber, h2.programNumber],
            horseNames: [h1.name, h2.name],
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn('EXACTA', [h1, h2], budgetPerWay, 1),
            windowScript: formatWindowScript('EXACTA', [h1.programNumber, h2.programNumber], budgetPerWay),
            explanation: `Straight exacta: ${h1.name} wins, ${h2.name} places. Half the cost of the box.`,
          });

          // Deeper: Exacta Box with 3 horses
          const thirdHorse = sortedByRank.find(
            (h) => !selectedHorseIndices.includes(h.index)
          );
          if (thirdHorse) {
            const threeHorses = [...selectedHorses.slice(0, 2), thirdHorse];
            const deeperCombos = calculateCombinations('EXACTA_BOX', 3);
            bets.push({
              id: 'deeper',
              medal: '🥉',
              label: 'GO DEEPER',
              betType: 'EXACTA_BOX',
              horses: threeHorses.map((h) => h.programNumber),
              horseNames: threeHorses.map((h) => h.name),
              combinations: deeperCombos,
              costPerCombo: budgetPerWay,
              totalCost: calculateTotalCost('EXACTA_BOX', 3, budgetPerWay),
              potentialReturn: estimateReturn('EXACTA_BOX', threeHorses, budgetPerWay, deeperCombos),
              windowScript: formatWindowScript(
                'EXACTA_BOX',
                threeHorses.map((h) => h.programNumber),
                budgetPerWay
              ),
              explanation: `Add ${thirdHorse.name} for more coverage. If any two finish 1-2, you win.`,
            });
          }
        }
        break;
      }

      case 'EXACTA_KEY': {
        if (selectedHorses.length >= 2) {
          const keyHorse = selectedHorses[0]!;
          const otherHorses = selectedHorses.slice(1);

          // Best: Key with selected others
          const keyCombos = calculateCombinations('EXACTA_KEY', selectedHorses.length);
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'EXACTA_KEY',
            horses: horses,
            horseNames: horseNames,
            combinations: keyCombos,
            costPerCombo: budgetPerWay,
            totalCost: calculateTotalCost('EXACTA_KEY', selectedHorses.length, budgetPerWay),
            potentialReturn: estimateReturn('EXACTA_KEY', selectedHorses, budgetPerWay, keyCombos),
            windowScript: formatWindowScript('EXACTA_KEY', horses, budgetPerWay),
            explanation: `${keyHorse.name} must win, any of ${otherHorses.map((h) => h.name).join(', ')} second.`,
          });

          // Safer: Straight Exacta
          if (otherHorses[0]) {
            bets.push({
              id: 'safer',
              medal: '🥈',
              label: 'SAFER OPTION',
              betType: 'EXACTA',
              horses: [keyHorse.programNumber, otherHorses[0].programNumber],
              horseNames: [keyHorse.name, otherHorses[0].name],
              combinations: 1,
              costPerCombo: budgetPerWay,
              totalCost: budgetPerWay,
              potentialReturn: estimateReturn('EXACTA', [keyHorse, otherHorses[0]], budgetPerWay, 1),
              windowScript: formatWindowScript(
                'EXACTA',
                [keyHorse.programNumber, otherHorses[0].programNumber],
                budgetPerWay
              ),
              explanation: `Single combination: ${keyHorse.name} over ${otherHorses[0].name}.`,
            });
          }

          // Deeper: Key with more horses
          const additionalHorse = sortedByRank.find(
            (h) => !selectedHorseIndices.includes(h.index)
          );
          if (additionalHorse) {
            const deeperHorses = [...selectedHorses, additionalHorse];
            const deeperCombos = calculateCombinations('EXACTA_KEY', deeperHorses.length);
            bets.push({
              id: 'deeper',
              medal: '🥉',
              label: 'GO DEEPER',
              betType: 'EXACTA_KEY',
              horses: deeperHorses.map((h) => h.programNumber),
              horseNames: deeperHorses.map((h) => h.name),
              combinations: deeperCombos,
              costPerCombo: budgetPerWay,
              totalCost: calculateTotalCost('EXACTA_KEY', deeperHorses.length, budgetPerWay),
              potentialReturn: estimateReturn('EXACTA_KEY', deeperHorses, budgetPerWay, deeperCombos),
              windowScript: formatWindowScript(
                'EXACTA_KEY',
                deeperHorses.map((h) => h.programNumber),
                budgetPerWay
              ),
              explanation: `Add ${additionalHorse.name} for more coverage on the place spot.`,
            });
          }
        }
        break;
      }

      case 'TRIFECTA':
      case 'TRIFECTA_BOX': {
        if (selectedHorses.length >= 3) {
          // Best: Trifecta Box with selected horses
          const boxCombos = calculateCombinations('TRIFECTA_BOX', selectedHorses.length);
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'TRIFECTA_BOX',
            horses: horses,
            horseNames: horseNames,
            combinations: boxCombos,
            costPerCombo: budgetPerWay,
            totalCost: calculateTotalCost('TRIFECTA_BOX', selectedHorses.length, budgetPerWay),
            potentialReturn: estimateReturn('TRIFECTA_BOX', selectedHorses, budgetPerWay, boxCombos),
            windowScript: formatWindowScript('TRIFECTA_BOX', horses, budgetPerWay),
            explanation: `Trifecta Box with ${selectedHorses.length} horses. Any order of these 3 in 1-2-3 wins.`,
          });

          // Safer: Trifecta Key (best horse keyed)
          const keyHorse = selectedHorses[0]!;
          const keyCombos = calculateCombinations('TRIFECTA_KEY', selectedHorses.length);
          bets.push({
            id: 'safer',
            medal: '🥈',
            label: 'SAFER OPTION',
            betType: 'TRIFECTA_KEY',
            horses: horses,
            horseNames: horseNames,
            combinations: keyCombos,
            costPerCombo: budgetPerWay,
            totalCost: calculateTotalCost('TRIFECTA_KEY', selectedHorses.length, budgetPerWay),
            potentialReturn: estimateReturn('TRIFECTA_KEY', selectedHorses, budgetPerWay, keyCombos),
            windowScript: formatWindowScript('TRIFECTA_KEY', horses, budgetPerWay),
            explanation: `${keyHorse.name} keyed to win with others filling 2nd/3rd. Fewer combos.`,
          });

          // Deeper: Trifecta Box with 4 horses
          const fourthHorse = sortedByRank.find(
            (h) => !selectedHorseIndices.includes(h.index)
          );
          if (fourthHorse) {
            const fourHorses = [...selectedHorses.slice(0, 3), fourthHorse];
            const deeperCombos = calculateCombinations('TRIFECTA_BOX', 4);
            bets.push({
              id: 'deeper',
              medal: '🥉',
              label: 'GO DEEPER',
              betType: 'TRIFECTA_BOX',
              horses: fourHorses.map((h) => h.programNumber),
              horseNames: fourHorses.map((h) => h.name),
              combinations: deeperCombos,
              costPerCombo: budgetPerWay,
              totalCost: calculateTotalCost('TRIFECTA_BOX', 4, budgetPerWay),
              potentialReturn: estimateReturn('TRIFECTA_BOX', fourHorses, budgetPerWay, deeperCombos),
              windowScript: formatWindowScript(
                'TRIFECTA_BOX',
                fourHorses.map((h) => h.programNumber),
                budgetPerWay
              ),
              explanation: `Add ${fourthHorse.name} for 24 combinations. More coverage.`,
            });
          }
        }
        break;
      }

      case 'TRIFECTA_KEY': {
        if (selectedHorses.length >= 3) {
          const keyHorse = selectedHorses[0]!;

          // Best: Key with selected horses
          const keyCombos = calculateCombinations('TRIFECTA_KEY', selectedHorses.length);
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'TRIFECTA_KEY',
            horses: horses,
            horseNames: horseNames,
            combinations: keyCombos,
            costPerCombo: budgetPerWay,
            totalCost: calculateTotalCost('TRIFECTA_KEY', selectedHorses.length, budgetPerWay),
            potentialReturn: estimateReturn('TRIFECTA_KEY', selectedHorses, budgetPerWay, keyCombos),
            windowScript: formatWindowScript('TRIFECTA_KEY', horses, budgetPerWay),
            explanation: `${keyHorse.name} keyed to win with others filling 2nd/3rd spots.`,
          });

          // Safer: Trifecta Box (more flexible)
          const boxCombos = calculateCombinations('TRIFECTA_BOX', selectedHorses.length);
          bets.push({
            id: 'safer',
            medal: '🥈',
            label: 'SAFER OPTION',
            betType: 'TRIFECTA_BOX',
            horses: horses,
            horseNames: horseNames,
            combinations: boxCombos,
            costPerCombo: budgetPerWay,
            totalCost: calculateTotalCost('TRIFECTA_BOX', selectedHorses.length, budgetPerWay),
            potentialReturn: estimateReturn('TRIFECTA_BOX', selectedHorses, budgetPerWay, boxCombos),
            windowScript: formatWindowScript('TRIFECTA_BOX', horses, budgetPerWay),
            explanation: `Box instead of key. Any order wins. More combos but more coverage.`,
          });

          // Deeper: Key with more horses
          const additionalHorse = sortedByRank.find(
            (h) => !selectedHorseIndices.includes(h.index)
          );
          if (additionalHorse) {
            const deeperHorses = [...selectedHorses, additionalHorse];
            const deeperCombos = calculateCombinations('TRIFECTA_KEY', deeperHorses.length);
            bets.push({
              id: 'deeper',
              medal: '🥉',
              label: 'GO DEEPER',
              betType: 'TRIFECTA_KEY',
              horses: deeperHorses.map((h) => h.programNumber),
              horseNames: deeperHorses.map((h) => h.name),
              combinations: deeperCombos,
              costPerCombo: budgetPerWay,
              totalCost: calculateTotalCost('TRIFECTA_KEY', deeperHorses.length, budgetPerWay),
              potentialReturn: estimateReturn('TRIFECTA_KEY', deeperHorses, budgetPerWay, deeperCombos),
              windowScript: formatWindowScript(
                'TRIFECTA_KEY',
                deeperHorses.map((h) => h.programNumber),
                budgetPerWay
              ),
              explanation: `Add ${additionalHorse.name} for more place/show coverage.`,
            });
          }
        }
        break;
      }

      case 'SUPERFECTA':
      case 'SUPERFECTA_BOX': {
        if (selectedHorses.length >= 4) {
          // Best: Superfecta Box with selected horses
          const boxCombos = calculateCombinations('SUPERFECTA_BOX', selectedHorses.length);
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'SUPERFECTA_BOX',
            horses: horses,
            horseNames: horseNames,
            combinations: boxCombos,
            costPerCombo: budgetPerWay,
            totalCost: calculateTotalCost('SUPERFECTA_BOX', selectedHorses.length, budgetPerWay),
            potentialReturn: estimateReturn('SUPERFECTA_BOX', selectedHorses, budgetPerWay, boxCombos),
            windowScript: formatWindowScript('SUPERFECTA_BOX', horses, budgetPerWay),
            explanation: `Superfecta Box with ${selectedHorses.length} horses. Big payouts if they sweep 1-2-3-4.`,
          });

          // Safer: Straight superfecta
          bets.push({
            id: 'safer',
            medal: '🥈',
            label: 'SAFER OPTION',
            betType: 'SUPERFECTA',
            horses: horses.slice(0, 4),
            horseNames: horseNames.slice(0, 4),
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn('SUPERFECTA', selectedHorses.slice(0, 4), budgetPerWay, 1),
            windowScript: formatWindowScript('SUPERFECTA', horses.slice(0, 4), budgetPerWay),
            explanation: `Straight superfecta in exact order. One combo, massive payout potential.`,
          });

          // Deeper: Superfecta Box with 5 horses
          const fifthHorse = sortedByRank.find(
            (h) => !selectedHorseIndices.includes(h.index)
          );
          if (fifthHorse) {
            const fiveHorses = [...selectedHorses.slice(0, 4), fifthHorse];
            const deeperCombos = calculateCombinations('SUPERFECTA_BOX', 5);
            bets.push({
              id: 'deeper',
              medal: '🥉',
              label: 'GO DEEPER',
              betType: 'SUPERFECTA_BOX',
              horses: fiveHorses.map((h) => h.programNumber),
              horseNames: fiveHorses.map((h) => h.name),
              combinations: deeperCombos,
              costPerCombo: budgetPerWay,
              totalCost: calculateTotalCost('SUPERFECTA_BOX', 5, budgetPerWay),
              potentialReturn: estimateReturn('SUPERFECTA_BOX', fiveHorses, budgetPerWay, deeperCombos),
              windowScript: formatWindowScript(
                'SUPERFECTA_BOX',
                fiveHorses.map((h) => h.programNumber),
                budgetPerWay
              ),
              explanation: `Add ${fifthHorse.name} for 120 combinations. Ultimate coverage.`,
            });
          }
        }
        break;
      }

      case 'QUINELLA': {
        if (selectedHorses.length >= 2) {
          const h1 = selectedHorses[0]!;
          const h2 = selectedHorses[1]!;

          // Best: Quinella with top 2
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType: 'QUINELLA',
            horses: [h1.programNumber, h2.programNumber],
            horseNames: [h1.name, h2.name],
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn('QUINELLA', [h1, h2], budgetPerWay, 1),
            windowScript: formatWindowScript('QUINELLA', [h1.programNumber, h2.programNumber], budgetPerWay),
            explanation: `Quinella: ${h1.name} and ${h2.name} finish 1-2 in any order.`,
          });

          // Safer: Exacta Box (same thing but different pool)
          bets.push({
            id: 'safer',
            medal: '🥈',
            label: 'SAFER OPTION',
            betType: 'EXACTA_BOX',
            horses: [h1.programNumber, h2.programNumber],
            horseNames: [h1.name, h2.name],
            combinations: 2,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay * 2,
            potentialReturn: estimateReturn('EXACTA_BOX', [h1, h2], budgetPerWay, 2),
            windowScript: formatWindowScript('EXACTA_BOX', [h1.programNumber, h2.programNumber], budgetPerWay),
            explanation: `Exacta Box instead. Same bet, different pool. Sometimes pays better.`,
          });

          // Deeper: Two quinellas
          const thirdHorse = sortedByRank[2];
          if (thirdHorse) {
            bets.push({
              id: 'deeper',
              medal: '🥉',
              label: 'GO DEEPER',
              betType: 'QUINELLA',
              horses: [h1.programNumber, thirdHorse.programNumber],
              horseNames: [h1.name, thirdHorse.name],
              combinations: 2,
              costPerCombo: budgetPerWay,
              totalCost: budgetPerWay * 2,
              potentialReturn: {
                min: estimateReturn('QUINELLA', [h1, h2], budgetPerWay, 1).min,
                max: estimateReturn('QUINELLA', [h1, thirdHorse], budgetPerWay, 1).max,
              },
              windowScript: `${formatWindowScript('QUINELLA', [h1.programNumber, h2.programNumber], budgetPerWay)} AND ${formatWindowScript('QUINELLA', [h1.programNumber, thirdHorse.programNumber], budgetPerWay)}`,
              explanation: `Two quinellas with ${h1.name}. More ways to win.`,
            });
          }
        }
        break;
      }

      default: {
        // Generic fallback for multi-race bets
        if (selectedHorses.length >= 1) {
          const bestHorse = selectedHorses[0]!;
          bets.push({
            id: 'best',
            medal: '🥇',
            label: 'BEST BET',
            betType,
            horses: [bestHorse.programNumber],
            horseNames: [bestHorse.name],
            combinations: 1,
            costPerCombo: budgetPerWay,
            totalCost: budgetPerWay,
            potentialReturn: estimateReturn(betType, [bestHorse], budgetPerWay, 1),
            windowScript: formatWindowScript(betType, [bestHorse.programNumber], budgetPerWay),
            explanation: `${BET_TYPE_CONFIG[betType].displayName} with your top pick.`,
          });
        }
      }
    }

    return bets;
  }, [betType, selectedHorses, budgetPerWay, sortedByRank, selectedHorseIndices, requiredHorses]);

  // Calculate totals
  const totalForAllBets = useMemo(() => {
    return generatedBets.reduce((sum, bet) => sum + bet.totalCost, 0);
  }, [generatedBets]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleBudgetSelect = useCallback((amount: number) => {
    setBudgetPerWay(amount);
    setIsCustomBudget(false);
  }, []);

  const handleCustomBudgetChange = useCallback((value: string) => {
    setCustomBudget(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 1000) {
      setBudgetPerWay(num);
      setIsCustomBudget(true);
    }
  }, []);

  const handleHorseSelect = useCallback(
    (position: number, horseIndex: number) => {
      const currentIndices = userOverrideIndices ?? defaultSelectedIndices;
      const newIndices = [...currentIndices];
      newIndices[position] = horseIndex;
      setUserOverrideState({ config: configKey, indices: newIndices });
    },
    [userOverrideIndices, defaultSelectedIndices, configKey]
  );

  const handleAddHorse = useCallback(() => {
    const currentIndices = userOverrideIndices ?? defaultSelectedIndices;
    const nextHorse = sortedByRank.find((h) => !currentIndices.includes(h.index));
    if (nextHorse && currentIndices.length < requiredHorses.max) {
      setUserOverrideState({ config: configKey, indices: [...currentIndices, nextHorse.index] });
    }
  }, [sortedByRank, userOverrideIndices, defaultSelectedIndices, requiredHorses.max, configKey]);

  const handleRemoveHorse = useCallback(() => {
    const currentIndices = userOverrideIndices ?? defaultSelectedIndices;
    if (currentIndices.length > requiredHorses.min) {
      setUserOverrideState({ config: configKey, indices: currentIndices.slice(0, -1) });
    }
  }, [userOverrideIndices, defaultSelectedIndices, requiredHorses.min, configKey]);

  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyToast(label);
      setTimeout(() => setCopyToast(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  const handleCopyBestBet = useCallback(() => {
    const bestBet = generatedBets[0];
    if (bestBet) {
      handleCopy(bestBet.windowScript, 'Best bet copied!');
    }
  }, [generatedBets, handleCopy]);

  const handleCopyAllBets = useCallback(() => {
    const allScripts = generatedBets.map((bet) => bet.windowScript).join('\n');
    handleCopy(allScripts, 'All bets copied!');
  }, [generatedBets, handleCopy]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="bet-builder">
      {/* Header */}
      <div className="bet-builder__header">
        <div className="bet-builder__header-left">
          <span className="bet-builder__title">BET BUILDER</span>
          <span className="bet-builder__separator">—</span>
          <span className="bet-builder__race">
            Race {raceNumber} at {trackName}
          </span>
        </div>
        <button className="bet-builder__close-btn" onClick={onClose}>
          <span className="material-icons">close</span>
        </button>
      </div>

      {/* Two Column Layout */}
      <div className="bet-builder__content">
        {/* Left Column - Inputs */}
        <div className="bet-builder__left">
          {/* Budget Per Way */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">BUDGET PER WAY</h3>
            <div className="bet-builder__budget-grid">
              {BUDGET_PRESETS.map((amount) => (
                <button
                  key={amount}
                  className={`bet-builder__budget-btn ${budgetPerWay === amount && !isCustomBudget ? 'bet-builder__budget-btn--active' : ''}`}
                  onClick={() => handleBudgetSelect(amount)}
                >
                  ${amount}
                </button>
              ))}
              <div className="bet-builder__custom-budget">
                <span className="bet-builder__custom-label">Custom:</span>
                <input
                  type="number"
                  className={`bet-builder__custom-input ${isCustomBudget ? 'bet-builder__custom-input--active' : ''}`}
                  placeholder="$"
                  value={customBudget}
                  onChange={(e) => handleCustomBudgetChange(e.target.value)}
                  min={1}
                  max={1000}
                />
              </div>
            </div>
            <p className="bet-builder__helper">Your base bet amount per combination</p>
          </section>

          {/* Risk Style */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">RISK STYLE</h3>
            <div className="bet-builder__style-grid">
              {(Object.keys(RISK_STYLE_CONFIG) as BuilderRiskStyle[]).map((style) => {
                const config = RISK_STYLE_CONFIG[style];
                return (
                  <button
                    key={style}
                    className={`bet-builder__style-btn ${riskStyle === style ? 'bet-builder__style-btn--active' : ''}`}
                    onClick={() => setRiskStyle(style)}
                  >
                    <span className="bet-builder__style-icon">{config.icon}</span>
                    <span className="bet-builder__style-label">{config.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="bet-builder__helper">{RISK_STYLE_CONFIG[riskStyle].description}</p>
          </section>

          {/* Bet Type */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">BET TYPE</h3>
            <select
              className="bet-builder__select"
              value={betType}
              onChange={(e) => setBetType(e.target.value as BuilderBetType)}
            >
              {BET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          {/* Horse Selection */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">YOUR HORSES (auto-filled by Furlong)</h3>
            <div className="bet-builder__horses">
              {selectedHorses.map((horse, position) => {
                const valueInfo = getValueLabel(horse.edge);
                return (
                  <div key={position} className="bet-builder__horse-row">
                    <span className="bet-builder__horse-position">
                      {position === 0 ? '1st' : position === 1 ? '2nd' : position === 2 ? '3rd' : `${position + 1}th`}:
                    </span>
                    <select
                      className="bet-builder__horse-select"
                      value={horse.index}
                      onChange={(e) => handleHorseSelect(position, parseInt(e.target.value, 10))}
                    >
                      {horseOptions
                        .filter((h) => !h.isScratched)
                        .map((h) => (
                          <option key={h.index} value={h.index}>
                            #{h.programNumber} {h.name} — Proj: {h.projectedRank}
                            {h.projectedRank === 1 ? 'st' : h.projectedRank === 2 ? 'nd' : h.projectedRank === 3 ? 'rd' : 'th'}
                            , {h.edge >= 0 ? '+' : ''}
                            {Math.round(h.edge)}%
                          </option>
                        ))}
                    </select>
                    <span className="bet-builder__horse-info">
                      <span className="bet-builder__horse-proj">
                        Proj: {horse.projectedRank}
                        {horse.projectedRank === 1 ? 'st' : horse.projectedRank === 2 ? 'nd' : horse.projectedRank === 3 ? 'rd' : 'th'}
                      </span>
                      <span
                        className="bet-builder__horse-edge"
                        style={{ color: valueInfo.color }}
                      >
                        {horse.edge >= 0 ? '+' : ''}
                        {Math.round(horse.edge)}%
                        {valueInfo.icon && ` ${valueInfo.icon}`}
                      </span>
                      {horse.projectedRank >= 5 && (
                        <span className="bet-builder__horse-warning" title="Projected 5th or worse">
                          ⚠️
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}

              {/* Add/Remove Horse buttons */}
              <div className="bet-builder__horse-actions">
                {selectedHorseIndices.length < requiredHorses.max && BET_TYPE_CONFIG[betType].allowsBox && (
                  <button className="bet-builder__horse-btn" onClick={handleAddHorse}>
                    + Add Horse
                  </button>
                )}
                {selectedHorseIndices.length > requiredHorses.min && (
                  <button className="bet-builder__horse-btn" onClick={handleRemoveHorse}>
                    - Remove Horse
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Projected Finish Order */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">FURLONG'S PROJECTED FINISH</h3>
            <div className="bet-builder__projected">
              {sortedByRank.slice(0, 6).map((horse) => {
                const valueInfo = getValueLabel(horse.edge);
                return (
                  <div key={horse.index} className="bet-builder__projected-row">
                    <span className="bet-builder__projected-rank">
                      {horse.projectedRank}
                      {horse.projectedRank === 1 ? 'st' : horse.projectedRank === 2 ? 'nd' : horse.projectedRank === 3 ? 'rd' : 'th'}:
                    </span>
                    <span className="bet-builder__projected-horse">
                      #{horse.programNumber} {horse.name}
                    </span>
                    <span className="bet-builder__projected-value" style={{ color: valueInfo.color }}>
                      — {valueInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column - Results */}
        <div className="bet-builder__right">
          {/* Selection Summary */}
          <div className="bet-builder__summary">
            Based on: ${budgetPerWay} per way / {RISK_STYLE_CONFIG[riskStyle].label} /{' '}
            {BET_TYPE_CONFIG[betType].displayName}
          </div>

          {/* Top 3 Bets */}
          <section className="bet-builder__bets">
            <h3 className="bet-builder__section-title">TOP 3 BETS</h3>
            {generatedBets.length === 0 ? (
              <div className="bet-builder__no-bets">
                Select at least {requiredHorses.min} horse(s) to generate bets.
              </div>
            ) : (
              generatedBets.map((bet) => (
                <div key={bet.id} className={`bet-builder__bet-card bet-builder__bet-card--${bet.id}`}>
                  <div className="bet-builder__bet-header">
                    <span className="bet-builder__bet-medal">{bet.medal}</span>
                    <span className="bet-builder__bet-label">{bet.label}</span>
                  </div>
                  <div className="bet-builder__bet-type">
                    {BET_TYPE_CONFIG[bet.betType].displayName.toUpperCase()}: #
                    {bet.horses.join(', #')}
                  </div>
                  <div className="bet-builder__bet-details">
                    <span>
                      {bet.combinations} combination{bet.combinations !== 1 ? 's' : ''} × $
                      {bet.costPerCombo} = <strong>${bet.totalCost}</strong> total
                    </span>
                    <span className="bet-builder__bet-return">
                      Potential return: ${bet.potentialReturn.min}-${bet.potentialReturn.max}
                    </span>
                  </div>

                  <div className="bet-builder__bet-window">
                    <span className="bet-builder__window-label">WHAT TO SAY AT THE WINDOW:</span>
                    <div className="bet-builder__window-box">
                      <span className="bet-builder__window-script">"{bet.windowScript}"</span>
                      <button
                        className="bet-builder__copy-btn"
                        onClick={() => handleCopy(bet.windowScript, 'Copied!')}
                      >
                        COPY
                      </button>
                    </div>
                  </div>

                  <div className="bet-builder__bet-why">
                    <span className="bet-builder__why-label">WHY THIS BET?</span>
                    <p className="bet-builder__why-text">{bet.explanation}</p>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Why These Horses */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">WHY THESE HORSES?</h3>
            <div className="bet-builder__horse-explanations">
              {selectedHorses.map((horse) => {
                const valueInfo = getValueLabel(horse.edge);
                return (
                  <div key={horse.index} className="bet-builder__horse-explain">
                    <div className="bet-builder__explain-header">
                      <span className="bet-builder__explain-number">
                        #{horse.programNumber} {horse.name}
                      </span>
                      <span className="bet-builder__explain-proj">
                        (Projected {horse.projectedRank}
                        {horse.projectedRank === 1 ? 'st' : horse.projectedRank === 2 ? 'nd' : horse.projectedRank === 3 ? 'rd' : 'th'})
                      </span>
                    </div>
                    <p className="bet-builder__explain-text" style={{ color: valueInfo.color }}>
                      <strong>{valueInfo.label}</strong>
                      {valueInfo.icon && ` ${valueInfo.icon}`} — The public has this horse at{' '}
                      {horse.odds} but Furlong says{' '}
                      {horse.edge >= 0
                        ? `you're getting +${Math.round(horse.edge)}% extra value.`
                        : `it's ${Math.abs(Math.round(horse.edge))}% overbet.`}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* What's a [Bet Type]? */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">
              WHAT'S {BET_TYPE_CONFIG[betType].displayName.toUpperCase().startsWith('A') ||
                BET_TYPE_CONFIG[betType].displayName.toUpperCase().startsWith('E') ||
                BET_TYPE_CONFIG[betType].displayName.toUpperCase().startsWith('I') ||
                BET_TYPE_CONFIG[betType].displayName.toUpperCase().startsWith('O') ||
                BET_TYPE_CONFIG[betType].displayName.toUpperCase().startsWith('U')
                ? 'AN'
                : 'A'}{' '}
              {BET_TYPE_CONFIG[betType].displayName.toUpperCase()}?
            </h3>
            <div className="bet-builder__bet-explanation">
              <p>{BET_TYPE_CONFIG[betType].whatItMeans}</p>
              <p className="bet-builder__explanation-detail">
                {getBetTypeExplanation(betType, selectedHorses.length)}
              </p>
              <p className="bet-builder__win-condition">
                <strong>You win if:</strong> {BET_TYPE_CONFIG[betType].winCondition}
              </p>
            </div>
          </section>

          {/* Footer with Totals */}
          <div className="bet-builder__footer">
            <div className="bet-builder__totals">
              <span className="bet-builder__total-label">TOTAL FOR ALL 3 BETS:</span>
              <span className="bet-builder__total-amount">${totalForAllBets}</span>
            </div>
            <div className="bet-builder__footer-actions">
              <button
                className="bet-builder__action-btn bet-builder__action-btn--primary"
                onClick={handleCopyBestBet}
                disabled={generatedBets.length === 0}
              >
                COPY BEST BET ONLY
              </button>
              <button
                className="bet-builder__action-btn bet-builder__action-btn--secondary"
                onClick={handleCopyAllBets}
                disabled={generatedBets.length === 0}
              >
                COPY ALL 3 BETS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Toast */}
      {copyToast && (
        <div className="bet-builder__toast">
          <span className="material-icons">check_circle</span>
          {copyToast}
        </div>
      )}
    </div>
  );
};

export default BetBuilderSingleScreen;
