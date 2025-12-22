/**
 * Bet Generator Module
 *
 * Generates specific bet recommendations from scored horses by integrating
 * all Phase 2 scoring modules:
 * - Pace analysis
 * - Overlay/value analysis
 * - Class analysis
 * - Equipment changes
 * - Breeding analysis
 * - Longshot detection
 * - Diamond in rough detection
 * - Trainer/jockey patterns
 *
 * @module recommendations/betGenerator
 */

import type { RaceHeader } from '../../types/drf';
import type { HorseScore, ScoredHorse } from '../scoring';
import type { UseBankrollReturn } from '../../hooks/useBankroll';
import type { ClassifiedHorse, TierGroup, BettingTier } from '../betting/tierClassification';
import type { LongshotAnalysisResult } from '../longshots';
import type { DiamondAnalysis } from '../diamonds';
import type { BetRecommendation, TierBetRecommendations } from '../betting/betRecommendations';

import { classifyHorses } from '../betting/tierClassification';
import { analyzeRaceLongshots } from '../longshots';
import { analyzeRaceDiamonds, getValidatedDiamonds } from '../diamonds';
import { analyzeLateBreakingInfo, type LateBreakingResult } from '../lateBreaking';
import { logger } from '../../services/logging';

import { calculateBetAmount, scaleBetsByBankroll } from './betSizing';
import { generateWindowInstruction } from './windowInstructions';
import { generateBetExplanation, generateBetNarrative } from './betExplanations';

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratorInput {
  /** Scored horses from race analysis */
  scoredHorses: ScoredHorse[];
  /** Race header information */
  raceHeader: RaceHeader;
  /** Race number for display */
  raceNumber: number;
  /** Bankroll settings from hook */
  bankroll: UseBankrollReturn;
}

export interface GeneratedBet extends BetRecommendation {
  /** Unique identifier for this bet */
  id: string;
  /** The tier this bet belongs to */
  tier: BettingTier;
  /** Whether this is a special category bet */
  specialCategory: 'nuclear' | 'diamond' | 'value_bomb' | null;
  /** Detailed explanation for "Why this bet?" */
  explanation: string[];
  /** Short narrative summary */
  narrative: string;
  /** Source scoring modules that contributed */
  scoringSources: string[];
  /** Expected value per dollar */
  evPerDollar: number;
  /** Overlay percentage */
  overlayPercent: number;
  /** Whether recommended based on betting style */
  isRecommended: boolean;
}

export interface GeneratedTierBets extends TierBetRecommendations {
  /** Extended bets with full metadata */
  generatedBets: GeneratedBet[];
}

export interface SpecialCategoryBets {
  /** Nuclear longshots (25/1+, 100+ upset angle points) */
  nuclearLongshots: GeneratedBet[];
  /** Diamonds in rough (120-139 pts, 200%+ overlay) */
  diamonds: GeneratedBet[];
  /** Value bombs based on EV calculations */
  valueBombs: GeneratedBet[];
  /** Total investment for special categories */
  totalInvestment: number;
}

export interface BetGeneratorResult {
  /** Bets organized by tier */
  tierBets: GeneratedTierBets[];
  /** Special category bets */
  specialBets: SpecialCategoryBets;
  /** All generated bets flattened */
  allBets: GeneratedBet[];
  /** Total recommended investment */
  totalRecommendedCost: number;
  /** Total cost if all bets selected */
  totalMaxCost: number;
  /** Late-breaking information analysis (Protocol 4) */
  lateBreakingInfo: LateBreakingResult;
  /** Summary statistics */
  summary: {
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    nuclearCount: number;
    diamondCount: number;
    positiveEVCount: number;
    overlayCount: number;
    scratchCount: number;
    lateBreakingBeneficiaries: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum bet amounts by category */
const MIN_BET_AMOUNTS = {
  nuclear: 2,
  diamond: 3,
  tier1: 5,
  tier2: 2,
  tier3: 1,
} as const;

/** Maximum bet amounts by category */
const MAX_BET_AMOUNTS = {
  nuclear: 5,
  diamond: 10,
  tier1: 50,
  tier2: 20,
  tier3: 10,
} as const;

// ============================================================================
// TIER 1 BET GENERATION (180+ pts, 80%+ confidence)
// ============================================================================

function generateTier1Bets(
  tierGroup: TierGroup,
  allClassifiedHorses: ClassifiedHorse[],
  raceNumber: number,
  bankroll: UseBankrollReturn
): GeneratedBet[] {
  const bets: GeneratedBet[] = [];
  const horses = tierGroup.horses;

  if (horses.length === 0) return bets;

  const topHorse = horses[0];
  if (!topHorse) return bets;

  const baseAmount = calculateBetAmount(topHorse.confidence, 'tier1', bankroll);

  // 1. Win bet (largest allocation)
  const winAmount = Math.round(baseAmount * 2);
  bets.push(
    createGeneratedBet({
      type: 'win',
      typeName: 'Win',
      description: `Win bet on top contender ${topHorse.horse.horseName}`,
      horses: [topHorse],
      amount: winAmount,
      tier: 'tier1',
      raceNumber,
      confidence: topHorse.confidence,
      icon: 'emoji_events',
    })
  );

  // 2. Place bet (safety)
  const placeAmount = Math.round(baseAmount);
  bets.push(
    createGeneratedBet({
      type: 'place',
      typeName: 'Place',
      description: `Place bet on ${topHorse.horse.horseName} for safety`,
      horses: [topHorse],
      amount: placeAmount,
      tier: 'tier1',
      raceNumber,
      confidence: topHorse.confidence + 10,
      icon: 'looks_two',
    })
  );

  // 3. Exacta box (top 2-3 horses in tier)
  if (horses.length >= 2) {
    const boxHorses = horses.slice(0, Math.min(3, horses.length));
    const boxAmount = Math.round(baseAmount / 2);
    bets.push(
      createGeneratedBet({
        type: 'exacta_box',
        typeName: 'Exacta Box',
        description: `Exacta box with top ${boxHorses.length} contenders`,
        horses: boxHorses,
        amount: boxAmount,
        tier: 'tier1',
        raceNumber,
        confidence: averageConfidence(boxHorses),
        icon: 'swap_vert',
      })
    );
  }

  // 4. Exacta key (this horse over field)
  const otherContenders = allClassifiedHorses
    .filter((h) => h.horseIndex !== topHorse.horseIndex && !h.score.isScratched)
    .slice(0, 4);

  if (otherContenders.length > 0) {
    const keyAmount = Math.round(baseAmount / 2);
    bets.push(
      createGeneratedBet({
        type: 'exacta_key_over',
        typeName: 'Exacta Key Over',
        description: `${topHorse.horse.horseName} over top ${otherContenders.length} others`,
        horses: [topHorse, ...otherContenders],
        amount: keyAmount,
        tier: 'tier1',
        raceNumber,
        confidence: topHorse.confidence - 10,
        icon: 'arrow_downward',
      })
    );
  }

  // 5. Trifecta box (top 3 if applicable)
  if (horses.length >= 3) {
    const triHorses = horses.slice(0, 3);
    bets.push(
      createGeneratedBet({
        type: 'trifecta_box',
        typeName: 'Trifecta Box',
        description: 'Trifecta box with top 3 chalk',
        horses: triHorses,
        amount: 1,
        tier: 'tier1',
        raceNumber,
        confidence: averageConfidence(triHorses) - 15,
        icon: 'view_list',
      })
    );
  } else if (horses.length >= 2) {
    // Use tier 1 + next best horse for trifecta
    const nextBest = allClassifiedHorses.find((h) => !horses.includes(h));
    if (nextBest && horses[0] && horses[1]) {
      const triHorses = [horses[0], horses[1], nextBest];
      bets.push(
        createGeneratedBet({
          type: 'trifecta_box',
          typeName: 'Trifecta Box',
          description: 'Trifecta box: chalk with one alternative',
          horses: triHorses,
          amount: 1,
          tier: 'tier1',
          raceNumber,
          confidence: 55,
          icon: 'view_list',
        })
      );
    }
  }

  return bets;
}

// ============================================================================
// TIER 2 BET GENERATION (160-179 pts, 60-79% confidence)
// ============================================================================

function generateTier2Bets(
  tierGroup: TierGroup,
  tier1Horses: ClassifiedHorse[],
  raceNumber: number,
  bankroll: UseBankrollReturn
): GeneratedBet[] {
  const bets: GeneratedBet[] = [];
  const horses = tierGroup.horses;

  if (horses.length === 0) return bets;

  const topValueHorse = horses[0];
  if (!topValueHorse) return bets;

  const baseAmount = calculateBetAmount(topValueHorse.confidence, 'tier2', bankroll);

  // 1. Win bet (value focus)
  bets.push(
    createGeneratedBet({
      type: 'win',
      typeName: 'Win',
      description: `Value win on ${topValueHorse.horse.horseName} at ${topValueHorse.oddsDisplay}`,
      horses: [topValueHorse],
      amount: baseAmount,
      tier: 'tier2',
      raceNumber,
      confidence: topValueHorse.confidence,
      icon: 'emoji_events',
    })
  );

  // 2. Exacta key over/under Tier 1
  if (tier1Horses.length > 0) {
    const chalkHorses = tier1Horses.slice(0, 2);
    const keyAmount = Math.round(baseAmount / 2);

    // Key over chalk (upset angle)
    bets.push(
      createGeneratedBet({
        type: 'exacta_key_over',
        typeName: 'Exacta Key Over',
        description: `${topValueHorse.horse.horseName} over chalk (upset special)`,
        horses: [topValueHorse, ...chalkHorses],
        amount: keyAmount,
        tier: 'tier2',
        raceNumber,
        confidence: topValueHorse.confidence - 10,
        icon: 'arrow_downward',
      })
    );

    // Key under chalk
    bets.push(
      createGeneratedBet({
        type: 'exacta_key_under',
        typeName: 'Exacta Key Under',
        description: `Chalk on top, ${topValueHorse.horse.horseName} underneath`,
        horses: [topValueHorse, ...chalkHorses],
        amount: keyAmount,
        tier: 'tier2',
        raceNumber,
        confidence: topValueHorse.confidence,
        icon: 'arrow_upward',
      })
    );
  }

  // 3. Trifecta combos with Tier 1
  const allTrifectaHorses = [...horses.slice(0, 2), ...tier1Horses.slice(0, 2)]
    .filter((h, i, arr) => arr.findIndex((x) => x.horseIndex === h.horseIndex) === i)
    .slice(0, 4);

  if (allTrifectaHorses.length >= 3) {
    const triHorses = allTrifectaHorses.slice(0, 3);
    bets.push(
      createGeneratedBet({
        type: 'trifecta_box',
        typeName: 'Trifecta Box',
        description: 'Trifecta box: alternatives with chalk',
        horses: triHorses,
        amount: 1,
        tier: 'tier2',
        raceNumber,
        confidence: 45,
        icon: 'view_list',
      })
    );
  }

  // 4. Quinella with Tier 1
  if (tier1Horses.length > 0 && horses.length > 0) {
    const topTier2 = horses[0];
    const topTier1 = tier1Horses[0];
    if (!topTier2 || !topTier1) return bets;

    const quinellaHorses = [topTier2, topTier1];
    bets.push(
      createGeneratedBet({
        type: 'quinella',
        typeName: 'Quinella',
        description: 'Quinella: alternative with favorite',
        horses: quinellaHorses,
        amount: baseAmount,
        tier: 'tier2',
        raceNumber,
        confidence: averageConfidence(quinellaHorses) - 5,
        icon: 'compare_arrows',
      })
    );
  }

  // 5. Place if value overlay exists
  if (topValueHorse.overlay.overlayPercent >= 25) {
    bets.push(
      createGeneratedBet({
        type: 'place',
        typeName: 'Place',
        description: `Place bet on value horse ${topValueHorse.horse.horseName}`,
        horses: [topValueHorse],
        amount: baseAmount,
        tier: 'tier2',
        raceNumber,
        confidence: topValueHorse.confidence + 10,
        icon: 'looks_two',
      })
    );
  }

  return bets;
}

// ============================================================================
// TIER 3 BET GENERATION (140-159 pts, 25-60% confidence)
// ============================================================================

function generateTier3Bets(
  tierGroup: TierGroup,
  allClassifiedHorses: ClassifiedHorse[],
  nuclearLongshots: Map<number, LongshotAnalysisResult>,
  raceNumber: number,
  bankroll: UseBankrollReturn
): GeneratedBet[] {
  const bets: GeneratedBet[] = [];
  const horses = tierGroup.horses;

  if (horses.length === 0) return bets;

  const bombHorse = horses[0];
  if (!bombHorse) return bets;

  const baseAmount = calculateBetAmount(bombHorse.confidence, 'tier3', bankroll);

  // Check for nuclear longshots first - these get priority
  for (const horse of horses) {
    const longshotAnalysis = nuclearLongshots.get(horse.horse.programNumber);
    if (
      longshotAnalysis &&
      (longshotAnalysis.classification === 'nuclear' || longshotAnalysis.classification === 'live')
    ) {
      const bombAmount = longshotAnalysis.classification === 'nuclear' ? 5 : 2;
      const angleNames = longshotAnalysis.detectedAngles.map((a) => a.name).join(' + ');
      const firstAngle = longshotAnalysis.detectedAngles[0];

      bets.push(
        createGeneratedBet({
          type: 'value_bomb',
          typeName: `${longshotAnalysis.classification === 'nuclear' ? 'NUCLEAR' : 'LIVE'} Value Bomb`,
          description: `${horse.horse.horseName} at ${horse.oddsDisplay}: ${angleNames}`,
          horses: [horse],
          amount: bombAmount,
          tier: 'tier3',
          raceNumber,
          confidence: Math.round(longshotAnalysis.upsetProbability * 100),
          icon: 'local_fire_department',
          specialCategory: 'nuclear',
          longshotAngle: firstAngle?.evidence,
          isNuclearLongshot: longshotAnalysis.classification === 'nuclear',
        })
      );
    }
  }

  // Skip normal win bet if we already have a value bomb for this horse
  const hasValueBomb = bets.some((b) => b.horseNumbers.includes(bombHorse.horse.programNumber));

  // 1. Small win bet (lottery ticket)
  if (!hasValueBomb) {
    bets.push(
      createGeneratedBet({
        type: 'win',
        typeName: 'Win',
        description: `Lottery ticket: ${bombHorse.horse.horseName} at ${bombHorse.oddsDisplay}`,
        horses: [bombHorse],
        amount: baseAmount,
        tier: 'tier3',
        raceNumber,
        confidence: bombHorse.confidence,
        icon: 'emoji_events',
      })
    );
  }

  // 2. Exacta key over all
  const otherHorses = allClassifiedHorses
    .filter((h) => h.horseIndex !== bombHorse.horseIndex)
    .slice(0, 5);

  if (otherHorses.length > 0) {
    bets.push(
      createGeneratedBet({
        type: 'exacta_key_over',
        typeName: 'Exacta Key Over',
        description: 'Bomb on top over field for huge exacta',
        horses: [bombHorse, ...otherHorses],
        amount: 1,
        tier: 'tier3',
        raceNumber,
        confidence: bombHorse.confidence - 15,
        icon: 'arrow_downward',
      })
    );
  }

  // 3. Superfecta coverage
  if (allClassifiedHorses.length >= 4) {
    const superHorses = [
      bombHorse,
      ...allClassifiedHorses.filter((h) => h.horseIndex !== bombHorse.horseIndex).slice(0, 3),
    ];
    bets.push(
      createGeneratedBet({
        type: 'superfecta',
        typeName: 'Superfecta',
        description: 'Superfecta box with bomb included',
        horses: superHorses,
        amount: 0.1,
        tier: 'tier3',
        raceNumber,
        confidence: bombHorse.confidence - 25,
        icon: 'format_list_numbered',
      })
    );
  }

  // 4. Trifecta wheel
  const topContenders = allClassifiedHorses
    .filter((h) => h.tier === 'tier1' || h.tier === 'tier2')
    .slice(0, 3);

  if (topContenders.length >= 2) {
    bets.push(
      createGeneratedBet({
        type: 'trifecta_wheel',
        typeName: 'Trifecta Wheel',
        description: 'Bomb trifecta wheel for jackpot',
        horses: [bombHorse, ...topContenders],
        amount: 1,
        tier: 'tier3',
        raceNumber,
        confidence: bombHorse.confidence - 20,
        icon: 'sync',
      })
    );
  }

  // 5. Place (better value than win for longshots)
  bets.push(
    createGeneratedBet({
      type: 'place',
      typeName: 'Place',
      description: `Place bet on ${bombHorse.horse.horseName} - better value`,
      horses: [bombHorse],
      amount: baseAmount * 2,
      tier: 'tier3',
      raceNumber,
      confidence: bombHorse.confidence + 15,
      icon: 'looks_two',
    })
  );

  return bets;
}

// ============================================================================
// SPECIAL CATEGORY BET GENERATION
// ============================================================================

function generateNuclearLongshotBets(
  longshots: LongshotAnalysisResult[],
  allClassifiedHorses: ClassifiedHorse[],
  raceNumber: number
): GeneratedBet[] {
  const bets: GeneratedBet[] = [];

  for (const longshot of longshots) {
    if (longshot.classification !== 'nuclear' && longshot.classification !== 'live') {
      continue;
    }

    const matchingHorse = allClassifiedHorses.find(
      (h) => h.horse.programNumber === longshot.programNumber
    );
    if (!matchingHorse) continue;

    const amount = longshot.classification === 'nuclear' ? 5 : 2;
    const angleNames = longshot.detectedAngles.map((a) => a.name).join(' + ');
    const firstAngle = longshot.detectedAngles[0];

    bets.push(
      createGeneratedBet({
        type: 'value_bomb',
        typeName: longshot.classification === 'nuclear' ? 'NUCLEAR Longshot' : 'LIVE Longshot',
        description: `${longshot.horseName} at ${longshot.oddsDisplay}: ${angleNames}`,
        horses: [matchingHorse],
        amount,
        tier: 'tier3',
        raceNumber,
        confidence: Math.round(longshot.upsetProbability * 100),
        icon: 'local_fire_department',
        specialCategory: 'nuclear',
        longshotAngle: firstAngle?.evidence,
        isNuclearLongshot: longshot.classification === 'nuclear',
      })
    );
  }

  return bets;
}

function generateDiamondBets(
  diamonds: DiamondAnalysis[],
  allClassifiedHorses: ClassifiedHorse[],
  raceNumber: number
): GeneratedBet[] {
  const bets: GeneratedBet[] = [];

  for (const diamond of diamonds) {
    const matchingHorse = allClassifiedHorses.find(
      (h) => h.horse.programNumber === diamond.programNumber
    );
    if (!matchingHorse) continue;

    const baseAmount = diamond.confidence >= 60 ? 4 : 3;

    // Win bet on diamond
    bets.push(
      createGeneratedBet({
        type: 'hidden_gem',
        typeName: 'Hidden Gem',
        description: `${diamond.horseName} at ${diamond.oddsDisplay}: ${diamond.story}`,
        horses: [matchingHorse],
        amount: baseAmount,
        tier: 'tier2',
        raceNumber,
        confidence: diamond.confidence,
        icon: 'diamond',
        specialCategory: 'diamond',
        diamondStory: diamond.story,
        isHiddenGem: true,
      })
    );

    // Place bet for safety
    if (baseAmount > 1) {
      bets.push(
        createGeneratedBet({
          type: 'place',
          typeName: 'Place',
          description: `Place saver on ${diamond.horseName}`,
          horses: [matchingHorse],
          amount: baseAmount - 1,
          tier: 'tier2',
          raceNumber,
          confidence: diamond.confidence + 15,
          icon: 'looks_two',
          specialCategory: 'diamond',
          isHiddenGem: true,
        })
      );
    }
  }

  return bets;
}

function generateValueBombBets(
  allClassifiedHorses: ClassifiedHorse[],
  raceNumber: number,
  bankroll: UseBankrollReturn
): GeneratedBet[] {
  const bets: GeneratedBet[] = [];

  // Find horses with positive EV and significant overlay
  const valuePlays = allClassifiedHorses.filter(
    (h) => h.overlay.isPositiveEV && h.overlay.overlayPercent >= 50 && h.odds >= 5 // At least 5-1 odds
  );

  for (const horse of valuePlays.slice(0, 2)) {
    const amount = Math.max(
      MIN_BET_AMOUNTS.tier2,
      Math.min(
        MAX_BET_AMOUNTS.tier2,
        Math.round(
          calculateBetAmount(horse.confidence, 'tier2', bankroll) * (horse.overlay.evPerDollar + 1)
        )
      )
    );

    bets.push(
      createGeneratedBet({
        type: 'value_bomb',
        typeName: 'EV Value Bomb',
        description: `${horse.horse.horseName} at ${horse.oddsDisplay}: +${horse.overlay.overlayPercent.toFixed(0)}% overlay`,
        horses: [horse],
        amount,
        tier: horse.tier,
        raceNumber,
        confidence: horse.confidence,
        icon: 'trending_up',
        specialCategory: 'value_bomb',
      })
    );
  }

  return bets;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface CreateBetParams {
  type: BetRecommendation['type'];
  typeName: string;
  description: string;
  horses: ClassifiedHorse[];
  amount: number;
  tier: BettingTier;
  raceNumber: number;
  confidence: number;
  icon: string;
  specialCategory?: 'nuclear' | 'diamond' | 'value_bomb' | null;
  longshotAngle?: string;
  isNuclearLongshot?: boolean;
  diamondStory?: string;
  isHiddenGem?: boolean;
}

function createGeneratedBet(params: CreateBetParams): GeneratedBet {
  const {
    type,
    typeName,
    description,
    horses,
    amount,
    tier,
    raceNumber,
    confidence,
    icon,
    specialCategory = null,
    longshotAngle,
    isNuclearLongshot,
    diamondStory,
    isHiddenGem,
  } = params;

  const horseNumbers = horses.map((h) => h.horse.programNumber);
  const totalCost = calculateTotalCost(type, horses.length, amount);
  const potentialReturn = calculatePotentialReturn(type, horses, totalCost);

  // Get overlay info from top horse
  const topHorse = horses[0];
  const overlayPercent = topHorse?.overlay?.overlayPercent ?? 0;
  const evPerDollar = topHorse?.overlay?.evPerDollar ?? 0;

  // Generate explanation from scoring modules
  const explanation = generateBetExplanation(horses, type);
  const narrative = generateBetNarrative(horses, type, overlayPercent);

  // Identify which scoring sources contributed
  const scoringSources = identifyScoringSources(horses);

  return {
    // Base BetRecommendation fields
    type,
    typeName,
    description,
    horses,
    horseNumbers,
    amount,
    totalCost,
    windowInstruction: generateWindowInstruction(type, horses, amount, raceNumber),
    potentialReturn,
    confidence: Math.max(0, Math.min(100, confidence)),
    icon,
    longshotAngle,
    isNuclearLongshot,
    diamondStory,
    isHiddenGem,

    // Extended GeneratedBet fields
    id: `${tier}-${type}-${horseNumbers.join('-')}-${Date.now()}`,
    tier,
    specialCategory,
    explanation,
    narrative,
    scoringSources,
    evPerDollar,
    overlayPercent,
    isRecommended: false, // Set later based on betting style
  };
}

function calculateTotalCost(type: string, numHorses: number, baseAmount: number): number {
  switch (type) {
    case 'exacta_box':
      return numHorses * (numHorses - 1) * baseAmount;
    case 'exacta_key_over':
    case 'exacta_key_under':
      return (numHorses - 1) * baseAmount;
    case 'trifecta_box':
      return numHorses * (numHorses - 1) * (numHorses - 2) * baseAmount;
    case 'trifecta_key':
    case 'trifecta_wheel':
      return Math.max(1, (numHorses - 1) * 2 * baseAmount);
    case 'superfecta':
      return 2.4; // $0.10 box of 4
    default:
      return baseAmount;
  }
}

function calculatePotentialReturn(
  type: string,
  horses: ClassifiedHorse[],
  cost: number
): { min: number; max: number } {
  if (horses.length === 0) return { min: 0, max: 0 };

  const avgOdds = horses.reduce((sum, h) => sum + h.odds, 0) / horses.length;
  const maxOdds = Math.max(...horses.map((h) => h.odds));
  const minOdds = Math.min(...horses.map((h) => h.odds));

  switch (type) {
    case 'win':
    case 'value_bomb':
    case 'hidden_gem':
      return {
        min: Math.round(cost * (minOdds + 1)),
        max: Math.round(cost * (maxOdds + 1)),
      };
    case 'place':
      return {
        min: Math.round(cost * (minOdds / 2 + 1)),
        max: Math.round(cost * (maxOdds / 2 + 1)),
      };
    case 'show':
      return {
        min: Math.round(cost * (minOdds / 3 + 1)),
        max: Math.round(cost * (maxOdds / 3 + 1)),
      };
    case 'exacta_box':
    case 'exacta_key_over':
    case 'exacta_key_under':
      return {
        min: Math.round(cost * (avgOdds * 2 + 1)),
        max: Math.round(cost * (maxOdds * avgOdds + 1)),
      };
    case 'trifecta_box':
    case 'trifecta_key':
    case 'trifecta_wheel':
      return {
        min: Math.round(cost * (avgOdds * 5 + 1)),
        max: Math.round(cost * (maxOdds * avgOdds * 3 + 1)),
      };
    case 'quinella':
      return {
        min: Math.round(cost * (avgOdds * 1.5 + 1)),
        max: Math.round(cost * (maxOdds * 2 + 1)),
      };
    case 'superfecta':
      return {
        min: Math.round(cost * (avgOdds * 20 + 1)),
        max: Math.round(cost * (maxOdds * avgOdds * 10 + 1)),
      };
    default:
      return { min: cost, max: cost * 10 };
  }
}

function averageConfidence(horses: ClassifiedHorse[]): number {
  if (horses.length === 0) return 0;
  return Math.round(horses.reduce((sum, h) => sum + h.confidence, 0) / horses.length);
}

function identifyScoringSources(horses: ClassifiedHorse[]): string[] {
  const sources = new Set<string>();

  for (const horse of horses) {
    const breakdown = horse.score.breakdown;

    if (breakdown.pace.total > 25) sources.add('pace');
    if (breakdown.speedClass.total > 30) sources.add('speed_class');
    if (breakdown.connections.total > 35) sources.add('connections');
    if (breakdown.form.total > 20) sources.add('form');
    if (breakdown.equipment.hasChanges) sources.add('equipment');
    if (breakdown.postPosition.isGoldenPost) sources.add('post_position');
    if (breakdown.breeding?.wasApplied) sources.add('breeding');
    if (breakdown.classAnalysis?.isValuePlay) sources.add('class_drop');
    if (horse.overlay.overlayPercent >= 25) sources.add('overlay');
    if (horse.isSpecialCase) sources.add(horse.specialCaseType || 'special');
  }

  return Array.from(sources);
}

function markRecommendedBets(bets: GeneratedBet[], bankroll: UseBankrollReturn): GeneratedBet[] {
  const mode = bankroll.getComplexityMode();
  const style = bankroll.getSimpleSettings().bettingStyle;

  return bets.map((bet) => {
    let isRecommended = false;

    if (mode === 'simple') {
      switch (style) {
        case 'safe':
          // Safe: 70% Tier 1, 30% Tier 2, 0% Tier 3
          isRecommended = bet.tier === 'tier1' || (bet.tier === 'tier2' && bet.confidence >= 65);
          break;
        case 'balanced':
          // Balanced: 40% Tier 1, 35% Tier 2, 25% Tier 3
          isRecommended =
            bet.tier === 'tier1' ||
            bet.tier === 'tier2' ||
            (bet.tier === 'tier3' && bet.confidence >= 45);
          break;
        case 'aggressive':
          // Fences: 20% Tier 1, 30% Tier 2, 50% Tier 3
          isRecommended = true; // All bets recommended
          break;
      }
    } else {
      // Moderate/Advanced: recommend based on positive EV and overlay
      isRecommended = bet.evPerDollar > 0 || bet.overlayPercent >= 25 || bet.tier === 'tier1';
    }

    return { ...bet, isRecommended };
  });
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generate comprehensive bet recommendations from scored horses
 * Integrates all Phase 2 scoring modules
 */
export function generateRecommendations(input: GeneratorInput): BetGeneratorResult {
  const { scoredHorses, raceHeader, raceNumber, bankroll } = input;

  try {
    // Prepare horse data for classification
    const horsesForClassification = scoredHorses.map((sh) => ({
      horse: sh.horse,
      index: sh.index,
      score: sh.score,
    }));

    // Classify horses into tiers
    const tierGroups = classifyHorses(horsesForClassification);
    const allClassifiedHorses = tierGroups.flatMap((g) => g.horses);

    // Build scores map for longshot analysis
    const scoresMap = new Map<number, HorseScore>();
    for (const sh of scoredHorses) {
      scoresMap.set(sh.horse.programNumber, sh.score);
    }

    // Analyze for nuclear longshots
    const longshotSummary = analyzeRaceLongshots(
      scoredHorses.map((sh) => sh.horse),
      raceHeader,
      scoresMap
    );

    // Build nuclear longshots map
    const nuclearLongshotsMap = new Map<number, LongshotAnalysisResult>();
    for (const ls of [...longshotSummary.nuclearLongshots, ...longshotSummary.liveLongshots]) {
      nuclearLongshotsMap.set(ls.programNumber, ls);
    }

    // Analyze for diamonds - provide getOdds callback
    const getOdds = (index: number, defaultOdds: string) => {
      const horse = scoredHorses[index];
      return horse?.horse.morningLineOdds ?? defaultOdds;
    };
    const diamondSummary = analyzeRaceDiamonds(
      scoredHorses.map((sh) => sh.horse),
      scoresMap,
      raceHeader,
      getOdds
    );
    const validatedDiamonds = getValidatedDiamonds(diamondSummary.diamonds);

    // Analyze late-breaking information (Protocol 4)
    const lateBreakingInfo = analyzeLateBreakingInfo(
      scoredHorses.map((sh) => sh.horse),
      raceHeader
    );

    // Get tier groups
    const tier1Group = tierGroups.find((g) => g.tier === 'tier1');
    const tier2Group = tierGroups.find((g) => g.tier === 'tier2');
    const tier3Group = tierGroups.find((g) => g.tier === 'tier3');
    const tier1Horses = tier1Group?.horses || [];

    // Generate tier bets
    const tier1Bets = tier1Group
      ? generateTier1Bets(tier1Group, allClassifiedHorses, raceNumber, bankroll)
      : [];
    const tier2Bets = tier2Group
      ? generateTier2Bets(tier2Group, tier1Horses, raceNumber, bankroll)
      : [];
    const tier3Bets = tier3Group
      ? generateTier3Bets(
          tier3Group,
          allClassifiedHorses,
          nuclearLongshotsMap,
          raceNumber,
          bankroll
        )
      : [];

    // Generate special category bets
    const nuclearBets = generateNuclearLongshotBets(
      longshotSummary.allLongshots,
      allClassifiedHorses,
      raceNumber
    );
    const diamondBets = generateDiamondBets(validatedDiamonds, allClassifiedHorses, raceNumber);
    const valueBombBets = generateValueBombBets(allClassifiedHorses, raceNumber, bankroll);

    // Combine all bets and scale by bankroll
    let allBets = [
      ...tier1Bets,
      ...tier2Bets,
      ...tier3Bets,
      ...nuclearBets,
      ...diamondBets,
      ...valueBombBets,
    ];

    // Remove duplicates (same horse numbers and bet type)
    allBets = deduplicateBets(allBets);

    // Scale bets by bankroll settings
    allBets = scaleBetsByBankroll(allBets, bankroll);

    // Mark recommended bets based on betting style
    allBets = markRecommendedBets(allBets, bankroll);

    // Sanitize bet amounts
    allBets = sanitizeBetAmounts(allBets);

    // Organize into tier groups
    const tierBets: GeneratedTierBets[] = tierGroups.map((group) => {
      const groupBets = allBets.filter((b) => b.tier === group.tier && !b.specialCategory);
      const totalInvestment = groupBets.reduce((sum, b) => sum + b.totalCost, 0);
      const minReturn = groupBets.reduce((sum, b) => sum + b.potentialReturn.min, 0);
      const maxReturn = groupBets.reduce((sum, b) => sum + b.potentialReturn.max, 0);

      return {
        tier: group.tier,
        tierName: group.name,
        description: group.description,
        bets: groupBets,
        generatedBets: groupBets,
        totalInvestment: Math.round(totalInvestment * 100) / 100,
        expectedHitRate: group.expectedHitRate,
        potentialReturnRange: { min: Math.round(minReturn), max: Math.round(maxReturn) },
      };
    });

    // Organize special category bets
    const specialBets: SpecialCategoryBets = {
      nuclearLongshots: allBets.filter((b) => b.specialCategory === 'nuclear'),
      diamonds: allBets.filter((b) => b.specialCategory === 'diamond'),
      valueBombs: allBets.filter((b) => b.specialCategory === 'value_bomb'),
      totalInvestment: allBets
        .filter((b) => b.specialCategory !== null)
        .reduce((sum, b) => sum + b.totalCost, 0),
    };

    // Calculate totals
    const recommendedBets = allBets.filter((b) => b.isRecommended);
    const totalRecommendedCost = recommendedBets.reduce((sum, b) => sum + b.totalCost, 0);
    const totalMaxCost = allBets.reduce((sum, b) => sum + b.totalCost, 0);

    // Build summary
    const summary = {
      tier1Count: tier1Bets.length,
      tier2Count: tier2Bets.length,
      tier3Count: tier3Bets.length,
      nuclearCount: specialBets.nuclearLongshots.length,
      diamondCount: specialBets.diamonds.length,
      positiveEVCount: allBets.filter((b) => b.evPerDollar > 0).length,
      overlayCount: allBets.filter((b) => b.overlayPercent >= 25).length,
      scratchCount: lateBreakingInfo.scratchCount,
      lateBreakingBeneficiaries: lateBreakingInfo.beneficiaries.length,
    };

    logger.logInfo('Bet recommendations generated', {
      component: 'betGenerator',
      raceNumber,
      totalBets: allBets.length,
      recommendedBets: recommendedBets.length,
      ...summary,
    });

    return {
      tierBets,
      specialBets,
      allBets,
      totalRecommendedCost: Math.round(totalRecommendedCost * 100) / 100,
      totalMaxCost: Math.round(totalMaxCost * 100) / 100,
      lateBreakingInfo,
      summary,
    };
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error(String(error)), {
      component: 'betGenerator',
      raceNumber,
    });

    // Return empty result on error
    return {
      tierBets: [],
      specialBets: {
        nuclearLongshots: [],
        diamonds: [],
        valueBombs: [],
        totalInvestment: 0,
      },
      allBets: [],
      totalRecommendedCost: 0,
      totalMaxCost: 0,
      lateBreakingInfo: {
        scratchCount: 0,
        scratchImpacts: [],
        jockeyChanges: [],
        updatedPaceScenario: {
          scenario: 'unknown' as const,
          label: 'Unknown',
          color: '#888888',
          description: 'Analysis error',
          ppi: 0,
          fieldSize: 0,
          expectedPace: 'moderate' as const,
          styleBreakdown: {
            earlySpeed: [],
            pressers: [],
            sustained: [],
            closers: [],
            unknown: [],
          },
        },
        beneficiaries: [],
        summary: 'Analysis error',
        hasSignificantChanges: false,
      },
      summary: {
        tier1Count: 0,
        tier2Count: 0,
        tier3Count: 0,
        nuclearCount: 0,
        diamondCount: 0,
        positiveEVCount: 0,
        overlayCount: 0,
        scratchCount: 0,
        lateBreakingBeneficiaries: 0,
      },
    };
  }
}

/**
 * Remove duplicate bets (same type and horse numbers)
 */
function deduplicateBets(bets: GeneratedBet[]): GeneratedBet[] {
  const seen = new Set<string>();
  return bets.filter((bet) => {
    const key = `${bet.type}-${bet.horseNumbers.sort().join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sanitize bet amounts - no $0 or negative bets
 */
function sanitizeBetAmounts(bets: GeneratedBet[]): GeneratedBet[] {
  return bets
    .filter((bet) => bet.amount > 0 && bet.totalCost > 0)
    .map((bet) => ({
      ...bet,
      amount: Math.max(0.1, bet.amount),
      totalCost: Math.max(0.1, bet.totalCost),
    }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { BetRecommendation, TierBetRecommendations, ClassifiedHorse, TierGroup, BettingTier };
