/**
 * Class Extractor
 *
 * Extracts and analyzes class information from DRF past performances.
 * Determines class levels, movements, and hidden class drops.
 */

import type { HorseEntry, RaceHeader, PastPerformance, RaceClassification } from '../../types/drf'
import {
  ClassLevel,
  ClassMovement,
  ClassMovementDirection,
  ProvenAtLevelResult,
  HiddenClassDrop,
  HiddenDropType,
  ClassAnalysisResult,
  getMovementMagnitude,
  CLASS_LEVEL_METADATA,
} from './classTypes'
import { analyzeTrackTierMovement, getTrackTier, isShipperFromElite } from './trackTiers'

// ============================================================================
// CLASS LEVEL MAPPING
// ============================================================================

/**
 * Map DRF RaceClassification to our detailed ClassLevel
 */
function mapRaceClassificationToLevel(
  classification: RaceClassification,
  claimingPrice: number | null,
  purse: number
): ClassLevel {
  switch (classification) {
    case 'maiden-claiming':
      return ClassLevel.MAIDEN_CLAIMING

    case 'maiden':
      return ClassLevel.MAIDEN_SPECIAL_WEIGHT

    case 'claiming':
      return mapClaimingPriceToLevel(claimingPrice)

    case 'starter-allowance':
      return ClassLevel.STARTER_ALLOWANCE

    case 'allowance':
      // Try to detect N1X/N2X/N3X from purse if needed
      return detectAllowanceLevel(purse)

    case 'allowance-optional-claiming':
      return ClassLevel.ALLOWANCE_OPTIONAL_CLAIMING

    case 'stakes':
    case 'handicap':
      return ClassLevel.STAKES_UNGRADED

    case 'stakes-listed':
      return ClassLevel.STAKES_LISTED

    case 'stakes-graded-3':
      return ClassLevel.STAKES_GRADE_3

    case 'stakes-graded-2':
      return ClassLevel.STAKES_GRADE_2

    case 'stakes-graded-1':
      return ClassLevel.STAKES_GRADE_1

    case 'unknown':
    default:
      return ClassLevel.UNKNOWN
  }
}

/**
 * Map claiming price to detailed claiming level
 */
function mapClaimingPriceToLevel(claimingPrice: number | null): ClassLevel {
  if (claimingPrice === null) {
    return ClassLevel.CLAIMING_25K_TO_49K // Default mid-level
  }

  if (claimingPrice >= 100000) return ClassLevel.CLAIMING_100K_PLUS
  if (claimingPrice >= 50000) return ClassLevel.CLAIMING_50K_TO_99K
  if (claimingPrice >= 25000) return ClassLevel.CLAIMING_25K_TO_49K
  if (claimingPrice >= 10000) return ClassLevel.CLAIMING_10K_TO_24K
  return ClassLevel.CLAIMING_UNDER_10K
}

/**
 * Detect allowance restriction level from purse
 */
function detectAllowanceLevel(purse: number): ClassLevel {
  // Higher purses typically indicate fewer restrictions
  if (purse >= 125000) return ClassLevel.ALLOWANCE
  if (purse >= 100000) return ClassLevel.ALLOWANCE_N1X
  if (purse >= 75000) return ClassLevel.ALLOWANCE_N2X
  return ClassLevel.ALLOWANCE_N3X
}

// ============================================================================
// CLASS EXTRACTION
// ============================================================================

/**
 * Extract class level from a past performance
 */
export function extractClassFromPP(pp: PastPerformance): ClassLevel {
  return mapRaceClassificationToLevel(pp.classification, pp.claimingPrice, pp.purse)
}

/**
 * Extract class level from current race header
 */
export function extractCurrentRaceClass(raceHeader: RaceHeader): ClassLevel {
  const claimingPrice = raceHeader.claimingPriceMax ?? raceHeader.claimingPriceMin
  return mapRaceClassificationToLevel(raceHeader.classification, claimingPrice, raceHeader.purse)
}

/**
 * Get class levels from recent past performances
 */
export function getRecentClassLevels(
  pastPerformances: PastPerformance[],
  count: number = 3
): ClassLevel[] {
  return pastPerformances.slice(0, count).map(extractClassFromPP)
}

// ============================================================================
// CLASS MOVEMENT ANALYSIS
// ============================================================================

/**
 * Analyze class movement from last race to current
 */
export function analyzeClassMovement(
  currentClass: ClassLevel,
  lastRaceClass: ClassLevel | null
): ClassMovement {
  if (lastRaceClass === null) {
    return {
      direction: 'unknown',
      magnitude: 'minor',
      levelsDifference: 0,
      description: 'First race - class unknown',
      fromLevel: ClassLevel.UNKNOWN,
      toLevel: currentClass,
      claimingPriceDrop: null,
    }
  }

  const currentValue = CLASS_LEVEL_METADATA[currentClass].value
  const lastValue = CLASS_LEVEL_METADATA[lastRaceClass].value
  const levelsDifference = currentValue - lastValue

  let direction: ClassMovementDirection
  let description: string

  if (levelsDifference < 0) {
    direction = 'drop'
    description = `Dropping from ${CLASS_LEVEL_METADATA[lastRaceClass].abbrev} to ${CLASS_LEVEL_METADATA[currentClass].abbrev}`
  } else if (levelsDifference > 0) {
    direction = 'rise'
    description = `Rising from ${CLASS_LEVEL_METADATA[lastRaceClass].abbrev} to ${CLASS_LEVEL_METADATA[currentClass].abbrev}`
  } else {
    direction = 'lateral'
    description = `Same class: ${CLASS_LEVEL_METADATA[currentClass].abbrev}`
  }

  return {
    direction,
    magnitude: getMovementMagnitude(Math.abs(levelsDifference) / 5), // Normalize to level steps
    levelsDifference,
    description,
    fromLevel: lastRaceClass,
    toLevel: currentClass,
    claimingPriceDrop: null,
  }
}

/**
 * Analyze class movement with claiming price details
 */
export function analyzeClassMovementWithClaiming(
  currentClass: ClassLevel,
  currentClaimingPrice: number | null,
  lastRaceClass: ClassLevel | null,
  lastRaceClaimingPrice: number | null
): ClassMovement {
  const baseMovement = analyzeClassMovement(currentClass, lastRaceClass)

  // Check for claiming price drop
  let claimingPriceDrop: number | null = null
  if (currentClaimingPrice !== null && lastRaceClaimingPrice !== null) {
    const priceDifference = lastRaceClaimingPrice - currentClaimingPrice
    if (priceDifference > 0) {
      claimingPriceDrop = priceDifference
      baseMovement.description += ` (claiming drop: $${(priceDifference / 1000).toFixed(0)}K)`
    }
  }

  return {
    ...baseMovement,
    claimingPriceDrop,
  }
}

// ============================================================================
// PROVEN AT LEVEL ANALYSIS
// ============================================================================

/**
 * Analyze if horse has proven at the current class level
 */
export function analyzeProvenAtLevel(
  currentClass: ClassLevel,
  pastPerformances: PastPerformance[]
): ProvenAtLevelResult {
  const currentValue = CLASS_LEVEL_METADATA[currentClass].value

  let winsAtLevel = 0
  let itmAtLevel = 0
  let competitiveRacesAtLevel = 0
  let bestFinish: number | null = null
  let bestBeyerAtLevel: number | null = null

  for (const pp of pastPerformances) {
    const ppClass = extractClassFromPP(pp)
    const ppValue = CLASS_LEVEL_METADATA[ppClass].value

    // Only count races at same level or higher
    if (ppValue >= currentValue) {
      // Track wins
      if (pp.finishPosition === 1) {
        winsAtLevel++
      }

      // Track ITM (1st, 2nd, 3rd)
      if (pp.finishPosition <= 3) {
        itmAtLevel++
      }

      // Track competitive (within 5 lengths)
      if (pp.finishPosition <= 5 || pp.lengthsBehind <= 5) {
        competitiveRacesAtLevel++
      }

      // Track best finish
      if (bestFinish === null || pp.finishPosition < bestFinish) {
        bestFinish = pp.finishPosition
      }

      // Track best Beyer at level
      const ppBeyer = pp.speedFigures.beyer
      if (ppBeyer !== null && (bestBeyerAtLevel === null || ppBeyer > bestBeyerAtLevel)) {
        bestBeyerAtLevel = ppBeyer
      }
    }
  }

  return {
    hasWon: winsAtLevel > 0,
    winsAtLevel,
    hasPlaced: itmAtLevel > 0,
    itmAtLevel,
    wasCompetitive: competitiveRacesAtLevel > 0,
    competitiveRacesAtLevel,
    bestFinish,
    bestBeyerAtLevel,
  }
}

// ============================================================================
// HIDDEN CLASS DROP DETECTION
// ============================================================================

/**
 * Detect hidden class drops - value indicators not obvious from class level
 */
export function detectHiddenClassDrops(
  horse: HorseEntry,
  raceHeader: RaceHeader
): HiddenClassDrop[] {
  const drops: HiddenClassDrop[] = []
  const pps = horse.pastPerformances

  if (pps.length === 0) return drops

  const lastPP = pps[0]
  const currentTrack = raceHeader.trackCode

  // 1. Track tier drop (ran at better track, now at lesser track)
  const trackMovement = analyzeTrackTierMovement(lastPP.track, currentTrack)
  if (trackMovement && trackMovement.pointsAdjustment > 0) {
    drops.push({
      type: 'track_tier_drop',
      description: `Ran at ${lastPP.track} (${trackMovement.fromTier}), now at ${currentTrack} (${trackMovement.toTier})`,
      pointsBonus: trackMovement.pointsAdjustment,
      explanation: `Track tier drop from ${trackMovement.fromTier} to ${trackMovement.toTier} gives significant edge`,
    })
  }

  // 2. Check for shipper from elite track
  if (isShipperFromElite(lastPP.track, currentTrack)) {
    const alreadyHasTrackDrop = drops.some(d => d.type === 'track_tier_drop')
    if (!alreadyHasTrackDrop) {
      drops.push({
        type: 'shipper_from_elite',
        description: `Shipping from elite track ${lastPP.track}`,
        pointsBonus: 6,
        explanation: 'Horses from premier circuits often dominate at smaller venues',
      })
    }
  }

  // 3. Purse drop (ran for higher purse, now lower)
  const purgeDrop = lastPP.purse - raceHeader.purse
  if (purgeDrop >= 25000) {
    drops.push({
      type: 'purse_drop',
      description: `Purse drop: $${formatMoney(lastPP.purse)} → $${formatMoney(raceHeader.purse)}`,
      pointsBonus: Math.min(6, Math.floor(purgeDrop / 15000)),
      explanation: `Running for ${Math.round((purgeDrop / lastPP.purse) * 100)}% less purse indicates easier spot`,
    })
  }

  // 4. Significant claiming price drop
  const currentClaiming = raceHeader.claimingPriceMax ?? raceHeader.claimingPriceMin
  const lastClaiming = lastPP.claimingPrice

  if (currentClaiming !== null && lastClaiming !== null) {
    const claimingDrop = lastClaiming - currentClaiming
    if (claimingDrop >= 10000) {
      drops.push({
        type: 'claiming_price_drop',
        description: `Claiming drop: $${formatMoney(lastClaiming)} → $${formatMoney(currentClaiming)}`,
        pointsBonus: Math.min(12, Math.floor(claimingDrop / 5000)),
        explanation: `$${formatMoney(claimingDrop)} claiming price drop is significant value indicator`,
      })
    }
  }

  // 5. Check recent races for runner-up in key race indicators
  // Look for horses that ran 2nd to a next-out winner
  for (let i = 0; i < Math.min(3, pps.length); i++) {
    const pp = pps[i]
    if (pp.finishPosition === 2 && pp.lengthsBehind <= 2) {
      // Finished close 2nd - potential key race
      const ppClass = extractClassFromPP(pp)
      const currentClass = extractCurrentRaceClass(raceHeader)
      if (CLASS_LEVEL_METADATA[ppClass].value > CLASS_LEVEL_METADATA[currentClass].value) {
        drops.push({
          type: 'runner_up_key_race',
          description: `Close 2nd at higher class (${CLASS_LEVEL_METADATA[ppClass].abbrev})`,
          pointsBonus: 5,
          explanation: 'Ran 2nd within 2 lengths at higher class, now dropping',
        })
        break // Only count once
      }
    }
  }

  return drops
}

// ============================================================================
// COMPLETE CLASS ANALYSIS
// ============================================================================

/**
 * Perform complete class analysis for a horse
 */
export function analyzeClass(
  horse: HorseEntry,
  raceHeader: RaceHeader
): ClassAnalysisResult {
  const pps = horse.pastPerformances
  const currentClass = extractCurrentRaceClass(raceHeader)

  // Get recent class levels
  const recentClassLevels = getRecentClassLevels(pps, 3)
  const lastRaceClass = recentClassLevels.length > 0 ? recentClassLevels[0] : null

  // Analyze movement
  const currentClaimingPrice = raceHeader.claimingPriceMax ?? raceHeader.claimingPriceMin
  const lastClaimingPrice = pps.length > 0 ? pps[0].claimingPrice : null

  const movement = analyzeClassMovementWithClaiming(
    currentClass,
    currentClaimingPrice,
    lastRaceClass,
    lastClaimingPrice
  )

  // Analyze proven at level
  const provenAtLevel = analyzeProvenAtLevel(currentClass, pps)

  // Detect hidden drops
  const hiddenDrops = detectHiddenClassDrops(horse, raceHeader)

  // Track tier movement
  const trackTierMovement = pps.length > 0
    ? analyzeTrackTierMovement(pps[0].track, raceHeader.trackCode)
    : null

  // Build reasoning
  const reasoning: string[] = []

  if (provenAtLevel.hasWon) {
    reasoning.push(`Proven winner at this level (${provenAtLevel.winsAtLevel}W at class)`)
  } else if (provenAtLevel.hasPlaced) {
    reasoning.push(`Has placed at this level (${provenAtLevel.itmAtLevel} ITM)`)
  }

  if (movement.direction === 'drop') {
    reasoning.push(movement.description)
  } else if (movement.direction === 'rise') {
    reasoning.push(`Testing higher class: ${movement.description}`)
  }

  hiddenDrops.forEach(drop => {
    reasoning.push(`Hidden edge: ${drop.description}`)
  })

  // Calculate base class score (will be refined in classScoring.ts)
  let classScore = 10 // Base neutral score

  if (provenAtLevel.hasWon) classScore += 10
  else if (provenAtLevel.hasPlaced) classScore += 5
  else if (provenAtLevel.wasCompetitive) classScore += 3

  if (movement.direction === 'drop') {
    classScore += movement.magnitude === 'major' ? 3 : 5
  } else if (movement.direction === 'rise') {
    classScore -= movement.magnitude === 'major' ? 5 : 3
  }

  hiddenDrops.forEach(drop => {
    classScore += drop.pointsBonus
  })

  // Cap score at reasonable range
  classScore = Math.max(0, Math.min(20, classScore))

  return {
    currentClass,
    lastRaceClass,
    recentClassLevels,
    movement,
    provenAtLevel,
    hiddenDrops,
    trackTierMovement,
    classScore,
    reasoning,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format money for display
 */
function formatMoney(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`
  }
  return amount.toString()
}

/**
 * Get class level from DRF classification string
 * Handles various DRF race type strings
 */
export function parseClassFromConditions(conditions: string): ClassLevel {
  const cond = conditions.toLowerCase()

  // Grade stakes
  if (cond.includes('grade 1') || cond.includes('g1')) return ClassLevel.STAKES_GRADE_1
  if (cond.includes('grade 2') || cond.includes('g2')) return ClassLevel.STAKES_GRADE_2
  if (cond.includes('grade 3') || cond.includes('g3')) return ClassLevel.STAKES_GRADE_3
  if (cond.includes('listed')) return ClassLevel.STAKES_LISTED
  if (cond.includes('stakes') || cond.includes('stk')) return ClassLevel.STAKES_UNGRADED

  // AOC
  if (cond.includes('allowance optional claiming') || cond.includes('aoc')) {
    return ClassLevel.ALLOWANCE_OPTIONAL_CLAIMING
  }

  // Allowance with restrictions
  if (cond.includes('allowance')) {
    if (cond.includes('n1x') || cond.includes('nw1')) return ClassLevel.ALLOWANCE_N1X
    if (cond.includes('n2x') || cond.includes('nw2')) return ClassLevel.ALLOWANCE_N2X
    if (cond.includes('n3x') || cond.includes('nw3')) return ClassLevel.ALLOWANCE_N3X
    return ClassLevel.ALLOWANCE
  }

  // Starter allowance
  if (cond.includes('starter')) return ClassLevel.STARTER_ALLOWANCE

  // Maiden
  if (cond.includes('maiden')) {
    if (cond.includes('claiming') || cond.includes('mcl')) return ClassLevel.MAIDEN_CLAIMING
    return ClassLevel.MAIDEN_SPECIAL_WEIGHT
  }

  // Claiming - try to extract price
  if (cond.includes('claiming') || cond.includes('clm')) {
    const priceMatch = cond.match(/(\d{1,3}),?(\d{3})?/)
    if (priceMatch) {
      const price = parseInt(priceMatch[0].replace(',', ''))
      return mapClaimingPriceToLevel(price)
    }
    return ClassLevel.CLAIMING_25K_TO_49K
  }

  return ClassLevel.UNKNOWN
}
