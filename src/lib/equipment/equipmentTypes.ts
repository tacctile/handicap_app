/**
 * Equipment Types and Definitions
 *
 * Defines all equipment changes tracked for horse racing handicapping.
 * Equipment changes can significantly impact performance, especially
 * first-time applications of Lasix or blinkers.
 */

// ============================================================================
// EQUIPMENT CODES (DRF Standard Abbreviations)
// ============================================================================

/**
 * Standard DRF equipment codes
 */
export const EQUIPMENT_CODES = {
  // Blinkers
  B: 'Blinkers',
  BO: 'Blinkers Off',

  // Bandages
  BL: 'Front Bandages',
  HR: 'Hind/Rear Bandages',
  FB: 'Front Bandages', // Alternative code
  RB: 'Rear Bandages', // Alternative code

  // Other Equipment
  TT: 'Tongue Tie',
  NS: 'Nasal Strip',
  SR: 'Shadow Roll',
  CP: 'Cheek Pieces',
  BS: 'Bar Shoes',
  MC: 'Mud Caulks',
  RR: 'Run-Out Bit Right',
  RL: 'Run-Out Bit Left',
  CO: 'Cornell Collar',
  FS: 'Figure-8 Noseband',

  // Medication
  L: 'Lasix',
  L1: 'Lasix First Time',
  LO: 'Lasix Off',
  BU: 'Bute',
} as const;

export type EquipmentCode = keyof typeof EQUIPMENT_CODES;

// ============================================================================
// EQUIPMENT CATEGORY TYPES
// ============================================================================

/**
 * Equipment category for grouping related equipment
 */
export type EquipmentCategory =
  | 'medication' // Lasix, Bute
  | 'vision' // Blinkers, Shadow Roll, Cheek Pieces
  | 'bandages' // Front, Hind, All
  | 'breathing' // Tongue Tie, Nasal Strip
  | 'shoes' // Bar Shoes, Mud Caulks
  | 'other'; // Everything else

/**
 * Direction of equipment change
 */
export type EquipmentChangeDirection = 'added' | 'removed' | 'switched';

/**
 * Impact classification
 */
export type ImpactClassification =
  | 'very_positive'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'very_negative';

// ============================================================================
// EQUIPMENT TYPE DEFINITIONS
// ============================================================================

/**
 * Complete equipment type definition
 */
export interface EquipmentTypeDefinition {
  /** Equipment identifier */
  id: string;
  /** DRF code(s) for this equipment */
  codes: string[];
  /** Display name */
  name: string;
  /** Short description of purpose */
  description: string;
  /** Equipment category */
  category: EquipmentCategory;
  /** Typical impact when added (points) */
  impactAdded: number;
  /** Typical impact when removed (points) */
  impactRemoved: number;
  /** Description of typical impact */
  impactDescription: string;
  /** Is this a first-time change that's especially significant? */
  significantFirstTime: boolean;
  /** Additional first-time bonus (if applicable) */
  firstTimeBonus: number;
}

// ============================================================================
// EQUIPMENT TYPE DATABASE
// ============================================================================

/**
 * Complete database of equipment types with impacts
 */
export const EQUIPMENT_TYPES: Record<string, EquipmentTypeDefinition> = {
  // Medication
  // v2.5: All impact values scaled by 0.6 (12/20) to match new MAX_EQUIPMENT_SCORE
  lasix: {
    id: 'lasix',
    codes: ['L', 'L1'],
    name: 'Lasix',
    description: 'Diuretic medication to prevent exercise-induced pulmonary hemorrhage (EIPH)',
    category: 'medication',
    impactAdded: 7, // was 12
    impactRemoved: -5, // was -8
    impactDescription:
      'First-time Lasix is one of the most significant equipment changes. Proven statistical advantage.',
    significantFirstTime: true,
    firstTimeBonus: 3, // was 5
  },

  // Vision Equipment
  blinkers: {
    id: 'blinkers',
    codes: ['B'],
    name: 'Blinkers',
    description: 'Hood with eye cups to limit peripheral vision and improve focus',
    category: 'vision',
    impactAdded: 6, // was 10
    impactRemoved: 5, // was 8
    impactDescription:
      'Blinkers on can improve focus. Blinkers off may help if horse was too keen.',
    significantFirstTime: true,
    firstTimeBonus: 2, // was 3
  },

  shadowRoll: {
    id: 'shadowRoll',
    codes: ['SR'],
    name: 'Shadow Roll',
    description: "Sheepskin noseband to block horse's view of shadows on track",
    category: 'vision',
    impactAdded: 2, // was 4
    impactRemoved: 0,
    impactDescription: 'Helps horses that spook at shadows or dark spots on track.',
    significantFirstTime: false,
    firstTimeBonus: 1,
  },

  cheekPieces: {
    id: 'cheekPieces',
    codes: ['CP'],
    name: 'Cheek Pieces',
    description: 'Strips attached to bridle to limit sideways vision',
    category: 'vision',
    impactAdded: 3, // was 5
    impactRemoved: 0,
    impactDescription: 'Similar to blinkers but less restrictive. Helps with focus.',
    significantFirstTime: false,
    firstTimeBonus: 1,
  },

  // Bandages
  frontBandages: {
    id: 'frontBandages',
    codes: ['BL', 'FB'],
    name: 'Front Bandages',
    description: 'Protective bandages on front legs',
    category: 'bandages',
    impactAdded: 1, // was 2
    impactRemoved: 0,
    impactDescription: 'Usually precautionary. May indicate minor concerns but also protection.',
    significantFirstTime: false,
    firstTimeBonus: 0,
  },

  hindBandages: {
    id: 'hindBandages',
    codes: ['HR', 'RB'],
    name: 'Hind Bandages',
    description: 'Protective bandages on hind legs',
    category: 'bandages',
    impactAdded: 1, // was 2
    impactRemoved: 0,
    impactDescription: 'Usually precautionary. May indicate minor concerns.',
    significantFirstTime: false,
    firstTimeBonus: 0,
  },

  allBandages: {
    id: 'allBandages',
    codes: ['AB', 'ALL'],
    name: 'All Bandages',
    description: 'Bandages on all four legs',
    category: 'bandages',
    impactAdded: 2, // was 3
    impactRemoved: 0,
    impactDescription: 'Four bandages may indicate more concern but also full protection.',
    significantFirstTime: false,
    firstTimeBonus: 0,
  },

  // Breathing Equipment
  tongueTie: {
    id: 'tongueTie',
    codes: ['TT'],
    name: 'Tongue Tie',
    description: 'Strap to hold tongue in place and prevent breathing obstruction',
    category: 'breathing',
    impactAdded: 3, // was 5
    impactRemoved: -1, // was -2
    impactDescription: 'Helps horses that have breathing issues related to tongue displacement.',
    significantFirstTime: true,
    firstTimeBonus: 1, // was 2
  },

  nasalStrip: {
    id: 'nasalStrip',
    codes: ['NS'],
    name: 'Nasal Strip',
    description: 'Adhesive strip on nose to open nasal passages',
    category: 'breathing',
    impactAdded: 2, // was 4
    impactRemoved: 0,
    impactDescription: 'Can improve airflow. Often used for first time in stakes races.',
    significantFirstTime: false,
    firstTimeBonus: 1,
  },

  // Shoes
  barShoes: {
    id: 'barShoes',
    codes: ['BS'],
    name: 'Bar Shoes',
    description: 'Specialty horseshoe with bar connecting heels for hoof support',
    category: 'shoes',
    impactAdded: 1, // was 2
    impactRemoved: 1,
    impactDescription:
      'Used for hoof issues. +2 on turf (better grip), -1 on dirt (may indicate concern).',
    significantFirstTime: false,
    firstTimeBonus: 0,
  },

  mudCaulks: {
    id: 'mudCaulks',
    codes: ['MC'],
    name: 'Mud Caulks',
    description: 'Cleats or grabs on horseshoes for wet track traction',
    category: 'shoes',
    impactAdded: 2, // was 3
    impactRemoved: 0,
    impactDescription: 'Only relevant on wet tracks. Shows trainer is prepared for conditions.',
    significantFirstTime: false,
    firstTimeBonus: 0,
  },
} as const;

// ============================================================================
// EQUIPMENT CHANGE INTERFACE
// ============================================================================

/**
 * Detected equipment change
 */
export interface DetectedEquipmentChange {
  /** Equipment type from EQUIPMENT_TYPES */
  equipmentType: EquipmentTypeDefinition;
  /** Direction of change */
  direction: EquipmentChangeDirection;
  /** Is this the first time this equipment is being used? */
  isFirstTime: boolean;
  /** Base point value for this change */
  basePoints: number;
  /** Adjusted point value (after trainer patterns, etc.) */
  adjustedPoints: number;
  /** Description of this specific change */
  changeDescription: string;
  /** Impact classification */
  impact: ImpactClassification;
  /** Evidence from past performances */
  evidence?: string;
}

/**
 * Complete equipment analysis result
 */
export interface EquipmentAnalysis {
  /** Current equipment string */
  currentEquipment: string;
  /** Last race equipment string */
  lastRaceEquipment: string | null;
  /** All detected changes */
  changes: DetectedEquipmentChange[];
  /** Total equipment score */
  totalScore: number;
  /** Base score without trainer patterns */
  baseScore: number;
  /** Is there at least one significant change? */
  hasSignificantChange: boolean;
  /** Summary for display */
  summary: string;
  /** Detailed reasoning */
  reasoning: string;
  /** Historical equipment pattern from past performances */
  equipmentHistory: EquipmentHistoryEntry[];
}

/**
 * Equipment usage in a past performance
 */
export interface EquipmentHistoryEntry {
  /** Race date */
  date: string;
  /** Track */
  track: string;
  /** Equipment string */
  equipment: string;
  /** Medication string */
  medication: string;
  /** Finish position */
  finishPosition: number;
  /** Did horse win? */
  won: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get equipment type definition by ID or code
 */
export function getEquipmentType(idOrCode: string): EquipmentTypeDefinition | null {
  const normalized = idOrCode.toUpperCase();

  // Check by ID first
  const typeById = EQUIPMENT_TYPES[idOrCode.toLowerCase()];
  if (typeById) {
    return typeById;
  }

  // Check by code
  for (const type of Object.values(EQUIPMENT_TYPES)) {
    if (type.codes.includes(normalized)) {
      return type;
    }
  }

  return null;
}

/**
 * Parse equipment code to name
 */
export function equipmentCodeToName(code: string): string {
  const normalized = code.toUpperCase();
  const codeName = EQUIPMENT_CODES[normalized as EquipmentCode];
  return codeName ?? code;
}

/**
 * Get impact classification from points
 */
export function getImpactClassification(points: number): ImpactClassification {
  if (points >= 10) return 'very_positive';
  if (points >= 5) return 'positive';
  if (points >= -2) return 'neutral';
  if (points >= -5) return 'negative';
  return 'very_negative';
}

/**
 * Get impact color for UI display
 */
export function getImpactColor(impact: ImpactClassification): string {
  switch (impact) {
    case 'very_positive':
      return '#22c55e'; // Bright green
    case 'positive':
      return '#36d1da'; // Accent cyan
    case 'neutral':
      return '#888888'; // Gray
    case 'negative':
      return '#f97316'; // Orange
    case 'very_negative':
      return '#ef4444'; // Red
  }
}

/**
 * Get impact icon for UI display
 */
export function getImpactIcon(impact: ImpactClassification): string {
  switch (impact) {
    case 'very_positive':
      return 'rocket_launch';
    case 'positive':
      return 'trending_up';
    case 'neutral':
      return 'remove';
    case 'negative':
      return 'trending_down';
    case 'very_negative':
      return 'warning';
  }
}

/**
 * Get equipment category icon
 */
export function getCategoryIcon(category: EquipmentCategory): string {
  switch (category) {
    case 'medication':
      return 'medication';
    case 'vision':
      return 'visibility';
    case 'bandages':
      return 'healing';
    case 'breathing':
      return 'air';
    case 'shoes':
      return 'directions_run';
    case 'other':
      return 'build';
  }
}
