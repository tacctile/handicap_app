/**
 * Breeding Analysis Type Definitions
 *
 * Types for extracting, structuring, and analyzing breeding data
 * for lightly raced horses where past performance data is limited.
 */

// ============================================================================
// CORE BREEDING INFO
// ============================================================================

/**
 * Basic breeding information extracted from DRF data
 */
export interface BreedingInfo {
  /** Sire (father) name */
  sire: string
  /** Dam (mother) name */
  dam: string
  /** Damsire (maternal grandsire / broodmare sire) */
  damsire: string
  /** Total lifetime starts */
  lifetimeStarts: number
  /** Whether this is a lightly raced horse (<8 starts) */
  isLightlyRaced: boolean
  /** Whether this is a debut (first-time starter, 0 starts) */
  isDebut: boolean
  /** Whether breeding info is complete */
  isComplete: boolean
  /** Where the horse was bred */
  whereBred: string
}

/**
 * Categories for experience level based on starts
 */
export type ExperienceLevel = 'debut' | 'lightly_raced' | 'experienced'

/**
 * Thresholds for experience classification
 */
export const EXPERIENCE_THRESHOLDS = {
  /** 0 starts = debut */
  DEBUT: 0,
  /** Less than 8 starts = lightly raced */
  LIGHTLY_RACED_MAX: 7,
  /** 8+ starts = experienced (normal handicapping applies) */
  EXPERIENCED_MIN: 8,
} as const

// ============================================================================
// SIRE PROFILE
// ============================================================================

/**
 * Profile of a sire's statistical tendencies
 * Used for projecting lightly raced horses
 */
export interface SireProfile {
  /** Sire name */
  name: string
  /** Overall win rate as a percentage (0-100) */
  winRate: number
  /** Average earnings per start in dollars */
  earningsPerStart: number
  /** Preferred surface: 'dirt', 'turf', 'synthetic', or 'versatile' */
  surfacePreference: SurfacePreference
  /** Optimal distance range in furlongs */
  distancePreference: DistancePreference
  /** First-time starter win rate */
  firstTimeStarterWinRate: number
  /** Win rate for lightly raced horses (2-7 starts) */
  lightlyRacedWinRate: number
  /** Whether sire data is available in database */
  isKnown: boolean
}

export type SurfacePreference = 'dirt' | 'turf' | 'synthetic' | 'versatile' | 'unknown'

export interface DistancePreference {
  /** Preferred minimum distance in furlongs */
  minFurlongs: number
  /** Preferred maximum distance in furlongs */
  maxFurlongs: number
  /** Category: 'sprint', 'route', 'versatile' */
  category: 'sprint' | 'route' | 'versatile' | 'unknown'
}

/**
 * Default sire profile for unknown sires
 */
export const DEFAULT_SIRE_PROFILE: SireProfile = {
  name: 'Unknown',
  winRate: 8.5, // Average win rate across all starters
  earningsPerStart: 5000,
  surfacePreference: 'unknown',
  distancePreference: {
    minFurlongs: 5,
    maxFurlongs: 10,
    category: 'unknown',
  },
  firstTimeStarterWinRate: 6.5,
  lightlyRacedWinRate: 8.0,
  isKnown: false,
}

// ============================================================================
// DAM PROFILE
// ============================================================================

/**
 * Profile of a dam's production record
 * Less commonly available but valuable when present
 */
export interface DamProfile {
  /** Dam name */
  name: string
  /** Quality rating as a producer (0-100) */
  producerQuality: number
  /** Overall win rate of offspring */
  offspringWinRate: number
  /** Number of named foals produced */
  foalsProduced: number
  /** Stakes winners produced */
  stakesWinnersProduced: number
  /** Whether dam data is available */
  isKnown: boolean
}

/**
 * Default dam profile for unknown dams
 */
export const DEFAULT_DAM_PROFILE: DamProfile = {
  name: 'Unknown',
  producerQuality: 50,
  offspringWinRate: 8.5,
  foalsProduced: 0,
  stakesWinnersProduced: 0,
  isKnown: false,
}

// ============================================================================
// DAMSIRE PROFILE
// ============================================================================

/**
 * Profile of a damsire (maternal grandsire)
 * Important for understanding pedigree influences
 */
export interface DamsireProfile {
  /** Damsire name */
  name: string
  /** Broodmare sire index rating */
  broodmareSireIndex: number
  /** Surface influence on offspring */
  surfaceInfluence: SurfacePreference
  /** Stamina influence (higher = more stamina) */
  staminaInfluence: number
  /** Whether damsire data is available */
  isKnown: boolean
}

/**
 * Default damsire profile for unknown damsires
 */
export const DEFAULT_DAMSIRE_PROFILE: DamsireProfile = {
  name: 'Unknown',
  broodmareSireIndex: 1.0,
  surfaceInfluence: 'unknown',
  staminaInfluence: 50,
  isKnown: false,
}

// ============================================================================
// BREEDING SCORE
// ============================================================================

/**
 * Breeding-based score for lightly raced horses
 * Maximum 60 points allocated across categories
 */
export interface BreedingScore {
  /** Total breeding score (0-60) */
  total: number
  /** Breakdown by category */
  breakdown: BreedingScoreBreakdown
  /** Confidence level in the assessment */
  confidence: BreedingConfidence
  /** Human-readable summary */
  summary: string
  /** Whether breeding analysis was applied */
  wasApplied: boolean
  /** Reason if not applied */
  notAppliedReason?: string
}

export interface BreedingScoreBreakdown {
  /** Sire reputation and statistics (0-25) */
  sireScore: number
  /** Dam production quality (0-15) */
  damScore: number
  /** Damsire influence (0-10) */
  damsireScore: number
  /** Surface/distance fit based on pedigree (0-10) */
  fitScore: number
}

export type BreedingConfidence = 'high' | 'medium' | 'low' | 'none'

/**
 * Score limits for breeding categories
 */
export const BREEDING_SCORE_LIMITS = {
  sire: 25,
  dam: 15,
  damsire: 10,
  fit: 10,
  total: 60,
} as const

/**
 * Empty breeding score (no analysis applied)
 */
export const EMPTY_BREEDING_SCORE: BreedingScore = {
  total: 0,
  breakdown: {
    sireScore: 0,
    damScore: 0,
    damsireScore: 0,
    fitScore: 0,
  },
  confidence: 'none',
  summary: 'Breeding analysis not applicable',
  wasApplied: false,
  notAppliedReason: 'Horse has sufficient race history',
}

// ============================================================================
// BREEDING PARSING RESULT
// ============================================================================

/**
 * Result of parsing a breeding line from DRF
 */
export interface BreedingParseResult {
  /** Parsed sire name (or null if not found) */
  sire: string | null
  /** Parsed dam name (or null if not found) */
  dam: string | null
  /** Parsed damsire name (or null if not found) */
  damsire: string | null
  /** Whether parsing was successful */
  success: boolean
  /** Any warnings during parsing */
  warnings: string[]
  /** Original input string */
  original: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Quick display info for breeding section in UI
 */
export interface BreedingDisplayInfo {
  sire: string
  dam: string
  damsire: string
  starts: number
  experienceLabel: string
  experienceLevel: ExperienceLevel
  showBreedingScore: boolean
  whereBred: string
}

/**
 * Breeding analysis result combining all data
 */
export interface BreedingAnalysis {
  info: BreedingInfo
  sireProfile: SireProfile
  damProfile: DamProfile
  damsireProfile: DamsireProfile
  score: BreedingScore
  displayInfo: BreedingDisplayInfo
}
