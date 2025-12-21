/**
 * Equipment Extractor Module
 *
 * Extracts and analyzes equipment changes from DRF data.
 * Detects changes between current and last race equipment,
 * flags first-time usage, and tracks patterns across past performances.
 */

import type { HorseEntry, Equipment, Medication, PastPerformance } from '../../types/drf';
import {
  EQUIPMENT_TYPES,
  type DetectedEquipmentChange,
  type EquipmentHistoryEntry,
  type EquipmentChangeDirection,
  type EquipmentTypeDefinition,
  getImpactClassification,
} from './equipmentTypes';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of equipment extraction
 */
export interface EquipmentExtractionResult {
  /** Current race equipment raw string */
  currentEquipment: string;
  /** Last race equipment raw string */
  lastRaceEquipment: string | null;
  /** All detected equipment changes */
  changes: DetectedEquipmentChange[];
  /** Historical equipment usage */
  history: EquipmentHistoryEntry[];
  /** Has any changes */
  hasChanges: boolean;
  /** Has significant changes (Lasix, blinkers) */
  hasSignificantChange: boolean;
}

/**
 * Parsed equipment flags from raw string
 */
interface ParsedEquipment {
  blinkers: boolean;
  blinkersOff: boolean;
  frontBandages: boolean;
  hindBandages: boolean;
  barShoes: boolean;
  mudCaulks: boolean;
  tongueTie: boolean;
  nasalStrip: boolean;
  shadowRoll: boolean;
  cheekPieces: boolean;
  lasix: boolean;
  lasixFirstTime: boolean;
  lasixOff: boolean;
  bute: boolean;
  raw: string;
}

// ============================================================================
// EQUIPMENT STRING PARSING
// ============================================================================

/**
 * Parse equipment from raw DRF string
 */
function parseEquipmentString(equipStr: string): ParsedEquipment {
  const str = equipStr.toLowerCase().trim();

  return {
    blinkers: /\bb\b|blink/i.test(str),
    blinkersOff: /\bbo\b|blinkers?\s*off/i.test(str),
    frontBandages: /\b(bl|fb)\b|front\s*band/i.test(str),
    hindBandages: /\b(hr|rb)\b|(hind|rear)\s*band/i.test(str),
    barShoes: /\bbs\b|bar\s*shoe/i.test(str),
    mudCaulks: /\bmc\b|mud\s*caulk/i.test(str),
    tongueTie: /\btt\b|tongue\s*tie/i.test(str),
    nasalStrip: /\bns\b|nasal\s*strip/i.test(str),
    shadowRoll: /\bsr\b|shadow\s*roll/i.test(str),
    cheekPieces: /\bcp\b|cheek\s*piece/i.test(str),
    lasix: /\bl\b(?!o|1)|lasix(?!\s*(off|first))/i.test(str),
    lasixFirstTime: /\bl1\b|lasix\s*first/i.test(str),
    lasixOff: /\blo\b|lasix\s*off/i.test(str),
    bute: /\bbu\b|bute/i.test(str),
    raw: equipStr,
  };
}

/**
 * Get equipment from HorseEntry objects
 */
function getEquipmentFromEntry(equipment: Equipment, medication: Medication): ParsedEquipment {
  return {
    blinkers: equipment.blinkers,
    blinkersOff: equipment.blinkersOff,
    frontBandages: equipment.frontBandages,
    hindBandages: equipment.rearBandages,
    barShoes: equipment.barShoes,
    mudCaulks: equipment.mudCaulks,
    tongueTie: equipment.tongueTie,
    nasalStrip: equipment.nasalStrip,
    shadowRoll: equipment.shadowRoll,
    cheekPieces: equipment.cheekPieces,
    lasix: medication.lasix,
    lasixFirstTime: medication.lasixFirstTime,
    lasixOff: medication.lasixOff,
    bute: medication.bute,
    raw: `${equipment.raw} ${medication.raw}`.trim(),
  };
}

// ============================================================================
// EQUIPMENT CHANGE DETECTION
// ============================================================================

/**
 * Compare two equipment states and detect changes
 */
function detectChanges(
  current: ParsedEquipment,
  previous: ParsedEquipment | null,
  firstTimeEquipment: string[]
): DetectedEquipmentChange[] {
  const changes: DetectedEquipmentChange[] = [];
  const firstTimeSet = new Set(firstTimeEquipment.map((e) => e.toLowerCase()));

  // Check Lasix first (most impactful)
  if (current.lasixFirstTime) {
    changes.push(createChange(EQUIPMENT_TYPES.lasix, 'added', true, 'First-time Lasix'));
  } else if (current.lasixOff) {
    changes.push(createChange(EQUIPMENT_TYPES.lasix, 'removed', false, 'Lasix removed'));
  }

  // Check blinkers
  if (current.blinkers && !previous?.blinkers) {
    const isFirstTime = firstTimeSet.has('b') || firstTimeSet.has('blinkers');
    changes.push(
      createChange(
        EQUIPMENT_TYPES.blinkers,
        'added',
        isFirstTime,
        isFirstTime ? 'Blinkers ON (first time)' : 'Blinkers ON'
      )
    );
  } else if (current.blinkersOff || (previous?.blinkers && !current.blinkers)) {
    changes.push(createChange(EQUIPMENT_TYPES.blinkers, 'removed', false, 'Blinkers OFF'));
  }

  // Check tongue tie
  if (current.tongueTie && !previous?.tongueTie) {
    const isFirstTime = firstTimeSet.has('tt') || firstTimeSet.has('tongue tie');
    changes.push(
      createChange(
        EQUIPMENT_TYPES.tongueTie,
        'added',
        isFirstTime,
        isFirstTime ? 'Tongue tie added (first time)' : 'Tongue tie added'
      )
    );
  } else if (previous?.tongueTie && !current.tongueTie) {
    changes.push(createChange(EQUIPMENT_TYPES.tongueTie, 'removed', false, 'Tongue tie removed'));
  }

  // Check nasal strip
  if (current.nasalStrip && !previous?.nasalStrip) {
    const isFirstTime = firstTimeSet.has('ns') || firstTimeSet.has('nasal strip');
    changes.push(
      createChange(
        EQUIPMENT_TYPES.nasalStrip,
        'added',
        isFirstTime,
        isFirstTime ? 'Nasal strip added (first time)' : 'Nasal strip added'
      )
    );
  }

  // Check shadow roll
  if (current.shadowRoll && !previous?.shadowRoll) {
    const isFirstTime = firstTimeSet.has('sr') || firstTimeSet.has('shadow roll');
    changes.push(
      createChange(EQUIPMENT_TYPES.shadowRoll, 'added', isFirstTime, 'Shadow roll added')
    );
  }

  // Check cheek pieces
  if (current.cheekPieces && !previous?.cheekPieces) {
    const isFirstTime = firstTimeSet.has('cp') || firstTimeSet.has('cheek pieces');
    changes.push(
      createChange(EQUIPMENT_TYPES.cheekPieces, 'added', isFirstTime, 'Cheek pieces added')
    );
  }

  // Check front bandages
  if (current.frontBandages && !previous?.frontBandages) {
    changes.push(
      createChange(EQUIPMENT_TYPES.frontBandages, 'added', false, 'Front bandages added')
    );
  }

  // Check hind bandages
  if (current.hindBandages && !previous?.hindBandages) {
    changes.push(createChange(EQUIPMENT_TYPES.hindBandages, 'added', false, 'Hind bandages added'));
  }

  // Check all bandages (both front and hind)
  if (
    current.frontBandages &&
    current.hindBandages &&
    (!previous?.frontBandages || !previous?.hindBandages)
  ) {
    // Remove individual bandage changes if we have all
    const filteredChanges = changes.filter(
      (c) => c.equipmentType.id !== 'frontBandages' && c.equipmentType.id !== 'hindBandages'
    );
    filteredChanges.push(
      createChange(EQUIPMENT_TYPES.allBandages, 'added', false, 'All bandages (4 legs)')
    );
    return filteredChanges;
  }

  // Check bar shoes
  if (current.barShoes && !previous?.barShoes) {
    changes.push(createChange(EQUIPMENT_TYPES.barShoes, 'added', false, 'Bar shoes added'));
  } else if (previous?.barShoes && !current.barShoes) {
    changes.push(createChange(EQUIPMENT_TYPES.barShoes, 'removed', false, 'Bar shoes removed'));
  }

  // Check mud caulks (usually only added)
  if (current.mudCaulks && !previous?.mudCaulks) {
    changes.push(createChange(EQUIPMENT_TYPES.mudCaulks, 'added', false, 'Mud caulks added'));
  }

  return changes;
}

/**
 * Create a detected equipment change
 */
function createChange(
  equipmentType: EquipmentTypeDefinition,
  direction: EquipmentChangeDirection,
  isFirstTime: boolean,
  description: string
): DetectedEquipmentChange {
  let basePoints: number;

  if (direction === 'added') {
    basePoints = equipmentType.impactAdded;
    if (isFirstTime && equipmentType.significantFirstTime) {
      basePoints += equipmentType.firstTimeBonus;
    }
  } else if (direction === 'removed') {
    basePoints = equipmentType.impactRemoved;
  } else {
    // Switched - average of added and removed
    basePoints = Math.round(
      (equipmentType.impactAdded + Math.abs(equipmentType.impactRemoved)) / 2
    );
  }

  return {
    equipmentType,
    direction,
    isFirstTime,
    basePoints,
    adjustedPoints: basePoints, // Will be adjusted by trainer patterns
    changeDescription: description,
    impact: getImpactClassification(basePoints),
  };
}

// ============================================================================
// EQUIPMENT HISTORY EXTRACTION
// ============================================================================

/**
 * Extract equipment history from past performances
 */
function extractEquipmentHistory(pastPerformances: PastPerformance[]): EquipmentHistoryEntry[] {
  return pastPerformances.map((pp) => ({
    date: pp.date,
    track: pp.track,
    equipment: pp.equipment || '',
    medication: pp.medication || '',
    finishPosition: pp.finishPosition,
    won: pp.finishPosition === 1,
  }));
}

/**
 * Analyze equipment history for patterns
 */
export function analyzeEquipmentHistory(history: EquipmentHistoryEntry[]): {
  usedLasix: boolean;
  usedBlinkers: boolean;
  blinkersWinRate: number;
  lasixWinRate: number;
  equipmentChangeRaces: number;
} {
  let lasixRaces = 0;
  let lasixWins = 0;
  let blinkerRaces = 0;
  let blinkerWins = 0;
  let prevEquipment = '';
  let equipmentChangeRaces = 0;

  for (const entry of history) {
    const combined = `${entry.equipment} ${entry.medication}`.toLowerCase();

    // Check Lasix usage
    if (/\bl\b|lasix/i.test(combined)) {
      lasixRaces++;
      if (entry.won) lasixWins++;
    }

    // Check blinkers usage
    if (/\bb\b|blink/i.test(combined)) {
      blinkerRaces++;
      if (entry.won) blinkerWins++;
    }

    // Check for equipment changes
    if (prevEquipment && prevEquipment !== combined) {
      equipmentChangeRaces++;
    }
    prevEquipment = combined;
  }

  return {
    usedLasix: lasixRaces > 0,
    usedBlinkers: blinkerRaces > 0,
    blinkersWinRate: blinkerRaces > 0 ? (blinkerWins / blinkerRaces) * 100 : 0,
    lasixWinRate: lasixRaces > 0 ? (lasixWins / lasixRaces) * 100 : 0,
    equipmentChangeRaces,
  };
}

// ============================================================================
// MAIN EXTRACTOR FUNCTION
// ============================================================================

/**
 * Extract all equipment information from a horse entry
 */
export function extractEquipmentInfo(horse: HorseEntry): EquipmentExtractionResult {
  // Get current equipment
  const current = getEquipmentFromEntry(horse.equipment, horse.medication);

  // Get last race equipment (if available)
  let lastRaceEquipment: string | null = null;
  let previous: ParsedEquipment | null = null;

  if (horse.pastPerformances.length > 0) {
    const lastPP = horse.pastPerformances[0];
    lastRaceEquipment = `${lastPP.equipment} ${lastPP.medication}`.trim();
    previous = parseEquipmentString(lastRaceEquipment);
  }

  // Detect changes
  const changes = detectChanges(current, previous, horse.equipment.firstTimeEquipment);

  // Extract history
  const history = extractEquipmentHistory(horse.pastPerformances);

  // Determine if significant
  const hasSignificantChange = changes.some(
    (c) => c.equipmentType.id === 'lasix' || c.equipmentType.id === 'blinkers' || c.isFirstTime
  );

  return {
    currentEquipment: current.raw,
    lastRaceEquipment,
    changes,
    history,
    hasChanges: changes.length > 0,
    hasSignificantChange,
  };
}

/**
 * Get a quick summary of equipment changes for display
 */
export function getEquipmentChangeSummary(horse: HorseEntry): {
  hasChanges: boolean;
  count: number;
  summary: string;
  primaryChange: DetectedEquipmentChange | null;
} {
  const result = extractEquipmentInfo(horse);

  if (!result.hasChanges) {
    return {
      hasChanges: false,
      count: 0,
      summary: '',
      primaryChange: null,
    };
  }

  // Get the most significant change (highest points)
  const sortedChanges = [...result.changes].sort(
    (a, b) => Math.abs(b.basePoints) - Math.abs(a.basePoints)
  );
  const primaryChange = sortedChanges[0];

  // Build summary
  const summary = result.changes.map((c) => c.changeDescription).join(', ');

  return {
    hasChanges: true,
    count: result.changes.length,
    summary,
    primaryChange,
  };
}

/**
 * Check if horse has specific equipment in current race
 */
export function hasEquipment(horse: HorseEntry, equipmentId: string): boolean {
  const equip = horse.equipment;
  const med = horse.medication;

  switch (equipmentId) {
    case 'lasix':
      return med.lasix || med.lasixFirstTime;
    case 'blinkers':
      return equip.blinkers;
    case 'tongueTie':
      return equip.tongueTie;
    case 'nasalStrip':
      return equip.nasalStrip;
    case 'shadowRoll':
      return equip.shadowRoll;
    case 'cheekPieces':
      return equip.cheekPieces;
    case 'frontBandages':
      return equip.frontBandages;
    case 'hindBandages':
      return equip.rearBandages;
    case 'barShoes':
      return equip.barShoes;
    case 'mudCaulks':
      return equip.mudCaulks;
    default:
      return false;
  }
}

/**
 * Check if equipment was used in past performances
 */
export function hasUsedEquipmentBefore(
  horse: HorseEntry,
  equipmentId: string
): { used: boolean; timesUsed: number; lastUsed: string | null } {
  const history = extractEquipmentHistory(horse.pastPerformances);

  let timesUsed = 0;
  let lastUsed: string | null = null;

  for (const entry of history) {
    const combined = `${entry.equipment} ${entry.medication}`.toLowerCase();
    let found = false;

    switch (equipmentId) {
      case 'lasix':
        found = /\bl\b|lasix/i.test(combined);
        break;
      case 'blinkers':
        found = /\bb\b|blink/i.test(combined);
        break;
      case 'tongueTie':
        found = /\btt\b|tongue/i.test(combined);
        break;
      case 'nasalStrip':
        found = /\bns\b|nasal/i.test(combined);
        break;
      case 'shadowRoll':
        found = /\bsr\b|shadow/i.test(combined);
        break;
      case 'cheekPieces':
        found = /\bcp\b|cheek/i.test(combined);
        break;
      case 'barShoes':
        found = /\bbs\b|bar/i.test(combined);
        break;
    }

    if (found) {
      timesUsed++;
      if (!lastUsed) {
        lastUsed = entry.date;
      }
    }
  }

  return {
    used: timesUsed > 0,
    timesUsed,
    lastUsed,
  };
}
