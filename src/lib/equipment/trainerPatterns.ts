/**
 * Trainer Equipment Patterns Module
 *
 * Tracks trainer-specific success rates with equipment changes.
 * When a trainer has a proven pattern with a specific equipment change,
 * we use their success rate to adjust the score rather than the base impact.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Equipment change type for pattern matching
 */
export type EquipmentChangeType =
  | 'lasix_first'
  | 'lasix_off'
  | 'blinkers_on'
  | 'blinkers_off'
  | 'blinkers_switch'
  | 'tongue_tie_on'
  | 'tongue_tie_off'
  | 'nasal_strip_on'
  | 'bar_shoes_on'
  | 'bar_shoes_off'
  | 'bandages_on';

/**
 * Trainer pattern for a specific equipment change
 */
export interface TrainerEquipmentPattern {
  /** Trainer name (normalized) */
  trainerName: string;
  /** Type of equipment change */
  changeType: EquipmentChangeType;
  /** Win percentage with this change */
  winRate: number;
  /** In-the-money percentage (top 3) */
  itmRate: number;
  /** Sample size (number of starts with this change) */
  sampleSize: number;
  /** Adjusted points based on success rate */
  adjustedPoints: number;
  /** Evidence string for display */
  evidence: string;
}

/**
 * Complete trainer profile with all equipment patterns
 */
export interface TrainerProfile {
  /** Trainer name */
  name: string;
  /** All equipment patterns for this trainer */
  patterns: TrainerEquipmentPattern[];
  /** Overall win percentage */
  overallWinRate: number;
  /** Total sample size across all patterns */
  totalSampleSize: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum sample size for pattern credibility
 */
export const MIN_SAMPLE_SIZE = 10;

/**
 * Base rates for comparison (general population)
 * These are approximate industry averages
 */
export const BASE_RATES: Record<EquipmentChangeType, { winRate: number; itmRate: number }> = {
  lasix_first: { winRate: 16.5, itmRate: 42 }, // Significant advantage
  lasix_off: { winRate: 8.0, itmRate: 25 }, // Usually negative
  blinkers_on: { winRate: 14.0, itmRate: 38 }, // Positive impact
  blinkers_off: { winRate: 13.5, itmRate: 36 }, // Can help some horses
  blinkers_switch: { winRate: 12.0, itmRate: 34 }, // Mixed results
  tongue_tie_on: { winRate: 12.5, itmRate: 35 }, // Positive
  tongue_tie_off: { winRate: 10.0, itmRate: 30 }, // Slight negative
  nasal_strip_on: { winRate: 11.5, itmRate: 33 }, // Slight positive
  bar_shoes_on: { winRate: 10.5, itmRate: 31 }, // Neutral to slight concern
  bar_shoes_off: { winRate: 11.0, itmRate: 32 }, // Neutral
  bandages_on: { winRate: 10.0, itmRate: 30 }, // Neutral/precautionary
};

// ============================================================================
// TRAINER PATTERNS DATABASE
// ============================================================================

/**
 * Top 20 trainers with known equipment patterns
 * Data is placeholder but structured for real statistics
 *
 * Format based on real-world trainer tendencies:
 * - High Lasix first-time trainers often specialize in this angle
 * - Blinker trainers may have specific conditioning approaches
 * - Patterns should be updated with actual statistics over time
 */
const TRAINER_PATTERNS_DATA: TrainerProfile[] = [
  // Elite trainers known for first-time Lasix success
  {
    name: 'CHAD C. BROWN',
    patterns: [
      {
        trainerName: 'CHAD C. BROWN',
        changeType: 'lasix_first',
        winRate: 24,
        itmRate: 52,
        sampleSize: 85,
        adjustedPoints: 16,
        evidence: 'Wins 24% first-time Lasix (85 starts)',
      },
      {
        trainerName: 'CHAD C. BROWN',
        changeType: 'blinkers_on',
        winRate: 18,
        itmRate: 45,
        sampleSize: 42,
        adjustedPoints: 13,
        evidence: 'Wins 18% with blinkers on (42 starts)',
      },
    ],
    overallWinRate: 21,
    totalSampleSize: 127,
  },
  {
    name: 'TODD A. PLETCHER',
    patterns: [
      {
        trainerName: 'TODD A. PLETCHER',
        changeType: 'lasix_first',
        winRate: 28,
        itmRate: 55,
        sampleSize: 120,
        adjustedPoints: 18,
        evidence: 'Wins 28% first-time Lasix (120 starts) - Elite',
      },
      {
        trainerName: 'TODD A. PLETCHER',
        changeType: 'blinkers_on',
        winRate: 20,
        itmRate: 48,
        sampleSize: 65,
        adjustedPoints: 14,
        evidence: 'Wins 20% with blinkers on (65 starts)',
      },
      {
        trainerName: 'TODD A. PLETCHER',
        changeType: 'blinkers_off',
        winRate: 22,
        itmRate: 50,
        sampleSize: 35,
        adjustedPoints: 15,
        evidence: 'Wins 22% blinkers off (35 starts)',
      },
    ],
    overallWinRate: 23,
    totalSampleSize: 220,
  },
  {
    name: 'BOB BAFFERT',
    patterns: [
      {
        trainerName: 'BOB BAFFERT',
        changeType: 'lasix_first',
        winRate: 30,
        itmRate: 58,
        sampleSize: 95,
        adjustedPoints: 20,
        evidence: 'Wins 30% first-time Lasix (95 starts) - Top tier',
      },
      {
        trainerName: 'BOB BAFFERT',
        changeType: 'blinkers_on',
        winRate: 25,
        itmRate: 52,
        sampleSize: 48,
        adjustedPoints: 16,
        evidence: 'Wins 25% with blinkers on (48 starts)',
      },
    ],
    overallWinRate: 26,
    totalSampleSize: 143,
  },
  {
    name: 'STEVE ASMUSSEN',
    patterns: [
      {
        trainerName: 'STEVE ASMUSSEN',
        changeType: 'lasix_first',
        winRate: 22,
        itmRate: 48,
        sampleSize: 200,
        adjustedPoints: 15,
        evidence: 'Wins 22% first-time Lasix (200 starts)',
      },
      {
        trainerName: 'STEVE ASMUSSEN',
        changeType: 'blinkers_on',
        winRate: 16,
        itmRate: 40,
        sampleSize: 120,
        adjustedPoints: 11,
        evidence: 'Wins 16% with blinkers on (120 starts)',
      },
      {
        trainerName: 'STEVE ASMUSSEN',
        changeType: 'bandages_on',
        winRate: 14,
        itmRate: 38,
        sampleSize: 80,
        adjustedPoints: 4,
        evidence: 'Wins 14% with bandages (80 starts)',
      },
    ],
    overallWinRate: 18,
    totalSampleSize: 400,
  },
  {
    name: 'BRAD H. COX',
    patterns: [
      {
        trainerName: 'BRAD H. COX',
        changeType: 'lasix_first',
        winRate: 26,
        itmRate: 54,
        sampleSize: 75,
        adjustedPoints: 17,
        evidence: 'Wins 26% first-time Lasix (75 starts)',
      },
      {
        trainerName: 'BRAD H. COX',
        changeType: 'blinkers_off',
        winRate: 20,
        itmRate: 46,
        sampleSize: 28,
        adjustedPoints: 14,
        evidence: 'Wins 20% blinkers off (28 starts)',
      },
    ],
    overallWinRate: 22,
    totalSampleSize: 103,
  },
  {
    name: 'MARK E. CASSE',
    patterns: [
      {
        trainerName: 'MARK E. CASSE',
        changeType: 'lasix_first',
        winRate: 20,
        itmRate: 45,
        sampleSize: 60,
        adjustedPoints: 14,
        evidence: 'Wins 20% first-time Lasix (60 starts)',
      },
      {
        trainerName: 'MARK E. CASSE',
        changeType: 'tongue_tie_on',
        winRate: 18,
        itmRate: 42,
        sampleSize: 35,
        adjustedPoints: 8,
        evidence: 'Wins 18% with tongue tie (35 starts)',
      },
    ],
    overallWinRate: 19,
    totalSampleSize: 95,
  },
  {
    name: 'BILL MOTT',
    patterns: [
      {
        trainerName: 'BILL MOTT',
        changeType: 'lasix_first',
        winRate: 25,
        itmRate: 52,
        sampleSize: 55,
        adjustedPoints: 17,
        evidence: 'Wins 25% first-time Lasix (55 starts)',
      },
      {
        trainerName: 'BILL MOTT',
        changeType: 'blinkers_on',
        winRate: 22,
        itmRate: 48,
        sampleSize: 30,
        adjustedPoints: 15,
        evidence: 'Wins 22% with blinkers on (30 starts)',
      },
    ],
    overallWinRate: 23,
    totalSampleSize: 85,
  },
  {
    name: 'DALE ROMANS',
    patterns: [
      {
        trainerName: 'DALE ROMANS',
        changeType: 'lasix_first',
        winRate: 18,
        itmRate: 42,
        sampleSize: 45,
        adjustedPoints: 12,
        evidence: 'Wins 18% first-time Lasix (45 starts)',
      },
      {
        trainerName: 'DALE ROMANS',
        changeType: 'blinkers_on',
        winRate: 15,
        itmRate: 38,
        sampleSize: 55,
        adjustedPoints: 10,
        evidence: 'Wins 15% with blinkers on (55 starts)',
      },
    ],
    overallWinRate: 16,
    totalSampleSize: 100,
  },
  {
    name: 'DOUG OCONNELL',
    patterns: [
      {
        trainerName: 'DOUG OCONNELL',
        changeType: 'lasix_first',
        winRate: 15,
        itmRate: 38,
        sampleSize: 40,
        adjustedPoints: 10,
        evidence: 'Wins 15% first-time Lasix (40 starts)',
      },
      {
        trainerName: 'DOUG OCONNELL',
        changeType: 'blinkers_switch',
        winRate: 18,
        itmRate: 42,
        sampleSize: 25,
        adjustedPoints: 10,
        evidence: 'Wins 18% with blinker switch (25 starts)',
      },
    ],
    overallWinRate: 14,
    totalSampleSize: 65,
  },
  {
    name: 'JORGE NAVARRO',
    patterns: [
      {
        trainerName: 'JORGE NAVARRO',
        changeType: 'lasix_first',
        winRate: 32,
        itmRate: 60,
        sampleSize: 80,
        adjustedPoints: 22,
        evidence: 'Wins 32% first-time Lasix (80 starts) - Specialist',
      },
    ],
    overallWinRate: 28,
    totalSampleSize: 80,
  },
  {
    name: 'CHRISTOPHE CLEMENT',
    patterns: [
      {
        trainerName: 'CHRISTOPHE CLEMENT',
        changeType: 'lasix_first',
        winRate: 22,
        itmRate: 48,
        sampleSize: 50,
        adjustedPoints: 15,
        evidence: 'Wins 22% first-time Lasix (50 starts)',
      },
      {
        trainerName: 'CHRISTOPHE CLEMENT',
        changeType: 'blinkers_on',
        winRate: 16,
        itmRate: 40,
        sampleSize: 28,
        adjustedPoints: 11,
        evidence: 'Wins 16% with blinkers on (28 starts)',
      },
    ],
    overallWinRate: 19,
    totalSampleSize: 78,
  },
  {
    name: 'KENNY MCPEEK',
    patterns: [
      {
        trainerName: 'KENNY MCPEEK',
        changeType: 'lasix_first',
        winRate: 20,
        itmRate: 45,
        sampleSize: 65,
        adjustedPoints: 14,
        evidence: 'Wins 20% first-time Lasix (65 starts)',
      },
      {
        trainerName: 'KENNY MCPEEK',
        changeType: 'blinkers_off',
        winRate: 18,
        itmRate: 42,
        sampleSize: 20,
        adjustedPoints: 12,
        evidence: 'Wins 18% blinkers off (20 starts)',
      },
    ],
    overallWinRate: 18,
    totalSampleSize: 85,
  },
  {
    name: 'MICHAEL MAKER',
    patterns: [
      {
        trainerName: 'MICHAEL MAKER',
        changeType: 'lasix_first',
        winRate: 16,
        itmRate: 40,
        sampleSize: 90,
        adjustedPoints: 11,
        evidence: 'Wins 16% first-time Lasix (90 starts)',
      },
      {
        trainerName: 'MICHAEL MAKER',
        changeType: 'bandages_on',
        winRate: 12,
        itmRate: 34,
        sampleSize: 50,
        adjustedPoints: 3,
        evidence: 'Wins 12% with bandages (50 starts)',
      },
    ],
    overallWinRate: 14,
    totalSampleSize: 140,
  },
  {
    name: 'SHUG MCGAUGHEY',
    patterns: [
      {
        trainerName: 'SHUG MCGAUGHEY',
        changeType: 'lasix_first',
        winRate: 24,
        itmRate: 50,
        sampleSize: 35,
        adjustedPoints: 16,
        evidence: 'Wins 24% first-time Lasix (35 starts)',
      },
    ],
    overallWinRate: 20,
    totalSampleSize: 35,
  },
  {
    name: 'WESLEY WARD',
    patterns: [
      {
        trainerName: 'WESLEY WARD',
        changeType: 'lasix_first',
        winRate: 19,
        itmRate: 44,
        sampleSize: 55,
        adjustedPoints: 13,
        evidence: 'Wins 19% first-time Lasix (55 starts)',
      },
      {
        trainerName: 'WESLEY WARD',
        changeType: 'blinkers_on',
        winRate: 22,
        itmRate: 48,
        sampleSize: 38,
        adjustedPoints: 15,
        evidence: 'Wins 22% with blinkers on (38 starts)',
      },
    ],
    overallWinRate: 20,
    totalSampleSize: 93,
  },
  {
    name: 'GRAHAM MOTION',
    patterns: [
      {
        trainerName: 'GRAHAM MOTION',
        changeType: 'lasix_first',
        winRate: 21,
        itmRate: 46,
        sampleSize: 42,
        adjustedPoints: 14,
        evidence: 'Wins 21% first-time Lasix (42 starts)',
      },
      {
        trainerName: 'GRAHAM MOTION',
        changeType: 'tongue_tie_on',
        winRate: 16,
        itmRate: 40,
        sampleSize: 22,
        adjustedPoints: 7,
        evidence: 'Wins 16% with tongue tie (22 starts)',
      },
    ],
    overallWinRate: 18,
    totalSampleSize: 64,
  },
  {
    name: 'LINDA RICE',
    patterns: [
      {
        trainerName: 'LINDA RICE',
        changeType: 'lasix_first',
        winRate: 23,
        itmRate: 50,
        sampleSize: 58,
        adjustedPoints: 16,
        evidence: 'Wins 23% first-time Lasix (58 starts)',
      },
      {
        trainerName: 'LINDA RICE',
        changeType: 'blinkers_on',
        winRate: 20,
        itmRate: 46,
        sampleSize: 35,
        adjustedPoints: 14,
        evidence: 'Wins 20% with blinkers on (35 starts)',
      },
    ],
    overallWinRate: 21,
    totalSampleSize: 93,
  },
  {
    name: 'RUDY RODRIGUEZ',
    patterns: [
      {
        trainerName: 'RUDY RODRIGUEZ',
        changeType: 'lasix_first',
        winRate: 17,
        itmRate: 42,
        sampleSize: 72,
        adjustedPoints: 12,
        evidence: 'Wins 17% first-time Lasix (72 starts)',
      },
      {
        trainerName: 'RUDY RODRIGUEZ',
        changeType: 'blinkers_on',
        winRate: 14,
        itmRate: 36,
        sampleSize: 45,
        adjustedPoints: 9,
        evidence: 'Wins 14% with blinkers on (45 starts)',
      },
    ],
    overallWinRate: 15,
    totalSampleSize: 117,
  },
  {
    name: 'JOHN SADLER',
    patterns: [
      {
        trainerName: 'JOHN SADLER',
        changeType: 'lasix_first',
        winRate: 22,
        itmRate: 48,
        sampleSize: 48,
        adjustedPoints: 15,
        evidence: 'Wins 22% first-time Lasix (48 starts)',
      },
      {
        trainerName: 'JOHN SADLER',
        changeType: 'blinkers_off',
        winRate: 19,
        itmRate: 44,
        sampleSize: 25,
        adjustedPoints: 13,
        evidence: 'Wins 19% blinkers off (25 starts)',
      },
    ],
    overallWinRate: 20,
    totalSampleSize: 73,
  },
  {
    name: 'RICHARD MANDELLA',
    patterns: [
      {
        trainerName: 'RICHARD MANDELLA',
        changeType: 'lasix_first',
        winRate: 26,
        itmRate: 54,
        sampleSize: 40,
        adjustedPoints: 17,
        evidence: 'Wins 26% first-time Lasix (40 starts)',
      },
      {
        trainerName: 'RICHARD MANDELLA',
        changeType: 'blinkers_on',
        winRate: 24,
        itmRate: 50,
        sampleSize: 28,
        adjustedPoints: 16,
        evidence: 'Wins 24% with blinkers on (28 starts)',
      },
    ],
    overallWinRate: 24,
    totalSampleSize: 68,
  },
];

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Normalize trainer name for matching
 */
export function normalizeTrainerName(name: string): string {
  return name.toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Get trainer profile by name
 */
export function getTrainerProfile(trainerName: string): TrainerProfile | null {
  const normalized = normalizeTrainerName(trainerName);

  return TRAINER_PATTERNS_DATA.find((t) => normalizeTrainerName(t.name) === normalized) || null;
}

/**
 * Get trainer pattern for specific equipment change
 */
export function getTrainerPattern(
  trainerName: string,
  changeType: EquipmentChangeType
): TrainerEquipmentPattern | null {
  const profile = getTrainerProfile(trainerName);

  if (!profile) return null;

  return (
    profile.patterns.find((p) => p.changeType === changeType && p.sampleSize >= MIN_SAMPLE_SIZE) ||
    null
  );
}

/**
 * Check if trainer has a credible pattern for an equipment change
 */
export function hasCrediblePattern(trainerName: string, changeType: EquipmentChangeType): boolean {
  const pattern = getTrainerPattern(trainerName, changeType);
  return pattern !== null && pattern.sampleSize >= MIN_SAMPLE_SIZE;
}

/**
 * Map equipment type ID to change type
 */
export function equipmentIdToChangeType(
  equipmentId: string,
  direction: 'added' | 'removed' | 'switched'
): EquipmentChangeType | null {
  switch (equipmentId) {
    case 'lasix':
      return direction === 'added' ? 'lasix_first' : 'lasix_off';
    case 'blinkers':
      if (direction === 'added') return 'blinkers_on';
      if (direction === 'removed') return 'blinkers_off';
      return 'blinkers_switch';
    case 'tongueTie':
      return direction === 'added' ? 'tongue_tie_on' : 'tongue_tie_off';
    case 'nasalStrip':
      return 'nasal_strip_on';
    case 'barShoes':
      return direction === 'added' ? 'bar_shoes_on' : 'bar_shoes_off';
    case 'frontBandages':
    case 'hindBandages':
    case 'allBandages':
      return 'bandages_on';
    default:
      return null;
  }
}

// ============================================================================
// SCORE ADJUSTMENT
// ============================================================================

/**
 * Calculate adjusted points based on trainer pattern
 */
export function calculateTrainerAdjustedPoints(
  trainerName: string,
  equipmentId: string,
  direction: 'added' | 'removed' | 'switched',
  basePoints: number
): {
  adjustedPoints: number;
  hasPattern: boolean;
  pattern: TrainerEquipmentPattern | null;
  evidence: string | null;
} {
  const changeType = equipmentIdToChangeType(equipmentId, direction);

  if (!changeType) {
    return {
      adjustedPoints: basePoints,
      hasPattern: false,
      pattern: null,
      evidence: null,
    };
  }

  const pattern = getTrainerPattern(trainerName, changeType);

  if (!pattern) {
    return {
      adjustedPoints: basePoints,
      hasPattern: false,
      pattern: null,
      evidence: null,
    };
  }

  // Use trainer-specific adjusted points
  return {
    adjustedPoints: pattern.adjustedPoints,
    hasPattern: true,
    pattern,
    evidence: pattern.evidence,
  };
}

/**
 * Get all trainers known for a specific equipment change type
 */
export function getTrainersForChangeType(
  changeType: EquipmentChangeType
): TrainerEquipmentPattern[] {
  const patterns: TrainerEquipmentPattern[] = [];

  for (const profile of TRAINER_PATTERNS_DATA) {
    const pattern = profile.patterns.find(
      (p) => p.changeType === changeType && p.sampleSize >= MIN_SAMPLE_SIZE
    );
    if (pattern) {
      patterns.push(pattern);
    }
  }

  // Sort by win rate descending
  return patterns.sort((a, b) => b.winRate - a.winRate);
}

/**
 * Get top trainers for first-time Lasix
 */
export function getTopLasixTrainers(limit: number = 10): TrainerEquipmentPattern[] {
  return getTrainersForChangeType('lasix_first').slice(0, limit);
}

/**
 * Get top trainers for blinkers changes
 */
export function getTopBlinkersTrainers(limit: number = 10): TrainerEquipmentPattern[] {
  const blinkersOn = getTrainersForChangeType('blinkers_on');
  const blinkersOff = getTrainersForChangeType('blinkers_off');

  // Combine and sort
  const all = [...blinkersOn, ...blinkersOff];
  return all.sort((a, b) => b.winRate - a.winRate).slice(0, limit);
}

/**
 * Compare trainer to base rate for a change type
 */
export function compareToBaseRate(
  trainerName: string,
  changeType: EquipmentChangeType
): {
  difference: number;
  percentAboveBase: number;
  isAboveAverage: boolean;
  rating: 'elite' | 'above_average' | 'average' | 'below_average';
} | null {
  const pattern = getTrainerPattern(trainerName, changeType);
  const baseRate = BASE_RATES[changeType];

  if (!pattern) return null;

  const difference = pattern.winRate - baseRate.winRate;
  const percentAboveBase = (difference / baseRate.winRate) * 100;

  let rating: 'elite' | 'above_average' | 'average' | 'below_average';
  if (percentAboveBase >= 50) {
    rating = 'elite';
  } else if (percentAboveBase >= 15) {
    rating = 'above_average';
  } else if (percentAboveBase >= -15) {
    rating = 'average';
  } else {
    rating = 'below_average';
  }

  return {
    difference,
    percentAboveBase,
    isAboveAverage: difference > 0,
    rating,
  };
}
