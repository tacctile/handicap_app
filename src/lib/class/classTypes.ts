/**
 * Class Level Type Definitions
 *
 * Defines the complete hierarchy of race class levels from lowest to highest,
 * with associated metadata for scoring and comparison.
 *
 * Class Hierarchy (lowest to highest):
 * 1. Maiden Claiming
 * 2. Maiden Special Weight
 * 3. Claiming (tiered by price)
 * 4. Allowance (with N1X, N2X, N3X restrictions)
 * 5. Allowance Optional Claiming
 * 6. Listed Stakes
 * 7. Grade 3 Stakes
 * 8. Grade 2 Stakes
 * 9. Grade 1 Stakes
 */

// ============================================================================
// CLASS LEVEL ENUM
// ============================================================================

/**
 * Race class levels in order from lowest to highest
 * Numeric values represent relative class level (higher = better class)
 */
export enum ClassLevel {
  // Maiden races (horses seeking first win)
  MAIDEN_CLAIMING = 10,
  MAIDEN_SPECIAL_WEIGHT = 20,

  // Claiming races (tiered by price)
  CLAIMING_UNDER_10K = 30,
  CLAIMING_10K_TO_24K = 35,
  CLAIMING_25K_TO_49K = 40,
  CLAIMING_50K_TO_99K = 45,
  CLAIMING_100K_PLUS = 50,

  // Starter allowance (must have started for claiming price)
  STARTER_ALLOWANCE = 55,

  // Allowance races (with conditions)
  ALLOWANCE_N3X = 60, // Non-winners of 3 races (other than maiden/claiming)
  ALLOWANCE_N2X = 65, // Non-winners of 2 races
  ALLOWANCE_N1X = 70, // Non-winners of 1 race
  ALLOWANCE = 75, // Open allowance

  // Allowance optional claiming
  ALLOWANCE_OPTIONAL_CLAIMING = 80,

  // Stakes races
  STAKES_UNGRADED = 85,
  STAKES_LISTED = 90,
  STAKES_GRADE_3 = 95,
  STAKES_GRADE_2 = 100,
  STAKES_GRADE_1 = 105,

  // Unknown/default
  UNKNOWN = 40, // Default to mid-claiming level
}

// ============================================================================
// CLASS LEVEL METADATA
// ============================================================================

export interface ClassLevelMetadata {
  /** Display name for UI */
  name: string
  /** Short abbreviation */
  abbrev: string
  /** Numeric value for comparison */
  value: number
  /** Typical purse range [min, max] */
  typicalPurseRange: [number, number]
  /** Par Beyer figure for this class */
  parBeyer: number
  /** Description */
  description: string
}

/**
 * Complete metadata for each class level
 */
export const CLASS_LEVEL_METADATA: Record<ClassLevel, ClassLevelMetadata> = {
  [ClassLevel.MAIDEN_CLAIMING]: {
    name: 'Maiden Claiming',
    abbrev: 'MCL',
    value: 10,
    typicalPurseRange: [10000, 30000],
    parBeyer: 62,
    description: 'Horses seeking first win, available to be claimed',
  },
  [ClassLevel.MAIDEN_SPECIAL_WEIGHT]: {
    name: 'Maiden Special Weight',
    abbrev: 'MSW',
    value: 20,
    typicalPurseRange: [40000, 100000],
    parBeyer: 72,
    description: 'Horses seeking first win, not for claim',
  },
  [ClassLevel.CLAIMING_UNDER_10K]: {
    name: 'Claiming <$10K',
    abbrev: 'CLM<10',
    value: 30,
    typicalPurseRange: [8000, 20000],
    parBeyer: 65,
    description: 'Low-level claiming, bottom rung',
  },
  [ClassLevel.CLAIMING_10K_TO_24K]: {
    name: 'Claiming $10-24K',
    abbrev: 'CLM10-24',
    value: 35,
    typicalPurseRange: [15000, 35000],
    parBeyer: 70,
    description: 'Low-mid claiming',
  },
  [ClassLevel.CLAIMING_25K_TO_49K]: {
    name: 'Claiming $25-49K',
    abbrev: 'CLM25-49',
    value: 40,
    typicalPurseRange: [25000, 50000],
    parBeyer: 75,
    description: 'Mid-level claiming',
  },
  [ClassLevel.CLAIMING_50K_TO_99K]: {
    name: 'Claiming $50-99K',
    abbrev: 'CLM50-99',
    value: 45,
    typicalPurseRange: [40000, 80000],
    parBeyer: 80,
    description: 'Upper-mid claiming',
  },
  [ClassLevel.CLAIMING_100K_PLUS]: {
    name: 'Claiming $100K+',
    abbrev: 'CLM100+',
    value: 50,
    typicalPurseRange: [75000, 150000],
    parBeyer: 85,
    description: 'High-level claiming',
  },
  [ClassLevel.STARTER_ALLOWANCE]: {
    name: 'Starter Allowance',
    abbrev: 'STR',
    value: 55,
    typicalPurseRange: [30000, 75000],
    parBeyer: 78,
    description: 'For horses that started for claiming price',
  },
  [ClassLevel.ALLOWANCE_N3X]: {
    name: 'Allowance (N3X)',
    abbrev: 'ALW-N3X',
    value: 60,
    typicalPurseRange: [40000, 80000],
    parBeyer: 80,
    description: 'Non-winners of 3 other than maiden/claiming',
  },
  [ClassLevel.ALLOWANCE_N2X]: {
    name: 'Allowance (N2X)',
    abbrev: 'ALW-N2X',
    value: 65,
    typicalPurseRange: [50000, 100000],
    parBeyer: 82,
    description: 'Non-winners of 2 other than maiden/claiming',
  },
  [ClassLevel.ALLOWANCE_N1X]: {
    name: 'Allowance (N1X)',
    abbrev: 'ALW-N1X',
    value: 70,
    typicalPurseRange: [60000, 125000],
    parBeyer: 85,
    description: 'Non-winners of 1 other than maiden/claiming',
  },
  [ClassLevel.ALLOWANCE]: {
    name: 'Allowance',
    abbrev: 'ALW',
    value: 75,
    typicalPurseRange: [75000, 150000],
    parBeyer: 88,
    description: 'Open allowance, no restrictions',
  },
  [ClassLevel.ALLOWANCE_OPTIONAL_CLAIMING]: {
    name: 'Allowance Optional Claiming',
    abbrev: 'AOC',
    value: 80,
    typicalPurseRange: [75000, 175000],
    parBeyer: 88,
    description: 'Allowance or optional claiming',
  },
  [ClassLevel.STAKES_UNGRADED]: {
    name: 'Stakes (Ungraded)',
    abbrev: 'STK',
    value: 85,
    typicalPurseRange: [75000, 200000],
    parBeyer: 92,
    description: 'Ungraded stakes race',
  },
  [ClassLevel.STAKES_LISTED]: {
    name: 'Listed Stakes',
    abbrev: 'L-STK',
    value: 90,
    typicalPurseRange: [100000, 300000],
    parBeyer: 95,
    description: 'Listed stakes race',
  },
  [ClassLevel.STAKES_GRADE_3]: {
    name: 'Grade 3 Stakes',
    abbrev: 'G3',
    value: 95,
    typicalPurseRange: [150000, 500000],
    parBeyer: 98,
    description: 'Grade 3 stakes race',
  },
  [ClassLevel.STAKES_GRADE_2]: {
    name: 'Grade 2 Stakes',
    abbrev: 'G2',
    value: 100,
    typicalPurseRange: [200000, 750000],
    parBeyer: 102,
    description: 'Grade 2 stakes race',
  },
  [ClassLevel.STAKES_GRADE_1]: {
    name: 'Grade 1 Stakes',
    abbrev: 'G1',
    value: 105,
    typicalPurseRange: [300000, 3000000],
    parBeyer: 108,
    description: 'Grade 1 stakes race - highest level',
  },
  [ClassLevel.UNKNOWN]: {
    name: 'Unknown',
    abbrev: 'UNK',
    value: 40,
    typicalPurseRange: [20000, 50000],
    parBeyer: 75,
    description: 'Unable to determine class level',
  },
}

// ============================================================================
// CLASS MOVEMENT TYPES
// ============================================================================

export type ClassMovementDirection = 'drop' | 'rise' | 'lateral' | 'unknown'

export type ClassMovementMagnitude = 'minor' | 'moderate' | 'major' | 'extreme'

export interface ClassMovement {
  /** Direction of class movement */
  direction: ClassMovementDirection
  /** Magnitude of the move (1-3 levels vs 4+) */
  magnitude: ClassMovementMagnitude
  /** Number of levels moved (positive = rise, negative = drop) */
  levelsDifference: number
  /** Description for UI */
  description: string
  /** From class level */
  fromLevel: ClassLevel
  /** To class level (current race) */
  toLevel: ClassLevel
  /** Claiming price drop if applicable */
  claimingPriceDrop: number | null
}

// ============================================================================
// CLASS ANALYSIS RESULT
// ============================================================================

export interface ClassAnalysisResult {
  /** Current race class level */
  currentClass: ClassLevel
  /** Last race class level */
  lastRaceClass: ClassLevel | null
  /** Class levels from last 3 races */
  recentClassLevels: ClassLevel[]
  /** Class movement analysis */
  movement: ClassMovement
  /** Whether horse has proven at this level */
  provenAtLevel: ProvenAtLevelResult
  /** Hidden class drop indicators */
  hiddenDrops: HiddenClassDrop[]
  /** Track tier movement (if applicable) */
  trackTierMovement: TrackTierMovement | null
  /** Overall class score contribution */
  classScore: number
  /** Detailed reasoning */
  reasoning: string[]
}

// ============================================================================
// PROVEN AT LEVEL
// ============================================================================

export interface ProvenAtLevelResult {
  /** Has won at this class or higher */
  hasWon: boolean
  /** Number of wins at this class or higher */
  winsAtLevel: number
  /** Has placed (2nd/3rd) at this class or higher */
  hasPlaced: boolean
  /** Number of ITM finishes at level */
  itmAtLevel: number
  /** Was competitive (within 5 lengths) at level */
  wasCompetitive: boolean
  /** Number of competitive races at level */
  competitiveRacesAtLevel: number
  /** Best finish at this class or higher */
  bestFinish: number | null
  /** Best Beyer at this class or higher */
  bestBeyerAtLevel: number | null
}

// ============================================================================
// HIDDEN CLASS DROPS
// ============================================================================

export type HiddenDropType =
  | 'track_tier_drop'
  | 'purse_drop'
  | 'claiming_price_drop'
  | 'runner_up_key_race'
  | 'shipper_from_elite'

export interface HiddenClassDrop {
  /** Type of hidden drop */
  type: HiddenDropType
  /** Description for display */
  description: string
  /** Points bonus for this hidden drop */
  pointsBonus: number
  /** Detailed explanation */
  explanation: string
}

// ============================================================================
// TRACK TIER MOVEMENT
// ============================================================================

export type TrackTier = 'A' | 'B' | 'C'

export interface TrackTierMovement {
  /** Previous track tier */
  fromTier: TrackTier
  /** Current track tier */
  toTier: TrackTier
  /** Previous track code */
  fromTrack: string
  /** Current track code */
  toTrack: string
  /** Description */
  description: string
  /** Points adjustment */
  pointsAdjustment: number
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get class level display name
 */
export function getClassLevelName(level: ClassLevel): string {
  return CLASS_LEVEL_METADATA[level].name
}

/**
 * Get class level abbreviation
 */
export function getClassLevelAbbrev(level: ClassLevel): string {
  return CLASS_LEVEL_METADATA[level].abbrev
}

/**
 * Get par Beyer for class level
 */
export function getClassParBeyer(level: ClassLevel): number {
  return CLASS_LEVEL_METADATA[level].parBeyer
}

/**
 * Compare two class levels
 * Returns: negative if a < b, 0 if equal, positive if a > b
 */
export function compareClassLevels(a: ClassLevel, b: ClassLevel): number {
  return CLASS_LEVEL_METADATA[a].value - CLASS_LEVEL_METADATA[b].value
}

/**
 * Calculate the magnitude of class movement
 */
export function getMovementMagnitude(levelsDifference: number): ClassMovementMagnitude {
  const absLevels = Math.abs(levelsDifference)
  if (absLevels <= 1) return 'minor'
  if (absLevels <= 2) return 'moderate'
  if (absLevels <= 3) return 'major'
  return 'extreme'
}

/**
 * Get color for class movement display
 */
export function getClassMovementColor(direction: ClassMovementDirection): string {
  switch (direction) {
    case 'drop':
      return '#22c55e' // Green - favorable
    case 'rise':
      return '#ef4444' // Red - challenging
    case 'lateral':
      return '#6b7280' // Gray - neutral
    default:
      return '#6b7280'
  }
}

/**
 * Get icon for class movement
 */
export function getClassMovementIcon(direction: ClassMovementDirection): string {
  switch (direction) {
    case 'drop':
      return '↓'
    case 'rise':
      return '↑'
    case 'lateral':
      return '→'
    default:
      return '?'
  }
}
