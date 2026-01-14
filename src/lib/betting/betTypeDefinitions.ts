/**
 * Bet Type Definitions Library
 *
 * Plain-English definitions and templates for all bet types.
 * Designed for complete novices who need hand-holding through every step.
 * All explanations use real horse names, real odds, real data.
 */

// ============================================================================
// VALUE LABEL EXPLANATIONS
// ============================================================================

export type ValueLabel =
  | 'BETTER_THAN_ODDS_SUGGEST'
  | 'GETTING_EXTRA_VALUE'
  | 'FAIR_VALUE_HORSE'
  | 'OVERBET_BY_PUBLIC'
  | 'FALSE_FAVORITE';

export const VALUE_LABEL_EXPLANATIONS: Record<ValueLabel, string> = {
  BETTER_THAN_ODDS_SUGGEST:
    "The public is undervaluing this horse. You're getting more than fair value.",
  GETTING_EXTRA_VALUE: "There's positive edge here — the odds are in your favor.",
  FAIR_VALUE_HORSE: "The odds are about right. Not a steal, but not overpriced either.",
  OVERBET_BY_PUBLIC: "The public likes this horse too much. You're paying a premium.",
  FALSE_FAVORITE:
    "This horse is the favorite but shouldn't be. Proceed with caution.",
};

/**
 * Get value label based on edge percentage
 */
export function getValueLabel(edgePercent: number): ValueLabel {
  if (edgePercent >= 30) return 'BETTER_THAN_ODDS_SUGGEST';
  if (edgePercent >= 10) return 'GETTING_EXTRA_VALUE';
  if (edgePercent >= -5) return 'FAIR_VALUE_HORSE';
  if (edgePercent >= -20) return 'OVERBET_BY_PUBLIC';
  return 'FALSE_FAVORITE';
}

// ============================================================================
// RISK CONTEXT EXPLANATIONS
// ============================================================================

export type RiskLevel = 'safe' | 'balanced' | 'aggressive';

export interface RiskContextTemplate {
  intro: string;
  horseContext: (horseName: string) => string;
}

export const RISK_CONTEXT: Record<RiskLevel, RiskContextTemplate> = {
  safe: {
    intro: 'This fits your safe approach',
    horseContext: (horseName: string) =>
      `${horseName} is a top contender with solid fundamentals.`,
  },
  balanced: {
    intro: 'This balances risk and reward',
    horseContext: (horseName: string) =>
      `${horseName} has upside without being a pure gamble.`,
  },
  aggressive: {
    intro: 'This fits your aggressive style',
    horseContext: (horseName: string) =>
      `${horseName} is a longshot but the edge is massive.`,
  },
};

// ============================================================================
// BET TYPE DEFINITIONS
// ============================================================================

export interface BetTypeDefinition {
  /** Short name for display */
  name: string;
  /** Plain-English definition a 5-year-old could understand */
  definition: string;
  /** Template string with placeholders for dynamic values */
  template: string;
  /** Risk level description */
  riskLevel: string;
  /** Payout description */
  payoutLevel: string;
  /** Example of how to read the bet */
  example: string;
  /** Common mistakes to avoid */
  commonMistakes?: string[];
}

export const BET_TYPE_DEFINITIONS: Record<string, BetTypeDefinition> = {
  WIN: {
    name: 'Win',
    definition: "You're betting your horse finishes 1st. Simple as that.",
    template:
      "You're betting $[amount] that #[number] [HORSE NAME] finishes 1st. At current odds of [odds], you'd win $[potential] plus your $[amount] back.",
    riskLevel: 'Higher risk - only first place pays',
    payoutLevel: 'Highest payout for straight bets',
    example: 'If you bet $10 to WIN on a 5-1 horse and he wins, you get $60 back ($50 profit + $10 stake)',
    commonMistakes: [
      "Don't bet WIN on heavy favorites - low payout isn't worth the risk",
      "WIN bets on longshots can pay big but hit less often"
    ]
  },

  PLACE: {
    name: 'Place',
    definition: "You're betting your horse finishes 1st OR 2nd. Safer than Win, but pays less.",
    template:
      "You're betting $[amount] that #[number] [HORSE NAME] finishes in the top 2. You win if he's 1st or 2nd.",
    riskLevel: 'Medium risk - two ways to cash',
    payoutLevel: 'Moderate payout',
    example: 'If you bet $10 to PLACE on a 5-1 horse and he runs 2nd, you might get $16-20 back',
    commonMistakes: [
      "PLACE payouts are roughly half of WIN payouts",
      "Use PLACE when you think a horse will be competitive but might not win"
    ]
  },

  SHOW: {
    name: 'Show',
    definition: "You're betting your horse finishes 1st, 2nd, OR 3rd. Safest bet, smallest payout.",
    template:
      "You're betting $[amount] that #[number] [HORSE NAME] finishes in the top 3. You win if he's 1st, 2nd, or 3rd.",
    riskLevel: 'Lower risk - three ways to cash',
    payoutLevel: 'Smallest payout',
    example: 'If you bet $10 to SHOW on a 5-1 horse and he runs 3rd, you might get $13-16 back',
    commonMistakes: [
      "SHOW bets on favorites often pay minimum ($2.10-2.20 on a $2 bet)",
      "Best for hedging or playing longshots with safety"
    ]
  },

  EXACTA: {
    name: 'Exacta',
    definition: 'Pick the 1st and 2nd place horses in exact order. Harder to hit, bigger payout.',
    template:
      "You're betting $[amount] that #[horse1] finishes 1st AND #[horse2] finishes 2nd, in that exact order.",
    riskLevel: 'Higher risk - exact order is tough',
    payoutLevel: 'Can pay 10x-100x your bet',
    example: 'A $2 exacta of 3 over 5 means #3 MUST win and #5 MUST be 2nd',
    commonMistakes: [
      "Order matters! 3-5 is different from 5-3",
      "Consider boxing if unsure which will win"
    ]
  },

  EXACTA_BOX: {
    name: 'Exacta Box',
    definition:
      'Pick 2+ horses to finish 1st and 2nd in any order. More combinations = higher cost but easier to hit.',
    template:
      "You're betting #[horse1] and #[horse2] finish 1st and 2nd in either order. That's [combinations] combinations at $[amount] each = $[total] total.",
    riskLevel: 'Medium-high risk - more flexibility than straight exacta',
    payoutLevel: 'Good payouts, costs more than straight exacta',
    example: 'Boxing 3 and 5 means you win if it comes 3-5 OR 5-3',
    commonMistakes: [
      "Boxing 3 horses = 6 combinations, costs 3x more than boxing 2",
      "Boxing 4 horses = 12 combinations, gets expensive fast"
    ]
  },

  EXACTA_KEY: {
    name: 'Exacta Key',
    definition:
      "You're betting one horse (your 'key') finishes 1st, with other horses filling 2nd place.",
    template:
      "You're keying #[key] to WIN, with #[horses] fighting for 2nd. That's [count] combinations at $[amount] each = $[total] total. Your key horse MUST win.",
    riskLevel: 'Higher risk - key must win',
    payoutLevel: 'Better coverage than straight exacta',
    example: '$2 Exacta Key: 3 over 5,6,7 means #3 must win with #5, #6, or #7 running 2nd',
    commonMistakes: [
      "If your key doesn't win, you lose everything",
      "Good strategy when you're confident in the winner but not sure about 2nd"
    ]
  },

  TRIFECTA: {
    name: 'Trifecta',
    definition: 'Pick the 1st, 2nd, and 3rd place horses in exact order. Hard to hit, big payout.',
    template:
      "You're betting #[horse1] finishes 1st, #[horse2] finishes 2nd, and #[horse3] finishes 3rd, in that exact order.",
    riskLevel: 'High risk - all three in exact order',
    payoutLevel: 'Can pay 50x-500x or more',
    example: 'A $1 trifecta of 3-5-7 means exactly that order',
    commonMistakes: [
      "Straight trifectas are very hard to hit",
      "Most people box or key trifectas for better coverage"
    ]
  },

  TRIFECTA_BOX: {
    name: 'Trifecta Box',
    definition: 'Pick 3+ horses to finish 1st, 2nd, and 3rd in any order.',
    template:
      "You're betting #[horse1], #[horse2], and #[horse3] finish 1st, 2nd, and 3rd in any order. That's [combinations] combinations at $[amount] each = $[total] total.",
    riskLevel: 'High risk - needs exact top 3 horses',
    payoutLevel: 'Great payouts when you hit',
    example: 'Boxing 3 horses = 6 combos. Boxing 4 horses = 24 combos. Boxing 5 horses = 60 combos.',
    commonMistakes: [
      "Costs add up fast! 4-horse box at $1 = $24",
      "Only box horses you truly believe in"
    ]
  },

  TRIFECTA_KEY: {
    name: 'Trifecta Key',
    definition:
      "You're betting one horse wins, with others filling 2nd and 3rd in any order.",
    template:
      "You're keying #[key] to WIN, with #[horses] fighting for 2nd and 3rd. That's [count] combinations at $[amount] each = $[total] total. Your key horse MUST win.",
    riskLevel: 'High risk - key must win',
    payoutLevel: 'Big payouts possible',
    example: '$1 Trifecta Key: 3 ALL with 5,6,7 = 6 combinations ($6 total)',
    commonMistakes: [
      "If your key doesn't win, you lose everything",
      "Good value when confident in winner"
    ]
  },

  SUPERFECTA: {
    name: 'Superfecta',
    definition:
      'Pick the 1st, 2nd, 3rd, and 4th place horses in exact order. Very hard, huge payout.',
    template:
      "You're betting the top 4 finishers in exact order. This is the hardest bet to hit, but pays the most.",
    riskLevel: 'Very high risk - needs 4 in exact order',
    payoutLevel: 'Can pay $100-$10,000+ on a $0.50 bet',
    example: 'A $0.50 superfecta can pay thousands if you hit',
    commonMistakes: [
      "Almost always box or key superfectas",
      "Keep bet sizes small - $0.50 or $1"
    ]
  },

  SUPERFECTA_BOX: {
    name: 'Superfecta Box',
    definition: 'Pick 4+ horses to finish in the top 4 in any order.',
    template:
      "You're betting #[horses] finish in the top 4 in any order. That's [combinations] combinations at $[amount] each = $[total] total.",
    riskLevel: 'Very high risk - but covers all orders',
    payoutLevel: 'Life-changing payouts possible',
    example: 'Boxing 4 horses = 24 combos at $0.50 = $12. Boxing 5 horses = 120 combos = $60!',
    commonMistakes: [
      "Costs explode with more horses",
      "Stick to 4-5 horses max unless you have a big bankroll"
    ]
  },

  DAILY_DOUBLE: {
    name: 'Daily Double',
    definition: 'Pick the winners of two consecutive races. Both must win.',
    template:
      "You're betting #[horse1] wins Race [X] AND #[horse2] wins Race [Y]. Both horses MUST win for you to cash.",
    riskLevel: 'Medium-high risk - need two winners',
    payoutLevel: 'Better than betting two races separately',
    example: 'If you like #3 in Race 1 and #7 in Race 2, a daily double pays more than two win bets',
    commonMistakes: [
      "Both races must hit - no partial payouts",
      "Good for linking two confident picks"
    ]
  },

  PICK_3: {
    name: 'Pick 3',
    definition: 'Pick the winners of three consecutive races. All three must win.',
    template:
      "You're betting winners in Races [X], [Y], and [Z]. All three must win. Higher difficulty, bigger payout than Daily Double.",
    riskLevel: 'High risk - need three winners',
    payoutLevel: 'Much better payouts than straight win bets',
    example: 'Pick 3 with singles: $2 cost. With spreads: $2 × combinations',
    commonMistakes: [
      "Spread uncertain races, single strong picks",
      "One bad leg loses the whole ticket"
    ]
  },

  PICK_4: {
    name: 'Pick 4',
    definition: 'Pick the winners of four consecutive races. All four must win.',
    template:
      "You're betting winners in four straight races. All must win. Often has large carryover pools.",
    riskLevel: 'Very high risk - need four winners',
    payoutLevel: 'Carryovers can make payouts huge',
    example: 'Pick 4 pools often have carryovers that boost payouts',
    commonMistakes: [
      "Keep ticket costs manageable",
      "Mix singles and spreads strategically"
    ]
  },

  PICK_5: {
    name: 'Pick 5',
    definition: 'Pick the winners of five consecutive races. All five must win.',
    template:
      "You're betting winners in five straight races. Very difficult, often life-changing payouts.",
    riskLevel: 'Extremely high risk',
    payoutLevel: 'Can pay $10,000-$100,000+',
    example: 'Pick 5 is a lottery-type bet but based on skill',
    commonMistakes: [
      "Use 50-cent minimums to keep costs down",
      "Focus on races you know best"
    ]
  },

  PICK_6: {
    name: 'Pick 6',
    definition:
      'Pick the winners of six consecutive races. All six must win. Lottery-level difficulty and payout.',
    template:
      "You're betting winners in six straight races. This is the lottery of horse racing.",
    riskLevel: 'Lottery-level risk',
    payoutLevel: 'Can pay $50,000-$1,000,000+',
    example: 'Pick 6 jackpots often roll over for weeks',
    commonMistakes: [
      "Only play with money you can afford to lose",
      "Consider playing in pools/syndicates"
    ]
  },

  QUINELLA: {
    name: 'Quinella',
    definition:
      'Pick two horses to finish 1st and 2nd in any order. Like an Exacta Box but usually cheaper.',
    template:
      "You're betting #[horse1] and #[horse2] finish 1st and 2nd in either order. One bet covers both orders.",
    riskLevel: 'Medium risk - two ways to win',
    payoutLevel: 'Usually pays between exacta box and place parlay',
    example: 'A $2 quinella on 3-5 wins whether it comes 3-5 or 5-3',
    commonMistakes: [
      "Not all tracks offer quinellas anymore",
      "Compare quinella vs exacta box for best value"
    ]
  },
};

// ============================================================================
// BOX COMBINATION TEMPLATES
// ============================================================================

export const EXACTA_BOX_TEMPLATES: Record<number, string> = {
  2: "You're betting #[horse1] and #[horse2] finish 1st and 2nd in either order. That's 2 combinations at $[amount] each = $[total] total.",
  3: "You're betting any two of #[horse1], #[horse2], #[horse3] finish 1st and 2nd. That's 6 combinations at $[amount] each = $[total] total.",
  4: "You're betting any two of your four horses finish 1st and 2nd. That's 12 combinations at $[amount] each = $[total] total.",
  5: "You're betting any two of your five horses finish 1st and 2nd. That's 20 combinations at $[amount] each = $[total] total.",
};

export const TRIFECTA_BOX_TEMPLATES: Record<number, string> = {
  3: "You're betting #[horse1], #[horse2], and #[horse3] finish 1st, 2nd, and 3rd in any order. That's 6 combinations at $[amount] each = $[total] total.",
  4: "You're betting any three of your four horses finish 1st, 2nd, and 3rd. That's 24 combinations at $[amount] each = $[total] total.",
  5: "You're betting any three of your five horses finish 1st, 2nd, and 3rd. That's 60 combinations at $[amount] each = $[total] total.",
  6: "You're betting any three of your six horses finish 1st, 2nd, and 3rd. That's 120 combinations at $[amount] each = $[total] total.",
};

export const SUPERFECTA_BOX_TEMPLATES: Record<number, string> = {
  4: "You're betting #[horses] finish in the top 4 in any order. That's 24 combinations at $[amount] each = $[total] total.",
  5: "You're betting any four of your five horses finish in the top 4. That's 120 combinations at $[amount] each = $[total] total.",
  6: "You're betting any four of your six horses finish in the top 4. That's 360 combinations at $[amount] each = $[total] total.",
};

// ============================================================================
// DYNAMIC EXPLANATION GENERATOR
// ============================================================================

export interface HorseData {
  programNumber: number;
  horseName: string;
  currentOdds: string;
  fairOdds: string;
  rank: number;
  edge: number;
}

/**
 * Generate a dynamic "Why this bet?" explanation using real data
 */
export function generateWhyThisBet(
  horse: HorseData,
  riskLevel: RiskLevel
): string {
  const valueLabel = getValueLabel(horse.edge);
  const valueLabelExplanation = VALUE_LABEL_EXPLANATIONS[valueLabel];
  const riskContext = RISK_CONTEXT[riskLevel];

  const parts = [
    `${horse.horseName} is Furlong's #${horse.rank} projected finisher with a ${horse.edge >= 0 ? '+' : ''}${Math.round(horse.edge)}% edge.`,
    `Current odds are ${horse.currentOdds} but our analysis says fair odds are ${horse.fairOdds}.`,
    valueLabelExplanation,
    `${riskContext.intro} — ${riskContext.horseContext(horse.horseName)}`,
  ];

  return parts.join(' ');
}

/**
 * Format a bet type definition with real values
 */
export function formatBetDefinition(
  betType: string,
  values: {
    amount?: number;
    number?: number;
    horseName?: string;
    odds?: string;
    potential?: number;
    horse1?: number;
    horse2?: number;
    horse3?: number;
    horses?: number[];
    key?: number;
    combinations?: number;
    total?: number;
  }
): string {
  const def = BET_TYPE_DEFINITIONS[betType];
  if (!def) return '';

  let template = def.template;

  // Replace all placeholders
  if (values.amount !== undefined) {
    template = template.replace(/\[amount\]/g, String(values.amount));
  }
  if (values.number !== undefined) {
    template = template.replace(/\[number\]/g, String(values.number));
  }
  if (values.horseName) {
    template = template.replace(/\[HORSE NAME\]/g, values.horseName);
  }
  if (values.odds) {
    template = template.replace(/\[odds\]/g, values.odds);
  }
  if (values.potential !== undefined) {
    template = template.replace(/\[potential\]/g, String(values.potential));
  }
  if (values.horse1 !== undefined) {
    template = template.replace(/\[horse1\]/g, String(values.horse1));
  }
  if (values.horse2 !== undefined) {
    template = template.replace(/\[horse2\]/g, String(values.horse2));
  }
  if (values.horse3 !== undefined) {
    template = template.replace(/\[horse3\]/g, String(values.horse3));
  }
  if (values.horses) {
    template = template.replace(/\[horses\]/g, values.horses.join(', '));
  }
  if (values.key !== undefined) {
    template = template.replace(/\[key\]/g, String(values.key));
  }
  if (values.combinations !== undefined) {
    template = template.replace(/\[combinations\]/g, String(values.combinations));
    template = template.replace(/\[count\]/g, String(values.combinations));
  }
  if (values.total !== undefined) {
    template = template.replace(/\[total\]/g, String(values.total));
  }

  return template;
}

/**
 * Get the plain-English definition for a bet type
 */
export function getBetTypeDefinition(betType: string): string {
  return BET_TYPE_DEFINITIONS[betType]?.definition || 'Unknown bet type.';
}

/**
 * Get betting advice for a risk level and budget
 */
export function getBettingAdvice(
  budget: number,
  riskLevel: RiskLevel
): string {
  if (budget < 10) {
    switch (riskLevel) {
      case 'safe':
        return "With a small budget, focus on a single Win or Place bet on the best horse. Don't spread yourself too thin.";
      case 'balanced':
        return 'Try a Place bet on your top pick plus a Win bet on the best value horse.';
      case 'aggressive':
        return 'Go for a Win bet on the biggest overlay — the horse with the most edge.';
    }
  } else if (budget <= 20) {
    switch (riskLevel) {
      case 'safe':
        return 'Split between Win and Place on your top-ranked horse for safety and value.';
      case 'balanced':
        return 'Win bet plus a small Exacta box on your top 3 picks gives good coverage.';
      case 'aggressive':
        return 'Trifecta key with your top overlay over the next 3 contenders.';
    }
  } else if (budget <= 50) {
    switch (riskLevel) {
      case 'safe':
        return 'Win/Place on your top pick plus an Exacta box on the top 2 for upside.';
      case 'balanced':
        return 'Win bet, Exacta box top 3, and a Trifecta key for max coverage.';
      case 'aggressive':
        return 'Trifecta box top 4 plus Win on your biggest overlay.';
    }
  } else {
    switch (riskLevel) {
      case 'safe':
        return 'Full Win/Place/Show on your top pick plus Exacta and Trifecta coverage.';
      case 'balanced':
        return 'Full spread: Win bet, Exacta box, and Trifecta box on your contenders.';
      case 'aggressive':
        return 'Superfecta box plus Trifecta box plus Win bets on all overlays.';
    }
  }
}
