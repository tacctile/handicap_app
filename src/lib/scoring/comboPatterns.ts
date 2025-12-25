/**
 * Combo Pattern Detection Module
 *
 * Identifies high-value plays where multiple positive signals align.
 * Combined signals are more powerful than individual signals - when a trainer
 * pulls multiple levers at once (class drop + equipment + jockey upgrade),
 * it indicates serious intent to win.
 *
 * Score: 0-12 points max (stacks multiple combos, capped)
 *
 * Combo Categories:
 * - High-Intent Combos: Class drop + equipment/jockey changes
 * - Freshening Combos: Layoff patterns with fitness indicators
 * - Surface/Distance Combos: First-time surface with breeding fit
 * - Triple Combos: Rare powerful combinations
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import { extractCurrentRaceClass, extractClassFromPP } from '../class';
import { CLASS_LEVEL_METADATA } from '../class/classTypes';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Individual detected combo with scoring details
 */
export interface DetectedCombo {
  /** Combo identifier (e.g., "classDropLasix") */
  combo: string;
  /** Component signals that make up this combo */
  components: string[];
  /** Points awarded for this combo */
  points: number;
  /** Human-readable explanation */
  reasoning: string;
}

/**
 * Result of combo pattern detection
 */
export interface ComboPatternResult {
  /** Total points (0-12 max) */
  total: number;
  /** All detected combos with details */
  detectedCombos: DetectedCombo[];
  /** Intent score (0-10 scale) indicating trainer intent */
  intentScore: number;
  /** Summary reasoning strings */
  reasoning: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum total points from combo patterns
 * v2.5: Reduced from 12 to 6 pts per diagnostic findings.
 * Combos are informational signals but shouldn't swing rankings heavily.
 * Longshots were getting +12 from combos while favorites got 0.
 */
export const MAX_COMBO_PATTERN_POINTS = 6;

/** Threshold for "hot" trainer at current meet (win percentage) */
const HOT_TRAINER_THRESHOLD = 25;

/** Threshold for jockey upgrade (win rate improvement) */
const JOCKEY_UPGRADE_THRESHOLD = 3;

/** Days to look back for bullet works */
const BULLET_WORK_DAYS = 30;

/** Days threshold for layoff */
const LAYOFF_DAYS_THRESHOLD = 45;

// ============================================================================
// SIGNAL DETECTION HELPERS
// ============================================================================

/**
 * Check if horse is dropping in class from last race
 */
export function isClassDrop(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  if (horse.pastPerformances.length === 0) return false;

  const lastPP = horse.pastPerformances[0];
  if (!lastPP) return false;

  const currentClass = extractCurrentRaceClass(raceHeader);
  const lastClass = extractClassFromPP(lastPP);

  const currentValue = CLASS_LEVEL_METADATA[currentClass].value;
  const lastValue = CLASS_LEVEL_METADATA[lastClass].value;

  // Drop = current is lower value than last
  return currentValue < lastValue;
}

/**
 * Check if horse is first-time Lasix
 */
export function isFirstTimeLasix(horse: HorseEntry): boolean {
  // Explicit first-time Lasix flag
  if (horse.medication.lasixFirstTime) return true;

  // Currently on Lasix but wasn't last race
  if (horse.medication.lasix && horse.pastPerformances.length > 0) {
    const lastRace = horse.pastPerformances[0];
    if (lastRace && !lastRace.medication.includes('L')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if horse is first-time Blinkers
 */
export function isFirstTimeBlinkers(horse: HorseEntry): boolean {
  // Explicit first-time equipment flag
  if (horse.equipment.firstTimeEquipment.includes('blinkers')) return true;

  // Currently has blinkers but didn't last race
  if (horse.equipment.blinkers && horse.pastPerformances.length > 0) {
    const lastRace = horse.pastPerformances[0];
    if (lastRace && !lastRace.equipment.includes('B')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if there's any first-time equipment (Lasix, blinkers, or other)
 */
export function hasFirstTimeEquipment(horse: HorseEntry): boolean {
  return (
    isFirstTimeLasix(horse) ||
    isFirstTimeBlinkers(horse) ||
    horse.equipment.firstTimeEquipment.length > 0
  );
}

/**
 * Check if jockey is an upgrade from last race
 * Compares current jockey's meet stats to previous jockey's stats
 */
export function isJockeyUpgrade(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false;

  const lastPP = horse.pastPerformances[0];
  if (!lastPP) return false;

  const currentJockey = horse.jockeyName.toLowerCase().trim();
  const lastJockey = lastPP.jockey?.toLowerCase().trim() ?? '';

  // Same jockey = not an upgrade
  if (currentJockey === lastJockey) return false;

  // Use meet stats if available
  const currentMeetStarts = horse.jockeyMeetStarts ?? 0;
  const currentMeetWins = horse.jockeyMeetWins ?? 0;
  const currentWinRate = currentMeetStarts > 0 ? (currentMeetWins / currentMeetStarts) * 100 : 0;

  // Try to get last jockey's stats from past performances
  // Count their wins/starts from PPs where they rode
  let lastJockeyStarts = 0;
  let lastJockeyWins = 0;

  for (const pp of horse.pastPerformances) {
    if (pp.jockey?.toLowerCase().trim() === lastJockey) {
      lastJockeyStarts++;
      if (pp.finishPosition === 1) {
        lastJockeyWins++;
      }
    }
  }

  // If we have enough data on last jockey
  if (lastJockeyStarts >= 3) {
    const lastJockeyWinRate = (lastJockeyWins / lastJockeyStarts) * 100;
    return currentWinRate > lastJockeyWinRate + JOCKEY_UPGRADE_THRESHOLD;
  }

  // If we have current jockey meet stats showing 15%+ win rate, consider it an upgrade
  // (assuming switch was intentional to get a better rider)
  if (currentMeetStarts >= 10 && currentWinRate >= 15) {
    return true;
  }

  return false;
}

/**
 * Check if this is the horse's 2nd start off a layoff
 */
export function isSecondOffLayoff(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length < 2) return false;

  const lastRace = horse.pastPerformances[0];
  if (!lastRace || lastRace.daysSinceLast === null) return false;

  // If last race's gap before it was 45+ days, today is 2nd off layoff
  return lastRace.daysSinceLast >= LAYOFF_DAYS_THRESHOLD;
}

/**
 * Check if horse is returning from a layoff (first race back)
 */
export function isReturningFromLayoff(horse: HorseEntry): boolean {
  const daysSince = horse.daysSinceLastRace;
  return daysSince !== null && daysSince >= LAYOFF_DAYS_THRESHOLD;
}

/**
 * Check if horse has a bullet workout within specified days
 */
export function hasBulletWork(horse: HorseEntry, withinDays: number = BULLET_WORK_DAYS): boolean {
  if (horse.workouts.length === 0) return false;

  const now = new Date();

  for (const workout of horse.workouts) {
    if (!workout.isBullet) continue;

    try {
      const workDate = new Date(workout.date);
      const diffDays = (now.getTime() - workDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= withinDays) {
        return true;
      }
    } catch {
      // Invalid date, skip
    }
  }

  return false;
}

/**
 * Check if trainer is "hot" at the current meet
 * Hot = 25%+ win rate at current meet with sufficient sample
 */
export function isTrainerHot(
  horse: HorseEntry,
  threshold: number = HOT_TRAINER_THRESHOLD
): boolean {
  const meetStarts = horse.trainerMeetStarts ?? 0;
  const meetWins = horse.trainerMeetWins ?? 0;

  // Need at least 5 starts to be credible
  if (meetStarts < 5) return false;

  const winRate = (meetWins / meetStarts) * 100;
  return winRate >= threshold;
}

/**
 * Check if this is horse's first start on turf
 */
export function isFirstTimeTurf(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  if (raceHeader.surface !== 'turf') return false;

  // Check if horse has any turf starts
  const turfStarts = horse.turfStarts ?? 0;
  if (turfStarts > 0) return false;

  // Also check past performances for turf
  for (const pp of horse.pastPerformances) {
    if (pp.surface === 'turf') return false;
  }

  return true;
}

/**
 * Check if horse has turf breeding (sire known for turf success)
 * Simplified check based on breeding info
 */
export function hasTurfBreeding(horse: HorseEntry): boolean {
  const sire = horse.breeding.sire?.toLowerCase() ?? '';
  const damSire = horse.breeding.damSire?.toLowerCase() ?? '';

  // Known turf sires (partial list - most common)
  const turfSires = [
    "kitten's joy",
    'english channel',
    "medaglia d'oro",
    'war front',
    'more than ready',
    'hard spun',
    "giant's causeway",
    'scat daddy',
    'blame',
    'city zip',
    'arch',
    'lemon drop kid',
    'dynaformer',
    'street cry',
    'street sense',
    'the factor',
    'uncle mo',
    'tapit',
    'ghostzapper',
    'awesome again',
    'distorted humor',
    'curlin',
    'speightstown',
    'american pharoah',
    'quality road',
    'nyquist',
    'constitution',
    'into mischief',
    'munnings',
  ];

  // Check sire
  for (const turfSire of turfSires) {
    if (sire.includes(turfSire)) return true;
  }

  // Check damsire (inherited turf influence)
  for (const turfSire of turfSires) {
    if (damSire.includes(turfSire)) return true;
  }

  return false;
}

/**
 * Check if horse is making a distance change (sprint to route or route to sprint)
 */
export function isDistanceChange(
  horse: HorseEntry,
  raceHeader: RaceHeader
): 'sprint_to_route' | 'route_to_sprint' | null {
  if (horse.pastPerformances.length === 0) return null;

  const lastPP = horse.pastPerformances[0];
  if (!lastPP) return null;

  const currentDistance = raceHeader.distanceFurlongs;
  const lastDistance = lastPP.distanceFurlongs;

  const currentIsRoute = currentDistance >= 8;
  const lastIsRoute = lastDistance >= 8;

  if (!lastIsRoute && currentIsRoute) return 'sprint_to_route';
  if (lastIsRoute && !currentIsRoute) return 'route_to_sprint';

  return null;
}

/**
 * Check if trainer has good stats for distance change pattern
 */
export function hasTrainerDistancePattern(
  horse: HorseEntry,
  changeType: 'sprint_to_route' | 'route_to_sprint'
): boolean {
  const stats = horse.trainerCategoryStats;

  if (changeType === 'sprint_to_route') {
    return stats.sprintToRoute.starts >= 5 && stats.sprintToRoute.winPercent >= 20;
  } else {
    return stats.routeToSprint.starts >= 5 && stats.routeToSprint.winPercent >= 20;
  }
}

// ============================================================================
// COMBO DETECTION
// ============================================================================

/**
 * Detect all combo patterns for a horse
 */
export function detectComboPatterns(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  _allHorses: HorseEntry[]
): ComboPatternResult {
  const detectedCombos: DetectedCombo[] = [];
  const reasoning: string[] = [];

  // Gather signal states
  const classDrop = isClassDrop(horse, raceHeader);
  const firstLasix = isFirstTimeLasix(horse);
  const firstBlinkers = isFirstTimeBlinkers(horse);
  const hasEquipment = hasFirstTimeEquipment(horse);
  const jockeyUpgrade = isJockeyUpgrade(horse);
  const trainerHot = isTrainerHot(horse);
  const secondLayoff = isSecondOffLayoff(horse);
  const returningLayoff = isReturningFromLayoff(horse);
  const bulletWork = hasBulletWork(horse);
  const firstTurf = isFirstTimeTurf(horse, raceHeader);
  const turfBreeding = hasTurfBreeding(horse);
  const distanceChange = isDistanceChange(horse, raceHeader);

  // =========================================================================
  // HIGH-INTENT COMBOS (trainer is trying to win)
  // =========================================================================

  // Class Drop + First Time Lasix: 2 pts (v2.5: halved from 4)
  if (classDrop && firstLasix) {
    detectedCombos.push({
      combo: 'classDropLasix',
      components: ['classDrop', 'firstTimeLasix'],
      points: 2,
      reasoning: 'Dropping in class AND adding Lasix = going for the win',
    });
  }

  // Class Drop + First Time Blinkers: 1 pt (v2.5: halved from 3, rounded down)
  if (classDrop && firstBlinkers) {
    detectedCombos.push({
      combo: 'classDropBlinkers',
      components: ['classDrop', 'firstTimeBlinkers'],
      points: 1,
      reasoning: 'Dropping in class AND adding blinkers = equipment experiment at easier level',
    });
  }

  // Class Drop + Jockey Upgrade: 2 pts (v2.5: halved from 4)
  if (classDrop && jockeyUpgrade) {
    detectedCombos.push({
      combo: 'classDropJockeyUpgrade',
      components: ['classDrop', 'jockeyUpgrade'],
      points: 2,
      reasoning: 'Dropping in class AND upgrading jockey = serious intent',
    });
  }

  // Class Drop + Trainer Hot: 1 pt (v2.5: halved from 3, rounded down)
  if (classDrop && trainerHot) {
    detectedCombos.push({
      combo: 'classDropHotTrainer',
      components: ['classDrop', 'trainerHot'],
      points: 1,
      reasoning: 'Dropping in class with hot trainer = confidence play',
    });
  }

  // =========================================================================
  // FRESHENING COMBOS (horse is ready)
  // =========================================================================

  // 2nd Off Layoff + Bullet Work: 2 pts (v2.5: halved from 3, rounded up)
  if (secondLayoff && bulletWork) {
    detectedCombos.push({
      combo: 'secondLayoffBullet',
      components: ['secondOffLayoff', 'bulletWork'],
      points: 2,
      reasoning: 'Second start after layoff AND sharp workout = fit and ready',
    });
  }

  // Layoff + Class Drop: 2 pts (v2.5: halved from 3, rounded up)
  if (returningLayoff && classDrop) {
    detectedCombos.push({
      combo: 'layoffClassDrop',
      components: ['layoff', 'classDrop'],
      points: 2,
      reasoning: 'Returning from layoff at easier level = trainer wants a confidence builder',
    });
  }

  // =========================================================================
  // SURFACE/DISTANCE COMBOS
  // =========================================================================

  // First Time Turf + Turf Breeding: 1 pt (v2.5: halved from 2)
  if (firstTurf && turfBreeding) {
    detectedCombos.push({
      combo: 'firstTurfWithBreeding',
      components: ['firstTimeTurf', 'turfBreeding'],
      points: 1,
      reasoning: 'First turf start with turf pedigree = bred for it',
    });
  }

  // Distance Change + Trainer Pattern: 1 pt (v2.5: halved from 2)
  if (distanceChange && hasTrainerDistancePattern(horse, distanceChange)) {
    detectedCombos.push({
      combo: 'distanceChangeTrainerPattern',
      components: ['distanceChange', 'trainerPattern'],
      points: 1,
      reasoning: `Trainer knows how to ${distanceChange === 'sprint_to_route' ? 'stretch out' : 'cut back'} horses`,
    });
  }

  // =========================================================================
  // TRIPLE COMBOS (rare but powerful)
  // =========================================================================

  // Class Drop + Equipment + Jockey Upgrade: 3 pts (v2.5: halved from 6)
  // This overrides the individual combos if all three are present
  if (classDrop && hasEquipment && jockeyUpgrade) {
    // Remove any double combos that would overlap
    const overlappingCombos = ['classDropLasix', 'classDropBlinkers', 'classDropJockeyUpgrade'];
    const filtered = detectedCombos.filter((c) => !overlappingCombos.includes(c.combo));
    detectedCombos.length = 0;
    detectedCombos.push(...filtered);

    detectedCombos.push({
      combo: 'tripleClassEquipmentJockey',
      components: ['classDrop', 'equipment', 'jockeyUpgrade'],
      points: 3,
      reasoning: 'All-in move — trainer pulling every lever',
    });
  }

  // Layoff + Class Drop + Equipment: 3 pts (v2.5: halved from 5, rounded up)
  // This overrides the individual combos if all three are present
  if (returningLayoff && classDrop && hasEquipment) {
    // Don't duplicate if we already have the triple combo above
    const hasTriple = detectedCombos.some((c) => c.combo === 'tripleClassEquipmentJockey');

    if (!hasTriple) {
      // Remove overlapping combos
      const overlappingCombos = ['layoffClassDrop', 'classDropLasix', 'classDropBlinkers'];
      const filtered = detectedCombos.filter((c) => !overlappingCombos.includes(c.combo));
      detectedCombos.length = 0;
      detectedCombos.push(...filtered);

      detectedCombos.push({
        combo: 'tripleLayoffClassEquipment',
        components: ['layoff', 'classDrop', 'equipment'],
        points: 3,
        reasoning: 'Freshened, dropped, and equipped = ready to fire',
      });
    }
  }

  // =========================================================================
  // CALCULATE TOTAL AND INTENT SCORE
  // =========================================================================

  const rawTotal = detectedCombos.reduce((sum, c) => sum + c.points, 0);
  const total = Math.min(rawTotal, MAX_COMBO_PATTERN_POINTS);

  // Intent score (0-10 scale)
  // Based on how many high-intent signals are present
  let intentScore = 0;

  // Base intent signals
  if (classDrop) intentScore += 2;
  if (hasEquipment) intentScore += 2;
  if (jockeyUpgrade) intentScore += 2;
  if (trainerHot) intentScore += 1;
  if (bulletWork) intentScore += 1;

  // Bonus for combos
  if (detectedCombos.length >= 2) intentScore += 1;
  if (detectedCombos.some((c) => c.combo.startsWith('triple'))) intentScore += 1;

  intentScore = Math.min(10, intentScore);

  // Build reasoning
  for (const combo of detectedCombos) {
    reasoning.push(`${combo.reasoning} (+${combo.points} pts)`);
  }

  if (rawTotal > MAX_COMBO_PATTERN_POINTS) {
    reasoning.push(`Total capped at ${MAX_COMBO_PATTERN_POINTS} pts (raw: ${rawTotal})`);
  }

  return {
    total,
    detectedCombos,
    intentScore,
    reasoning,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if any combo patterns are detected for this horse
 */
export function hasComboPatterns(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  const result = detectComboPatterns(horse, raceHeader, []);
  return result.detectedCombos.length > 0;
}

/**
 * Get a summary string for combo patterns
 */
export function getComboPatternSummary(result: ComboPatternResult): string {
  if (result.detectedCombos.length === 0) {
    return 'No combo patterns detected';
  }

  const combos = result.detectedCombos.map((c) => `${c.combo}: +${c.points}`).join(', ');
  return `${result.total} pts from ${result.detectedCombos.length} combo(s): ${combos}`;
}

/**
 * Get intent level description
 */
export function getIntentLevel(intentScore: number): string {
  if (intentScore >= 8) return 'Maximum Intent';
  if (intentScore >= 6) return 'High Intent';
  if (intentScore >= 4) return 'Moderate Intent';
  if (intentScore >= 2) return 'Some Intent';
  return 'Low Intent';
}
