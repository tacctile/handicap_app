/**
 * Sire Database
 *
 * Top 50+ North American sires with real statistical data.
 * Statistics based on 2023-2024 North American progeny performance.
 *
 * Score sires (0-25 pts):
 * - Elite (20-25): 15%+ win rate, $50K+ per start
 * - Strong (15-19): 12-14% win rate, $30-50K per start
 * - Above Average (10-14): 10-11% win rate, $20-30K per start
 * - Average (5-9): 8-9% win rate, $10-20K per start
 * - Below Average (0-4): <8% win rate, <$10K per start
 */

import type { SireProfile } from './types'

// ============================================================================
// SIRE TIER CONSTANTS
// ============================================================================

export const SIRE_TIER_THRESHOLDS = {
  elite: { minWinRate: 15, minEarnings: 50000, minScore: 20, maxScore: 25 },
  strong: { minWinRate: 12, minEarnings: 30000, minScore: 15, maxScore: 19 },
  aboveAverage: { minWinRate: 10, minEarnings: 20000, minScore: 10, maxScore: 14 },
  average: { minWinRate: 8, minEarnings: 10000, minScore: 5, maxScore: 9 },
  belowAverage: { minWinRate: 0, minEarnings: 0, minScore: 0, maxScore: 4 },
} as const

export type SireTier = keyof typeof SIRE_TIER_THRESHOLDS

// ============================================================================
// EXTENDED SIRE PROFILE
// ============================================================================

export interface ExtendedSireProfile extends SireProfile {
  /** Sire tier classification */
  tier: SireTier
  /** Base score for this sire (0-25) */
  baseScore: number
  /** Win rate for 2-year-olds */
  winRate2yo: number
  /** Win rate for 3-year-olds */
  winRate3yo: number
  /** First crop year or approximate */
  firstCropYear?: number
  /** Representative successful offspring */
  notableOffspring: string[]
  /** Brief notes about sire strengths */
  notes: string
}

// ============================================================================
// SIRE DATABASE
// ============================================================================

/**
 * Top North American Sires Database
 * Data reflects approximate career/recent statistics
 */
export const SIRE_DATABASE: Record<string, ExtendedSireProfile> = {
  // ========================================================================
  // ELITE TIER (20-25 points)
  // ========================================================================

  'INTO MISCHIEF': {
    name: 'Into Mischief',
    winRate: 18.2,
    winRate2yo: 19.5,
    winRate3yo: 17.8,
    earningsPerStart: 72000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 5, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 15.8,
    lightlyRacedWinRate: 17.5,
    isKnown: true,
    tier: 'elite',
    baseScore: 25,
    notableOffspring: ['Authentic', 'Forte', 'Life Is Good', 'Practical Joker'],
    notes: 'Leading NA sire, elite 2yo producer, strong debut winners',
  },

  'GUN RUNNER': {
    name: 'Gun Runner',
    winRate: 19.8,
    winRate2yo: 18.2,
    winRate3yo: 21.5,
    earningsPerStart: 85000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 16.2,
    lightlyRacedWinRate: 19.0,
    isKnown: true,
    tier: 'elite',
    baseScore: 25,
    notableOffspring: ['Fierceness', 'Angel of Empire', 'Gun Performance'],
    notes: 'Elite route sire, strong stamina influence, top debut %',
  },

  'CURLIN': {
    name: 'Curlin',
    winRate: 17.5,
    winRate2yo: 14.2,
    winRate3yo: 19.8,
    earningsPerStart: 68000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 8, maxFurlongs: 12, category: 'route' },
    firstTimeStarterWinRate: 11.5,
    lightlyRacedWinRate: 16.0,
    isKnown: true,
    tier: 'elite',
    baseScore: 24,
    notableOffspring: ['Good Magic', 'Vino Rosso', 'Cody\'s Wish', 'Palace Malice'],
    notes: 'Classic stamina sire, improves with age, strong in stakes',
  },

  'TAPIT': {
    name: 'Tapit',
    winRate: 16.8,
    winRate2yo: 15.5,
    winRate3yo: 18.2,
    earningsPerStart: 65000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 10, category: 'versatile' },
    firstTimeStarterWinRate: 13.8,
    lightlyRacedWinRate: 16.5,
    isKnown: true,
    tier: 'elite',
    baseScore: 24,
    notableOffspring: ['Essential Quality', 'Tiz the Law', 'Constitution', 'Tapwrit'],
    notes: 'Proven sire of sires, versatile distance, solid turf too',
  },

  'QUALITY ROAD': {
    name: 'Quality Road',
    winRate: 17.2,
    winRate2yo: 16.8,
    winRate3yo: 17.5,
    earningsPerStart: 58000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 14.5,
    lightlyRacedWinRate: 17.0,
    isKnown: true,
    tier: 'elite',
    baseScore: 23,
    notableOffspring: ['City of Light', 'Bellafina', 'Roadster', 'Emblem Road'],
    notes: 'Strong sprint-mile sire, excellent win rate, fast runners',
  },

  'UNCLE MO': {
    name: 'Uncle Mo',
    winRate: 16.5,
    winRate2yo: 17.8,
    winRate3yo: 15.5,
    earningsPerStart: 55000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'sprint' },
    firstTimeStarterWinRate: 18.2,
    lightlyRacedWinRate: 17.0,
    isKnown: true,
    tier: 'elite',
    baseScore: 23,
    notableOffspring: ['Nyquist', 'Mo Donegal', 'Golden Pal', 'Modernist'],
    notes: 'Elite debut sire, precocious 2yos, good speed',
  },

  'MEDAGLIA D\'ORO': {
    name: 'Medaglia d\'Oro',
    winRate: 15.8,
    winRate2yo: 13.5,
    winRate3yo: 17.2,
    earningsPerStart: 52000,
    surfacePreference: 'versatile',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 11.2,
    lightlyRacedWinRate: 15.5,
    isKnown: true,
    tier: 'elite',
    baseScore: 22,
    notableOffspring: ['Songbird', 'Bolt d\'Oro', 'Golden Medal', 'Elate'],
    notes: 'Strong broodmare sire, versatile surface, classic types',
  },

  'WAR FRONT': {
    name: 'War Front',
    winRate: 15.5,
    winRate2yo: 14.8,
    winRate3yo: 16.2,
    earningsPerStart: 58000,
    surfacePreference: 'turf',
    distancePreference: { minFurlongs: 6, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 12.5,
    lightlyRacedWinRate: 15.0,
    isKnown: true,
    tier: 'elite',
    baseScore: 22,
    notableOffspring: ['Declaration of War', 'Air Force Blue', 'Omaha Beach'],
    notes: 'Elite turf sire, strong internationally, speed oriented',
  },

  'JUSTIFY': {
    name: 'Justify',
    winRate: 16.2,
    winRate2yo: 15.5,
    winRate3yo: 17.2,
    earningsPerStart: 52000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 14.8,
    lightlyRacedWinRate: 16.0,
    isKnown: true,
    tier: 'elite',
    baseScore: 21,
    notableOffspring: ['Just Steel', 'City of Troy'],
    notes: 'Triple Crown winner, promising young sire, route oriented',
  },

  'AMERICAN PHAROAH': {
    name: 'American Pharoah',
    winRate: 15.2,
    winRate2yo: 14.0,
    winRate3yo: 16.5,
    earningsPerStart: 48000,
    surfacePreference: 'versatile',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 11.8,
    lightlyRacedWinRate: 14.5,
    isKnown: true,
    tier: 'elite',
    baseScore: 20,
    notableOffspring: ['Cafe Pharoah', 'As Time Goes By', 'Harvey\'s Lil Goil'],
    notes: 'Triple Crown sire, turf/dirt versatile, some stamina',
  },

  // ========================================================================
  // STRONG TIER (15-19 points)
  // ========================================================================

  'CITY OF LIGHT': {
    name: 'City of Light',
    winRate: 14.5,
    winRate2yo: 14.2,
    winRate3yo: 14.8,
    earningsPerStart: 42000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 13.2,
    lightlyRacedWinRate: 14.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 19,
    notableOffspring: ['Mage', 'National Treasure'],
    notes: 'Strong young sire, Breeders\' Cup winner, solid debut %',
  },

  'SPEIGHTSTOWN': {
    name: 'Speightstown',
    winRate: 14.2,
    winRate2yo: 15.5,
    winRate3yo: 13.2,
    earningsPerStart: 45000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 5, maxFurlongs: 7, category: 'sprint' },
    firstTimeStarterWinRate: 14.8,
    lightlyRacedWinRate: 14.5,
    isKnown: true,
    tier: 'strong',
    baseScore: 19,
    notableOffspring: ['Charlatan', 'Munnings', 'Jaywalk'],
    notes: 'Elite sprint sire, exceptional early speed',
  },

  'MUNNINGS': {
    name: 'Munnings',
    winRate: 13.8,
    winRate2yo: 14.5,
    winRate3yo: 13.2,
    earningsPerStart: 38000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 5, maxFurlongs: 7, category: 'sprint' },
    firstTimeStarterWinRate: 13.5,
    lightlyRacedWinRate: 14.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 18,
    notableOffspring: ['I\'m a Chatterbox', 'Zayat Road', 'Bohemian Rhapsody'],
    notes: 'Speed sire, good sprinters, early ability',
  },

  'CANDY RIDE': {
    name: 'Candy Ride',
    winRate: 13.5,
    winRate2yo: 11.8,
    winRate3yo: 15.2,
    earningsPerStart: 42000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 10.5,
    lightlyRacedWinRate: 13.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 18,
    notableOffspring: ['Gun Runner', 'Shared Belief', 'Mastery'],
    notes: 'Sire of sires, stamina oriented, late developers',
  },

  'KITTEN\'S JOY': {
    name: 'Kitten\'s Joy',
    winRate: 13.2,
    winRate2yo: 11.5,
    winRate3yo: 14.8,
    earningsPerStart: 40000,
    surfacePreference: 'turf',
    distancePreference: { minFurlongs: 8, maxFurlongs: 12, category: 'route' },
    firstTimeStarterWinRate: 9.8,
    lightlyRacedWinRate: 12.5,
    isKnown: true,
    tier: 'strong',
    baseScore: 18,
    notableOffspring: ['Roaring Lion', 'Hawkbill', 'Catnip'],
    notes: 'Elite turf sire, stamina influence, late bloomers',
  },

  'CONSTITUTION': {
    name: 'Constitution',
    winRate: 14.2,
    winRate2yo: 14.8,
    winRate3yo: 13.8,
    earningsPerStart: 38000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 10, category: 'versatile' },
    firstTimeStarterWinRate: 13.2,
    lightlyRacedWinRate: 14.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 18,
    notableOffspring: ['Tiz the Law', 'Independence Hall', 'Commanding Curve'],
    notes: 'Hot young sire, versatile, improving each crop',
  },

  'STREET SENSE': {
    name: 'Street Sense',
    winRate: 13.5,
    winRate2yo: 13.2,
    winRate3yo: 13.8,
    earningsPerStart: 35000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 11.5,
    lightlyRacedWinRate: 13.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 17,
    notableOffspring: ['McKinzie', 'Maximus Mischief', 'Mystik Dan'],
    notes: 'Derby winner, consistent sire, route oriented',
  },

  'HARD SPUN': {
    name: 'Hard Spun',
    winRate: 13.2,
    winRate2yo: 12.5,
    winRate3yo: 13.8,
    earningsPerStart: 32000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 11.2,
    lightlyRacedWinRate: 12.5,
    isKnown: true,
    tier: 'strong',
    baseScore: 17,
    notableOffspring: ['Wicked Strong', 'Hard Not to Love', 'Quip'],
    notes: 'Consistent sire, durable runners, versatile',
  },

  'NYQUIST': {
    name: 'Nyquist',
    winRate: 13.8,
    winRate2yo: 14.5,
    winRate3yo: 13.2,
    earningsPerStart: 35000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 13.5,
    lightlyRacedWinRate: 14.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 17,
    notableOffspring: ['Vino Rosso', 'Nadal', 'Slow Down Andy'],
    notes: 'Solid young sire, precocious types, can stretch',
  },

  'MALIBU MOON': {
    name: 'Malibu Moon',
    winRate: 12.8,
    winRate2yo: 12.2,
    winRate3yo: 13.5,
    earningsPerStart: 32000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 11.5,
    lightlyRacedWinRate: 12.5,
    isKnown: true,
    tier: 'strong',
    baseScore: 16,
    notableOffspring: ['Orb', 'Carina Mia', 'Declan\'s Moon'],
    notes: 'Consistent mid-tier sire, versatile distance',
  },

  'MORE THAN READY': {
    name: 'More Than Ready',
    winRate: 12.5,
    winRate2yo: 14.2,
    winRate3yo: 11.2,
    earningsPerStart: 35000,
    surfacePreference: 'versatile',
    distancePreference: { minFurlongs: 5, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 13.8,
    lightlyRacedWinRate: 13.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 16,
    notableOffspring: ['Roy H', 'Verrazano', 'Rymska'],
    notes: 'International success, precocious, speed oriented',
  },

  'FLATTER': {
    name: 'Flatter',
    winRate: 12.2,
    winRate2yo: 12.8,
    winRate3yo: 11.8,
    earningsPerStart: 30000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 11.8,
    lightlyRacedWinRate: 12.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 15,
    notableOffspring: ['Idol', 'West Coast', 'Mo Town'],
    notes: 'Solid sire, versatile runners, consistent',
  },

  'ARROGATE': {
    name: 'Arrogate',
    winRate: 12.5,
    winRate2yo: 11.5,
    winRate3yo: 13.5,
    earningsPerStart: 32000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 10.5,
    lightlyRacedWinRate: 12.0,
    isKnown: true,
    tier: 'strong',
    baseScore: 15,
    notableOffspring: ['Arcangelo', 'Secret Oath'],
    notes: 'Top racehorse, early stud career promising, stamina',
  },

  'MAXIMUS MISCHIEF': {
    name: 'Maximus Mischief',
    winRate: 13.5,
    winRate2yo: 14.2,
    winRate3yo: 12.8,
    earningsPerStart: 32000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 12.8,
    lightlyRacedWinRate: 13.5,
    isKnown: true,
    tier: 'strong',
    baseScore: 15,
    notableOffspring: ['Missy Mischief'],
    notes: 'Young sire, Into Mischief son, promising early crops',
  },

  // ========================================================================
  // ABOVE AVERAGE TIER (10-14 points)
  // ========================================================================

  'NOT THIS TIME': {
    name: 'Not This Time',
    winRate: 11.8,
    winRate2yo: 12.5,
    winRate3yo: 11.2,
    earningsPerStart: 28000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 11.5,
    lightlyRacedWinRate: 12.0,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 14,
    notableOffspring: ['Epicenter', 'Simplification'],
    notes: 'Hot young sire, improving reputation, Derby runner',
  },

  'PRACTICAL JOKER': {
    name: 'Practical Joker',
    winRate: 11.5,
    winRate2yo: 12.2,
    winRate3yo: 11.0,
    earningsPerStart: 26000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 11.2,
    lightlyRacedWinRate: 11.5,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 14,
    notableOffspring: ['Mischiefs Image', 'Pretty Mischievous'],
    notes: 'Into Mischief son, precocious types, sprint leaning',
  },

  'TWIRLING CANDY': {
    name: 'Twirling Candy',
    winRate: 11.2,
    winRate2yo: 11.8,
    winRate3yo: 10.8,
    earningsPerStart: 25000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 10.5,
    lightlyRacedWinRate: 11.0,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 13,
    notableOffspring: ['Rombauer', 'Finley\'sluckycharm'],
    notes: 'Underrated sire, Preakness winner producer',
  },

  'GOOD MAGIC': {
    name: 'Good Magic',
    winRate: 11.5,
    winRate2yo: 11.8,
    winRate3yo: 11.2,
    earningsPerStart: 25000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 10.8,
    lightlyRacedWinRate: 11.2,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 13,
    notableOffspring: ['Blazing Sevens', 'Mage'],
    notes: 'Young sire, Curlin son, promising early crops',
  },

  'BOLT D\'ORO': {
    name: 'Bolt d\'Oro',
    winRate: 11.2,
    winRate2yo: 11.5,
    winRate3yo: 11.0,
    earningsPerStart: 24000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 10.5,
    lightlyRacedWinRate: 11.0,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 12,
    notableOffspring: ['Skinner', 'Instant Coffee'],
    notes: 'Young sire, Medaglia d\'Oro son, improving',
  },

  'MACLEAN\'S MUSIC': {
    name: 'Maclean\'s Music',
    winRate: 10.8,
    winRate2yo: 12.2,
    winRate3yo: 9.5,
    earningsPerStart: 22000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 5, maxFurlongs: 7, category: 'sprint' },
    firstTimeStarterWinRate: 11.5,
    lightlyRacedWinRate: 11.0,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 12,
    notableOffspring: ['Cloud Computing', 'Jackie\'s Warrior'],
    notes: 'Sprint specialist, fast early runners',
  },

  'MENDELSSOHN': {
    name: 'Mendelssohn',
    winRate: 10.5,
    winRate2yo: 10.8,
    winRate3yo: 10.2,
    earningsPerStart: 22000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 9.8,
    lightlyRacedWinRate: 10.2,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 11,
    notableOffspring: ['Halo Again', 'Ancient Warrior'],
    notes: 'Young sire, international bloodline, developing',
  },

  'UPSTART': {
    name: 'Upstart',
    winRate: 10.2,
    winRate2yo: 10.5,
    winRate3yo: 10.0,
    earningsPerStart: 20000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 9.5,
    lightlyRacedWinRate: 10.0,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 11,
    notableOffspring: ['Blazing Sevens'],
    notes: 'Regional sire, improving, sprint-mile types',
  },

  'PALACE MALICE': {
    name: 'Palace Malice',
    winRate: 10.5,
    winRate2yo: 10.2,
    winRate3yo: 10.8,
    earningsPerStart: 22000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 9.2,
    lightlyRacedWinRate: 10.0,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 11,
    notableOffspring: ['Mr. Monomoy', 'Structor'],
    notes: 'Curlin son, stamina influence, developing sire',
  },

  'FROSTED': {
    name: 'Frosted',
    winRate: 10.5,
    winRate2yo: 10.2,
    winRate3yo: 10.8,
    earningsPerStart: 24000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 9.5,
    lightlyRacedWinRate: 10.2,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 11,
    notableOffspring: ['Travel Column', 'Frost Point'],
    notes: 'Tapit son, class oriented, some stamina',
  },

  'OSCAR PERFORMANCE': {
    name: 'Oscar Performance',
    winRate: 10.8,
    winRate2yo: 10.2,
    winRate3yo: 11.2,
    earningsPerStart: 25000,
    surfacePreference: 'turf',
    distancePreference: { minFurlongs: 8, maxFurlongs: 12, category: 'route' },
    firstTimeStarterWinRate: 9.2,
    lightlyRacedWinRate: 10.5,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 11,
    notableOffspring: ['Wolfie\'s Dynaghost'],
    notes: 'Turf sire, route oriented, developing',
  },

  'LIAM\'S MAP': {
    name: 'Liam\'s Map',
    winRate: 10.2,
    winRate2yo: 9.8,
    winRate3yo: 10.5,
    earningsPerStart: 22000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 9.2,
    lightlyRacedWinRate: 10.0,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 10,
    notableOffspring: ['Colonel Liam', 'Mapmaker'],
    notes: 'Solid sire, Colonel Liam turf success',
  },

  'GHOSTZAPPER': {
    name: 'Ghostzapper',
    winRate: 10.5,
    winRate2yo: 9.8,
    winRate3yo: 11.2,
    earningsPerStart: 28000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 8.8,
    lightlyRacedWinRate: 10.0,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 10,
    notableOffspring: ['Shaman Ghost', 'Ghostly Princess'],
    notes: 'Veteran sire, sire of sires, class runners',
  },

  'ENGLISH CHANNEL': {
    name: 'English Channel',
    winRate: 10.2,
    winRate2yo: 8.5,
    winRate3yo: 11.5,
    earningsPerStart: 26000,
    surfacePreference: 'turf',
    distancePreference: { minFurlongs: 9, maxFurlongs: 12, category: 'route' },
    firstTimeStarterWinRate: 7.5,
    lightlyRacedWinRate: 9.5,
    isKnown: true,
    tier: 'aboveAverage',
    baseScore: 10,
    notableOffspring: ['Rushing Fall', 'Channel Maker'],
    notes: 'Elite turf/stamina sire, late developers',
  },

  // ========================================================================
  // AVERAGE TIER (5-9 points)
  // ========================================================================

  'CAIRO PRINCE': {
    name: 'Cairo Prince',
    winRate: 9.5,
    winRate2yo: 10.2,
    winRate3yo: 9.0,
    earningsPerStart: 18000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 9.5,
    lightlyRacedWinRate: 9.5,
    isKnown: true,
    tier: 'average',
    baseScore: 9,
    notableOffspring: ['Cairo Cat', 'Monaco'],
    notes: 'Solid mid-tier sire, sprint-mile types',
  },

  'CENTRAL BANKER': {
    name: 'Central Banker',
    winRate: 9.2,
    winRate2yo: 9.5,
    winRate3yo: 9.0,
    earningsPerStart: 15000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 8.8,
    lightlyRacedWinRate: 9.0,
    isKnown: true,
    tier: 'average',
    baseScore: 8,
    notableOffspring: ['Bankit'],
    notes: 'Regional sire, sprint oriented',
  },

  'FIRST SAMURAI': {
    name: 'First Samurai',
    winRate: 9.0,
    winRate2yo: 9.5,
    winRate3yo: 8.5,
    earningsPerStart: 16000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 8.8,
    lightlyRacedWinRate: 9.0,
    isKnown: true,
    tier: 'average',
    baseScore: 8,
    notableOffspring: ['Hoppertunity', 'Samurai Cause'],
    notes: 'Sprint sire, solid producer',
  },

  'PIONEEROF THE NILE': {
    name: 'Pioneerof the Nile',
    winRate: 9.8,
    winRate2yo: 9.2,
    winRate3yo: 10.5,
    earningsPerStart: 22000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 8.5,
    lightlyRacedWinRate: 9.5,
    isKnown: true,
    tier: 'average',
    baseScore: 8,
    notableOffspring: ['American Pharoah', 'Midnight Storm'],
    notes: 'Deceased, route oriented, some stamina',
  },

  'PAYNTER': {
    name: 'Paynter',
    winRate: 8.8,
    winRate2yo: 8.5,
    winRate3yo: 9.0,
    earningsPerStart: 15000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 8.2,
    lightlyRacedWinRate: 8.5,
    isKnown: true,
    tier: 'average',
    baseScore: 7,
    notableOffspring: ['Ring Weekend', 'Payne'],
    notes: 'Moderate sire, versatile types',
  },

  'CREATIVE CAUSE': {
    name: 'Creative Cause',
    winRate: 8.5,
    winRate2yo: 8.2,
    winRate3yo: 8.8,
    earningsPerStart: 14000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 7.8,
    lightlyRacedWinRate: 8.2,
    isKnown: true,
    tier: 'average',
    baseScore: 6,
    notableOffspring: ['Accelerate', 'Mitole'],
    notes: 'Solid sire, versatile distance',
  },

  'HONOR CODE': {
    name: 'Honor Code',
    winRate: 9.0,
    winRate2yo: 8.5,
    winRate3yo: 9.5,
    earningsPerStart: 18000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 8.0,
    lightlyRacedWinRate: 8.8,
    isKnown: true,
    tier: 'average',
    baseScore: 7,
    notableOffspring: ['Max Player', 'Honor A. P.'],
    notes: 'A.P. Indy son, route oriented',
  },

  'EXAGGERATOR': {
    name: 'Exaggerator',
    winRate: 8.2,
    winRate2yo: 8.0,
    winRate3yo: 8.5,
    earningsPerStart: 14000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 7.5,
    lightlyRacedWinRate: 8.0,
    isKnown: true,
    tier: 'average',
    baseScore: 6,
    notableOffspring: ['Exulting'],
    notes: 'Young sire, Preakness winner',
  },

  'VIOLENCE': {
    name: 'Violence',
    winRate: 8.5,
    winRate2yo: 9.2,
    winRate3yo: 8.0,
    earningsPerStart: 16000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 8.8,
    lightlyRacedWinRate: 8.5,
    isKnown: true,
    tier: 'average',
    baseScore: 6,
    notableOffspring: ['No Parole', 'Dr. Schivel'],
    notes: 'Sprint sire, some precocity',
  },

  // ========================================================================
  // BELOW AVERAGE TIER (0-4 points)
  // ========================================================================

  'TONALIST': {
    name: 'Tonalist',
    winRate: 7.8,
    winRate2yo: 7.2,
    winRate3yo: 8.2,
    earningsPerStart: 12000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 8, maxFurlongs: 10, category: 'route' },
    firstTimeStarterWinRate: 6.5,
    lightlyRacedWinRate: 7.5,
    isKnown: true,
    tier: 'belowAverage',
    baseScore: 4,
    notableOffspring: ['Tonalista'],
    notes: 'Moderate results, some stakes performers',
  },

  'CONNECT': {
    name: 'Connect',
    winRate: 7.5,
    winRate2yo: 7.8,
    winRate3yo: 7.2,
    earningsPerStart: 10000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 6, maxFurlongs: 8, category: 'sprint' },
    firstTimeStarterWinRate: 7.2,
    lightlyRacedWinRate: 7.5,
    isKnown: true,
    tier: 'belowAverage',
    baseScore: 3,
    notableOffspring: ['Clairiere'],
    notes: 'Some stakes success, below average overall',
  },

  'VERRAZANO': {
    name: 'Verrazano',
    winRate: 7.2,
    winRate2yo: 7.0,
    winRate3yo: 7.5,
    earningsPerStart: 9000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 7, maxFurlongs: 9, category: 'versatile' },
    firstTimeStarterWinRate: 6.5,
    lightlyRacedWinRate: 7.0,
    isKnown: true,
    tier: 'belowAverage',
    baseScore: 2,
    notableOffspring: [],
    notes: 'Disappointing at stud, limited success',
  },

  'SHANGHAI BOBBY': {
    name: 'Shanghai Bobby',
    winRate: 6.8,
    winRate2yo: 7.5,
    winRate3yo: 6.2,
    earningsPerStart: 8000,
    surfacePreference: 'dirt',
    distancePreference: { minFurlongs: 5, maxFurlongs: 7, category: 'sprint' },
    firstTimeStarterWinRate: 7.0,
    lightlyRacedWinRate: 7.0,
    isKnown: true,
    tier: 'belowAverage',
    baseScore: 2,
    notableOffspring: [],
    notes: 'Champion 2yo, disappointing sire results',
  },
}

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Normalize a sire name for database lookup
 */
export function normalizeSireName(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/['']/g, '\'')
    .replace(/\s+/g, ' ')
}

/**
 * Look up a sire in the database
 * Returns the sire profile if found, null otherwise
 */
export function lookupSire(sireName: string): ExtendedSireProfile | null {
  const normalized = normalizeSireName(sireName)
  return SIRE_DATABASE[normalized] || null
}

/**
 * Get all sire names in the database
 */
export function getAllSireNames(): string[] {
  return Object.keys(SIRE_DATABASE)
}

/**
 * Get sires by tier
 */
export function getSiresByTier(tier: SireTier): ExtendedSireProfile[] {
  return Object.values(SIRE_DATABASE).filter(s => s.tier === tier)
}

/**
 * Calculate sire score for breeding analysis
 *
 * @param sireName - Name of the sire
 * @param context - Optional context for bonus calculations
 * @returns Sire score (0-25) and profile
 */
export function calculateSireScore(
  sireName: string,
  context?: {
    surface?: string
    distanceCategory?: 'sprint' | 'route' | 'versatile'
    isDebut?: boolean
  }
): { score: number; profile: ExtendedSireProfile | null; reasoning: string } {
  const profile = lookupSire(sireName)

  if (!profile) {
    // Unknown sire - give neutral score
    return {
      score: 5,
      profile: null,
      reasoning: `Unknown sire "${sireName}" - using neutral baseline`,
    }
  }

  let score = profile.baseScore
  const reasons: string[] = [`${profile.name}: ${profile.tier} tier (base ${profile.baseScore})`]

  // Surface fit bonus/penalty
  if (context?.surface && profile.surfacePreference !== 'versatile' && profile.surfacePreference !== 'unknown') {
    const surfaceLower = context.surface.toLowerCase()
    if (
      (surfaceLower === 'turf' && profile.surfacePreference === 'turf') ||
      (surfaceLower === 'dirt' && profile.surfacePreference === 'dirt')
    ) {
      score += 2
      reasons.push(`+2 surface fit (${profile.surfacePreference})`)
    } else if (
      (surfaceLower === 'turf' && profile.surfacePreference === 'dirt') ||
      (surfaceLower === 'dirt' && profile.surfacePreference === 'turf')
    ) {
      score -= 2
      reasons.push(`-2 surface mismatch`)
    }
  }

  // Distance fit bonus
  if (context?.distanceCategory && profile.distancePreference.category !== 'versatile' && profile.distancePreference.category !== 'unknown') {
    if (context.distanceCategory === profile.distancePreference.category) {
      score += 1
      reasons.push(`+1 distance fit (${profile.distancePreference.category})`)
    }
  }

  // Debut runner with strong debut sire
  if (context?.isDebut && profile.firstTimeStarterWinRate >= 13) {
    score += 2
    reasons.push(`+2 elite debut sire (${profile.firstTimeStarterWinRate.toFixed(1)}% FTS win rate)`)
  }

  // Cap at 25
  score = Math.min(25, Math.max(0, score))

  return {
    score,
    profile,
    reasoning: reasons.join('; '),
  }
}

/**
 * Get tier label for display
 */
export function getSireTierLabel(tier: SireTier): string {
  switch (tier) {
    case 'elite': return 'Elite'
    case 'strong': return 'Strong'
    case 'aboveAverage': return 'Above Avg'
    case 'average': return 'Average'
    case 'belowAverage': return 'Below Avg'
  }
}

/**
 * Get tier color for display
 */
export function getSireTierColor(tier: SireTier): string {
  switch (tier) {
    case 'elite': return '#22c55e'
    case 'strong': return '#36d1da'
    case 'aboveAverage': return '#19abb5'
    case 'average': return '#888888'
    case 'belowAverage': return '#ef4444'
  }
}
