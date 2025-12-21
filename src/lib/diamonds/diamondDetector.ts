/**
 * Diamond in Rough Detector
 *
 * Detects horses with moderate scores (120-139) that have massive overlays (200%+)
 * AND multiple supporting factors that create a "perfect storm" scenario.
 *
 * Diamond Criteria:
 * 1. Score: 120-139 pts (not terrible, but not great)
 * 2. Overlay: 200%+ (massive value vs odds)
 * 3. Must have logical story (2+ supporting factors)
 *
 * Perfect Storm Scenarios:
 * - Class drop + equipment change + pace fit
 * - Hidden form + track bias fit
 * - Breeding potential (lightly raced) + trainer pattern
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { HorseScore } from '../scoring';
import { analyzeOverlay, parseOddsToDecimal, calculateEV } from '../scoring/overlayAnalysis';
import { getSpeedBias, getPostPositionBias } from '../trackIntelligence';
import { parseRunningStyle, analyzePaceScenario } from '../scoring/paceAnalysis';
import { getTrainerProfile, getTrainerPattern } from '../equipment/trainerPatterns';
import { logger } from '../../services/logging';
import {
  type DetectedFactor,
  type DiamondAnalysis,
  type RaceDiamondSummary,
  DIAMOND_SCORE_MIN,
  DIAMOND_SCORE_MAX,
  DIAMOND_MIN_OVERLAY_PERCENT,
  DIAMOND_MIN_FACTORS,
  FACTOR_NAMES,
  FACTOR_ICONS,
  FACTOR_COLORS,
  isScoreInDiamondRange,
  meetsMinimumOverlay,
  meetsMinimumFactors,
  calculateConfidence,
} from './diamondTypes';

// ============================================================================
// FACTOR DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect class drop factor
 */
function detectClassDropFactor(score: HorseScore): DetectedFactor | null {
  if (!score.classScore) return null;

  const movement = score.classScore.analysis.movement;
  if (movement.direction !== 'drop') return null;

  // Need significant drop
  const levelsDiff = Math.abs(movement.levelsDifference);
  if (levelsDiff < 3) return null;

  const evidenceDetails: string[] = [
    `Dropping ${Math.ceil(levelsDiff / 5)} class levels`,
    movement.description,
  ];

  if (score.classScore.analysis.provenAtLevel.hasWon) {
    evidenceDetails.push(
      `Won ${score.classScore.analysis.provenAtLevel.winsAtLevel} at higher level`
    );
  }

  return {
    type: 'class_drop',
    name: FACTOR_NAMES.class_drop,
    evidence: `Class drop: ${movement.description}`,
    evidenceDetails,
    confidence: Math.min(90, 60 + levelsDiff * 2),
    icon: FACTOR_ICONS.class_drop,
    color: FACTOR_COLORS.class_drop,
    sourceModule: 'classScoring',
  };
}

/**
 * Detect hidden class drop factor (track tier or purse)
 */
function detectHiddenClassDropFactor(score: HorseScore): DetectedFactor | null {
  if (!score.classScore) return null;

  const hiddenDrops = score.classScore.analysis.hiddenDrops;
  if (hiddenDrops.length === 0) return null;

  const evidenceDetails = hiddenDrops.map((drop) => `${drop.description}: ${drop.explanation}`);

  return {
    type: 'hidden_class_drop',
    name: FACTOR_NAMES.hidden_class_drop,
    evidence: `Hidden class edges: ${hiddenDrops.length} detected`,
    evidenceDetails,
    confidence: Math.min(85, 50 + hiddenDrops.length * 15),
    icon: FACTOR_ICONS.hidden_class_drop,
    color: FACTOR_COLORS.hidden_class_drop,
    sourceModule: 'classScoring',
  };
}

/**
 * Detect equipment change factor
 */
function detectEquipmentChangeFactor(horse: HorseEntry, score: HorseScore): DetectedFactor | null {
  const equipmentScore = score.breakdown.equipment;
  if (equipmentScore.total < 15) return null; // Need significant equipment impact

  const evidenceDetails: string[] = [equipmentScore.reasoning];

  // Check for first-time Lasix specifically
  if (horse.medication.lasixFirstTime) {
    evidenceDetails.push('First-time Lasix application');
  }

  // Check for blinkers
  if (horse.equipment.blinkers && !horse.pastPerformances[0]?.equipment.includes('B')) {
    evidenceDetails.push('Blinkers being added');
  }

  return {
    type: 'equipment_change',
    name: FACTOR_NAMES.equipment_change,
    evidence: equipmentScore.reasoning,
    evidenceDetails,
    confidence: Math.min(85, 50 + equipmentScore.total * 2),
    icon: FACTOR_ICONS.equipment_change,
    color: FACTOR_COLORS.equipment_change,
    sourceModule: 'equipmentScoring',
  };
}

/**
 * Detect first-time Lasix factor
 */
function detectFirstTimeLasixFactor(horse: HorseEntry): DetectedFactor | null {
  if (!horse.medication.lasixFirstTime) return null;

  // Check trainer pattern for Lasix
  const pattern = getTrainerPattern(horse.trainerName, 'lasix_first');
  const evidenceDetails: string[] = ['First-time Lasix application'];

  let confidence = 60;

  if (pattern) {
    evidenceDetails.push(
      `Trainer wins ${pattern.winRate}% with first-time Lasix (${pattern.sampleSize} starts)`
    );
    confidence = Math.min(90, 60 + pattern.winRate);
  }

  return {
    type: 'first_time_lasix',
    name: FACTOR_NAMES.first_time_lasix,
    evidence: 'First-time Lasix - potential improvement',
    evidenceDetails,
    confidence,
    icon: FACTOR_ICONS.first_time_lasix,
    color: FACTOR_COLORS.first_time_lasix,
    sourceModule: 'medication',
  };
}

/**
 * Detect pace fit factor
 */
function detectPaceFitFactor(
  horse: HorseEntry,
  allHorses: HorseEntry[],
  score: HorseScore
): DetectedFactor | null {
  const paceScore = score.breakdown.pace;
  if (paceScore.paceFit !== 'perfect' && paceScore.paceFit !== 'good') return null;

  const runningStyle = parseRunningStyle(horse);
  const paceScenario = analyzePaceScenario(allHorses);

  const evidenceDetails: string[] = [
    `Running style: ${runningStyle.styleName}`,
    `Pace scenario: ${paceScenario.label}`,
    `PPI: ${paceScenario.ppi}`,
  ];

  // Perfect fit: closer in speed duel
  if (runningStyle.style === 'C' && paceScenario.ppi >= 50) {
    evidenceDetails.push('Closer in speed duel setup - excellent');
    return {
      type: 'pace_fit',
      name: FACTOR_NAMES.pace_fit,
      evidence: `${runningStyle.styleName} perfectly positioned for ${paceScenario.label}`,
      evidenceDetails,
      confidence: Math.min(90, 60 + (paceScenario.ppi - 50)),
      icon: FACTOR_ICONS.pace_fit,
      color: FACTOR_COLORS.pace_fit,
      sourceModule: 'paceAnalysis',
    };
  }

  // Good fit: lone speed in soft pace
  if (runningStyle.style === 'E' && paceScenario.ppi < 30) {
    evidenceDetails.push('Lone speed in soft pace - wire-to-wire potential');
    return {
      type: 'pace_fit',
      name: FACTOR_NAMES.pace_fit,
      evidence: `Lone speed in ${paceScenario.label} - get loose on lead`,
      evidenceDetails,
      confidence: 80,
      icon: FACTOR_ICONS.pace_fit,
      color: FACTOR_COLORS.pace_fit,
      sourceModule: 'paceAnalysis',
    };
  }

  return null;
}

/**
 * Detect track bias fit factor
 */
function detectTrackBiasFitFactor(
  horse: HorseEntry,
  raceHeader: RaceHeader
): DetectedFactor | null {
  const speedBias = getSpeedBias(raceHeader.trackCode, raceHeader.surface);
  if (!speedBias) return null;

  const runningStyle = parseRunningStyle(horse);
  const evidenceDetails: string[] = [];

  // Check for extreme bias match
  if (
    speedBias.earlySpeedWinRate >= 75 &&
    (runningStyle.style === 'E' || runningStyle.style === 'P')
  ) {
    evidenceDetails.push(
      `Track favors speed: ${speedBias.earlySpeedWinRate}% early speed win rate`
    );
    evidenceDetails.push(`This is a ${runningStyle.styleName}`);

    const postBias = getPostPositionBias(
      raceHeader.trackCode,
      raceHeader.distance,
      raceHeader.surface
    );
    if (postBias && postBias.favoredPosts.includes(horse.postPosition)) {
      evidenceDetails.push(`Post ${horse.postPosition} is favored at this track`);
    }

    return {
      type: 'track_bias_fit',
      name: FACTOR_NAMES.track_bias_fit,
      evidence: `Speed horse on speed-favoring track (${speedBias.earlySpeedWinRate}%)`,
      evidenceDetails,
      confidence: Math.min(90, 50 + (speedBias.earlySpeedWinRate - 50)),
      icon: FACTOR_ICONS.track_bias_fit,
      color: FACTOR_COLORS.track_bias_fit,
      sourceModule: 'trackIntelligence',
    };
  }

  // Closer-friendly track
  const closerWinRate = 100 - speedBias.earlySpeedWinRate;
  if (closerWinRate >= 60 && runningStyle.style === 'C') {
    evidenceDetails.push(`Track favors closers: ${closerWinRate}% closer win rate`);
    evidenceDetails.push(`This is a ${runningStyle.styleName}`);

    return {
      type: 'track_bias_fit',
      name: FACTOR_NAMES.track_bias_fit,
      evidence: `Closer on closer-friendly track (${closerWinRate}%)`,
      evidenceDetails,
      confidence: Math.min(85, 50 + (closerWinRate - 40)),
      icon: FACTOR_ICONS.track_bias_fit,
      color: FACTOR_COLORS.track_bias_fit,
      sourceModule: 'trackIntelligence',
    };
  }

  return null;
}

/**
 * Detect hidden form factor (sharp workouts + excuse)
 */
function detectHiddenFormFactor(horse: HorseEntry): DetectedFactor | null {
  const evidenceDetails: string[] = [];
  let hasSharpWorkouts = false;
  let hasExcuse = false;

  // Check workouts
  const workouts = horse.workouts || [];
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  let recentWorks = 0;
  let hasBullet = false;

  for (const work of workouts) {
    try {
      const workDate = new Date(work.date);
      if (workDate >= fourteenDaysAgo) {
        recentWorks++;
        if (work.isBullet) hasBullet = true;
      }
    } catch {
      // Skip invalid dates
    }
  }

  if (recentWorks >= 3 || (recentWorks >= 2 && hasBullet)) {
    hasSharpWorkouts = true;
    evidenceDetails.push(
      `${recentWorks} works in last 14 days${hasBullet ? ' (includes bullet)' : ''}`
    );
  }

  // Check for excuse in last race
  const lastRace = horse.pastPerformances[0];
  if (lastRace) {
    const comment = lastRace.tripComment?.toLowerCase() || '';
    const excuseKeywords = ['wide', 'trouble', 'blocked', 'bumped', 'steadied', 'checked'];

    for (const keyword of excuseKeywords) {
      if (comment.includes(keyword)) {
        hasExcuse = true;
        evidenceDetails.push(`Last race excuse: ${keyword}`);
        break;
      }
    }
  }

  if (hasSharpWorkouts && hasExcuse) {
    return {
      type: 'hidden_form',
      name: FACTOR_NAMES.hidden_form,
      evidence: 'Sharp workouts + valid excuse = improvement expected',
      evidenceDetails,
      confidence: 75,
      icon: FACTOR_ICONS.hidden_form,
      color: FACTOR_COLORS.hidden_form,
      sourceModule: 'formAnalysis',
    };
  }

  // Just sharp workouts is still a factor
  if (hasSharpWorkouts) {
    return {
      type: 'hidden_form',
      name: FACTOR_NAMES.hidden_form,
      evidence: 'Sharp training pattern indicates readiness',
      evidenceDetails,
      confidence: 60,
      icon: FACTOR_ICONS.hidden_form,
      color: FACTOR_COLORS.hidden_form,
      sourceModule: 'formAnalysis',
    };
  }

  return null;
}

/**
 * Detect breeding potential factor (lightly raced horses)
 */
function detectBreedingPotentialFactor(
  horse: HorseEntry,
  score: HorseScore
): DetectedFactor | null {
  // Only for lightly raced horses (< 8 starts)
  if (horse.lifetimeStarts >= 8) return null;
  if (!score.breedingScore || !score.breedingScore.wasApplied) return null;

  const breedingTotal = score.breedingScore.total;
  if (breedingTotal < 35) return null; // Need good breeding score

  const evidenceDetails: string[] = [
    `Lifetime starts: ${horse.lifetimeStarts}`,
    `Breeding score: ${breedingTotal}/60`,
  ];

  if (score.breedingScore.sireDetails.profile) {
    evidenceDetails.push(
      `Sire: ${score.breedingScore.sireDetails.profile.name} (${score.breedingScore.sireDetails.tierLabel})`
    );
  }

  if (score.breedingScore.bonuses.total > 0) {
    evidenceDetails.push(`Breeding bonuses: +${score.breedingScore.bonuses.total}`);
  }

  return {
    type: 'breeding_potential',
    name: FACTOR_NAMES.breeding_potential,
    evidence: `Lightly raced (${horse.lifetimeStarts} starts) with strong pedigree`,
    evidenceDetails,
    confidence: Math.min(85, 50 + breedingTotal),
    icon: FACTOR_ICONS.breeding_potential,
    color: FACTOR_COLORS.breeding_potential,
    sourceModule: 'breedingScoring',
  };
}

/**
 * Detect trainer pattern factor
 */
function detectTrainerPatternFactor(
  horse: HorseEntry,
  _raceHeader: RaceHeader
): DetectedFactor | null {
  const profile = getTrainerProfile(horse.trainerName);
  if (!profile) return null;
  if (profile.overallWinRate < 18) return null;

  const evidenceDetails: string[] = [
    `Trainer: ${horse.trainerName}`,
    `Overall win rate: ${profile.overallWinRate}%`,
  ];

  let bestPatternRate = 0;
  let bestPatternName = '';

  // Check relevant patterns
  for (const pattern of profile.patterns) {
    if (pattern.sampleSize >= 15 && pattern.winRate >= 20) {
      if (pattern.winRate > bestPatternRate) {
        bestPatternRate = pattern.winRate;
        bestPatternName = pattern.changeType.replace(/_/g, ' ');
      }
      evidenceDetails.push(
        `${pattern.changeType.replace(/_/g, ' ')}: ${pattern.winRate}% (${pattern.sampleSize} starts)`
      );
    }
  }

  if (bestPatternRate < 20) return null;

  return {
    type: 'trainer_pattern',
    name: FACTOR_NAMES.trainer_pattern,
    evidence: `Trainer excels in this spot: ${bestPatternRate}% with ${bestPatternName}`,
    evidenceDetails,
    confidence: Math.min(90, 50 + bestPatternRate),
    icon: FACTOR_ICONS.trainer_pattern,
    color: FACTOR_COLORS.trainer_pattern,
    sourceModule: 'trainerPatterns',
  };
}

/**
 * Detect surface switch factor
 */
function detectSurfaceSwitchFactor(
  horse: HorseEntry,
  raceHeader: RaceHeader
): DetectedFactor | null {
  const lastRace = horse.pastPerformances[0];
  if (!lastRace) return null;
  if (lastRace.surface === raceHeader.surface) return null;

  const evidenceDetails: string[] = [`Switching: ${lastRace.surface} → ${raceHeader.surface}`];

  let favorable = false;

  // Switching to turf with turf wins
  if (raceHeader.surface === 'turf' && horse.turfWins > 0) {
    evidenceDetails.push(`Has ${horse.turfWins} turf win${horse.turfWins > 1 ? 's' : ''}`);
    favorable = true;
  }

  // Switching to dirt from turf where dirt is preferred
  if (raceHeader.surface === 'dirt' && horse.lifetimeWins > horse.turfWins) {
    const dirtWins = horse.lifetimeWins - horse.turfWins;
    evidenceDetails.push(`Better on dirt: ${dirtWins} dirt wins vs ${horse.turfWins} turf wins`);
    favorable = true;
  }

  if (!favorable) return null;

  return {
    type: 'surface_switch',
    name: FACTOR_NAMES.surface_switch,
    evidence: `Favorable surface switch to ${raceHeader.surface}`,
    evidenceDetails,
    confidence: 70,
    icon: FACTOR_ICONS.surface_switch,
    color: FACTOR_COLORS.surface_switch,
    sourceModule: 'surfaceAnalysis',
  };
}

/**
 * Detect distance change factor
 */
function detectDistanceChangeFactor(
  horse: HorseEntry,
  raceHeader: RaceHeader
): DetectedFactor | null {
  const lastRace = horse.pastPerformances[0];
  if (!lastRace) return null;

  const distanceChange = raceHeader.distanceFurlongs - lastRace.distanceFurlongs;
  if (Math.abs(distanceChange) < 1.5) return null; // Need significant change

  const evidenceDetails: string[] = [];
  let favorable = false;

  if (distanceChange > 0) {
    // Stretching out
    evidenceDetails.push(
      `Stretching out: ${lastRace.distanceFurlongs}f → ${raceHeader.distanceFurlongs}f`
    );
    if (horse.distanceWins > 0) {
      evidenceDetails.push(`Has ${horse.distanceWins} route wins`);
      favorable = true;
    }
  } else {
    // Cutting back
    evidenceDetails.push(
      `Cutting back: ${lastRace.distanceFurlongs}f → ${raceHeader.distanceFurlongs}f`
    );
    // Calculate sprint wins as lifetime wins minus distance/route wins
    const sprintWins = horse.lifetimeWins - horse.distanceWins;
    if (sprintWins > 0) {
      evidenceDetails.push(`Has ${sprintWins} sprint wins`);
      favorable = true;
    }
  }

  if (!favorable) return null;

  return {
    type: 'distance_change',
    name: FACTOR_NAMES.distance_change,
    evidence: `Favorable distance change: ${distanceChange > 0 ? 'stretching out' : 'cutting back'}`,
    evidenceDetails,
    confidence: 65,
    icon: FACTOR_ICONS.distance_change,
    color: FACTOR_COLORS.distance_change,
    sourceModule: 'distanceAnalysis',
  };
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect all perfect storm factors for a potential diamond
 */
function detectAllFactors(
  horse: HorseEntry,
  score: HorseScore,
  allHorses: HorseEntry[],
  raceHeader: RaceHeader
): DetectedFactor[] {
  const factors: DetectedFactor[] = [];

  try {
    // Class drop
    const classDrop = detectClassDropFactor(score);
    if (classDrop) factors.push(classDrop);

    // Hidden class drop
    const hiddenClassDrop = detectHiddenClassDropFactor(score);
    if (hiddenClassDrop) factors.push(hiddenClassDrop);

    // Equipment change
    const equipmentChange = detectEquipmentChangeFactor(horse, score);
    if (equipmentChange) factors.push(equipmentChange);

    // First-time Lasix (separate from equipment)
    const firstTimeLasix = detectFirstTimeLasixFactor(horse);
    if (firstTimeLasix && !equipmentChange) factors.push(firstTimeLasix);

    // Pace fit
    const paceFit = detectPaceFitFactor(horse, allHorses, score);
    if (paceFit) factors.push(paceFit);

    // Track bias fit
    const trackBiasFit = detectTrackBiasFitFactor(horse, raceHeader);
    if (trackBiasFit) factors.push(trackBiasFit);

    // Hidden form
    const hiddenForm = detectHiddenFormFactor(horse);
    if (hiddenForm) factors.push(hiddenForm);

    // Breeding potential
    const breedingPotential = detectBreedingPotentialFactor(horse, score);
    if (breedingPotential) factors.push(breedingPotential);

    // Trainer pattern
    const trainerPattern = detectTrainerPatternFactor(horse, raceHeader);
    if (trainerPattern) factors.push(trainerPattern);

    // Surface switch
    const surfaceSwitch = detectSurfaceSwitchFactor(horse, raceHeader);
    if (surfaceSwitch) factors.push(surfaceSwitch);

    // Distance change
    const distanceChange = detectDistanceChangeFactor(horse, raceHeader);
    if (distanceChange) factors.push(distanceChange);
  } catch (_error) {
    logger.logWarning('Error detecting diamond factors', {
      component: 'diamondDetector',
      horseName: horse.horseName,
    });
  }

  return factors;
}

/**
 * Generate the "story" for why this diamond makes sense
 */
function generateStory(factors: DetectedFactor[]): string {
  if (factors.length === 0) return 'No supporting factors';
  if (factors.length === 1) return factors[0].evidence;

  // Build a narrative from the top 3 factors
  const topFactors = factors.sort((a, b) => b.confidence - a.confidence).slice(0, 3);

  const parts = topFactors.map((f) => f.name.toLowerCase());

  if (parts.length === 2) {
    return `${parts[0]} + ${parts[1]} = upset potential at big odds`;
  }

  return `${parts[0]} + ${parts[1]} + ${parts[2]} = perfect storm for upset`;
}

/**
 * Generate bet recommendation for a diamond
 */
function generateBetRecommendation(
  confidence: number,
  _overlayPercent: number,
  oddsDisplay: string
): string {
  if (confidence >= 80) {
    return `Strong Hidden Gem bet at ${oddsDisplay}. Consider Win + Place.`;
  } else if (confidence >= 60) {
    return `Moderate Hidden Gem play at ${oddsDisplay}. Win bet with Place saver.`;
  } else {
    return `Speculative Hidden Gem at ${oddsDisplay}. Small Win bet only.`;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze a single horse for diamond potential
 */
export function analyzeDiamondCandidate(
  horse: HorseEntry,
  horseIndex: number,
  score: HorseScore,
  allHorses: HorseEntry[],
  raceHeader: RaceHeader,
  currentOdds: string
): DiamondAnalysis {
  const horseName = horse.horseName;
  const programNumber = horse.programNumber;
  const scoreTotal = score.total;
  const oddsDecimal = parseOddsToDecimal(currentOdds);

  // Analyze overlay
  const overlay = analyzeOverlay(scoreTotal, currentOdds);
  const overlayPercent = overlay.overlayPercent;

  // Initialize result
  const result: DiamondAnalysis = {
    programNumber,
    horseName,
    horseIndex,
    score: scoreTotal,
    oddsDisplay: currentOdds,
    oddsDecimal,
    overlayPercent,
    isDiamond: false,
    factors: [],
    factorCount: 0,
    confidence: 0,
    story: '',
    summary: '',
    reasoning: [],
    validationStatus: 'rejected',
    validationNotes: [],
    expectedValue: 0,
    roiPotential: 0,
    betRecommendation: '',
    analyzedAt: new Date().toISOString(),
  };

  // Check score range
  if (!isScoreInDiamondRange(scoreTotal)) {
    result.disqualificationReason = `Score ${scoreTotal} outside diamond range (${DIAMOND_SCORE_MIN}-${DIAMOND_SCORE_MAX})`;
    return result;
  }

  // Check overlay
  if (!meetsMinimumOverlay(overlayPercent)) {
    result.disqualificationReason = `Overlay ${overlayPercent.toFixed(0)}% below minimum (${DIAMOND_MIN_OVERLAY_PERCENT}%)`;
    return result;
  }

  // Detect all factors
  const factors = detectAllFactors(horse, score, allHorses, raceHeader);
  result.factors = factors;
  result.factorCount = factors.length;

  // Check minimum factors
  if (!meetsMinimumFactors(factors.length)) {
    result.disqualificationReason = `Only ${factors.length} factor(s) detected, need ${DIAMOND_MIN_FACTORS}+`;
    result.validationStatus = 'partial';
    return result;
  }

  // This IS a diamond!
  result.isDiamond = true;
  result.confidence = calculateConfidence(factors.length);
  result.story = generateStory(factors);
  result.validationStatus = 'validated';

  // Calculate EV and ROI
  const winProb = (result.confidence / 100) * 0.3; // Conservative probability estimate
  result.expectedValue = calculateEV(winProb * 100, oddsDecimal);
  result.roiPotential = (oddsDecimal - 1) * winProb;

  // Generate summary
  result.summary = `Diamond: ${horseName} (${currentOdds}) - ${factors.length} factors, ${result.confidence}% confidence`;

  // Generate reasoning
  result.reasoning = [
    `Score: ${scoreTotal} (diamond range ${DIAMOND_SCORE_MIN}-${DIAMOND_SCORE_MAX})`,
    `Overlay: +${overlayPercent.toFixed(0)}% (requires ${DIAMOND_MIN_OVERLAY_PERCENT}%+)`,
    `Factors: ${factors.length} detected (requires ${DIAMOND_MIN_FACTORS}+)`,
    '',
    'Perfect Storm Factors:',
    ...factors.map((f) => `• ${f.name}: ${f.evidence}`),
    '',
    `Story: ${result.story}`,
  ];

  // Generate bet recommendation
  result.betRecommendation = generateBetRecommendation(
    result.confidence,
    overlayPercent,
    currentOdds
  );

  // Validation notes
  result.validationNotes = factors.map(
    (f) => `${f.name} validated from ${f.sourceModule} (${f.confidence}% confidence)`
  );

  logger.logInfo('Diamond detected', {
    component: 'diamondDetector',
    horseName,
    programNumber,
    score: scoreTotal,
    overlay: overlayPercent,
    factors: factors.length,
    confidence: result.confidence,
  });

  return result;
}

/**
 * Analyze all horses in a race for diamonds
 */
export function analyzeRaceDiamonds(
  horses: HorseEntry[],
  scores: Map<number, HorseScore>,
  raceHeader: RaceHeader,
  getOdds: (index: number, defaultOdds: string) => string
): RaceDiamondSummary {
  const diamonds: DiamondAnalysis[] = [];

  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i];
    const score = scores.get(i) || scores.get(horse.programNumber);

    if (!score || score.isScratched) continue;

    const currentOdds = getOdds(i, horse.morningLineOdds);
    const analysis = analyzeDiamondCandidate(horse, i, score, horses, raceHeader, currentOdds);

    if (analysis.isDiamond) {
      diamonds.push(analysis);
    }
  }

  // Sort by confidence
  diamonds.sort((a, b) => b.confidence - a.confidence);

  const totalFactors = diamonds.reduce((sum, d) => sum + d.factorCount, 0);
  const averageConfidence =
    diamonds.length > 0 ? diamonds.reduce((sum, d) => sum + d.confidence, 0) / diamonds.length : 0;

  let summary = '';
  if (diamonds.length === 0) {
    summary = 'No diamonds detected in this race';
  } else if (diamonds.length === 1) {
    summary = `1 diamond found: ${diamonds[0].horseName} at ${diamonds[0].oddsDisplay}`;
  } else {
    summary = `${diamonds.length} diamonds found - hidden value in this race!`;
  }

  return {
    raceNumber: raceHeader.raceNumber,
    trackCode: raceHeader.trackCode,
    totalHorses: horses.length,
    diamondCount: diamonds.length,
    diamonds,
    hasDiamonds: diamonds.length > 0,
    bestDiamond: diamonds.length > 0 ? diamonds[0] : null,
    totalFactors,
    averageConfidence: Math.round(averageConfidence),
    summary,
  };
}

/**
 * Quick check if a horse might be a diamond candidate
 * (For performance - skip full analysis if not possible)
 */
export function mightBeDiamond(score: number, overlayPercent: number): boolean {
  return isScoreInDiamondRange(score) && meetsMinimumOverlay(overlayPercent);
}
