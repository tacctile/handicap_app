/**
 * BetBuilderInterface Component
 *
 * Single-screen reactive bet builder with two-column layout:
 * - Left column: All inputs (budget, risk style, bet type, horse selection)
 * - Right column: Live results (top 3 bet suggestions with context)
 *
 * Everything updates reactively - no wizard steps, no pagination.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ParsedRace } from '../../types/drf';
import type { ScoredHorse } from '../../lib/scoring';
import { parseOddsToNumber, getEdgeColor } from '../../hooks/useValueDetection';
import {
  analyzeOverlayWithField,
  formatOverlayPercent,
  VALUE_LABELS,
} from '../../lib/scoring/overlayAnalysis';
import './BetBuilderInterface.css';

// ============================================================================
// TYPES
// ============================================================================

export type BuilderBetType =
  | 'WIN'
  | 'PLACE'
  | 'SHOW'
  | 'EXACTA'
  | 'EXACTA_BOX'
  | 'EXACTA_KEY'
  | 'TRIFECTA'
  | 'TRIFECTA_BOX'
  | 'TRIFECTA_KEY'
  | 'SUPERFECTA'
  | 'SUPERFECTA_BOX'
  | 'DAILY_DOUBLE'
  | 'PICK_3'
  | 'PICK_4'
  | 'PICK_5'
  | 'PICK_6'
  | 'QUINELLA';

export type RiskStyle = 'safe' | 'balanced' | 'aggressive';

interface BetTypeConfig {
  name: string;
  description: string;
  minHorses: number;
  maxHorses: number;
  isMultiRace: boolean;
}

interface HorseSelection {
  index: number;
  programNumber: number;
  name: string;
  projectedFinish: number;
  edge: number;
  valueLabel: string;
  odds: string;
}

interface GeneratedBet {
  id: string;
  label: string; // "BEST BET", "SAFER OPTION", "GO DEEPER"
  icon: string;
  betType: BuilderBetType;
  betTypeName: string;
  horses: HorseSelection[];
  combinations: number;
  amountPerWay: number;
  totalCost: number;
  potentialReturn: { min: number; max: number };
  windowScript: string;
  whyThisBet: string;
  betTypeExplanation: string;
}

interface BetBuilderInterfaceProps {
  race: ParsedRace;
  raceNumber: number;
  trackName: string;
  scoredHorses: ScoredHorse[];
  getOdds: (index: number, defaultOdds: string) => string;
  isScratched: (index: number) => boolean;
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BUDGET_PRESETS = [1, 2, 5, 10];
const DEFAULT_BUDGET = 1;
const DEFAULT_RISK_STYLE: RiskStyle = 'balanced';
const DEFAULT_BET_TYPE: BuilderBetType = 'WIN';

const RISK_STYLE_CONFIG: Record<RiskStyle, { name: string; subtitle: string; icon: string }> = {
  safe: {
    name: 'Safe',
    subtitle: 'Top-ranked horses, fewer combinations',
    icon: '🛡️',
  },
  balanced: {
    name: 'Balanced',
    subtitle: 'Mix of favorites and value plays',
    icon: '⚖️',
  },
  aggressive: {
    name: 'Aggressive',
    subtitle: 'Lean into longshots with edge',
    icon: '🔥',
  },
};

const BET_TYPE_CONFIG: Record<BuilderBetType, BetTypeConfig> = {
  WIN: { name: 'Win', description: 'Horse must finish 1st to cash', minHorses: 1, maxHorses: 1, isMultiRace: false },
  PLACE: { name: 'Place', description: 'Horse must finish 1st or 2nd to cash', minHorses: 1, maxHorses: 1, isMultiRace: false },
  SHOW: { name: 'Show', description: 'Horse must finish 1st, 2nd, or 3rd to cash', minHorses: 1, maxHorses: 1, isMultiRace: false },
  EXACTA: { name: 'Exacta', description: 'Pick 1st and 2nd in exact order', minHorses: 2, maxHorses: 2, isMultiRace: false },
  EXACTA_BOX: { name: 'Exacta Box', description: 'Pick 1st and 2nd in any order', minHorses: 2, maxHorses: 6, isMultiRace: false },
  EXACTA_KEY: { name: 'Exacta Key', description: 'Key horse over/under others', minHorses: 2, maxHorses: 6, isMultiRace: false },
  TRIFECTA: { name: 'Trifecta', description: 'Pick 1st, 2nd, 3rd in exact order', minHorses: 3, maxHorses: 3, isMultiRace: false },
  TRIFECTA_BOX: { name: 'Trifecta Box', description: 'Pick 1st, 2nd, 3rd in any order', minHorses: 3, maxHorses: 8, isMultiRace: false },
  TRIFECTA_KEY: { name: 'Trifecta Key', description: 'Key horse with others for 2nd/3rd', minHorses: 3, maxHorses: 8, isMultiRace: false },
  SUPERFECTA: { name: 'Superfecta', description: 'Pick 1st, 2nd, 3rd, 4th in exact order', minHorses: 4, maxHorses: 4, isMultiRace: false },
  SUPERFECTA_BOX: { name: 'Superfecta Box', description: 'Pick top 4 in any order', minHorses: 4, maxHorses: 8, isMultiRace: false },
  QUINELLA: { name: 'Quinella', description: 'Pick 1st and 2nd in either order', minHorses: 2, maxHorses: 2, isMultiRace: false },
  DAILY_DOUBLE: { name: 'Daily Double', description: 'Pick winners of 2 consecutive races', minHorses: 1, maxHorses: 1, isMultiRace: true },
  PICK_3: { name: 'Pick 3', description: 'Pick winners of 3 consecutive races', minHorses: 1, maxHorses: 1, isMultiRace: true },
  PICK_4: { name: 'Pick 4', description: 'Pick winners of 4 consecutive races', minHorses: 1, maxHorses: 1, isMultiRace: true },
  PICK_5: { name: 'Pick 5', description: 'Pick winners of 5 consecutive races', minHorses: 1, maxHorses: 1, isMultiRace: true },
  PICK_6: { name: 'Pick 6', description: 'Pick winners of 6 consecutive races', minHorses: 1, maxHorses: 1, isMultiRace: true },
};

const BET_TYPE_EXPLANATIONS: Record<BuilderBetType, string> = {
  WIN: 'A WIN bet is the simplest wager. Your horse must finish first. If your horse wins, you get paid based on the odds. If your horse finishes 2nd or worse, you lose your bet.',
  PLACE: 'A PLACE bet pays if your horse finishes 1st OR 2nd. The payout is lower than a WIN bet, but you have two chances to cash. Great for horses you like but aren\'t 100% confident will win.',
  SHOW: 'A SHOW bet pays if your horse finishes 1st, 2nd, OR 3rd. The lowest payout of the WPS bets, but the safest. Your horse just needs to "hit the board" (top 3).',
  EXACTA: 'An EXACTA requires picking the 1st and 2nd place finishers in exact order. "#4 over #6" means #4 must WIN and #6 must be exactly 2nd. Harder than WIN, but pays more.',
  EXACTA_BOX: 'An EXACTA BOX covers both orders. Boxing #4 and #6 means you win if they finish 1-2 OR 2-1. Costs 2x a straight exacta (2 combinations).',
  EXACTA_KEY: 'An EXACTA KEY puts one horse "on top" over multiple others. "#4 over 6,1,3" means #4 must win, and any of #6, #1, or #3 can be second.',
  TRIFECTA: 'A TRIFECTA requires picking 1st, 2nd, AND 3rd in exact order. Very hard to hit, but pays extremely well when you do.',
  TRIFECTA_BOX: 'A TRIFECTA BOX covers all orderings of your selected horses for 1st, 2nd, 3rd. A 3-horse box = 6 combinations. A 4-horse box = 24 combinations.',
  TRIFECTA_KEY: 'A TRIFECTA KEY uses one "key" horse in a specific position with others filling the remaining spots. More targeted than a full box.',
  SUPERFECTA: 'A SUPERFECTA requires picking the top FOUR finishers in exact order. The hardest single-race bet, but can pay life-changing amounts.',
  SUPERFECTA_BOX: 'A SUPERFECTA BOX covers all orderings of your horses for the top 4 positions. A 4-horse box = 24 combos. A 5-horse box = 120 combos!',
  QUINELLA: 'A QUINELLA is like an Exacta Box for 2 horses, but typically costs less. Your two horses must finish 1-2 in either order.',
  DAILY_DOUBLE: 'A DAILY DOUBLE requires picking the winners of two consecutive races. Both horses must WIN. Harder than two WIN bets, but pays more than betting separately.',
  PICK_3: 'A PICK 3 requires picking winners of 3 consecutive races. All three horses must WIN. Great value when you can "single" confident picks and spread uncertain races.',
  PICK_4: 'A PICK 4 requires picking winners of 4 consecutive races. Often has a mandatory payout or carryover. Can produce huge payouts on small investments.',
  PICK_5: 'A PICK 5 requires picking winners of 5 consecutive races. Very difficult but can pay enormous amounts. Usually offered with $0.50 minimum.',
  PICK_6: 'A PICK 6 requires picking winners of 6 consecutive races. The ultimate challenge. Often has jackpot carryovers that grow to six figures or more.',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate combinations for box bets
 */
function calculateCombinations(betType: BuilderBetType, horseCount: number): number {
  switch (betType) {
    case 'WIN':
    case 'PLACE':
    case 'SHOW':
      return 1;
    case 'EXACTA':
      return 1;
    case 'EXACTA_BOX':
    case 'QUINELLA':
      // n * (n-1) for exacta box, but quinella is n * (n-1) / 2
      return betType === 'QUINELLA'
        ? (horseCount * (horseCount - 1)) / 2
        : horseCount * (horseCount - 1);
    case 'EXACTA_KEY':
      return horseCount - 1; // Key horse over others
    case 'TRIFECTA':
      return 1;
    case 'TRIFECTA_BOX':
      return horseCount * (horseCount - 1) * (horseCount - 2);
    case 'TRIFECTA_KEY':
      return (horseCount - 1) * (horseCount - 2); // Key in first, others 2nd/3rd
    case 'SUPERFECTA':
      return 1;
    case 'SUPERFECTA_BOX':
      return horseCount * (horseCount - 1) * (horseCount - 2) * (horseCount - 3);
    default:
      return 1;
  }
}

/**
 * Generate window script for a bet
 */
function generateWindowScript(
  betType: BuilderBetType,
  horses: HorseSelection[],
  amount: number,
  raceNumber: number
): string {
  const racePrefix = `Race ${raceNumber}, `;
  const nums = horses.map(h => h.programNumber);

  switch (betType) {
    case 'WIN':
      return `${racePrefix}$${amount} to WIN on number ${nums[0]}`;
    case 'PLACE':
      return `${racePrefix}$${amount} to PLACE on number ${nums[0]}`;
    case 'SHOW':
      return `${racePrefix}$${amount} to SHOW on number ${nums[0]}`;
    case 'EXACTA':
      return `${racePrefix}$${amount} EXACTA, ${nums[0]} over ${nums[1]}`;
    case 'EXACTA_BOX':
      return `${racePrefix}$${amount} EXACTA BOX, ${nums.join('-')}`;
    case 'EXACTA_KEY':
      return `${racePrefix}$${amount} EXACTA, number ${nums[0]} on top with ${nums.slice(1).join(', ')}`;
    case 'TRIFECTA':
      return `${racePrefix}$${amount} TRIFECTA, ${nums.join('-')}`;
    case 'TRIFECTA_BOX':
      return `${racePrefix}$${amount} TRIFECTA BOX, ${nums.join('-')}`;
    case 'TRIFECTA_KEY':
      return `${racePrefix}$${amount} TRIFECTA KEY, number ${nums[0]} first, with ${nums.slice(1).join(', ')} for second and third`;
    case 'SUPERFECTA':
      return `${racePrefix}$${amount} SUPERFECTA, ${nums.join('-')}`;
    case 'SUPERFECTA_BOX':
      return `${racePrefix}$${amount} SUPERFECTA BOX, ${nums.join('-')}`;
    case 'QUINELLA':
      return `${racePrefix}$${amount} QUINELLA, ${nums.join('-')}`;
    default:
      return `${racePrefix}$${amount} ${BET_TYPE_CONFIG[betType].name} on ${nums.join(', ')}`;
  }
}

/**
 * Calculate potential returns based on odds and bet type
 */
function calculatePotentialReturn(
  betType: BuilderBetType,
  horses: HorseSelection[],
  totalCost: number
): { min: number; max: number } {
  if (horses.length === 0) return { min: 0, max: 0 };

  const odds = horses.map(h => parseOddsToNumber(h.odds));
  const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
  const maxOdds = Math.max(...odds);
  const minOdds = Math.min(...odds);

  switch (betType) {
    case 'WIN':
      return { min: Math.round(totalCost * (minOdds + 1)), max: Math.round(totalCost * (maxOdds + 1)) };
    case 'PLACE':
      return { min: Math.round(totalCost * (minOdds / 2 + 1)), max: Math.round(totalCost * (maxOdds / 2 + 1)) };
    case 'SHOW':
      return { min: Math.round(totalCost * (minOdds / 3 + 1)), max: Math.round(totalCost * (maxOdds / 3 + 1)) };
    case 'EXACTA':
    case 'EXACTA_BOX':
    case 'EXACTA_KEY':
    case 'QUINELLA':
      return { min: Math.round(totalCost * avgOdds * 2), max: Math.round(totalCost * maxOdds * avgOdds) };
    case 'TRIFECTA':
    case 'TRIFECTA_BOX':
    case 'TRIFECTA_KEY':
      return { min: Math.round(totalCost * avgOdds * 5), max: Math.round(totalCost * maxOdds * avgOdds * 3) };
    case 'SUPERFECTA':
    case 'SUPERFECTA_BOX':
      return { min: Math.round(totalCost * avgOdds * 20), max: Math.round(totalCost * maxOdds * avgOdds * 10) };
    default:
      return { min: totalCost * 2, max: totalCost * 10 };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BetBuilderInterface: React.FC<BetBuilderInterfaceProps> = ({
  race: _race,
  raceNumber,
  trackName: _trackName,
  scoredHorses,
  getOdds,
  isScratched,
  onClose,
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [budgetPerWay, setBudgetPerWay] = useState(DEFAULT_BUDGET);
  const [customBudget, setCustomBudget] = useState('');
  const [riskStyle, setRiskStyle] = useState<RiskStyle>(DEFAULT_RISK_STYLE);
  const [betType, setBetType] = useState<BuilderBetType>(DEFAULT_BET_TYPE);
  const [selectedHorses, setSelectedHorses] = useState<number[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  // Get active horses sorted by rank
  const activeHorses = useMemo(() => {
    return scoredHorses
      .filter(h => !isScratched(h.index) && !h.score.isScratched)
      .sort((a, b) => a.rank - b.rank);
  }, [scoredHorses, isScratched]);

  // Get all base scores for field-relative calculations
  const allFieldBaseScores = useMemo(() => {
    return activeHorses.map(h => h.score.baseScore);
  }, [activeHorses]);

  // Build horse selection options with overlay analysis
  const horseOptions: HorseSelection[] = useMemo(() => {
    return activeHorses.map(scoredHorse => {
      const odds = getOdds(scoredHorse.index, scoredHorse.horse.morningLineOdds);
      const overlay = analyzeOverlayWithField(
        scoredHorse.score.baseScore,
        allFieldBaseScores,
        odds
      );

      return {
        index: scoredHorse.index,
        programNumber: scoredHorse.horse.programNumber,
        name: scoredHorse.horse.horseName,
        projectedFinish: scoredHorse.rank,
        edge: overlay.overlayPercent,
        valueLabel: VALUE_LABELS[overlay.valueClass],
        odds,
      };
    });
  }, [activeHorses, getOdds, allFieldBaseScores]);

  // Value analysis for the race (reserved for future use)
  const _valueAnalysis = useMemo(() => {
    // Note: Currently not displayed directly but available for future enhancements
    return null;
  }, []);

  // ============================================================================
  // AUTO-FILL HORSES BASED ON BET TYPE AND RISK STYLE
  // ============================================================================

  useEffect(() => {
    const config = BET_TYPE_CONFIG[betType];
    if (config.isMultiRace) return; // Multi-race bets handled differently

    // Get horses based on risk style
    let candidates: HorseSelection[];

    switch (riskStyle) {
      case 'safe':
        // Top-ranked horses only
        candidates = horseOptions.slice(0, 4);
        break;
      case 'aggressive':
        // Favor horses with high edge
        candidates = [...horseOptions]
          .sort((a, b) => b.edge - a.edge)
          .slice(0, 6);
        break;
      case 'balanced':
      default:
        // Mix of top-ranked and value
        const topRanked = horseOptions.slice(0, 3);
        const valueHorses = horseOptions.filter(h => h.edge > 20 && !topRanked.includes(h));
        candidates = [...topRanked, ...valueHorses.slice(0, 3)];
        break;
    }

    // Select appropriate number of horses for bet type
    const newSelection = candidates
      .slice(0, config.minHorses)
      .map(h => h.index);

    setSelectedHorses(newSelection);
  }, [betType, riskStyle, horseOptions]);

  // ============================================================================
  // GENERATE TOP 3 BETS
  // ============================================================================

  const generatedBets = useMemo((): GeneratedBet[] => {
    const config = BET_TYPE_CONFIG[betType];
    if (config.isMultiRace) return []; // Not supported in this builder

    const selected = selectedHorses
      .map(idx => horseOptions.find(h => h.index === idx))
      .filter((h): h is HorseSelection => h !== undefined);

    if (selected.length < config.minHorses) return [];

    const bets: GeneratedBet[] = [];
    const actualBudget = customBudget ? parseFloat(customBudget) || budgetPerWay : budgetPerWay;

    // Generate BEST BET based on user's selection
    const bestBetHorses = selected.slice(0, config.maxHorses);
    const bestCombos = calculateCombinations(betType, bestBetHorses.length);
    const bestCost = actualBudget * bestCombos;

    bets.push({
      id: 'best',
      label: 'BEST BET',
      icon: '🥇',
      betType,
      betTypeName: config.name,
      horses: bestBetHorses,
      combinations: bestCombos,
      amountPerWay: actualBudget,
      totalCost: bestCost,
      potentialReturn: calculatePotentialReturn(betType, bestBetHorses, bestCost),
      windowScript: generateWindowScript(betType, bestBetHorses, actualBudget, raceNumber),
      whyThisBet: generateWhyThisBet(betType, bestBetHorses, riskStyle),
      betTypeExplanation: BET_TYPE_EXPLANATIONS[betType],
    });

    // Generate SAFER OPTION
    const saferBet = generateSaferOption(betType, selected, actualBudget, raceNumber, horseOptions);
    if (saferBet) {
      bets.push(saferBet);
    }

    // Generate GO DEEPER option
    const deeperBet = generateDeeperOption(betType, selected, actualBudget, raceNumber, horseOptions, config);
    if (deeperBet) {
      bets.push(deeperBet);
    }

    return bets;
  }, [betType, selectedHorses, budgetPerWay, customBudget, raceNumber, horseOptions, riskStyle]);

  // ============================================================================
  // HELPER FUNCTIONS FOR BET GENERATION
  // ============================================================================

  function generateWhyThisBet(type: BuilderBetType, horses: HorseSelection[], style: RiskStyle): string {
    if (horses.length === 0) return '';

    const topHorse = horses[0]!;
    const edgeText = topHorse.edge > 0 ? `+${Math.round(topHorse.edge)}% edge` : 'fair value';

    switch (type) {
      case 'WIN':
        return `#${topHorse.programNumber} ${topHorse.name} is projected ${toOrdinal(topHorse.projectedFinish)} with ${edgeText}. ${style === 'aggressive' ? 'You\'re swinging for the fence with this one.' : 'A straightforward WIN bet maximizes your payout if this horse takes it.'}`;
      case 'PLACE':
        return `#${topHorse.programNumber} ${topHorse.name} is ranked ${toOrdinal(topHorse.projectedFinish)} and offers ${edgeText}. PLACE gives you a safety net - 1st or 2nd both cash.`;
      case 'SHOW':
        return `#${topHorse.programNumber} ${topHorse.name} just needs to hit the board (top 3). At ${topHorse.odds} with ${edgeText}, this is a safer way to cash.`;
      case 'EXACTA':
        return `#${horses[0]?.programNumber} over #${horses[1]?.programNumber} - your top two picks in order. This exacta combines projected finishers ${horses.map(h => toOrdinal(h.projectedFinish)).join(' and ')}.`;
      case 'EXACTA_BOX':
        return `Boxing ${horses.map(h => `#${h.programNumber}`).join(', ')} covers ${calculateCombinations(type, horses.length)} combinations. They can finish 1-2 in any order.`;
      case 'TRIFECTA':
        return `Straight trifecta with your projected 1-2-3 finishers. High risk, high reward - they must finish exactly in this order.`;
      case 'TRIFECTA_BOX':
        return `Boxing ${horses.length} horses covers ${calculateCombinations(type, horses.length)} trifecta combinations. More coverage, but higher cost.`;
      default:
        return `This ${BET_TYPE_CONFIG[type].name} bet uses your selected horses based on Furlong's projections.`;
    }
  }

  function generateSaferOption(
    type: BuilderBetType,
    selected: HorseSelection[],
    amount: number,
    raceNum: number,
    _allHorses: HorseSelection[]
  ): GeneratedBet | null {
    let saferType: BuilderBetType;
    let saferHorses: HorseSelection[];

    switch (type) {
      case 'WIN':
        // Safer: PLACE bet on same horse
        saferType = 'PLACE';
        saferHorses = selected.slice(0, 1);
        break;
      case 'PLACE':
        // Safer: SHOW bet
        saferType = 'SHOW';
        saferHorses = selected.slice(0, 1);
        break;
      case 'SHOW':
        // Already safest WPS bet, no safer option
        return null;
      case 'EXACTA':
        // Safer: Exacta Box (either order)
        saferType = 'EXACTA_BOX';
        saferHorses = selected.slice(0, 2);
        break;
      case 'EXACTA_BOX':
        // Safer: Remove lowest-ranked horse if more than 2
        if (selected.length <= 2) {
          saferType = 'QUINELLA';
          saferHorses = selected.slice(0, 2);
        } else {
          saferType = 'EXACTA_BOX';
          saferHorses = selected.slice(0, selected.length - 1);
        }
        break;
      case 'TRIFECTA':
        // Safer: Trifecta Box
        saferType = 'TRIFECTA_BOX';
        saferHorses = selected.slice(0, 3);
        break;
      case 'TRIFECTA_BOX':
        // Safer: Trifecta Key (if 4+ horses)
        if (selected.length <= 3) {
          saferType = 'EXACTA_BOX';
          saferHorses = selected.slice(0, 3);
        } else {
          saferType = 'TRIFECTA_KEY';
          saferHorses = selected.slice(0, 4);
        }
        break;
      case 'SUPERFECTA':
      case 'SUPERFECTA_BOX':
        // Safer: Trifecta Box
        saferType = 'TRIFECTA_BOX';
        saferHorses = selected.slice(0, 4);
        break;
      default:
        return null;
    }

    const combos = calculateCombinations(saferType, saferHorses.length);
    const cost = amount * combos;

    return {
      id: 'safer',
      label: 'SAFER OPTION',
      icon: '🥈',
      betType: saferType,
      betTypeName: BET_TYPE_CONFIG[saferType].name,
      horses: saferHorses,
      combinations: combos,
      amountPerWay: amount,
      totalCost: cost,
      potentialReturn: calculatePotentialReturn(saferType, saferHorses, cost),
      windowScript: generateWindowScript(saferType, saferHorses, amount, raceNum),
      whyThisBet: `A ${BET_TYPE_CONFIG[saferType].name} gives you more ways to cash. Lower potential payout, but higher hit rate.`,
      betTypeExplanation: BET_TYPE_EXPLANATIONS[saferType],
    };
  }

  function generateDeeperOption(
    type: BuilderBetType,
    selected: HorseSelection[],
    amount: number,
    raceNum: number,
    allHorses: HorseSelection[],
    config: BetTypeConfig
  ): GeneratedBet | null {
    let deeperType: BuilderBetType;
    let deeperHorses: HorseSelection[];

    // Find next best horse not in selection
    const nextBest = allHorses.find(h => !selected.some(s => s.index === h.index));

    switch (type) {
      case 'WIN':
        // Deeper: Win bet on both top pick AND next overlay
        if (!nextBest) return null;
        deeperType = 'WIN';
        deeperHorses = selected.slice(0, 1);
        // For WIN, we show an additional WIN bet, not combined
        return {
          id: 'deeper',
          label: 'GO DEEPER',
          icon: '🥉',
          betType: 'WIN',
          betTypeName: `Win + Win (#${selected[0]?.programNumber} + #${nextBest.programNumber})`,
          horses: [...selected.slice(0, 1), nextBest],
          combinations: 2,
          amountPerWay: amount,
          totalCost: amount * 2,
          potentialReturn: calculatePotentialReturn('WIN', [selected[0] || nextBest, nextBest], amount * 2),
          windowScript: `${generateWindowScript('WIN', selected.slice(0, 1), amount, raceNum)}\n${generateWindowScript('WIN', [nextBest], amount, raceNum)}`,
          whyThisBet: `Two WIN bets: your top pick #${selected[0]?.programNumber} plus overlay horse #${nextBest.programNumber} (${formatOverlayPercent(nextBest.edge)}). If either wins, you profit.`,
          betTypeExplanation: 'Spreading across two WIN bets covers more outcomes. If either horse wins, you cash.',
        };
      case 'PLACE':
      case 'SHOW':
        // Deeper: Exacta box
        if (!nextBest) return null;
        deeperType = 'EXACTA_BOX';
        deeperHorses = [...selected.slice(0, 1), nextBest];
        break;
      case 'EXACTA':
      case 'EXACTA_BOX':
        // Deeper: Add another horse to box
        if (!nextBest || selected.length >= config.maxHorses) return null;
        deeperType = 'EXACTA_BOX';
        deeperHorses = [...selected, nextBest];
        break;
      case 'TRIFECTA':
      case 'TRIFECTA_BOX':
        // Deeper: Add another horse
        if (!nextBest || selected.length >= config.maxHorses) return null;
        deeperType = 'TRIFECTA_BOX';
        deeperHorses = [...selected, nextBest].slice(0, 4);
        break;
      case 'SUPERFECTA':
      case 'SUPERFECTA_BOX':
        // Deeper: Add another horse
        if (!nextBest || selected.length >= config.maxHorses) return null;
        deeperType = 'SUPERFECTA_BOX';
        deeperHorses = [...selected, nextBest].slice(0, 5);
        break;
      default:
        return null;
    }

    const combos = calculateCombinations(deeperType, deeperHorses.length);
    const cost = amount * combos;

    return {
      id: 'deeper',
      label: 'GO DEEPER',
      icon: '🥉',
      betType: deeperType,
      betTypeName: BET_TYPE_CONFIG[deeperType].name,
      horses: deeperHorses,
      combinations: combos,
      amountPerWay: amount,
      totalCost: cost,
      potentialReturn: calculatePotentialReturn(deeperType, deeperHorses, cost),
      windowScript: generateWindowScript(deeperType, deeperHorses, amount, raceNum),
      whyThisBet: `Adding #${nextBest?.programNumber} ${nextBest?.name} (${toOrdinal(nextBest?.projectedFinish || 99)}) gives you ${combos} combinations. More coverage for upset scenarios.`,
      betTypeExplanation: BET_TYPE_EXPLANATIONS[deeperType],
    };
  }

  function toOrdinal(n: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'] as const;
    const v = n % 100;
    const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? 'th';
    return `${n}${suffix}`;
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleBudgetSelect = (amount: number) => {
    setBudgetPerWay(amount);
    setCustomBudget('');
  };

  const handleCustomBudgetChange = (value: string) => {
    setCustomBudget(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0) {
      setBudgetPerWay(parsed);
    }
  };

  const handleHorseChange = (position: number, horseIndex: number) => {
    setSelectedHorses(prev => {
      const newSelection = [...prev];
      newSelection[position] = horseIndex;
      return newSelection;
    });
  };

  const handleAddHorse = () => {
    const config = BET_TYPE_CONFIG[betType];
    if (selectedHorses.length >= config.maxHorses) return;

    // Find first horse not already selected
    const nextHorse = horseOptions.find(h => !selectedHorses.includes(h.index));
    if (nextHorse) {
      setSelectedHorses(prev => [...prev, nextHorse.index]);
    }
  };

  const handleRemoveHorse = (position: number) => {
    const config = BET_TYPE_CONFIG[betType];
    if (selectedHorses.length <= config.minHorses) return;

    setSelectedHorses(prev => prev.filter((_, i) => i !== position));
  };

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(id);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const handleCopyAllBets = useCallback(async () => {
    const scripts = generatedBets.map(b => b.windowScript).join('\n');
    await handleCopy(scripts, 'all');
  }, [generatedBets, handleCopy]);

  const handleCopyBestBet = useCallback(async () => {
    const bestBet = generatedBets.find(b => b.id === 'best');
    if (bestBet) {
      await handleCopy(bestBet.windowScript, 'best-only');
    }
  }, [generatedBets, handleCopy]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const config = BET_TYPE_CONFIG[betType];
  const actualBudget = customBudget ? parseFloat(customBudget) || budgetPerWay : budgetPerWay;
  const totalAllBets = generatedBets.reduce((sum, b) => sum + b.totalCost, 0);

  return (
    <div className="bet-builder">
      {/* Header */}
      <div className="bet-builder__header">
        <div className="bet-builder__header-left">
          <span className="bet-builder__header-icon">🏇</span>
          <span className="bet-builder__header-title">BET BUILDER</span>
          <span className="bet-builder__header-separator">—</span>
          <span className="bet-builder__header-race">Race {raceNumber}</span>
        </div>
        <button className="bet-builder__close-btn" onClick={onClose}>
          <span className="material-icons">close</span>
          <span className="bet-builder__close-text">Close</span>
        </button>
      </div>

      {/* Two-Column Layout */}
      <div className="bet-builder__columns">
        {/* LEFT COLUMN - Inputs */}
        <div className="bet-builder__left">
          {/* Budget Per Way */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">BUDGET PER WAY</h3>
            <p className="bet-builder__section-helper">
              This is your base bet amount. ${actualBudget} per way means ${actualBudget} per combination.
            </p>
            <div className="bet-builder__budget-buttons">
              {BUDGET_PRESETS.map(amount => (
                <button
                  key={amount}
                  className={`bet-builder__budget-btn ${budgetPerWay === amount && !customBudget ? 'bet-builder__budget-btn--active' : ''}`}
                  onClick={() => handleBudgetSelect(amount)}
                >
                  ${amount}
                </button>
              ))}
              <input
                type="number"
                className="bet-builder__budget-custom"
                placeholder="Custom"
                value={customBudget}
                onChange={e => handleCustomBudgetChange(e.target.value)}
                min="0.50"
                step="0.50"
              />
            </div>
          </section>

          {/* Risk Style */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">RISK STYLE</h3>
            <div className="bet-builder__risk-buttons">
              {(Object.keys(RISK_STYLE_CONFIG) as RiskStyle[]).map(style => (
                <button
                  key={style}
                  className={`bet-builder__risk-btn ${riskStyle === style ? 'bet-builder__risk-btn--active' : ''}`}
                  onClick={() => setRiskStyle(style)}
                >
                  <span className="bet-builder__risk-icon">{RISK_STYLE_CONFIG[style].icon}</span>
                  <span className="bet-builder__risk-name">{RISK_STYLE_CONFIG[style].name}</span>
                  <span className="bet-builder__risk-subtitle">{RISK_STYLE_CONFIG[style].subtitle}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Bet Type */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">BET TYPE</h3>
            <select
              className="bet-builder__bet-type-select"
              value={betType}
              onChange={e => setBetType(e.target.value as BuilderBetType)}
            >
              <optgroup label="Win/Place/Show">
                <option value="WIN">Win</option>
                <option value="PLACE">Place</option>
                <option value="SHOW">Show</option>
              </optgroup>
              <optgroup label="Exacta">
                <option value="EXACTA">Exacta (straight)</option>
                <option value="EXACTA_BOX">Exacta Box</option>
                <option value="EXACTA_KEY">Exacta Key</option>
              </optgroup>
              <optgroup label="Trifecta">
                <option value="TRIFECTA">Trifecta (straight)</option>
                <option value="TRIFECTA_BOX">Trifecta Box</option>
                <option value="TRIFECTA_KEY">Trifecta Key</option>
              </optgroup>
              <optgroup label="Superfecta">
                <option value="SUPERFECTA">Superfecta (straight)</option>
                <option value="SUPERFECTA_BOX">Superfecta Box</option>
              </optgroup>
              <optgroup label="Other">
                <option value="QUINELLA">Quinella</option>
              </optgroup>
            </select>
            <p className="bet-builder__bet-type-desc">{config.description}</p>
          </section>

          {/* Horse Selection */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">HORSES</h3>
            <div className="bet-builder__horses">
              {selectedHorses.map((horseIdx, position) => {
                const horse = horseOptions.find(h => h.index === horseIdx);
                const isLowRank = horse && horse.projectedFinish >= 5;
                const positionLabel = config.minHorses === 1 ? '' :
                  position === 0 ? '1st:' :
                  position === 1 ? '2nd:' :
                  position === 2 ? '3rd:' : `${position + 1}th:`;

                return (
                  <div key={position} className="bet-builder__horse-row">
                    {positionLabel && <span className="bet-builder__horse-position">{positionLabel}</span>}
                    <select
                      className={`bet-builder__horse-select ${isLowRank ? 'bet-builder__horse-select--warning' : ''}`}
                      value={horseIdx}
                      onChange={e => handleHorseChange(position, parseInt(e.target.value))}
                    >
                      {horseOptions.map(h => (
                        <option key={h.index} value={h.index}>
                          #{h.programNumber} {h.name}
                        </option>
                      ))}
                    </select>
                    <span className="bet-builder__horse-meta">
                      Proj: {toOrdinal(horse?.projectedFinish || 99)} {' '}
                      <span style={{ color: getEdgeColor(horse?.edge || 0) }}>
                        {formatOverlayPercent(horse?.edge || 0)}
                      </span>
                      {(horse?.edge || 0) >= 75 && <span className="bet-builder__horse-fire">🔥</span>}
                    </span>
                    {isLowRank && (
                      <span className="bet-builder__horse-warning" title="Projected 5th or worse">⚠️</span>
                    )}
                    {selectedHorses.length > config.minHorses && (
                      <button
                        className="bet-builder__horse-remove"
                        onClick={() => handleRemoveHorse(position)}
                        title="Remove horse"
                      >
                        −
                      </button>
                    )}
                  </div>
                );
              })}
              {selectedHorses.length < config.maxHorses && (
                <button className="bet-builder__add-horse" onClick={handleAddHorse}>
                  + Add Horse
                </button>
              )}
            </div>
          </section>

          {/* Projected Finish Order */}
          <section className="bet-builder__section bet-builder__section--projected">
            <h3 className="bet-builder__section-title">FURLONG'S PROJECTED FINISH</h3>
            <div className="bet-builder__projected-list">
              {horseOptions.slice(0, 6).map(horse => (
                <div key={horse.index} className="bet-builder__projected-row">
                  <span className="bet-builder__projected-rank">{toOrdinal(horse.projectedFinish)}:</span>
                  <span className="bet-builder__projected-horse">#{horse.programNumber} {horse.name}</span>
                  <span className="bet-builder__projected-label">— {horse.valueLabel.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN - Results */}
        <div className="bet-builder__right">
          {/* Current Selection Header */}
          <div className="bet-builder__selection-header">
            Based on: ${actualBudget} per way / {RISK_STYLE_CONFIG[riskStyle].name} / {config.name}
          </div>

          {/* Top 3 Bets */}
          <section className="bet-builder__bets-section">
            <h3 className="bet-builder__section-title">TOP 3 BETS</h3>

            {generatedBets.length === 0 ? (
              <div className="bet-builder__no-bets">
                Select horses above to generate bet suggestions
              </div>
            ) : (
              <div className="bet-builder__bet-cards">
                {generatedBets.map(bet => (
                  <div key={bet.id} className={`bet-builder__bet-card bet-builder__bet-card--${bet.id}`}>
                    <div className="bet-builder__bet-card-header">
                      <span className="bet-builder__bet-card-icon">{bet.icon}</span>
                      <span className="bet-builder__bet-card-label">{bet.label}</span>
                    </div>

                    <div className="bet-builder__bet-card-type">
                      {bet.betTypeName}
                    </div>

                    <div className="bet-builder__bet-card-horses">
                      {bet.horses.map((h, i) => (
                        <span key={h.index} className="bet-builder__bet-card-horse">
                          #{h.programNumber} {h.name}
                          {i < bet.horses.length - 1 && ', '}
                        </span>
                      ))}
                    </div>

                    <div className="bet-builder__bet-card-math">
                      <span>{bet.combinations} combo{bet.combinations !== 1 ? 's' : ''}</span>
                      <span>×</span>
                      <span>${bet.amountPerWay}</span>
                      <span>=</span>
                      <span className="bet-builder__bet-card-cost">${bet.totalCost}</span>
                    </div>

                    <div className="bet-builder__bet-card-returns">
                      Potential: ${bet.potentialReturn.min} – ${bet.potentialReturn.max}
                    </div>

                    <div className="bet-builder__bet-card-script">
                      <div className="bet-builder__bet-card-script-label">WHAT TO SAY AT WINDOW:</div>
                      <div className="bet-builder__bet-card-script-text">"{bet.windowScript}"</div>
                      <button
                        className="bet-builder__copy-btn"
                        onClick={() => handleCopy(bet.windowScript, bet.id)}
                      >
                        {copySuccess === bet.id ? '✓ Copied!' : 'COPY'}
                      </button>
                    </div>

                    <details className="bet-builder__bet-card-details">
                      <summary>Why this bet?</summary>
                      <p>{bet.whyThisBet}</p>
                    </details>

                    <details className="bet-builder__bet-card-details">
                      <summary>What's a {bet.betTypeName}?</summary>
                      <p>{bet.betTypeExplanation}</p>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Why These Horses */}
          {generatedBets.length > 0 && generatedBets[0] && (
            <section className="bet-builder__section bet-builder__why-section">
              <h3 className="bet-builder__section-title">WHY THESE HORSES</h3>
              <div className="bet-builder__why-list">
                {generatedBets[0].horses.map(horse => (
                  <div key={horse.index} className="bet-builder__why-item">
                    <div className="bet-builder__why-horse">
                      #{horse.programNumber} {horse.name} (Projected {toOrdinal(horse.projectedFinish)})
                    </div>
                    <div className="bet-builder__why-label" style={{ color: getEdgeColor(horse.edge) }}>
                      {horse.valueLabel.toUpperCase()}
                    </div>
                    <p className="bet-builder__why-explanation">
                      {horse.edge > 20 ? (
                        <>The public has this horse at {horse.odds} but Furlong says the fair odds are lower. You're getting {formatOverlayPercent(horse.edge)} extra value on this horse.</>
                      ) : horse.edge < -20 ? (
                        <>This horse is overbet by the public. At {horse.odds}, you're getting {formatOverlayPercent(horse.edge)} less value than fair odds suggest.</>
                      ) : (
                        <>This horse is priced fairly by the market at {horse.odds}. The edge is near zero - bet based on your conviction, not value.</>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bet Type Explanation */}
          <section className="bet-builder__section">
            <h3 className="bet-builder__section-title">WHAT'S A {config.name.toUpperCase()}?</h3>
            <p className="bet-builder__bet-explanation">
              {BET_TYPE_EXPLANATIONS[betType]}
            </p>
          </section>

          {/* Footer */}
          <div className="bet-builder__footer">
            <div className="bet-builder__footer-total">
              Total cost of all 3 bets: <strong>${totalAllBets.toFixed(2)}</strong>
            </div>
            <div className="bet-builder__footer-actions">
              <button
                className="bet-builder__footer-btn bet-builder__footer-btn--secondary"
                onClick={handleCopyAllBets}
                disabled={generatedBets.length === 0}
              >
                {copySuccess === 'all' ? '✓ Copied!' : 'COPY ALL 3 BETS'}
              </button>
              <button
                className="bet-builder__footer-btn bet-builder__footer-btn--primary"
                onClick={handleCopyBestBet}
                disabled={generatedBets.length === 0}
              >
                {copySuccess === 'best-only' ? '✓ Copied!' : 'COPY BEST BET ONLY'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BetBuilderInterface;
