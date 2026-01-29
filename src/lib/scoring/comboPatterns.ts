/**
 * Combo Pattern Detection Module
 *
 * Identifies high-value plays where multiple positive signals align,
 * and pretenders where multiple negative signals indicate poor intent.
 *
 * Combined signals are more powerful than individual signals - when a trainer
 * pulls multiple levers at once (class drop + equipment + jockey upgrade),
 * it indicates serious intent to win. Conversely, class rises combined with
 * jockey downgrades indicate the trainer isn't trying hard.
 *
 * Score: -6 to +10 points (16 point spread for exacta separation)
 *
 * v4.0 CHANGES (Exacta Separation Enhancement):
 * - Expanded positive combos from 4 to 10 pts max
 * - Added negative combos (-6 to 0 pts) for pretender detection
 * - Net scoring: positive + negative, floored at -6, capped at +10
 * - New positive combos: class drop + trainer upgrade, first-time blinkers + class drop,
 *   jockey upgrade + equipment change, triple positive bonus
 * - New negative combos: class rise + jockey downgrade, class rise + no workout,
 *   trainer downgrade, triple negative penalty
 *
 * Combo Categories:
 * - High-Intent Combos: Class drop + equipment/jockey/trainer changes
 * - Freshening Combos: Layoff patterns with fitness indicators
 * - Surface/Distance Combos: First-time surface with breeding fit
 * - Triple Combos: Rare powerful combinations (+3 bonus)
 * - Negative Combos: Class rise + connection downgrades (pretender detection)
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
  /** Net total points (-6 to +10) */
  total: number;
  /** Gross positive points (0 to +10) */
  grossPositive: number;
  /** Gross negative points (-6 to 0) */
  grossNegative: number;
  /** All detected positive combos with details */
  detectedCombos: DetectedCombo[];
  /** All detected negative combos with details */
  negativePatterns: DetectedCombo[];
  /** Intent score (0-10 scale) indicating trainer intent */
  intentScore: number;
  /** Summary reasoning strings */
  reasoning: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum positive points from combo patterns
 * v4.0: Expanded from 4 to 10 pts for better exacta separation.
 * Horses with multiple positive intent signals should separate more clearly.
 */
export const MAX_COMBO_PATTERN_POINTS = 10;

/**
 * Maximum negative points from combo patterns (expressed as positive for cap)
 * v4.0: Added negative combos to push pretenders down.
 * Horses with class rise + jockey downgrade + no workout = -6 pts max
 */
export const MAX_NEGATIVE_COMBO_POINTS = -6;

/**
 * Minimum net combo score (floor)
 * Net score = gross positive + gross negative
 */
export const MIN_NET_COMBO_SCORE = -6;

/** Threshold for "hot" trainer at current meet (win percentage) */
const HOT_TRAINER_THRESHOLD = 25;

/** Threshold for jockey upgrade (win rate improvement) */
const JOCKEY_UPGRADE_THRESHOLD = 3;

/** Threshold for jockey downgrade (win rate decrease) */
const JOCKEY_DOWNGRADE_THRESHOLD = 3;

/** Days to look back for bullet works */
const BULLET_WORK_DAYS = 30;

/** Days threshold for layoff */
const LAYOFF_DAYS_THRESHOLD = 45;

/** Days threshold for "no recent work" negative combo */
const NO_WORKOUT_DAYS_THRESHOLD = 14;

/** Days threshold for "freshening" pattern (45-60 days) */
const FRESHENING_MIN_DAYS = 45;
const FRESHENING_MAX_DAYS = 60;

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
 * Check if horse is rising in class from last race (negative signal)
 */
export function isClassRise(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  if (horse.pastPerformances.length === 0) return false;

  const lastPP = horse.pastPerformances[0];
  if (!lastPP) return false;

  const currentClass = extractCurrentRaceClass(raceHeader);
  const lastClass = extractClassFromPP(lastPP);

  const currentValue = CLASS_LEVEL_METADATA[currentClass].value;
  const lastValue = CLASS_LEVEL_METADATA[lastClass].value;

  // Rise = current is higher value than last (facing tougher competition)
  return currentValue > lastValue;
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
 * Check if jockey is a downgrade from last race (negative signal)
 * Compares current jockey's meet stats to previous jockey's stats
 */
export function isJockeyDowngrade(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false;

  const lastPP = horse.pastPerformances[0];
  if (!lastPP) return false;

  const currentJockey = horse.jockeyName.toLowerCase().trim();
  const lastJockey = lastPP.jockey?.toLowerCase().trim() ?? '';

  // Same jockey = not a downgrade
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
    // Downgrade if current jockey is significantly worse
    return currentWinRate < lastJockeyWinRate - JOCKEY_DOWNGRADE_THRESHOLD;
  }

  // If current jockey has poor meet stats (<10% win rate), consider it a downgrade
  // (assuming the switch was a forced move, not intentional improvement)
  if (currentMeetStarts >= 10 && currentWinRate < 10) {
    return true;
  }

  return false;
}

/**
 * Check if this is a trainer upgrade (new trainer with higher win%)
 * Compares current trainer's meet win% to trainer from last race
 */
export function isTrainerUpgrade(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false;

  const lastPP = horse.pastPerformances[0];
  if (!lastPP) return false;

  // Check if trainer changed (look at PP trainer if available)
  const currentTrainer = horse.trainerName.toLowerCase().trim();
  const lastTrainer = lastPP.trainer?.toLowerCase().trim() ?? '';

  // Same trainer = not an upgrade
  if (currentTrainer === lastTrainer || !lastTrainer) return false;

  // Current trainer meet stats
  const currentMeetStarts = horse.trainerMeetStarts ?? 0;
  const currentMeetWins = horse.trainerMeetWins ?? 0;
  const currentWinRate = currentMeetStarts > 0 ? (currentMeetWins / currentMeetStarts) * 100 : 0;

  // For trainer upgrade, we need a significant improvement
  // If current trainer has 20%+ win rate at meet, consider it an upgrade
  if (currentMeetStarts >= 5 && currentWinRate >= 20) {
    return true;
  }

  return false;
}

/**
 * Check if this is a trainer downgrade (to lower win% trainer)
 * Negative signal when switching to a trainer with poor stats
 */
export function isTrainerDowngrade(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false;

  const lastPP = horse.pastPerformances[0];
  if (!lastPP) return false;

  // Check if trainer changed
  const currentTrainer = horse.trainerName.toLowerCase().trim();
  const lastTrainer = lastPP.trainer?.toLowerCase().trim() ?? '';

  // Same trainer = not a downgrade
  if (currentTrainer === lastTrainer || !lastTrainer) return false;

  // Current trainer meet stats
  const currentMeetStarts = horse.trainerMeetStarts ?? 0;
  const currentMeetWins = horse.trainerMeetWins ?? 0;
  const currentWinRate = currentMeetStarts > 0 ? (currentMeetWins / currentMeetStarts) * 100 : 0;

  // Trainer downgrade if new trainer has <10% win rate at meet
  if (currentMeetStarts >= 5 && currentWinRate < 10) {
    return true;
  }

  return false;
}

/**
 * Check if horse has no workout in the last 14 days (negative signal)
 * Combined with class rise, indicates lack of preparation
 */
export function hasNoRecentWorkout(horse: HorseEntry): boolean {
  if (horse.workouts.length === 0) return true;

  const now = new Date();

  for (const workout of horse.workouts) {
    try {
      const workDate = new Date(workout.date);
      const diffDays = (now.getTime() - workDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= NO_WORKOUT_DAYS_THRESHOLD) {
        return false; // Has a recent workout
      }
    } catch {
      // Invalid date, skip
    }
  }

  return true; // No workouts within threshold
}

/**
 * Check if horse is in the "freshening" window (45-60 days since last race)
 * Combined with bullet work, indicates strong comeback preparation
 */
export function isFreshening(horse: HorseEntry): boolean {
  const daysSince = horse.daysSinceLastRace;
  if (daysSince === null) return false;

  return daysSince >= FRESHENING_MIN_DAYS && daysSince <= FRESHENING_MAX_DAYS;
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
 * Detect all combo patterns for a horse (positive and negative)
 *
 * v4.0: Expanded positive combos to +10, added negative combos to -6
 * Net scoring for better exacta separation
 */
export function detectComboPatterns(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  _allHorses: HorseEntry[]
): ComboPatternResult {
  const detectedCombos: DetectedCombo[] = [];
  const negativePatterns: DetectedCombo[] = [];
  const reasoning: string[] = [];

  // Gather positive signal states
  const classDrop = isClassDrop(horse, raceHeader);
  const firstLasix = isFirstTimeLasix(horse);
  const firstBlinkers = isFirstTimeBlinkers(horse);
  const hasEquipment = hasFirstTimeEquipment(horse);
  const jockeyUpgrade = isJockeyUpgrade(horse);
  const trainerUpgrade = isTrainerUpgrade(horse);
  const trainerHot = isTrainerHot(horse);
  const secondLayoff = isSecondOffLayoff(horse);
  const returningLayoff = isReturningFromLayoff(horse);
  const bulletWork = hasBulletWork(horse);
  const firstTurf = isFirstTimeTurf(horse, raceHeader);
  const turfBreeding = hasTurfBreeding(horse);
  const distanceChange = isDistanceChange(horse, raceHeader);
  const freshening = isFreshening(horse);

  // Gather negative signal states
  const classRise = isClassRise(horse, raceHeader);
  const jockeyDowngrade = isJockeyDowngrade(horse);
  const trainerDowngrade = isTrainerDowngrade(horse);
  const noRecentWorkout = hasNoRecentWorkout(horse);

  // Count positive signals for triple bonus detection
  let positiveSignalCount = 0;
  if (classDrop) positiveSignalCount++;
  if (hasEquipment) positiveSignalCount++;
  if (jockeyUpgrade) positiveSignalCount++;
  if (trainerUpgrade) positiveSignalCount++;
  if (bulletWork) positiveSignalCount++;

  // Count negative signals for triple penalty detection
  let negativeSignalCount = 0;
  if (classRise) negativeSignalCount++;
  if (jockeyDowngrade) negativeSignalCount++;
  if (trainerDowngrade) negativeSignalCount++;
  if (noRecentWorkout) negativeSignalCount++;

  // =========================================================================
  // POSITIVE COMBOS (v4.0: expanded values)
  // =========================================================================

  // Class Drop + First Time Lasix: 3 pts (v4.0: up from 1)
  if (classDrop && firstLasix) {
    detectedCombos.push({
      combo: 'classDropLasix',
      components: ['classDrop', 'firstTimeLasix'],
      points: 3,
      reasoning: 'Dropping in class AND adding Lasix = going for the win',
    });
  }

  // Class Drop + Jockey Upgrade: 3 pts (v4.0: up from 1)
  if (classDrop && jockeyUpgrade) {
    detectedCombos.push({
      combo: 'classDropJockeyUpgrade',
      components: ['classDrop', 'jockeyUpgrade'],
      points: 3,
      reasoning: 'Dropping in class AND upgrading jockey = serious intent',
    });
  }

  // Layoff Return + Equipment Change: 2 pts (unchanged)
  if (returningLayoff && hasEquipment) {
    detectedCombos.push({
      combo: 'layoffEquipment',
      components: ['layoff', 'equipment'],
      points: 2,
      reasoning: 'Returning from layoff with equipment change = trainer adjustments',
    });
  }

  // Freshening (45-60 days) + Bullet Work: 2 pts (v4.0: up from 1)
  if (freshening && bulletWork) {
    detectedCombos.push({
      combo: 'fresheningBullet',
      components: ['freshening', 'bulletWork'],
      points: 2,
      reasoning: 'Freshened 45-60 days AND sharp workout = well-prepared return',
    });
  }

  // First Time Turf + Turf Sire: 2 pts (v4.0: up from 1)
  if (firstTurf && turfBreeding) {
    detectedCombos.push({
      combo: 'firstTurfWithBreeding',
      components: ['firstTimeTurf', 'turfBreeding'],
      points: 2,
      reasoning: 'First turf start with turf pedigree = bred for it',
    });
  }

  // Sprint to Route + Stamina Breeding: 2 pts (v4.0: up from 1)
  if (distanceChange === 'sprint_to_route' && hasTrainerDistancePattern(horse, distanceChange)) {
    detectedCombos.push({
      combo: 'sprintToRouteStamina',
      components: ['sprintToRoute', 'trainerPattern'],
      points: 2,
      reasoning: 'Stretching out with trainer who excels at sprint-to-route = strategic move',
    });
  }

  // =========================================================================
  // NEW POSITIVE COMBOS (v4.0)
  // =========================================================================

  // Class Drop + Trainer Upgrade: 2 pts (NEW)
  if (classDrop && trainerUpgrade) {
    detectedCombos.push({
      combo: 'classDropTrainerUpgrade',
      components: ['classDrop', 'trainerUpgrade'],
      points: 2,
      reasoning: 'Dropping in class AND new trainer with higher win% = serious upgrade',
    });
  }

  // First-time Blinkers + Class Drop: 2 pts (NEW)
  if (firstBlinkers && classDrop) {
    detectedCombos.push({
      combo: 'firstBlinkersClassDrop',
      components: ['firstTimeBlinkers', 'classDrop'],
      points: 2,
      reasoning: 'First-time blinkers at easier level = focused improvement attempt',
    });
  }

  // Jockey Upgrade + Equipment Change: 2 pts (NEW)
  if (jockeyUpgrade && hasEquipment) {
    detectedCombos.push({
      combo: 'jockeyUpgradeEquipment',
      components: ['jockeyUpgrade', 'equipment'],
      points: 2,
      reasoning: 'Better jockey AND equipment change = double improvement',
    });
  }

  // 2nd Off Layoff + Bullet Work: 2 pts
  if (secondLayoff && bulletWork) {
    detectedCombos.push({
      combo: 'secondLayoffBullet',
      components: ['secondOffLayoff', 'bulletWork'],
      points: 2,
      reasoning: 'Second start after layoff AND sharp workout = fit and ready',
    });
  }

  // Layoff + Class Drop: 2 pts
  if (returningLayoff && classDrop) {
    detectedCombos.push({
      combo: 'layoffClassDrop',
      components: ['layoff', 'classDrop'],
      points: 2,
      reasoning: 'Returning from layoff at easier level = trainer wants a confidence builder',
    });
  }

  // Class Drop + Hot Trainer: 2 pts
  if (classDrop && trainerHot) {
    detectedCombos.push({
      combo: 'classDropHotTrainer',
      components: ['classDrop', 'trainerHot'],
      points: 2,
      reasoning: 'Dropping in class with hot trainer = confidence play',
    });
  }

  // Route to Sprint + Trainer Pattern: 2 pts
  if (distanceChange === 'route_to_sprint' && hasTrainerDistancePattern(horse, distanceChange)) {
    detectedCombos.push({
      combo: 'routeToSprintPattern',
      components: ['routeToSprint', 'trainerPattern'],
      points: 2,
      reasoning: 'Cutting back with trainer who excels at route-to-sprint = tactical move',
    });
  }

  // =========================================================================
  // TRIPLE POSITIVE BONUS (v4.0: +3 pts for any 3 positive signals)
  // =========================================================================
  if (positiveSignalCount >= 3) {
    detectedCombos.push({
      combo: 'triplePositiveBonus',
      components: ['multiplePositiveSignals'],
      points: 3,
      reasoning: `Triple positive combo: ${positiveSignalCount} positive signals aligned = all-in move`,
    });
  }

  // =========================================================================
  // NEGATIVE COMBOS (v4.0: new pretender detection)
  // =========================================================================

  // Class Rise + Jockey Downgrade: -3 pts
  if (classRise && jockeyDowngrade) {
    negativePatterns.push({
      combo: 'classRiseJockeyDowngrade',
      components: ['classRise', 'jockeyDowngrade'],
      points: -3,
      reasoning: 'Rising in class AND downgrading jockey = trainer not trying hard',
    });
  }

  // Class Rise + No Workout in 14 days: -2 pts
  if (classRise && noRecentWorkout) {
    negativePatterns.push({
      combo: 'classRiseNoWorkout',
      components: ['classRise', 'noRecentWorkout'],
      points: -2,
      reasoning: 'Rising in class without recent workout = underprepared for tougher competition',
    });
  }

  // Trainer Downgrade (standalone): -2 pts
  if (trainerDowngrade) {
    negativePatterns.push({
      combo: 'trainerDowngrade',
      components: ['trainerDowngrade'],
      points: -2,
      reasoning: 'Switched to trainer with lower win% = downward move',
    });
  }

  // Jockey Downgrade + No Recent Workout: -2 pts
  if (jockeyDowngrade && noRecentWorkout) {
    negativePatterns.push({
      combo: 'jockeyDowngradeNoWorkout',
      components: ['jockeyDowngrade', 'noRecentWorkout'],
      points: -2,
      reasoning: 'Worse jockey AND no recent workout = lack of preparation and investment',
    });
  }

  // =========================================================================
  // TRIPLE NEGATIVE PENALTY (v4.0: -3 pts additional for 3+ negative signals)
  // =========================================================================
  if (negativeSignalCount >= 3) {
    negativePatterns.push({
      combo: 'tripleNegativePenalty',
      components: ['multipleNegativeSignals'],
      points: -3,
      reasoning: `Triple negative combo: ${negativeSignalCount} negative signals = pretender alert`,
    });
  }

  // =========================================================================
  // CALCULATE TOTALS WITH FLOOR/CEILING
  // =========================================================================

  // Gross positive (capped at +10)
  const rawPositive = detectedCombos.reduce((sum, c) => sum + c.points, 0);
  const grossPositive = Math.min(rawPositive, MAX_COMBO_PATTERN_POINTS);

  // Gross negative (floored at -6)
  const rawNegative = negativePatterns.reduce((sum, c) => sum + c.points, 0);
  const grossNegative = Math.max(rawNegative, MAX_NEGATIVE_COMBO_POINTS);

  // Net total (floor -6, ceiling +10)
  const netTotal = Math.max(MIN_NET_COMBO_SCORE, Math.min(MAX_COMBO_PATTERN_POINTS, grossPositive + grossNegative));

  // Intent score (0-10 scale)
  // Based on how many high-intent signals are present
  let intentScore = 0;

  // Positive intent signals
  if (classDrop) intentScore += 2;
  if (hasEquipment) intentScore += 2;
  if (jockeyUpgrade) intentScore += 2;
  if (trainerUpgrade) intentScore += 1;
  if (trainerHot) intentScore += 1;
  if (bulletWork) intentScore += 1;

  // Bonus for multiple combos
  if (detectedCombos.length >= 2) intentScore += 1;

  // Penalty for negative signals
  if (classRise) intentScore -= 2;
  if (jockeyDowngrade) intentScore -= 1;
  if (trainerDowngrade) intentScore -= 1;

  intentScore = Math.max(0, Math.min(10, intentScore));

  // Build reasoning
  for (const combo of detectedCombos) {
    reasoning.push(`${combo.reasoning} (+${combo.points} pts)`);
  }

  for (const combo of negativePatterns) {
    reasoning.push(`${combo.reasoning} (${combo.points} pts)`);
  }

  if (rawPositive > MAX_COMBO_PATTERN_POINTS) {
    reasoning.push(`Positive combos capped at ${MAX_COMBO_PATTERN_POINTS} pts (raw: ${rawPositive})`);
  }

  if (rawNegative < MAX_NEGATIVE_COMBO_POINTS) {
    reasoning.push(`Negative combos floored at ${MAX_NEGATIVE_COMBO_POINTS} pts (raw: ${rawNegative})`);
  }

  return {
    total: netTotal,
    grossPositive,
    grossNegative,
    detectedCombos,
    negativePatterns,
    intentScore,
    reasoning,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if any combo patterns are detected for this horse (positive or negative)
 */
export function hasComboPatterns(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  const result = detectComboPatterns(horse, raceHeader, []);
  return result.detectedCombos.length > 0 || result.negativePatterns.length > 0;
}

/**
 * Check if any negative combo patterns are detected for this horse
 */
export function hasNegativeComboPatterns(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  const result = detectComboPatterns(horse, raceHeader, []);
  return result.negativePatterns.length > 0;
}

/**
 * Get a summary string for combo patterns
 */
export function getComboPatternSummary(result: ComboPatternResult): string {
  const positiveCount = result.detectedCombos.length;
  const negativeCount = result.negativePatterns.length;

  if (positiveCount === 0 && negativeCount === 0) {
    return 'No combo patterns detected';
  }

  const parts: string[] = [];

  if (positiveCount > 0) {
    const combos = result.detectedCombos.map((c) => `${c.combo}: +${c.points}`).join(', ');
    parts.push(`+${result.grossPositive} from ${positiveCount} positive: ${combos}`);
  }

  if (negativeCount > 0) {
    const combos = result.negativePatterns.map((c) => `${c.combo}: ${c.points}`).join(', ');
    parts.push(`${result.grossNegative} from ${negativeCount} negative: ${combos}`);
  }

  return `Net ${result.total} pts (${parts.join(' | ')})`;
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
