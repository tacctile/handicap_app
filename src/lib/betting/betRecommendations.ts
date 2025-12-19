import type { ClassifiedHorse, TierGroup, BettingTier } from './tierClassification'

// Bet types
export type BetType =
  | 'win'
  | 'place'
  | 'show'
  | 'exacta_box'
  | 'exacta_key_over'
  | 'exacta_key_under'
  | 'trifecta_box'
  | 'trifecta_key'
  | 'trifecta_wheel'
  | 'quinella'
  | 'superfecta'

export interface BetRecommendation {
  type: BetType
  typeName: string
  description: string
  horses: ClassifiedHorse[]
  horseNumbers: number[] // Program numbers for display
  amount: number
  totalCost: number
  windowInstruction: string
  potentialReturn: { min: number; max: number }
  confidence: number
  icon: string
}

export interface TierBetRecommendations {
  tier: BettingTier
  tierName: string
  description: string
  bets: BetRecommendation[]
  totalInvestment: number
  expectedHitRate: { win: number; place: number; show: number }
  potentialReturnRange: { min: number; max: number }
}

// Base bet amounts by tier
const BASE_AMOUNTS: Record<BettingTier, number> = {
  tier1: 10, // Higher base for favorites
  tier2: 5,  // Medium for logical alternatives
  tier3: 2,  // Small for value bombs
}

// Bet type configurations
const BET_TYPE_CONFIG: Record<BetType, { name: string; icon: string }> = {
  win: { name: 'Win', icon: 'emoji_events' },
  place: { name: 'Place', icon: 'looks_two' },
  show: { name: 'Show', icon: 'looks_3' },
  exacta_box: { name: 'Exacta Box', icon: 'swap_vert' },
  exacta_key_over: { name: 'Exacta Key Over', icon: 'arrow_downward' },
  exacta_key_under: { name: 'Exacta Key Under', icon: 'arrow_upward' },
  trifecta_box: { name: 'Trifecta Box', icon: 'view_list' },
  trifecta_key: { name: 'Trifecta Key', icon: 'first_page' },
  trifecta_wheel: { name: 'Trifecta Wheel', icon: 'sync' },
  quinella: { name: 'Quinella', icon: 'compare_arrows' },
  superfecta: { name: 'Superfecta', icon: 'format_list_numbered' },
}

/**
 * Calculate exacta box cost
 * n horses = n * (n-1) combinations
 */
function exactaBoxCost(numHorses: number, baseAmount: number): number {
  return numHorses * (numHorses - 1) * baseAmount
}

/**
 * Calculate exacta key over field cost
 * 1 key horse over n others = n combinations
 */
function exactaKeyOverCost(numOthers: number, baseAmount: number): number {
  return numOthers * baseAmount
}

/**
 * Calculate trifecta box cost
 * n horses = n * (n-1) * (n-2) combinations
 */
function trifectaBoxCost(numHorses: number, baseAmount: number): number {
  return numHorses * (numHorses - 1) * (numHorses - 2) * baseAmount
}

/**
 * Calculate potential returns based on odds
 */
function calculatePotentialReturn(
  betType: BetType,
  horses: ClassifiedHorse[],
  cost: number
): { min: number; max: number } {
  if (horses.length === 0) return { min: 0, max: 0 }

  const avgOdds = horses.reduce((sum, h) => sum + h.odds, 0) / horses.length
  const maxOdds = Math.max(...horses.map(h => h.odds))
  const minOdds = Math.min(...horses.map(h => h.odds))

  switch (betType) {
    case 'win':
      return {
        min: Math.round(cost * (minOdds + 1)),
        max: Math.round(cost * (maxOdds + 1)),
      }
    case 'place':
      return {
        min: Math.round(cost * (minOdds / 2 + 1)),
        max: Math.round(cost * (maxOdds / 2 + 1)),
      }
    case 'show':
      return {
        min: Math.round(cost * (minOdds / 3 + 1)),
        max: Math.round(cost * (maxOdds / 3 + 1)),
      }
    case 'exacta_box':
    case 'exacta_key_over':
    case 'exacta_key_under':
      return {
        min: Math.round(cost * (avgOdds * 2 + 1)),
        max: Math.round(cost * (maxOdds * avgOdds + 1)),
      }
    case 'trifecta_box':
    case 'trifecta_key':
    case 'trifecta_wheel':
      return {
        min: Math.round(cost * (avgOdds * 5 + 1)),
        max: Math.round(cost * (maxOdds * avgOdds * 3 + 1)),
      }
    case 'quinella':
      return {
        min: Math.round(cost * (avgOdds * 1.5 + 1)),
        max: Math.round(cost * (maxOdds * 2 + 1)),
      }
    case 'superfecta':
      return {
        min: Math.round(cost * (avgOdds * 20 + 1)),
        max: Math.round(cost * (maxOdds * avgOdds * 10 + 1)),
      }
    default:
      return { min: cost, max: cost * 10 }
  }
}

/**
 * Format horse numbers for window instruction
 */
function formatHorseNumbers(horses: ClassifiedHorse[]): string {
  return horses.map(h => h.horse.programNumber).join(', ')
}

/**
 * Generate window instruction text
 */
function generateWindowInstruction(
  betType: BetType,
  horses: ClassifiedHorse[],
  amount: number,
  raceNumber?: number
): string {
  const racePrefix = raceNumber ? `Race ${raceNumber}, ` : ''
  const numbers = formatHorseNumbers(horses)
  const baseAmount = `$${amount}`

  switch (betType) {
    case 'win':
      return `"${racePrefix}${baseAmount} to WIN on number ${numbers}"`
    case 'place':
      return `"${racePrefix}${baseAmount} to PLACE on number ${numbers}"`
    case 'show':
      return `"${racePrefix}${baseAmount} to SHOW on number ${numbers}"`
    case 'exacta_box':
      return `"${racePrefix}${baseAmount} EXACTA BOX ${numbers}"`
    case 'exacta_key_over':
      return `"${racePrefix}${baseAmount} EXACTA, number ${horses[0].horse.programNumber} on top with ${horses.slice(1).map(h => h.horse.programNumber).join(', ')}"`
    case 'exacta_key_under':
      return `"${racePrefix}${baseAmount} EXACTA, ${horses.slice(1).map(h => h.horse.programNumber).join(', ')} with number ${horses[0].horse.programNumber} second"`
    case 'trifecta_box':
      return `"${racePrefix}${baseAmount} TRIFECTA BOX ${numbers}"`
    case 'trifecta_key':
      return `"${racePrefix}${baseAmount} TRIFECTA, number ${horses[0].horse.programNumber} first, with ${horses.slice(1).map(h => h.horse.programNumber).join(', ')} for second and third"`
    case 'trifecta_wheel':
      return `"${racePrefix}${baseAmount} TRIFECTA WHEEL, number ${horses[0].horse.programNumber} with ALL for second, ${horses.slice(1).map(h => h.horse.programNumber).join(', ')} for third"`
    case 'quinella':
      return `"${racePrefix}${baseAmount} QUINELLA ${numbers}"`
    case 'superfecta':
      return `"${racePrefix}$0.10 SUPERFECTA BOX ${numbers}"`
    default:
      return `"${racePrefix}${baseAmount} on ${numbers}"`
  }
}

/**
 * Generate Tier 1 (Cover Chalk) bet recommendations
 */
function generateTier1Bets(
  tierGroup: TierGroup,
  allHorses: ClassifiedHorse[]
): BetRecommendation[] {
  const bets: BetRecommendation[] = []
  const baseAmount = BASE_AMOUNTS.tier1
  const tier1Horses = tierGroup.horses

  if (tier1Horses.length === 0) return bets

  const topHorse = tier1Horses[0]

  // 1. Win bet on top pick
  const winAmount = baseAmount * 2
  bets.push({
    type: 'win',
    typeName: BET_TYPE_CONFIG.win.name,
    description: `Win bet on top contender ${topHorse.horse.horseName}`,
    horses: [topHorse],
    horseNumbers: [topHorse.horse.programNumber],
    amount: winAmount,
    totalCost: winAmount,
    windowInstruction: generateWindowInstruction('win', [topHorse], winAmount),
    potentialReturn: calculatePotentialReturn('win', [topHorse], winAmount),
    confidence: topHorse.confidence,
    icon: BET_TYPE_CONFIG.win.icon,
  })

  // 2. Place bet for safety
  const placeAmount = baseAmount
  bets.push({
    type: 'place',
    typeName: BET_TYPE_CONFIG.place.name,
    description: `Place bet on ${topHorse.horse.horseName} for safety`,
    horses: [topHorse],
    horseNumbers: [topHorse.horse.programNumber],
    amount: placeAmount,
    totalCost: placeAmount,
    windowInstruction: generateWindowInstruction('place', [topHorse], placeAmount),
    potentialReturn: calculatePotentialReturn('place', [topHorse], placeAmount),
    confidence: topHorse.confidence,
    icon: BET_TYPE_CONFIG.place.icon,
  })

  // 3. Exacta box with top 2-3 tier 1 horses
  if (tier1Horses.length >= 2) {
    const boxHorses = tier1Horses.slice(0, Math.min(3, tier1Horses.length))
    const boxAmount = baseAmount / 2
    const boxCost = exactaBoxCost(boxHorses.length, boxAmount)
    bets.push({
      type: 'exacta_box',
      typeName: BET_TYPE_CONFIG.exacta_box.name,
      description: `Exacta box with top ${boxHorses.length} contenders`,
      horses: boxHorses,
      horseNumbers: boxHorses.map(h => h.horse.programNumber),
      amount: boxAmount,
      totalCost: boxCost,
      windowInstruction: generateWindowInstruction('exacta_box', boxHorses, boxAmount),
      potentialReturn: calculatePotentialReturn('exacta_box', boxHorses, boxCost),
      confidence: Math.round(boxHorses.reduce((sum, h) => sum + h.confidence, 0) / boxHorses.length),
      icon: BET_TYPE_CONFIG.exacta_box.icon,
    })
  }

  // 4. Exacta key over field (top pick over others)
  const otherContenders = allHorses.filter(
    h => h.horseIndex !== topHorse.horseIndex && !h.score.isScratched
  ).slice(0, 4)

  if (otherContenders.length > 0) {
    const keyAmount = baseAmount / 2
    const keyCost = exactaKeyOverCost(otherContenders.length, keyAmount)
    const keyHorses = [topHorse, ...otherContenders]
    bets.push({
      type: 'exacta_key_over',
      typeName: BET_TYPE_CONFIG.exacta_key_over.name,
      description: `${topHorse.horse.horseName} over top ${otherContenders.length} others`,
      horses: keyHorses,
      horseNumbers: keyHorses.map(h => h.horse.programNumber),
      amount: keyAmount,
      totalCost: keyCost,
      windowInstruction: generateWindowInstruction('exacta_key_over', keyHorses, keyAmount),
      potentialReturn: calculatePotentialReturn('exacta_key_over', keyHorses, keyCost),
      confidence: topHorse.confidence - 10,
      icon: BET_TYPE_CONFIG.exacta_key_over.icon,
    })
  }

  // 5. Trifecta box with top 3
  if (tier1Horses.length >= 3) {
    const triHorses = tier1Horses.slice(0, 3)
    const triAmount = 1
    const triCost = trifectaBoxCost(3, triAmount)
    bets.push({
      type: 'trifecta_box',
      typeName: BET_TYPE_CONFIG.trifecta_box.name,
      description: `Trifecta box with top 3 chalk`,
      horses: triHorses,
      horseNumbers: triHorses.map(h => h.horse.programNumber),
      amount: triAmount,
      totalCost: triCost,
      windowInstruction: generateWindowInstruction('trifecta_box', triHorses, triAmount),
      potentialReturn: calculatePotentialReturn('trifecta_box', triHorses, triCost),
      confidence: Math.round(triHorses.reduce((sum, h) => sum + h.confidence, 0) / triHorses.length) - 15,
      icon: BET_TYPE_CONFIG.trifecta_box.icon,
    })
  } else if (tier1Horses.length >= 2) {
    // Use tier 1 + tier 2 horses for trifecta
    const triHorses = [...tier1Horses.slice(0, 2), ...allHorses.filter(h =>
      !tier1Horses.includes(h)
    ).slice(0, 1)]
    if (triHorses.length >= 3) {
      const triAmount = 1
      const triCost = trifectaBoxCost(3, triAmount)
      bets.push({
        type: 'trifecta_box',
        typeName: BET_TYPE_CONFIG.trifecta_box.name,
        description: `Trifecta box: chalk with one alternative`,
        horses: triHorses,
        horseNumbers: triHorses.map(h => h.horse.programNumber),
        amount: triAmount,
        totalCost: triCost,
        windowInstruction: generateWindowInstruction('trifecta_box', triHorses, triAmount),
        potentialReturn: calculatePotentialReturn('trifecta_box', triHorses, triCost),
        confidence: 55,
        icon: BET_TYPE_CONFIG.trifecta_box.icon,
      })
    }
  }

  return bets
}

/**
 * Generate Tier 2 (Logical Alternatives) bet recommendations
 */
function generateTier2Bets(
  tierGroup: TierGroup,
  tier1Horses: ClassifiedHorse[]
): BetRecommendation[] {
  const bets: BetRecommendation[] = []
  const baseAmount = BASE_AMOUNTS.tier2
  const tier2Horses = tierGroup.horses

  if (tier2Horses.length === 0) return bets

  const topValueHorse = tier2Horses[0]

  // 1. Win bet (value focus)
  const winAmount = baseAmount
  bets.push({
    type: 'win',
    typeName: BET_TYPE_CONFIG.win.name,
    description: `Value win on ${topValueHorse.horse.horseName} at ${topValueHorse.oddsDisplay}`,
    horses: [topValueHorse],
    horseNumbers: [topValueHorse.horse.programNumber],
    amount: winAmount,
    totalCost: winAmount,
    windowInstruction: generateWindowInstruction('win', [topValueHorse], winAmount),
    potentialReturn: calculatePotentialReturn('win', [topValueHorse], winAmount),
    confidence: topValueHorse.confidence,
    icon: BET_TYPE_CONFIG.win.icon,
  })

  // 2. Exacta key over chalk
  if (tier1Horses.length > 0) {
    const chalkHorses = tier1Horses.slice(0, 2)
    const keyHorses = [topValueHorse, ...chalkHorses]
    const keyAmount = baseAmount / 2
    const keyCost = exactaKeyOverCost(chalkHorses.length, keyAmount)
    bets.push({
      type: 'exacta_key_over',
      typeName: BET_TYPE_CONFIG.exacta_key_over.name,
      description: `${topValueHorse.horse.horseName} over chalk upset special`,
      horses: keyHorses,
      horseNumbers: keyHorses.map(h => h.horse.programNumber),
      amount: keyAmount,
      totalCost: keyCost,
      windowInstruction: generateWindowInstruction('exacta_key_over', keyHorses, keyAmount),
      potentialReturn: calculatePotentialReturn('exacta_key_over', keyHorses, keyCost),
      confidence: topValueHorse.confidence - 10,
      icon: BET_TYPE_CONFIG.exacta_key_over.icon,
    })

    // 3. Exacta key under chalk
    const underHorses = [...chalkHorses, topValueHorse]
    bets.push({
      type: 'exacta_key_under',
      typeName: BET_TYPE_CONFIG.exacta_key_under.name,
      description: `Chalk on top, ${topValueHorse.horse.horseName} underneath`,
      horses: [topValueHorse, ...chalkHorses],
      horseNumbers: [topValueHorse.horse.programNumber, ...chalkHorses.map(h => h.horse.programNumber)],
      amount: keyAmount,
      totalCost: keyCost,
      windowInstruction: generateWindowInstruction('exacta_key_under', underHorses, keyAmount),
      potentialReturn: calculatePotentialReturn('exacta_key_under', underHorses, keyCost),
      confidence: topValueHorse.confidence,
      icon: BET_TYPE_CONFIG.exacta_key_under.icon,
    })
  }

  // 4. Quinella with chalk
  if (tier1Horses.length > 0 && tier2Horses.length > 0) {
    const quinellaHorses = [tier2Horses[0], tier1Horses[0]]
    const quinellaAmount = baseAmount
    bets.push({
      type: 'quinella',
      typeName: BET_TYPE_CONFIG.quinella.name,
      description: `Quinella: alternative with favorite`,
      horses: quinellaHorses,
      horseNumbers: quinellaHorses.map(h => h.horse.programNumber),
      amount: quinellaAmount,
      totalCost: quinellaAmount,
      windowInstruction: generateWindowInstruction('quinella', quinellaHorses, quinellaAmount),
      potentialReturn: calculatePotentialReturn('quinella', quinellaHorses, quinellaAmount),
      confidence: Math.round((quinellaHorses[0].confidence + quinellaHorses[1].confidence) / 2) - 5,
      icon: BET_TYPE_CONFIG.quinella.icon,
    })
  }

  // 5. Trifecta combinations
  const allTrifectaHorses = [...tier2Horses.slice(0, 2), ...tier1Horses.slice(0, 2)]
    .filter((h, i, arr) => arr.findIndex(x => x.horseIndex === h.horseIndex) === i)
    .slice(0, 4)

  if (allTrifectaHorses.length >= 3) {
    const triHorses = allTrifectaHorses.slice(0, 3)
    const triAmount = 1
    const triCost = trifectaBoxCost(3, triAmount)
    bets.push({
      type: 'trifecta_box',
      typeName: BET_TYPE_CONFIG.trifecta_box.name,
      description: `Trifecta box: alternatives with chalk`,
      horses: triHorses,
      horseNumbers: triHorses.map(h => h.horse.programNumber),
      amount: triAmount,
      totalCost: triCost,
      windowInstruction: generateWindowInstruction('trifecta_box', triHorses, triAmount),
      potentialReturn: calculatePotentialReturn('trifecta_box', triHorses, triCost),
      confidence: 45,
      icon: BET_TYPE_CONFIG.trifecta_box.icon,
    })
  }

  // 6. Place bet if value exists
  if (topValueHorse.valueScore > 20) {
    const placeAmount = baseAmount
    bets.push({
      type: 'place',
      typeName: BET_TYPE_CONFIG.place.name,
      description: `Place bet on value horse ${topValueHorse.horse.horseName}`,
      horses: [topValueHorse],
      horseNumbers: [topValueHorse.horse.programNumber],
      amount: placeAmount,
      totalCost: placeAmount,
      windowInstruction: generateWindowInstruction('place', [topValueHorse], placeAmount),
      potentialReturn: calculatePotentialReturn('place', [topValueHorse], placeAmount),
      confidence: topValueHorse.confidence + 10,
      icon: BET_TYPE_CONFIG.place.icon,
    })
  }

  return bets
}

/**
 * Generate Tier 3 (Value Bombs) bet recommendations
 */
function generateTier3Bets(
  tierGroup: TierGroup,
  allHorses: ClassifiedHorse[]
): BetRecommendation[] {
  const bets: BetRecommendation[] = []
  const baseAmount = BASE_AMOUNTS.tier3
  const tier3Horses = tierGroup.horses

  if (tier3Horses.length === 0) return bets

  const bombHorse = tier3Horses[0]

  // 1. Small win bet (lottery ticket)
  const winAmount = baseAmount
  bets.push({
    type: 'win',
    typeName: BET_TYPE_CONFIG.win.name,
    description: `Lottery ticket: ${bombHorse.horse.horseName} at ${bombHorse.oddsDisplay}`,
    horses: [bombHorse],
    horseNumbers: [bombHorse.horse.programNumber],
    amount: winAmount,
    totalCost: winAmount,
    windowInstruction: generateWindowInstruction('win', [bombHorse], winAmount),
    potentialReturn: calculatePotentialReturn('win', [bombHorse], winAmount),
    confidence: bombHorse.confidence,
    icon: BET_TYPE_CONFIG.win.icon,
  })

  // 2. Exacta key over all others
  const otherHorses = allHorses
    .filter(h => h.horseIndex !== bombHorse.horseIndex)
    .slice(0, 5)

  if (otherHorses.length > 0) {
    const keyHorses = [bombHorse, ...otherHorses]
    const keyAmount = 1
    const keyCost = exactaKeyOverCost(otherHorses.length, keyAmount)
    bets.push({
      type: 'exacta_key_over',
      typeName: BET_TYPE_CONFIG.exacta_key_over.name,
      description: `Bomb on top over field for huge exacta`,
      horses: keyHorses,
      horseNumbers: keyHorses.map(h => h.horse.programNumber),
      amount: keyAmount,
      totalCost: keyCost,
      windowInstruction: generateWindowInstruction('exacta_key_over', keyHorses, keyAmount),
      potentialReturn: calculatePotentialReturn('exacta_key_over', keyHorses, keyCost),
      confidence: bombHorse.confidence - 15,
      icon: BET_TYPE_CONFIG.exacta_key_over.icon,
    })
  }

  // 3. Place bet (often better value for longshots)
  const placeAmount = baseAmount * 2
  bets.push({
    type: 'place',
    typeName: BET_TYPE_CONFIG.place.name,
    description: `Place bet on ${bombHorse.horse.horseName} - better value`,
    horses: [bombHorse],
    horseNumbers: [bombHorse.horse.programNumber],
    amount: placeAmount,
    totalCost: placeAmount,
    windowInstruction: generateWindowInstruction('place', [bombHorse], placeAmount),
    potentialReturn: calculatePotentialReturn('place', [bombHorse], placeAmount),
    confidence: bombHorse.confidence + 15,
    icon: BET_TYPE_CONFIG.place.icon,
  })

  // 4. Trifecta wheel (bomb with all for second, contenders for third)
  const topContenders = allHorses
    .filter(h => h.tier === 'tier1' || h.tier === 'tier2')
    .slice(0, 3)

  if (topContenders.length >= 2) {
    const wheelHorses = [bombHorse, ...topContenders]
    const wheelAmount = 1
    const wheelCost = topContenders.length * wheelAmount * 2 // Approximate
    bets.push({
      type: 'trifecta_wheel',
      typeName: BET_TYPE_CONFIG.trifecta_wheel.name,
      description: `Bomb trifecta wheel for jackpot`,
      horses: wheelHorses,
      horseNumbers: wheelHorses.map(h => h.horse.programNumber),
      amount: wheelAmount,
      totalCost: wheelCost,
      windowInstruction: generateWindowInstruction('trifecta_wheel', wheelHorses, wheelAmount),
      potentialReturn: calculatePotentialReturn('trifecta_wheel', wheelHorses, wheelCost),
      confidence: bombHorse.confidence - 20,
      icon: BET_TYPE_CONFIG.trifecta_wheel.icon,
    })
  }

  // 5. Superfecta coverage
  if (allHorses.length >= 4) {
    const superHorses = [bombHorse, ...allHorses.filter(h => h.horseIndex !== bombHorse.horseIndex).slice(0, 3)]
    const superAmount = 0.1
    const superCost = 2.40 // $0.10 box of 4
    bets.push({
      type: 'superfecta',
      typeName: BET_TYPE_CONFIG.superfecta.name,
      description: `Superfecta box with bomb included`,
      horses: superHorses,
      horseNumbers: superHorses.map(h => h.horse.programNumber),
      amount: superAmount,
      totalCost: superCost,
      windowInstruction: generateWindowInstruction('superfecta', superHorses, superAmount),
      potentialReturn: calculatePotentialReturn('superfecta', superHorses, superCost),
      confidence: bombHorse.confidence - 25,
      icon: BET_TYPE_CONFIG.superfecta.icon,
    })
  }

  return bets
}

/**
 * Generate all bet recommendations for a set of tier groups
 */
export function generateBetRecommendations(
  tierGroups: TierGroup[]
): TierBetRecommendations[] {
  const recommendations: TierBetRecommendations[] = []

  // Get all classified horses for cross-tier bets
  const allHorses = tierGroups.flatMap(g => g.horses)
  const tier1Group = tierGroups.find(g => g.tier === 'tier1')
  const tier1Horses = tier1Group?.horses || []

  for (const group of tierGroups) {
    let bets: BetRecommendation[] = []

    switch (group.tier) {
      case 'tier1':
        bets = generateTier1Bets(group, allHorses)
        break
      case 'tier2':
        bets = generateTier2Bets(group, tier1Horses)
        break
      case 'tier3':
        bets = generateTier3Bets(group, allHorses)
        break
    }

    const totalInvestment = bets.reduce((sum, bet) => sum + bet.totalCost, 0)
    const minReturn = bets.reduce((sum, bet) => sum + bet.potentialReturn.min, 0)
    const maxReturn = bets.reduce((sum, bet) => sum + bet.potentialReturn.max, 0)

    recommendations.push({
      tier: group.tier,
      tierName: group.name,
      description: group.description,
      bets,
      totalInvestment: Math.round(totalInvestment * 100) / 100,
      expectedHitRate: group.expectedHitRate,
      potentialReturnRange: {
        min: Math.round(minReturn),
        max: Math.round(maxReturn),
      },
    })
  }

  return recommendations
}

/**
 * Calculate bet sizing based on confidence and bankroll
 */
export function calculateBetSize(
  confidence: number,
  baseUnit: number = 10,
  maxUnits: number = 5
): number {
  // Scale bet size based on confidence (60-100% maps to 1-5 units)
  const normalizedConfidence = Math.max(0, Math.min(1, (confidence - 60) / 40))
  const units = 1 + normalizedConfidence * (maxUnits - 1)
  return Math.round(units * baseUnit)
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}
