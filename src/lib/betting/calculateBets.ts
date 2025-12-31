/**
 * Bet Calculation Engine
 *
 * Core logic for calculating bet recommendations based on:
 * - Budget
 * - Risk style (safe, balanced, aggressive)
 * - Value analysis
 * - Contender rankings
 *
 * This is the brain of the betting system.
 */

import type { BetCalculationInput, BetCalculationResult, SingleBet, BetType } from './betTypes';
import { MIN_BET_AMOUNT } from './betTypes';
import { estimateBetReturn, parseOddsToDecimal } from './returnEstimates';
import { generateWhatToSay, generateBetExplanation, generateSkipExplanation } from './whatToSay';
import type { ScoredHorse } from '../scoring';

// Re-export for consumers
export type { BetCalculationResult } from './betTypes';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for a bet
 */
function generateBetId(type: BetType, horses: number[]): string {
  return `${type}-${horses.join('-')}-${Date.now()}`;
}

/**
 * Round amount to valid bet increment (whole dollars)
 */
function roundBetAmount(amount: number): number {
  return Math.max(MIN_BET_AMOUNT, Math.round(amount));
}

/**
 * Calculate number of trifecta key combinations
 * Key horse can be in any of 3 positions, with others filling remaining 2
 * Formula: 3 * P(n, 2) = 3 * n * (n-1) where n = number of "with" horses
 * Simplified for key in first: (n-1) * (n-2) for 2nd/3rd from remaining
 * Actually: key ALL means key can be 1st, 2nd, or 3rd
 * With 3 other horses: 3! = 6 orderings of the others when key is 1st
 * Plus 3 * 2 for when key is 2nd, plus 3 * 2 for 3rd = 6 + 6 + 6? No.
 * Correct: key in any of 3 spots, pick 2 from n others for remaining spots
 * = 3 * n * (n-1) / 2... Actually let's just use known values:
 * Key with 3 others = 6 combinations
 * Key with 4 others = 12 combinations
 * Key with 5 others = 20 combinations
 */
function calculateTrifectaKeyCombinations(withHorses: number): number {
  // Key horse can be 1st, 2nd, or 3rd
  // Remaining 2 spots filled by 2 of the "with" horses in order
  // = 3 * P(n, 2) = 3 * n * (n-1)
  // But that's for full permutations...
  // Standard trifecta key: n * (n-1) where n = with horses
  // Because key is fixed in one position each combo
  // Actually: key ALL with A,B,C means:
  // Key-A-B, Key-A-C, Key-B-A, Key-B-C, Key-C-A, Key-C-B = 6 when key is 1st
  // A-Key-B, A-Key-C, B-Key-A, B-Key-C, C-Key-A, C-Key-B = 6 when key is 2nd
  // A-B-Key, A-C-Key, B-A-Key, B-C-Key, C-A-Key, C-B-Key = 6 when key is 3rd
  // Total = 18 combinations for key with 3 others
  //
  // Hmm, but tracks often use simpler math. Let me use the standard:
  // Key with n others = n * (n-1) combinations when key is 1st only
  // Key ALL (any position) = 3 * n * (n-1) / 2 = ?
  // Let's use practical values:
  const combos: Record<number, number> = {
    2: 2, // Key with 2 = 2 combos (key must be 1st, others fill 2nd/3rd)
    3: 6, // Key with 3 = 6 combos (key 1st, pick 2 from 3 in order)
    4: 12, // Key with 4 = 12 combos
    5: 20, // Key with 5 = 20 combos
  };
  return combos[withHorses] || withHorses * (withHorses - 1);
}

/**
 * Calculate trifecta box combinations: n! / (n-3)! = n * (n-1) * (n-2)
 */
function calculateTrifectaBoxCombinations(horses: number): number {
  if (horses < 3) return 0;
  return horses * (horses - 1) * (horses - 2);
}

/**
 * Calculate exacta box combinations: n * (n-1)
 */
function calculateExactaBoxCombinations(horses: number): number {
  if (horses < 2) return 0;
  return horses * (horses - 1);
}

// ============================================================================
// SAFE STYLE CALCULATIONS
// ============================================================================

/**
 * Calculate bets for SAFE style
 * Focus: Place and Show bets, minimize risk, cash tickets
 */
function calculateSafeBets(input: BetCalculationInput): SingleBet[] {
  const { budget, valuePlay, contenders, getOdds, isScratched } = input;
  const bets: SingleBet[] = [];

  // Filter contenders to non-scratched
  const activeContenders = contenders.filter((c) => !isScratched(c.index));
  if (activeContenders.length === 0) return bets;

  const topContender = activeContenders[0]!;
  const topOdds = parseOddsToDecimal(
    getOdds(topContender.index, topContender.horse.morningLineOdds)
  );

  if (valuePlay) {
    // WITH VALUE PLAY: Split between Place on value, Show on value, Show on backup
    // 50% Place on value, 30% Show on value, 20% Show on top contender

    const placeAmount = roundBetAmount(budget * 0.5);
    const showValueAmount = roundBetAmount(budget * 0.3);
    const showBackupAmount = roundBetAmount(budget * 0.2);

    const valueOdds = parseOddsToDecimal(valuePlay.currentOdds);

    // Bet 1: Place on value play
    if (placeAmount >= MIN_BET_AMOUNT) {
      const returns = estimateBetReturn('PLACE', [valueOdds], placeAmount, 1);
      bets.push({
        id: generateBetId('PLACE', [valuePlay.programNumber]),
        type: 'PLACE',
        horses: [valuePlay.programNumber],
        horseNames: [valuePlay.horseName],
        amount: placeAmount,
        combinations: 1,
        totalCost: placeAmount,
        potentialReturn: returns,
        explanation: generateBetExplanation(
          'PLACE',
          [valuePlay.horseName],
          valueOdds,
          valuePlay.valueEdge,
          valuePlay.modelRank,
          true
        ),
        whatToSay: generateWhatToSay('PLACE', [valuePlay.programNumber], placeAmount),
        priority: 1,
      });
    }

    // Bet 2: Show on value play (backup)
    if (showValueAmount >= MIN_BET_AMOUNT) {
      const returns = estimateBetReturn('SHOW', [valueOdds], showValueAmount, 1);
      bets.push({
        id: generateBetId('SHOW', [valuePlay.programNumber]),
        type: 'SHOW',
        horses: [valuePlay.programNumber],
        horseNames: [valuePlay.horseName],
        amount: showValueAmount,
        combinations: 1,
        totalCost: showValueAmount,
        potentialReturn: returns,
        explanation: `Backup show bet on ${valuePlay.horseName}. If he runs 3rd, we still cash.`,
        whatToSay: generateWhatToSay('SHOW', [valuePlay.programNumber], showValueAmount),
        priority: 2,
      });
    }

    // Bet 3: Show on top contender (different from value play)
    const backupHorse = activeContenders.find(
      (c) =>
        c.index !== contenders.find((x) => x.horse.programNumber === valuePlay.programNumber)?.index
    );
    if (backupHorse && showBackupAmount >= MIN_BET_AMOUNT) {
      const backupOdds = parseOddsToDecimal(
        getOdds(backupHorse.index, backupHorse.horse.morningLineOdds)
      );
      const returns = estimateBetReturn('SHOW', [backupOdds], showBackupAmount, 1);
      bets.push({
        id: generateBetId('SHOW', [backupHorse.horse.programNumber]),
        type: 'SHOW',
        horses: [backupHorse.horse.programNumber],
        horseNames: [backupHorse.horse.horseName],
        amount: showBackupAmount,
        combinations: 1,
        totalCost: showBackupAmount,
        potentialReturn: returns,
        explanation: `Safety net on #${backupHorse.rank} contender. Covers us if the chalk holds.`,
        whatToSay: generateWhatToSay('SHOW', [backupHorse.horse.programNumber], showBackupAmount),
        priority: 3,
      });
    }
  } else {
    // NO VALUE PLAY (PASS race): Conservative survival bets
    // 40% Place on top, 30% Show on top, 30% Show on #2

    const placeAmount = roundBetAmount(budget * 0.4);
    const showTopAmount = roundBetAmount(budget * 0.3);
    const showSecondAmount = roundBetAmount(budget * 0.3);

    // Bet 1: Place on top ranked
    if (placeAmount >= MIN_BET_AMOUNT) {
      const returns = estimateBetReturn('PLACE', [topOdds], placeAmount, 1);
      bets.push({
        id: generateBetId('PLACE', [topContender.horse.programNumber]),
        type: 'PLACE',
        horses: [topContender.horse.programNumber],
        horseNames: [topContender.horse.horseName],
        amount: placeAmount,
        combinations: 1,
        totalCost: placeAmount,
        potentialReturn: returns,
        explanation: `No value play in this race. Playing ${topContender.horse.horseName} to place as our best-ranked contender.`,
        whatToSay: generateWhatToSay('PLACE', [topContender.horse.programNumber], placeAmount),
        priority: 1,
      });
    }

    // Bet 2: Show on top
    if (showTopAmount >= MIN_BET_AMOUNT) {
      const returns = estimateBetReturn('SHOW', [topOdds], showTopAmount, 1);
      bets.push({
        id: generateBetId('SHOW', [topContender.horse.programNumber]),
        type: 'SHOW',
        horses: [topContender.horse.programNumber],
        horseNames: [topContender.horse.horseName],
        amount: showTopAmount,
        combinations: 1,
        totalCost: showTopAmount,
        potentialReturn: returns,
        explanation: `Show bet on ${topContender.horse.horseName} for safety.`,
        whatToSay: generateWhatToSay('SHOW', [topContender.horse.programNumber], showTopAmount),
        priority: 2,
      });
    }

    // Bet 3: Show on second
    if (activeContenders.length > 1 && showSecondAmount >= MIN_BET_AMOUNT) {
      const secondContender = activeContenders[1]!;
      const secondOdds = parseOddsToDecimal(
        getOdds(secondContender.index, secondContender.horse.morningLineOdds)
      );
      const returns = estimateBetReturn('SHOW', [secondOdds], showSecondAmount, 1);
      bets.push({
        id: generateBetId('SHOW', [secondContender.horse.programNumber]),
        type: 'SHOW',
        horses: [secondContender.horse.programNumber],
        horseNames: [secondContender.horse.horseName],
        amount: showSecondAmount,
        combinations: 1,
        totalCost: showSecondAmount,
        potentialReturn: returns,
        explanation: `Backup show on our #2 ranked horse.`,
        whatToSay: generateWhatToSay(
          'SHOW',
          [secondContender.horse.programNumber],
          showSecondAmount
        ),
        priority: 3,
      });
    }
  }

  return bets;
}

// ============================================================================
// BALANCED STYLE CALCULATIONS
// ============================================================================

/**
 * Calculate bets for BALANCED style
 * Focus: Mix of straight bets and exotics
 */
function calculateBalancedBets(input: BetCalculationInput): SingleBet[] {
  const { budget, valuePlay, contenders, getOdds, isScratched } = input;
  const bets: SingleBet[] = [];

  const activeContenders = contenders.filter((c) => !isScratched(c.index));
  if (activeContenders.length === 0) return bets;

  if (valuePlay) {
    // WITH VALUE PLAY:
    // 30% Place on value, 10% Exacta (value over top), 60% Trifecta Key

    const placeAmount = roundBetAmount(budget * 0.3);
    const exactaAmount = Math.max(2, roundBetAmount(budget * 0.1));
    const trifectaBudget = budget - placeAmount - exactaAmount;

    const valueOdds = parseOddsToDecimal(valuePlay.currentOdds);

    // Get top 3 other contenders for trifecta
    const otherContenders = activeContenders
      .filter((c) => c.horse.programNumber !== valuePlay.programNumber)
      .slice(0, 3);

    // Bet 1: Place on value play
    if (placeAmount >= MIN_BET_AMOUNT) {
      const returns = estimateBetReturn('PLACE', [valueOdds], placeAmount, 1);
      bets.push({
        id: generateBetId('PLACE', [valuePlay.programNumber]),
        type: 'PLACE',
        horses: [valuePlay.programNumber],
        horseNames: [valuePlay.horseName],
        amount: placeAmount,
        combinations: 1,
        totalCost: placeAmount,
        potentialReturn: returns,
        explanation: generateBetExplanation(
          'PLACE',
          [valuePlay.horseName],
          valueOdds,
          valuePlay.valueEdge,
          valuePlay.modelRank,
          true
        ),
        whatToSay: generateWhatToSay('PLACE', [valuePlay.programNumber], placeAmount),
        priority: 1,
      });
    }

    // Bet 2: Exacta - value over top contender
    if (otherContenders.length > 0 && exactaAmount >= MIN_BET_AMOUNT) {
      const topOther = otherContenders[0]!;
      const topOtherOdds = parseOddsToDecimal(
        getOdds(topOther.index, topOther.horse.morningLineOdds)
      );
      const returns = estimateBetReturn('EXACTA', [valueOdds, topOtherOdds], exactaAmount, 1);
      bets.push({
        id: generateBetId('EXACTA', [valuePlay.programNumber, topOther.horse.programNumber]),
        type: 'EXACTA',
        horses: [valuePlay.programNumber, topOther.horse.programNumber],
        horseNames: [valuePlay.horseName, topOther.horse.horseName],
        amount: exactaAmount,
        combinations: 1,
        totalCost: exactaAmount,
        potentialReturn: returns,
        explanation: `Exacta with our value play over the top-ranked contender. If ${valuePlay.horseName} wins and ${topOther.horse.horseName} runs second, we cash big.`,
        whatToSay: generateWhatToSay(
          'EXACTA',
          [valuePlay.programNumber, topOther.horse.programNumber],
          exactaAmount
        ),
        priority: 2,
      });
    }

    // Bet 3: Trifecta Key - value ALL with top 3 others
    if (otherContenders.length >= 2 && trifectaBudget >= MIN_BET_AMOUNT * 3) {
      const withHorses = otherContenders.map((c) => c.horse.programNumber);
      const combinations = calculateTrifectaKeyCombinations(withHorses.length);
      const perComboAmount = Math.max(1, Math.floor(trifectaBudget / combinations));
      const totalCost = perComboAmount * combinations;

      const otherOdds = otherContenders.map((c) =>
        parseOddsToDecimal(getOdds(c.index, c.horse.morningLineOdds))
      );
      const returns = estimateBetReturn(
        'TRIFECTA_KEY',
        [valueOdds, ...otherOdds],
        perComboAmount,
        combinations
      );

      bets.push({
        id: generateBetId('TRIFECTA_KEY', [valuePlay.programNumber, ...withHorses]),
        type: 'TRIFECTA_KEY',
        horses: [valuePlay.programNumber, ...withHorses],
        horseNames: [valuePlay.horseName, ...otherContenders.map((c) => c.horse.horseName)],
        amount: perComboAmount,
        combinations,
        totalCost,
        potentialReturn: returns,
        explanation: generateBetExplanation(
          'TRIFECTA_KEY',
          [valuePlay.horseName],
          valueOdds,
          valuePlay.valueEdge,
          valuePlay.modelRank,
          true
        ),
        whatToSay: generateWhatToSay(
          'TRIFECTA_KEY',
          [valuePlay.programNumber, ...withHorses],
          perComboAmount
        ),
        priority: 3,
      });
    }
  } else {
    // NO VALUE PLAY: Defensive balanced approach
    // 40% Show on top, 20% Exacta box top 2, 40% Trifecta box top 3

    const showAmount = roundBetAmount(budget * 0.4);
    const exactaBudget = roundBetAmount(budget * 0.2);
    const trifectaBudget = budget - showAmount - exactaBudget;

    const topContender = activeContenders[0]!;
    const topOdds = parseOddsToDecimal(
      getOdds(topContender.index, topContender.horse.morningLineOdds)
    );

    // Bet 1: Show on top
    if (showAmount >= MIN_BET_AMOUNT) {
      const returns = estimateBetReturn('SHOW', [topOdds], showAmount, 1);
      bets.push({
        id: generateBetId('SHOW', [topContender.horse.programNumber]),
        type: 'SHOW',
        horses: [topContender.horse.programNumber],
        horseNames: [topContender.horse.horseName],
        amount: showAmount,
        combinations: 1,
        totalCost: showAmount,
        potentialReturn: returns,
        explanation: `No clear value play. Show bet on our top-ranked horse for safety.`,
        whatToSay: generateWhatToSay('SHOW', [topContender.horse.programNumber], showAmount),
        priority: 1,
      });
    }

    // Bet 2: Exacta box top 2
    if (activeContenders.length >= 2 && exactaBudget >= MIN_BET_AMOUNT * 2) {
      const top2 = activeContenders.slice(0, 2);
      const combinations = 2; // Box 2 = 2 combos
      const perComboAmount = Math.max(2, Math.floor(exactaBudget / combinations));
      const totalCost = perComboAmount * combinations;

      const odds = top2.map((c) => parseOddsToDecimal(getOdds(c.index, c.horse.morningLineOdds)));
      const returns = estimateBetReturn('EXACTA_BOX', odds, perComboAmount, combinations);

      bets.push({
        id: generateBetId(
          'EXACTA_BOX',
          top2.map((c) => c.horse.programNumber)
        ),
        type: 'EXACTA_BOX',
        horses: top2.map((c) => c.horse.programNumber),
        horseNames: top2.map((c) => c.horse.horseName),
        amount: perComboAmount,
        combinations,
        totalCost,
        potentialReturn: returns,
        explanation: `Boxing our top 2 ranked horses in the exacta.`,
        whatToSay: generateWhatToSay(
          'EXACTA_BOX',
          top2.map((c) => c.horse.programNumber),
          perComboAmount
        ),
        priority: 2,
      });
    }

    // Bet 3: Trifecta box top 3
    if (activeContenders.length >= 3 && trifectaBudget >= MIN_BET_AMOUNT * 6) {
      const top3 = activeContenders.slice(0, 3);
      const combinations = 6; // Box 3 = 6 combos
      const perComboAmount = Math.max(1, Math.floor(trifectaBudget / combinations));
      const totalCost = perComboAmount * combinations;

      const odds = top3.map((c) => parseOddsToDecimal(getOdds(c.index, c.horse.morningLineOdds)));
      const returns = estimateBetReturn('TRIFECTA_BOX', odds, perComboAmount, combinations);

      bets.push({
        id: generateBetId(
          'TRIFECTA_BOX',
          top3.map((c) => c.horse.programNumber)
        ),
        type: 'TRIFECTA_BOX',
        horses: top3.map((c) => c.horse.programNumber),
        horseNames: top3.map((c) => c.horse.horseName),
        amount: perComboAmount,
        combinations,
        totalCost,
        potentialReturn: returns,
        explanation: `If the favorites hold form, this trifecta box cashes.`,
        whatToSay: generateWhatToSay(
          'TRIFECTA_BOX',
          top3.map((c) => c.horse.programNumber),
          perComboAmount
        ),
        priority: 3,
      });
    }
  }

  return bets;
}

// ============================================================================
// AGGRESSIVE STYLE CALCULATIONS
// ============================================================================

/**
 * Calculate bets for AGGRESSIVE style
 * Focus: Heavy on exotics, maximum upside
 */
function calculateAggressiveBets(input: BetCalculationInput): SingleBet[] {
  const { budget, valuePlay, contenders, getOdds, isScratched } = input;
  const bets: SingleBet[] = [];

  const activeContenders = contenders.filter((c) => !isScratched(c.index));
  if (activeContenders.length === 0) return bets;

  if (valuePlay) {
    // WITH VALUE PLAY:
    // 10% Place on value (safety), 15% Exacta with value, 75% Trifecta Key

    const placeAmount = Math.max(MIN_BET_AMOUNT, roundBetAmount(budget * 0.1));
    const exactaAmount = Math.max(MIN_BET_AMOUNT, roundBetAmount(budget * 0.15));
    const trifectaBudget = budget - placeAmount - exactaAmount;

    const valueOdds = parseOddsToDecimal(valuePlay.currentOdds);

    // Get top 4 other contenders for bigger trifecta coverage
    const otherContenders = activeContenders
      .filter((c) => c.horse.programNumber !== valuePlay.programNumber)
      .slice(0, 4);

    // Bet 1: Small place on value (safety net)
    if (placeAmount >= MIN_BET_AMOUNT) {
      const returns = estimateBetReturn('PLACE', [valueOdds], placeAmount, 1);
      bets.push({
        id: generateBetId('PLACE', [valuePlay.programNumber]),
        type: 'PLACE',
        horses: [valuePlay.programNumber],
        horseNames: [valuePlay.horseName],
        amount: placeAmount,
        combinations: 1,
        totalCost: placeAmount,
        potentialReturn: returns,
        explanation: `Small place bet on ${valuePlay.horseName} as a safety net. Main action is in the exotics.`,
        whatToSay: generateWhatToSay('PLACE', [valuePlay.programNumber], placeAmount),
        priority: 1,
      });
    }

    // Bet 2: Exacta - value over top 2 contenders (2 combos)
    if (otherContenders.length >= 2 && exactaAmount >= MIN_BET_AMOUNT) {
      const top2Others = otherContenders.slice(0, 2);
      const combinations = 2;
      const perComboAmount = Math.max(2, Math.floor(exactaAmount / combinations));
      const totalCost = perComboAmount * combinations;

      const otherOdds = top2Others.map((c) =>
        parseOddsToDecimal(getOdds(c.index, c.horse.morningLineOdds))
      );
      const returns = estimateBetReturn(
        'EXACTA',
        [valueOdds, ...otherOdds],
        perComboAmount,
        combinations
      );

      bets.push({
        id: generateBetId('EXACTA', [
          valuePlay.programNumber,
          ...top2Others.map((c) => c.horse.programNumber),
        ]),
        type: 'EXACTA',
        horses: [valuePlay.programNumber, ...top2Others.map((c) => c.horse.programNumber)],
        horseNames: [valuePlay.horseName, ...top2Others.map((c) => c.horse.horseName)],
        amount: perComboAmount,
        combinations,
        totalCost,
        potentialReturn: returns,
        explanation: `Exacta wheels with ${valuePlay.horseName} on top over our top contenders.`,
        whatToSay: `$${perComboAmount} EXACTA, ${valuePlay.programNumber} over ${top2Others.map((c) => c.horse.programNumber).join(' and ')}`,
        priority: 2,
      });
    }

    // Bet 3: Trifecta Key - value with 4 horses (maximum coverage)
    if (otherContenders.length >= 3 && trifectaBudget >= MIN_BET_AMOUNT * 6) {
      const withHorses = otherContenders.map((c) => c.horse.programNumber);
      const combinations = calculateTrifectaKeyCombinations(withHorses.length);
      const perComboAmount = Math.max(1, Math.floor(trifectaBudget / combinations));
      const totalCost = perComboAmount * combinations;

      const otherOdds = otherContenders.map((c) =>
        parseOddsToDecimal(getOdds(c.index, c.horse.morningLineOdds))
      );
      const returns = estimateBetReturn(
        'TRIFECTA_KEY',
        [valueOdds, ...otherOdds],
        perComboAmount,
        combinations
      );

      bets.push({
        id: generateBetId('TRIFECTA_KEY', [valuePlay.programNumber, ...withHorses]),
        type: 'TRIFECTA_KEY',
        horses: [valuePlay.programNumber, ...withHorses],
        horseNames: [valuePlay.horseName, ...otherContenders.map((c) => c.horse.horseName)],
        amount: perComboAmount,
        combinations,
        totalCost,
        potentialReturn: returns,
        explanation: `Big trifecta key on ${valuePlay.horseName} with maximum coverage. This is our main swing for the fences.`,
        whatToSay: generateWhatToSay(
          'TRIFECTA_KEY',
          [valuePlay.programNumber, ...withHorses],
          perComboAmount
        ),
        priority: 3,
      });
    }
  } else {
    // NO VALUE PLAY: Still aggressive but defensive
    // 20% Show on top, 30% Exacta box top 3, 50% Trifecta box top 4

    const showAmount = roundBetAmount(budget * 0.2);
    const exactaBudget = roundBetAmount(budget * 0.3);
    const trifectaBudget = budget - showAmount - exactaBudget;

    const topContender = activeContenders[0]!;
    const topOdds = parseOddsToDecimal(
      getOdds(topContender.index, topContender.horse.morningLineOdds)
    );

    // Bet 1: Show on top (minimal safety)
    if (showAmount >= MIN_BET_AMOUNT) {
      const returns = estimateBetReturn('SHOW', [topOdds], showAmount, 1);
      bets.push({
        id: generateBetId('SHOW', [topContender.horse.programNumber]),
        type: 'SHOW',
        horses: [topContender.horse.programNumber],
        horseNames: [topContender.horse.horseName],
        amount: showAmount,
        combinations: 1,
        totalCost: showAmount,
        potentialReturn: returns,
        explanation: `Minimal safety show bet. Main action is in exotics.`,
        whatToSay: generateWhatToSay('SHOW', [topContender.horse.programNumber], showAmount),
        priority: 1,
      });
    }

    // Bet 2: Exacta box top 3
    if (activeContenders.length >= 3 && exactaBudget >= MIN_BET_AMOUNT * 6) {
      const top3 = activeContenders.slice(0, 3);
      const combinations = calculateExactaBoxCombinations(3); // 6 combos
      const perComboAmount = Math.max(2, Math.floor(exactaBudget / combinations));
      const totalCost = perComboAmount * combinations;

      const odds = top3.map((c) => parseOddsToDecimal(getOdds(c.index, c.horse.morningLineOdds)));
      const returns = estimateBetReturn('EXACTA_BOX', odds, perComboAmount, combinations);

      bets.push({
        id: generateBetId(
          'EXACTA_BOX',
          top3.map((c) => c.horse.programNumber)
        ),
        type: 'EXACTA_BOX',
        horses: top3.map((c) => c.horse.programNumber),
        horseNames: top3.map((c) => c.horse.horseName),
        amount: perComboAmount,
        combinations,
        totalCost,
        potentialReturn: returns,
        explanation: `Exacta box with top 3 contenders.`,
        whatToSay: generateWhatToSay(
          'EXACTA_BOX',
          top3.map((c) => c.horse.programNumber),
          perComboAmount
        ),
        priority: 2,
      });
    }

    // Bet 3: Trifecta box top 4
    if (activeContenders.length >= 4 && trifectaBudget >= MIN_BET_AMOUNT * 24) {
      const top4 = activeContenders.slice(0, 4);
      const combinations = calculateTrifectaBoxCombinations(4); // 24 combos
      const perComboAmount = Math.max(1, Math.floor(trifectaBudget / combinations));
      const totalCost = perComboAmount * combinations;

      const odds = top4.map((c) => parseOddsToDecimal(getOdds(c.index, c.horse.morningLineOdds)));
      const returns = estimateBetReturn('TRIFECTA_BOX', odds, perComboAmount, combinations);

      bets.push({
        id: generateBetId(
          'TRIFECTA_BOX',
          top4.map((c) => c.horse.programNumber)
        ),
        type: 'TRIFECTA_BOX',
        horses: top4.map((c) => c.horse.programNumber),
        horseNames: top4.map((c) => c.horse.horseName),
        amount: perComboAmount,
        combinations,
        totalCost,
        potentialReturn: returns,
        explanation: `Big trifecta box with 4 horses. If the form holds, we cash.`,
        whatToSay: generateWhatToSay(
          'TRIFECTA_BOX',
          top4.map((c) => c.horse.programNumber),
          perComboAmount
        ),
        priority: 3,
      });
    }
  }

  return bets;
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate bet recommendations based on budget, style, and race analysis
 */
export function calculateBets(input: BetCalculationInput): BetCalculationResult {
  const { budget, riskStyle, valueAnalysis } = input;

  // Get bets based on style
  let bets: SingleBet[];
  switch (riskStyle) {
    case 'safe':
      bets = calculateSafeBets(input);
      break;
    case 'balanced':
      bets = calculateBalancedBets(input);
      break;
    case 'aggressive':
      bets = calculateAggressiveBets(input);
      break;
    default:
      bets = calculateBalancedBets(input);
  }

  // Calculate totals
  const totalCost = bets.reduce((sum, bet) => sum + bet.totalCost, 0);
  const remainingBudget = Math.max(0, budget - totalCost);

  // Combine potential returns
  const potentialReturn = {
    min: bets.reduce((sum, bet) => sum + bet.potentialReturn.min, 0),
    max: bets.reduce((sum, bet) => sum + bet.potentialReturn.max, 0),
  };

  // Generate skipped bets for underlays
  const skippedBets: SingleBet[] = [];
  if (valueAnalysis.topPick && !valueAnalysis.hasValuePlay) {
    // Top pick is an underlay
    const topPick = valueAnalysis.topPick;
    skippedBets.push({
      id: generateBetId('WIN', [0]),
      type: 'WIN',
      horses: [0], // Placeholder
      horseNames: [topPick.name],
      amount: 0,
      combinations: 0,
      totalCost: 0,
      potentialReturn: { min: 0, max: 0 },
      explanation: generateSkipExplanation(
        topPick.name,
        topPick.oddsDecimal,
        topPick.rank,
        -20 // Negative edge for underlay
      ),
      whatToSay: '',
      skip: true,
      skipReason: `Odds too low at ${topPick.odds}. No value.`,
      priority: 99,
    });
  }

  // Generate summary
  let summary: string;
  if (valueAnalysis.hasValuePlay) {
    const vp = valueAnalysis.primaryValuePlay!;
    summary = `Value play on ${vp.horseName} (#${vp.programNumber}) at ${vp.currentOdds} with +${Math.round(vp.valueEdge)}% edge.`;
  } else {
    summary = 'No clear value plays. These are defensive bets to minimize losses.';
  }

  return {
    bets,
    totalCost,
    remainingBudget,
    potentialReturn,
    raceVerdict: valueAnalysis.verdict,
    valuePlay: valueAnalysis.primaryValuePlay,
    summary,
    skippedBets,
  };
}

/**
 * Get contenders from scored horses (top 4 by rank)
 */
export function getContenders(
  scoredHorses: ScoredHorse[],
  isScratched: (index: number) => boolean,
  limit: number = 4
): ScoredHorse[] {
  return scoredHorses
    .filter((h) => !isScratched(h.index) && !h.score.isScratched)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}
