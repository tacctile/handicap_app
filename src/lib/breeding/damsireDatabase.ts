/**
 * Damsire (Broodmare Sire) Database
 *
 * Profiles for notable broodmare sires.
 * The damsire (maternal grandsire) influences stamina, surface preference,
 * and overall class through daughters.
 *
 * Score damsires (0-15 pts):
 * - Elite (12-15): Proven broodmare sire, multiple champions through daughters
 * - Strong (8-11): Consistent producer of quality runners through daughters
 * - Average (4-7): Acceptable broodmare sire
 * - Below Average (0-3): Limited success as broodmare sire
 */

import type { DamsireProfile } from './types'

// ============================================================================
// DAMSIRE TIER CONSTANTS
// ============================================================================

export const DAMSIRE_TIER_THRESHOLDS = {
  elite: { minIndex: 1.5, minScore: 12, maxScore: 15 },
  strong: { minIndex: 1.2, minScore: 8, maxScore: 11 },
  average: { minIndex: 0.9, minScore: 4, maxScore: 7 },
  belowAverage: { minIndex: 0, minScore: 0, maxScore: 3 },
} as const

export type DamsireTier = keyof typeof DAMSIRE_TIER_THRESHOLDS

// ============================================================================
// EXTENDED DAMSIRE PROFILE
// ============================================================================

export interface ExtendedDamsireProfile extends DamsireProfile {
  /** Damsire tier classification */
  tier: DamsireTier
  /** Base score for this damsire (0-15) */
  baseScore: number
  /** Notable offspring through daughters */
  notableThroughDaughters: string[]
  /** Brief notes */
  notes: string
}

// ============================================================================
// DAMSIRE DATABASE
// ============================================================================

/**
 * Broodmare Sire Database
 * Data reflects influence through daughters on 2023-2024 performers
 */
export const DAMSIRE_DATABASE: Record<string, ExtendedDamsireProfile> = {
  // ========================================================================
  // ELITE TIER (12-15 points)
  // ========================================================================

  'A.P. INDY': {
    name: 'A.P. Indy',
    broodmareSireIndex: 2.0,
    surfaceInfluence: 'dirt',
    staminaInfluence: 75,
    isKnown: true,
    tier: 'elite',
    baseScore: 15,
    notableThroughDaughters: ['Essential Quality', 'Honor Code', 'Bernardini'],
    notes: 'Elite broodmare sire, stamina and class influence',
  },

  'GIANT\'S CAUSEWAY': {
    name: 'Giant\'s Causeway',
    broodmareSireIndex: 1.9,
    surfaceInfluence: 'versatile',
    staminaInfluence: 70,
    isKnown: true,
    tier: 'elite',
    baseScore: 15,
    notableThroughDaughters: ['Caravel', 'Shamrock Rose'],
    notes: 'Versatile broodmare sire, international influence',
  },

  'UNBRIDLED\'S SONG': {
    name: 'Unbridled\'s Song',
    broodmareSireIndex: 1.85,
    surfaceInfluence: 'dirt',
    staminaInfluence: 65,
    isKnown: true,
    tier: 'elite',
    baseScore: 14,
    notableThroughDaughters: ['Arrogate', 'Liam\'s Map'],
    notes: 'Strong dirt influence, classic stamina',
  },

  'STORM CAT': {
    name: 'Storm Cat',
    broodmareSireIndex: 1.85,
    surfaceInfluence: 'versatile',
    staminaInfluence: 60,
    isKnown: true,
    tier: 'elite',
    baseScore: 14,
    notableThroughDaughters: ['Nyquist', 'Lookin At Lucky'],
    notes: 'Elite overall influence, speed and class',
  },

  'STREET CRY': {
    name: 'Street Cry',
    broodmareSireIndex: 1.75,
    surfaceInfluence: 'versatile',
    staminaInfluence: 70,
    isKnown: true,
    tier: 'elite',
    baseScore: 14,
    notableThroughDaughters: ['Zenyatta', 'Winx'],
    notes: 'International broodmare sire, stamina',
  },

  'DISTORTED HUMOR': {
    name: 'Distorted Humor',
    broodmareSireIndex: 1.7,
    surfaceInfluence: 'dirt',
    staminaInfluence: 62,
    isKnown: true,
    tier: 'elite',
    baseScore: 13,
    notableThroughDaughters: ['Gun Runner', 'Code of Honor'],
    notes: 'Strong dirt broodmare sire',
  },

  'TAPIT': {
    name: 'Tapit',
    broodmareSireIndex: 1.65,
    surfaceInfluence: 'dirt',
    staminaInfluence: 68,
    isKnown: true,
    tier: 'elite',
    baseScore: 13,
    notableThroughDaughters: ['Forte', 'Knicks Go'],
    notes: 'Rising broodmare sire, quality influence',
  },

  'EMPIRE MAKER': {
    name: 'Empire Maker',
    broodmareSireIndex: 1.6,
    surfaceInfluence: 'dirt',
    staminaInfluence: 72,
    isKnown: true,
    tier: 'elite',
    baseScore: 13,
    notableThroughDaughters: ['American Pharoah', 'Country House'],
    notes: 'Stamina influence, classic types',
  },

  'MEDAGLIA D\'ORO': {
    name: 'Medaglia d\'Oro',
    broodmareSireIndex: 1.55,
    surfaceInfluence: 'versatile',
    staminaInfluence: 68,
    isKnown: true,
    tier: 'elite',
    baseScore: 12,
    notableThroughDaughters: ['Violence', 'Midnight Bourbon'],
    notes: 'Versatile influence, developing',
  },

  'SMART STRIKE': {
    name: 'Smart Strike',
    broodmareSireIndex: 1.55,
    surfaceInfluence: 'dirt',
    staminaInfluence: 65,
    isKnown: true,
    tier: 'elite',
    baseScore: 12,
    notableThroughDaughters: ['Curlin', 'English Channel'],
    notes: 'Quality broodmare sire, class influence',
  },

  // ========================================================================
  // STRONG TIER (8-11 points)
  // ========================================================================

  'PULPIT': {
    name: 'Pulpit',
    broodmareSireIndex: 1.45,
    surfaceInfluence: 'dirt',
    staminaInfluence: 65,
    isKnown: true,
    tier: 'strong',
    baseScore: 11,
    notableThroughDaughters: ['Authentic', 'Life Is Good'],
    notes: 'Solid broodmare sire, Into Mischief success',
  },

  'MORE THAN READY': {
    name: 'More Than Ready',
    broodmareSireIndex: 1.4,
    surfaceInfluence: 'versatile',
    staminaInfluence: 55,
    isKnown: true,
    tier: 'strong',
    baseScore: 11,
    notableThroughDaughters: ['Mandaloun', 'Verrazano'],
    notes: 'Speed influence, versatile surface',
  },

  'TIZNOW': {
    name: 'Tiznow',
    broodmareSireIndex: 1.4,
    surfaceInfluence: 'dirt',
    staminaInfluence: 70,
    isKnown: true,
    tier: 'strong',
    baseScore: 11,
    notableThroughDaughters: ['Tourist', 'Destin'],
    notes: 'Stamina influence, Breeders\' Cup type',
  },

  'SPEIGHTSTOWN': {
    name: 'Speightstown',
    broodmareSireIndex: 1.35,
    surfaceInfluence: 'dirt',
    staminaInfluence: 50,
    isKnown: true,
    tier: 'strong',
    baseScore: 10,
    notableThroughDaughters: ['Mo Town', 'Hit Show'],
    notes: 'Sprint influence, early speed',
  },

  'DEPUTY MINISTER': {
    name: 'Deputy Minister',
    broodmareSireIndex: 1.35,
    surfaceInfluence: 'dirt',
    staminaInfluence: 60,
    isKnown: true,
    tier: 'strong',
    baseScore: 10,
    notableThroughDaughters: ['Touch Gold', 'Awesome Again'],
    notes: 'Classic broodmare sire influence',
  },

  'CANDY RIDE': {
    name: 'Candy Ride',
    broodmareSireIndex: 1.35,
    surfaceInfluence: 'dirt',
    staminaInfluence: 68,
    isKnown: true,
    tier: 'strong',
    baseScore: 10,
    notableThroughDaughters: ['Epicenter'],
    notes: 'Developing broodmare sire, stamina',
  },

  'WAR FRONT': {
    name: 'War Front',
    broodmareSireIndex: 1.3,
    surfaceInfluence: 'turf',
    staminaInfluence: 58,
    isKnown: true,
    tier: 'strong',
    baseScore: 10,
    notableThroughDaughters: [],
    notes: 'Turf influence, quality runners',
  },

  'CURLIN': {
    name: 'Curlin',
    broodmareSireIndex: 1.3,
    surfaceInfluence: 'dirt',
    staminaInfluence: 75,
    isKnown: true,
    tier: 'strong',
    baseScore: 10,
    notableThroughDaughters: ['Nest', 'Cody\'s Wish'],
    notes: 'Rising broodmare sire, stamina',
  },

  'BERNARDINI': {
    name: 'Bernardini',
    broodmareSireIndex: 1.28,
    surfaceInfluence: 'dirt',
    staminaInfluence: 70,
    isKnown: true,
    tier: 'strong',
    baseScore: 9,
    notableThroughDaughters: ['Fierceness', 'Mischevious Alex'],
    notes: 'Solid broodmare sire, Gun Runner success',
  },

  'KITTEN\'S JOY': {
    name: 'Kitten\'s Joy',
    broodmareSireIndex: 1.25,
    surfaceInfluence: 'turf',
    staminaInfluence: 72,
    isKnown: true,
    tier: 'strong',
    baseScore: 9,
    notableThroughDaughters: ['Domestic Spending'],
    notes: 'Turf broodmare sire, stamina',
  },

  'MALIBU MOON': {
    name: 'Malibu Moon',
    broodmareSireIndex: 1.22,
    surfaceInfluence: 'dirt',
    staminaInfluence: 60,
    isKnown: true,
    tier: 'strong',
    baseScore: 9,
    notableThroughDaughters: ['Orb', 'Declan\'s Moon'],
    notes: 'Solid broodmare sire influence',
  },

  'ELUSIVE QUALITY': {
    name: 'Elusive Quality',
    broodmareSireIndex: 1.2,
    surfaceInfluence: 'versatile',
    staminaInfluence: 55,
    isKnown: true,
    tier: 'strong',
    baseScore: 8,
    notableThroughDaughters: ['Authentic', 'Swiss Skydiver'],
    notes: 'Quality broodmare sire, versatile',
  },

  'STREET SENSE': {
    name: 'Street Sense',
    broodmareSireIndex: 1.2,
    surfaceInfluence: 'dirt',
    staminaInfluence: 65,
    isKnown: true,
    tier: 'strong',
    baseScore: 8,
    notableThroughDaughters: ['Mystik Dan'],
    notes: 'Developing broodmare sire',
  },

  // ========================================================================
  // AVERAGE TIER (4-7 points)
  // ========================================================================

  'INDIAN CHARLIE': {
    name: 'Indian Charlie',
    broodmareSireIndex: 1.1,
    surfaceInfluence: 'dirt',
    staminaInfluence: 55,
    isKnown: true,
    tier: 'average',
    baseScore: 7,
    notableThroughDaughters: ['Good Magic'],
    notes: 'Uncle Mo connection, moderate influence',
  },

  'HARD SPUN': {
    name: 'Hard Spun',
    broodmareSireIndex: 1.08,
    surfaceInfluence: 'dirt',
    staminaInfluence: 60,
    isKnown: true,
    tier: 'average',
    baseScore: 7,
    notableThroughDaughters: [],
    notes: 'Developing as broodmare sire',
  },

  'UNCLE MO': {
    name: 'Uncle Mo',
    broodmareSireIndex: 1.08,
    surfaceInfluence: 'dirt',
    staminaInfluence: 55,
    isKnown: true,
    tier: 'average',
    baseScore: 7,
    notableThroughDaughters: [],
    notes: 'Young as broodmare sire, precocity',
  },

  'QUIET AMERICAN': {
    name: 'Quiet American',
    broodmareSireIndex: 1.05,
    surfaceInfluence: 'dirt',
    staminaInfluence: 58,
    isKnown: true,
    tier: 'average',
    baseScore: 6,
    notableThroughDaughters: ['Real Quiet'],
    notes: 'Solid broodmare sire, moderate',
  },

  'AWESOME AGAIN': {
    name: 'Awesome Again',
    broodmareSireIndex: 1.05,
    surfaceInfluence: 'dirt',
    staminaInfluence: 62,
    isKnown: true,
    tier: 'average',
    baseScore: 6,
    notableThroughDaughters: ['Ghostzapper'],
    notes: 'Moderate broodmare sire influence',
  },

  'THUNDER GULCH': {
    name: 'Thunder Gulch',
    broodmareSireIndex: 1.0,
    surfaceInfluence: 'dirt',
    staminaInfluence: 65,
    isKnown: true,
    tier: 'average',
    baseScore: 5,
    notableThroughDaughters: [],
    notes: 'Derby winner, moderate broodmare sire',
  },

  'FUSAICHI PEGASUS': {
    name: 'Fusaichi Pegasus',
    broodmareSireIndex: 0.98,
    surfaceInfluence: 'dirt',
    staminaInfluence: 60,
    isKnown: true,
    tier: 'average',
    baseScore: 5,
    notableThroughDaughters: ['Roman Ruler'],
    notes: 'Derby winner, limited broodmare success',
  },

  'GONE WEST': {
    name: 'Gone West',
    broodmareSireIndex: 0.95,
    surfaceInfluence: 'versatile',
    staminaInfluence: 55,
    isKnown: true,
    tier: 'average',
    baseScore: 5,
    notableThroughDaughters: [],
    notes: 'Speed influence, moderate overall',
  },

  'TALE OF THE CAT': {
    name: 'Tale of the Cat',
    broodmareSireIndex: 0.95,
    surfaceInfluence: 'dirt',
    staminaInfluence: 52,
    isKnown: true,
    tier: 'average',
    baseScore: 5,
    notableThroughDaughters: ['Midnight Bourbon'],
    notes: 'Speed influence, some success',
  },

  'SILVER DEPUTY': {
    name: 'Silver Deputy',
    broodmareSireIndex: 0.92,
    surfaceInfluence: 'dirt',
    staminaInfluence: 58,
    isKnown: true,
    tier: 'average',
    baseScore: 4,
    notableThroughDaughters: [],
    notes: 'Moderate broodmare sire',
  },

  // ========================================================================
  // BELOW AVERAGE TIER (0-3 points)
  // ========================================================================

  'APTITUDE': {
    name: 'Aptitude',
    broodmareSireIndex: 0.85,
    surfaceInfluence: 'dirt',
    staminaInfluence: 60,
    isKnown: true,
    tier: 'belowAverage',
    baseScore: 3,
    notableThroughDaughters: [],
    notes: 'Limited broodmare sire success',
  },

  'POINT GIVEN': {
    name: 'Point Given',
    broodmareSireIndex: 0.82,
    surfaceInfluence: 'dirt',
    staminaInfluence: 68,
    isKnown: true,
    tier: 'belowAverage',
    baseScore: 2,
    notableThroughDaughters: [],
    notes: 'Champion, limited stud success',
  },
}

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Normalize a damsire name for database lookup
 */
export function normalizeDamsireName(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/['']/g, '\'')
    .replace(/\s+/g, ' ')
}

/**
 * Look up a damsire in the database
 * Returns the damsire profile if found, null otherwise
 */
export function lookupDamsire(damsireName: string): ExtendedDamsireProfile | null {
  const normalized = normalizeDamsireName(damsireName)
  return DAMSIRE_DATABASE[normalized] || null
}

/**
 * Get all damsire names in the database
 */
export function getAllDamsireNames(): string[] {
  return Object.keys(DAMSIRE_DATABASE)
}

/**
 * Calculate damsire score for breeding analysis
 *
 * @param damsireName - Name of the damsire
 * @param context - Optional context for bonus calculations
 * @returns Damsire score (0-15) and profile
 */
export function calculateDamsireScore(
  damsireName: string,
  context?: {
    surface?: string
    isRoute?: boolean
  }
): { score: number; profile: ExtendedDamsireProfile | null; reasoning: string } {
  const profile = lookupDamsire(damsireName)

  if (!profile) {
    // Unknown damsire - give baseline score
    return {
      score: 5,
      profile: null,
      reasoning: `Unknown damsire - baseline score`,
    }
  }

  let score = profile.baseScore
  const reasons: string[] = [`${profile.name}: ${profile.tier} damsire (base ${profile.baseScore})`]

  // Surface fit bonus
  if (context?.surface && profile.surfaceInfluence !== 'versatile' && profile.surfaceInfluence !== 'unknown') {
    const surfaceLower = context.surface.toLowerCase()
    if (
      (surfaceLower === 'turf' && profile.surfaceInfluence === 'turf') ||
      (surfaceLower === 'dirt' && profile.surfaceInfluence === 'dirt')
    ) {
      score += 1
      reasons.push(`+1 surface fit`)
    }
  }

  // Stamina influence for routes
  if (context?.isRoute && profile.staminaInfluence >= 70) {
    score += 1
    reasons.push(`+1 stamina for route`)
  }

  // Cap at 15
  score = Math.min(15, Math.max(0, score))

  return {
    score,
    profile,
    reasoning: reasons.join('; '),
  }
}

/**
 * Get tier label for display
 */
export function getDamsireTierLabel(tier: DamsireTier): string {
  switch (tier) {
    case 'elite': return 'Elite BMS'
    case 'strong': return 'Strong BMS'
    case 'average': return 'Average BMS'
    case 'belowAverage': return 'Below Avg'
  }
}

/**
 * Get tier color for display
 */
export function getDamsireTierColor(tier: DamsireTier): string {
  switch (tier) {
    case 'elite': return '#22c55e'
    case 'strong': return '#36d1da'
    case 'average': return '#888888'
    case 'belowAverage': return '#ef4444'
  }
}
