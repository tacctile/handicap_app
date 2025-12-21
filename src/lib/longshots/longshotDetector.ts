/**
 * Longshot Upset Angle Detector
 *
 * Detects specific upset angles for horses at 25/1+ odds.
 * Each angle has specific criteria that must be met with hard evidence.
 */

import type { HorseEntry, RaceHeader, Workout } from '../../types/drf';
import {
  type DetectedUpsetAngle,
  UPSET_ANGLE_NAMES,
  UPSET_ANGLE_BASE_POINTS,
} from './longshotTypes';
import { type PaceScenarioAnalysis, type RunningStyleProfile } from '../scoring/paceAnalysis';
import type { ClassScoreResult } from '../class/classScoring';
import type { EquipmentScoreResult } from '../equipment/equipmentScoring';
import {
  getTrainerPattern,
  getTrainerProfile,
  type EquipmentChangeType,
} from '../equipment/trainerPatterns';
import { getSpeedBias, getPostPositionBias } from '../trackIntelligence';
import { logger } from '../../services/logging';

// ============================================================================
// PACE DEVASTATION DETECTION
// ============================================================================

/**
 * Detect Pace Devastation angle
 *
 * Criteria:
 * - Speed duel scenario (PPI > 50)
 * - Horse is lone closer or one of few closers
 * - 4+ early speed horses in field
 * - Early speed will burn each other out
 *
 * Points: 40 base + up to 10 bonus
 */
export function detectPaceDevastation(
  horse: HorseEntry,
  _allHorses: HorseEntry[],
  paceScenario: PaceScenarioAnalysis,
  runningStyle: RunningStyleProfile
): DetectedUpsetAngle | null {
  try {
    const evidenceDetails: string[] = [];
    let bonusPoints = 0;

    // Check PPI > 50 (speed duel)
    if (paceScenario.ppi <= 50) {
      return null; // Not a speed duel
    }
    evidenceDetails.push(`PPI: ${paceScenario.ppi} (Speed Duel)`);

    // Check horse is a closer
    if (runningStyle.style !== 'C') {
      return null; // Not a closer
    }
    evidenceDetails.push(`Running Style: Closer`);

    // Check speed horse count
    const speedCount = paceScenario.styleBreakdown.earlySpeed.length;
    if (speedCount < 4) {
      return null; // Not enough speed for collapse
    }
    evidenceDetails.push(`${speedCount} early speed horses will battle`);

    // Check closer count (prefer lone closer)
    const closerCount = paceScenario.styleBreakdown.closers.length;
    if (closerCount === 1) {
      evidenceDetails.push('Lone closer in the field');
      bonusPoints += 5;
    } else if (closerCount <= 2) {
      evidenceDetails.push(`Only ${closerCount} closers in field`);
      bonusPoints += 2;
    }

    // Bonus: Rail speed (inside posts have early speed)
    const insideSpeedCount = paceScenario.styleBreakdown.earlySpeed.filter((pn) => pn <= 3).length;
    if (insideSpeedCount >= 2) {
      evidenceDetails.push('Speed from inside posts will engage early');
      bonusPoints += 3;
    }

    // Bonus: Proven closing ability (finished top 3 making late run)
    const closingWins = runningStyle.evidence.filter(
      (e) => e.styleInRace === 'C' && e.finishPosition <= 3
    ).length;
    if (closingWins >= 2) {
      evidenceDetails.push(`${closingWins} top-3 finishes with closing runs`);
      bonusPoints += 2;
    }

    const points = UPSET_ANGLE_BASE_POINTS.pace_devastation + Math.min(bonusPoints, 10);
    const evidence = `${speedCount} speed horses will battle, this closer gets perfect setup`;

    return {
      category: 'pace_devastation',
      name: UPSET_ANGLE_NAMES.pace_devastation,
      points,
      evidence,
      evidenceDetails,
      confidence: Math.min(95, 70 + (paceScenario.ppi - 50)),
      hasAllRequiredEvidence: true,
      bonusPoints: Math.min(bonusPoints, 10),
    };
  } catch (_error) {
    logger.logWarning('Error detecting pace devastation angle', {
      component: 'longshotDetector',
      horseName: horse.horseName,
    });
    return null;
  }
}

// ============================================================================
// CLASS RELIEF DETECTION
// ============================================================================

/**
 * Detect Class Relief angle
 *
 * Criteria:
 * - 3+ level class drop from last race
 * - Proven at higher level (won or placed)
 * - Now facing significantly weaker competition
 *
 * Points: 35 base + up to 10 bonus
 */
export function detectClassRelief(
  horse: HorseEntry,
  _raceHeader: RaceHeader,
  classScore: ClassScoreResult
): DetectedUpsetAngle | null {
  try {
    const evidenceDetails: string[] = [];
    let bonusPoints = 0;

    const movement = classScore.analysis.movement;

    // Must be dropping
    if (movement.direction !== 'drop') {
      return null;
    }

    // Calculate levels dropped
    const levelsDiff = Math.abs(movement.levelsDifference);

    // Need 3+ level drop (using value difference / 5 as approximation)
    const approximateLevels = Math.ceil(levelsDiff / 5);
    if (approximateLevels < 3) {
      return null;
    }
    evidenceDetails.push(`Dropping ${approximateLevels} class levels`);

    // Check if proven at higher level
    const provenAt = classScore.analysis.provenAtLevel;

    if (!provenAt.hasWon && !provenAt.hasPlaced && !provenAt.wasCompetitive) {
      return null; // No form at higher level
    }

    if (provenAt.hasWon) {
      evidenceDetails.push(`Won ${provenAt.winsAtLevel} race(s) at higher class`);
      bonusPoints += 5;
    } else if (provenAt.hasPlaced) {
      evidenceDetails.push(`Placed ${provenAt.itmAtLevel} time(s) at higher class`);
      bonusPoints += 3;
    } else {
      evidenceDetails.push(`Competitive (within 5 lengths) at higher level`);
    }

    // Bonus: Hidden drops detected
    if (classScore.analysis.hiddenDrops.length > 0) {
      const hiddenDesc = classScore.analysis.hiddenDrops.map((d) => d.type).join(', ');
      evidenceDetails.push(`Hidden edges: ${hiddenDesc}`);
      bonusPoints += classScore.analysis.hiddenDrops.length * 2;
    }

    // Bonus: Major claiming price drop
    if (movement.claimingPriceDrop && movement.claimingPriceDrop >= 15000) {
      const dropK = Math.round(movement.claimingPriceDrop / 1000);
      evidenceDetails.push(`$${dropK}K claiming price drop`);
      bonusPoints += 3;
    }

    const points = UPSET_ANGLE_BASE_POINTS.class_relief + Math.min(bonusPoints, 10);
    const evidence = `${movement.description}, proven at higher level`;

    return {
      category: 'class_relief',
      name: UPSET_ANGLE_NAMES.class_relief,
      points,
      evidence,
      evidenceDetails,
      confidence: Math.min(90, 65 + approximateLevels * 5),
      hasAllRequiredEvidence: true,
      bonusPoints: Math.min(bonusPoints, 10),
    };
  } catch (_error) {
    logger.logWarning('Error detecting class relief angle', {
      component: 'longshotDetector',
      horseName: horse.horseName,
    });
    return null;
  }
}

// ============================================================================
// EQUIPMENT RESCUE DETECTION
// ============================================================================

/**
 * Detect Equipment Rescue angle
 *
 * Criteria:
 * - First-time Lasix AND Blinkers ON
 * - Trainer has 25%+ win rate with this combo
 * - Horse's last race had a valid excuse
 *
 * Points: 30 base + up to 10 bonus
 */
export function detectEquipmentRescue(
  horse: HorseEntry,
  equipmentScore: EquipmentScoreResult
): DetectedUpsetAngle | null {
  try {
    const evidenceDetails: string[] = [];
    let bonusPoints = 0;

    // Check for first-time Lasix
    const hasFirstTimeLasix = horse.medication.lasixFirstTime;

    // Check for blinkers on
    const hasBlinkersOn = equipmentScore.changes.some(
      (c) => c.equipmentType.id === 'blinkers' && c.direction === 'added'
    );

    // Need at least one of Lasix or Blinkers
    if (!hasFirstTimeLasix && !hasBlinkersOn) {
      return null;
    }

    // Best case: both
    if (hasFirstTimeLasix && hasBlinkersOn) {
      evidenceDetails.push('First-time Lasix + Blinkers ON');
      bonusPoints += 5;
    } else if (hasFirstTimeLasix) {
      evidenceDetails.push('First-time Lasix');
    } else {
      evidenceDetails.push('First-time Blinkers');
    }

    // Check for trainer pattern
    let trainerWinRate = 0;
    let trainerSampleSize = 0;

    if (hasFirstTimeLasix) {
      const lasixPattern = getTrainerPattern(horse.trainerName, 'lasix_first');
      if (lasixPattern) {
        trainerWinRate = Math.max(trainerWinRate, lasixPattern.winRate);
        trainerSampleSize = lasixPattern.sampleSize;
      }
    }

    if (hasBlinkersOn) {
      const blinkersPattern = getTrainerPattern(horse.trainerName, 'blinkers_on');
      if (blinkersPattern) {
        trainerWinRate = Math.max(trainerWinRate, blinkersPattern.winRate);
        trainerSampleSize = Math.max(trainerSampleSize, blinkersPattern.sampleSize);
      }
    }

    // Need trainer pattern with 20%+ win rate
    if (trainerWinRate < 20) {
      // No strong trainer pattern, but still possible angle if both changes
      if (!(hasFirstTimeLasix && hasBlinkersOn)) {
        return null; // Need trainer pattern OR both changes
      }
    } else {
      evidenceDetails.push(
        `Trainer wins ${trainerWinRate}% with this change (${trainerSampleSize} starts)`
      );
      if (trainerWinRate >= 25) {
        bonusPoints += 5;
      }
    }

    // Check for valid excuse in last race
    const lastRace = horse.pastPerformances[0];
    if (lastRace) {
      const tripComment = lastRace.tripComment.toLowerCase();
      const hasExcuse =
        tripComment.includes('trouble') ||
        tripComment.includes('wide') ||
        tripComment.includes('blocked') ||
        tripComment.includes('bumped') ||
        tripComment.includes('steadied') ||
        tripComment.includes('checked');

      if (hasExcuse) {
        evidenceDetails.push(`Last race excuse: "${lastRace.tripComment}"`);
        bonusPoints += 3;
      }
    }

    const points = UPSET_ANGLE_BASE_POINTS.equipment_rescue + Math.min(bonusPoints, 10);
    const evidence = equipmentScore.reasoning;

    return {
      category: 'equipment_rescue',
      name: UPSET_ANGLE_NAMES.equipment_rescue,
      points,
      evidence,
      evidenceDetails,
      confidence: Math.min(85, 60 + trainerWinRate),
      hasAllRequiredEvidence: hasFirstTimeLasix && hasBlinkersOn && trainerWinRate >= 20,
      bonusPoints: Math.min(bonusPoints, 10),
    };
  } catch (_error) {
    logger.logWarning('Error detecting equipment rescue angle', {
      component: 'longshotDetector',
      horseName: horse.horseName,
    });
    return null;
  }
}

// ============================================================================
// TRAINER PATTERN DETECTION
// ============================================================================

/**
 * Detect Trainer Pattern angle
 *
 * Criteria:
 * - Trainer wins 20%+ at this track/distance/surface combo
 * - Horse fits specific pattern (layoff, class drop, etc.)
 * - Sample size of 20+ starts
 *
 * Points: 35 base + up to 15 bonus
 */
export function detectTrainerPattern(
  horse: HorseEntry,
  _raceHeader: RaceHeader
): DetectedUpsetAngle | null {
  try {
    const evidenceDetails: string[] = [];
    let bonusPoints = 0;
    let totalWinRate = 0;
    let patternCount = 0;

    // Get trainer profile
    const profile = getTrainerProfile(horse.trainerName);

    // Check various trainer patterns
    const patterns: { type: EquipmentChangeType; rate: number; sample: number }[] = [];

    // Check each relevant pattern
    const relevantPatterns: EquipmentChangeType[] = [
      'lasix_first',
      'blinkers_on',
      'blinkers_off',
      'tongue_tie_on',
    ];

    for (const patternType of relevantPatterns) {
      const pattern = getTrainerPattern(horse.trainerName, patternType);
      if (pattern && pattern.sampleSize >= 10) {
        patterns.push({
          type: patternType,
          rate: pattern.winRate,
          sample: pattern.sampleSize,
        });
      }
    }

    // Check for layoff pattern (horse coming off 60+ day layoff)
    const daysSinceLast = horse.daysSinceLastRace;
    if (daysSinceLast && daysSinceLast >= 60) {
      // This is a layoff horse - check if trainer is good off layoffs
      if (profile && profile.overallWinRate >= 18) {
        evidenceDetails.push(
          `Trainer overall win rate: ${profile.overallWinRate}% (layoff specialist potential)`
        );
        totalWinRate += profile.overallWinRate;
        patternCount++;
      }
    }

    // Check class drop pattern
    const lastRace = horse.pastPerformances[0];
    if (lastRace && horse.claimingPrice && lastRace.claimingPrice) {
      if (horse.claimingPrice < lastRace.claimingPrice) {
        // Class drop - trainer might be good with drops
        if (profile && profile.overallWinRate >= 16) {
          evidenceDetails.push(`Class drop move with ${profile.overallWinRate}% trainer`);
          if (profile.overallWinRate >= 20) {
            totalWinRate += profile.overallWinRate;
            patternCount++;
          }
        }
      }
    }

    // Add equipment pattern info
    for (const p of patterns) {
      if (p.rate >= 20) {
        evidenceDetails.push(`${p.type.replace(/_/g, ' ')}: ${p.rate}% (${p.sample} starts)`);
        totalWinRate += p.rate;
        patternCount++;
      }
    }

    if (patternCount === 0) {
      return null; // No qualifying patterns
    }

    const avgWinRate = totalWinRate / patternCount;

    if (avgWinRate < 18) {
      return null; // Not strong enough pattern
    }

    // Bonus for strong win rate
    if (avgWinRate >= 25) {
      bonusPoints += 10;
    } else if (avgWinRate >= 22) {
      bonusPoints += 5;
    }

    // Bonus for multiple patterns
    if (patternCount >= 2) {
      bonusPoints += 5;
      evidenceDetails.push(`Multiple positive trainer patterns (${patternCount})`);
    }

    const points = UPSET_ANGLE_BASE_POINTS.trainer_pattern + Math.min(bonusPoints, 15);
    const evidence = `Trainer wins ${Math.round(avgWinRate)}% in this spot type`;

    return {
      category: 'trainer_pattern',
      name: UPSET_ANGLE_NAMES.trainer_pattern,
      points,
      evidence,
      evidenceDetails,
      confidence: Math.min(90, 60 + avgWinRate),
      hasAllRequiredEvidence: avgWinRate >= 20,
      bonusPoints: Math.min(bonusPoints, 15),
    };
  } catch (_error) {
    logger.logWarning('Error detecting trainer pattern angle', {
      component: 'longshotDetector',
      horseName: horse.horseName,
    });
    return null;
  }
}

// ============================================================================
// TRACK BIAS FIT DETECTION
// ============================================================================

/**
 * Detect Track Bias Fit angle
 *
 * Criteria:
 * - Extreme track bias (80%+ early speed or 70%+ closers)
 * - Horse's running style is a perfect match for the bias
 * - Post position is ideal for the bias
 *
 * Points: 30 base + up to 10 bonus
 */
export function detectTrackBiasFit(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  runningStyle: RunningStyleProfile
): DetectedUpsetAngle | null {
  try {
    const evidenceDetails: string[] = [];
    let bonusPoints = 0;

    // Get track bias data
    const speedBias = getSpeedBias(raceHeader.trackCode, raceHeader.surface);

    if (!speedBias) {
      return null; // No track data
    }

    const earlySpeedWinRate = speedBias.earlySpeedWinRate;
    const closerWinRate = 100 - earlySpeedWinRate;

    // Check for extreme bias
    let extremeBias: 'speed' | 'closer' | null = null;
    let biasStrength = 0;

    if (earlySpeedWinRate >= 80) {
      extremeBias = 'speed';
      biasStrength = earlySpeedWinRate;
      evidenceDetails.push(`Track favors speed ${earlySpeedWinRate}%`);
    } else if (closerWinRate >= 70) {
      extremeBias = 'closer';
      biasStrength = closerWinRate;
      evidenceDetails.push(`Track favors closers ${closerWinRate}%`);
    } else {
      return null; // No extreme bias
    }

    // Check if running style matches bias
    const styleMatches =
      (extremeBias === 'speed' && (runningStyle.style === 'E' || runningStyle.style === 'P')) ||
      (extremeBias === 'closer' && runningStyle.style === 'C');

    if (!styleMatches) {
      return null; // Style doesn't match bias
    }

    evidenceDetails.push(`Running style: ${runningStyle.styleName} - perfect match`);

    // Check post position
    const postBias = getPostPositionBias(
      raceHeader.trackCode,
      raceHeader.distance,
      raceHeader.surface
    );

    if (postBias) {
      const isFavoredPost = postBias.favoredPosts.includes(horse.postPosition);
      if (isFavoredPost) {
        evidenceDetails.push(`Post ${horse.postPosition} is favored at this track`);
        bonusPoints += 5;
      }
    }

    // Bonus for consistent style
    const styleConfidence = runningStyle.confidence;
    if (styleConfidence >= 80) {
      evidenceDetails.push(`Consistent ${runningStyle.styleName} (${styleConfidence}% confidence)`);
      bonusPoints += 3;
    }

    // Bonus for extreme bias strength
    if (biasStrength >= 85) {
      bonusPoints += 2;
    }

    const points = UPSET_ANGLE_BASE_POINTS.track_bias_fit + Math.min(bonusPoints, 10);
    const evidence = `Track favors ${extremeBias} ${biasStrength}%, this is ${extremeBias === 'speed' ? 'lone speed' : 'a closer'} from ideal post`;

    return {
      category: 'track_bias_fit',
      name: UPSET_ANGLE_NAMES.track_bias_fit,
      points,
      evidence,
      evidenceDetails,
      confidence: Math.min(85, 60 + (biasStrength - 70)),
      hasAllRequiredEvidence: true,
      bonusPoints: Math.min(bonusPoints, 10),
    };
  } catch (_error) {
    logger.logWarning('Error detecting track bias fit angle', {
      component: 'longshotDetector',
      horseName: horse.horseName,
    });
    return null;
  }
}

// ============================================================================
// HIDDEN FORM DETECTION
// ============================================================================

/**
 * Analyze workout pattern for sharpness
 */
function analyzeWorkoutPattern(workouts: Workout[]): {
  isSharp: boolean;
  worksIn14Days: number;
  hasBullet: boolean;
  description: string;
} {
  if (!workouts || workouts.length === 0) {
    return { isSharp: false, worksIn14Days: 0, hasBullet: false, description: 'No workouts' };
  }

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  let worksIn14Days = 0;
  let hasBullet = false;

  for (const work of workouts) {
    try {
      const workDate = new Date(work.date);
      if (workDate >= fourteenDaysAgo) {
        worksIn14Days++;
        if (work.isBullet) {
          hasBullet = true;
        }
      }
    } catch {
      // Skip invalid dates
    }
  }

  const isSharp = worksIn14Days >= 3 || (worksIn14Days >= 2 && hasBullet);
  let description = `${worksIn14Days} works in last 14 days`;
  if (hasBullet) {
    description += ' (includes bullet)';
  }

  return { isSharp, worksIn14Days, hasBullet, description };
}

/**
 * Check for valid excuse in last race
 */
function checkLastRaceExcuse(horse: HorseEntry): {
  hasExcuse: boolean;
  excuseType: string | null;
  description: string;
} {
  const lastRace = horse.pastPerformances[0];
  if (!lastRace) {
    return { hasExcuse: false, excuseType: null, description: 'No last race' };
  }

  const comment = lastRace.tripComment.toLowerCase();

  // Trouble keywords
  const troubleKeywords = [
    { keyword: 'wide', type: 'wide_trip' },
    { keyword: 'traffic', type: 'traffic' },
    { keyword: 'blocked', type: 'blocked' },
    { keyword: 'bumped', type: 'bumped' },
    { keyword: 'checked', type: 'checked' },
    { keyword: 'steadied', type: 'steadied' },
    { keyword: 'clipped heels', type: 'trouble' },
    { keyword: 'stumbled', type: 'stumbled' },
  ];

  for (const { keyword, type } of troubleKeywords) {
    if (comment.includes(keyword)) {
      return {
        hasExcuse: true,
        excuseType: type,
        description: `Last race trouble: ${keyword}`,
      };
    }
  }

  // Off track excuse (hates mud/slop)
  const offTrack = lastRace.trackCondition === 'muddy' || lastRace.trackCondition === 'sloppy';
  if (offTrack && horse.wetWins === 0 && horse.wetStarts >= 2) {
    return {
      hasExcuse: true,
      excuseType: 'off_track',
      description: 'Last race was off track (0 wet wins)',
    };
  }

  return { hasExcuse: false, excuseType: null, description: 'No valid excuse found' };
}

/**
 * Detect Hidden Form angle
 *
 * Criteria:
 * - Sharp workout pattern (3+ works in 14 days)
 * - Last race had a valid excuse (bad trip, off track, etc.)
 * - Improvement expected from layoff or surface switch
 *
 * Points: 25 base + up to 10 bonus
 */
export function detectHiddenForm(
  horse: HorseEntry,
  raceHeader: RaceHeader
): DetectedUpsetAngle | null {
  try {
    const evidenceDetails: string[] = [];
    let bonusPoints = 0;

    // Analyze workout pattern
    const workoutAnalysis = analyzeWorkoutPattern(horse.workouts);

    if (!workoutAnalysis.isSharp) {
      return null; // Not showing sharp training
    }

    evidenceDetails.push(workoutAnalysis.description);

    if (workoutAnalysis.hasBullet) {
      bonusPoints += 5;
      evidenceDetails.push('Has bullet work');
    }

    // Check for valid excuse
    const excuseAnalysis = checkLastRaceExcuse(horse);

    // Need either excuse OR surface/distance switch
    let hasPositiveFactor = excuseAnalysis.hasExcuse;

    if (excuseAnalysis.hasExcuse) {
      evidenceDetails.push(excuseAnalysis.description);
      bonusPoints += 3;
    }

    // Check surface switch
    const lastRace = horse.pastPerformances[0];
    if (lastRace && lastRace.surface !== raceHeader.surface) {
      const switchDesc = `Surface switch: ${lastRace.surface} → ${raceHeader.surface}`;
      evidenceDetails.push(switchDesc);

      // Check if favorable switch
      if (raceHeader.surface === 'turf' && horse.turfWins > 0) {
        evidenceDetails.push(`Has ${horse.turfWins} turf wins`);
        bonusPoints += 3;
        hasPositiveFactor = true;
      } else if (raceHeader.surface === 'dirt' && horse.lifetimeWins > horse.turfWins) {
        evidenceDetails.push(`Better on dirt (${horse.lifetimeWins - horse.turfWins} dirt wins)`);
        bonusPoints += 2;
        hasPositiveFactor = true;
      }
    }

    // Check distance change
    if (lastRace && Math.abs(lastRace.distanceFurlongs - raceHeader.distanceFurlongs) >= 2) {
      const direction =
        raceHeader.distanceFurlongs > lastRace.distanceFurlongs ? 'stretching out' : 'sprinting';
      evidenceDetails.push(`Distance change: ${direction}`);

      // Check if favorable
      if (horse.distanceWins > 0) {
        evidenceDetails.push(`Has ${horse.distanceWins} wins at this distance range`);
        bonusPoints += 2;
        hasPositiveFactor = true;
      }
    }

    // Check layoff bounce potential
    const daysSince = horse.daysSinceLastRace;
    if (daysSince && daysSince >= 45 && daysSince <= 120) {
      evidenceDetails.push(`Coming off ${daysSince}-day layoff (bounce candidate)`);
      if (horse.lifetimeWins > 0) {
        bonusPoints += 2;
        hasPositiveFactor = true;
      }
    }

    if (!hasPositiveFactor) {
      return null; // Need some positive factor besides workouts
    }

    const points = UPSET_ANGLE_BASE_POINTS.hidden_form + Math.min(bonusPoints, 10);
    const evidence = `${workoutAnalysis.worksIn14Days} works in ${14} days, ${excuseAnalysis.hasExcuse ? excuseAnalysis.excuseType : 'improvement likely'}`;

    return {
      category: 'hidden_form',
      name: UPSET_ANGLE_NAMES.hidden_form,
      points,
      evidence,
      evidenceDetails,
      confidence: Math.min(75, 50 + workoutAnalysis.worksIn14Days * 5),
      hasAllRequiredEvidence: workoutAnalysis.isSharp && hasPositiveFactor,
      bonusPoints: Math.min(bonusPoints, 10),
    };
  } catch (_error) {
    logger.logWarning('Error detecting hidden form angle', {
      component: 'longshotDetector',
      horseName: horse.horseName,
    });
    return null;
  }
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect all applicable upset angles for a longshot horse
 */
export function detectAllUpsetAngles(
  horse: HorseEntry,
  allHorses: HorseEntry[],
  raceHeader: RaceHeader,
  paceScenario: PaceScenarioAnalysis,
  runningStyle: RunningStyleProfile,
  classScore: ClassScoreResult,
  equipmentScore: EquipmentScoreResult
): DetectedUpsetAngle[] {
  const angles: DetectedUpsetAngle[] = [];

  try {
    // Detect each angle type
    const paceAngle = detectPaceDevastation(horse, allHorses, paceScenario, runningStyle);
    if (paceAngle) {
      angles.push(paceAngle);
      logger.logInfo('Detected pace devastation angle', {
        component: 'longshotDetector',
        horseName: horse.horseName,
        points: paceAngle.points,
      });
    }

    const classAngle = detectClassRelief(horse, raceHeader, classScore);
    if (classAngle) {
      angles.push(classAngle);
      logger.logInfo('Detected class relief angle', {
        component: 'longshotDetector',
        horseName: horse.horseName,
        points: classAngle.points,
      });
    }

    const equipmentAngle = detectEquipmentRescue(horse, equipmentScore);
    if (equipmentAngle) {
      angles.push(equipmentAngle);
      logger.logInfo('Detected equipment rescue angle', {
        component: 'longshotDetector',
        horseName: horse.horseName,
        points: equipmentAngle.points,
      });
    }

    const trainerAngle = detectTrainerPattern(horse, raceHeader);
    if (trainerAngle) {
      angles.push(trainerAngle);
      logger.logInfo('Detected trainer pattern angle', {
        component: 'longshotDetector',
        horseName: horse.horseName,
        points: trainerAngle.points,
      });
    }

    const biasAngle = detectTrackBiasFit(horse, raceHeader, runningStyle);
    if (biasAngle) {
      angles.push(biasAngle);
      logger.logInfo('Detected track bias fit angle', {
        component: 'longshotDetector',
        horseName: horse.horseName,
        points: biasAngle.points,
      });
    }

    const formAngle = detectHiddenForm(horse, raceHeader);
    if (formAngle) {
      angles.push(formAngle);
      logger.logInfo('Detected hidden form angle', {
        component: 'longshotDetector',
        horseName: horse.horseName,
        points: formAngle.points,
      });
    }
  } catch (_error) {
    logger.logWarning('Error detecting upset angles', {
      component: 'longshotDetector',
      horseName: horse.horseName,
    });
  }

  return angles;
}
