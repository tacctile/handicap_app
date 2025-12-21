/**
 * Market Inefficiency Detector
 *
 * Identifies patterns where the betting market is systematically wrong,
 * creating value opportunities for informed bettors.
 *
 * INEFFICIENCY TYPES DETECTED:
 *
 * A) Public Overreaction
 *    - Horse with terrible last race gets overbet next time
 *    - Look for: Low score but high odds (public avoiding)
 *    - Our value: Score suggests better than odds indicate
 *
 * B) Recency Bias
 *    - Recent winner overbet (odds too low)
 *    - Recent loser underbet (odds too high)
 *    - Check: Is recent form actually predictive or noise?
 *
 * C) Name Recognition
 *    - Famous jockey/trainer overbet (odds too low)
 *    - Unknown connections underbet (odds too high)
 *    - Our advantage: Score connections objectively
 *
 * D) Post Position Panic
 *    - Outside posts overbet on bias tracks
 *    - Inside posts underbet when bias favors outside
 *    - Our advantage: Track intelligence database
 *
 * E) Class Confusion
 *    - Public doesn't recognize hidden class drops
 *    - Horse moving up gets avoided (public sees class rise)
 *    - But actually dropping in quality (track tier, purse, etc.)
 *
 * F) Equipment Misunderstanding
 *    - Public overreacts to blinkers on/off
 *    - Doesn't understand trainer-specific patterns
 *    - Our advantage: Equipment scoring with trainer stats
 *
 * @module value/marketInefficiency
 */

import { logger } from '../../services/logging';
import type { HorseEntry, PastPerformance, RaceHeader } from '../../types/drf';
import type { HorseScore } from '../scoring';
import { parseOddsToDecimal } from '../betting/kellyCriterion';
import { scoreToWinProbability, oddsToMarketProbability, calculateEdge } from './valueDetector';

// ============================================================================
// TYPES
// ============================================================================

/** Types of market inefficiencies */
export type InefficiencyType =
  | 'public_overreaction'
  | 'recency_bias'
  | 'name_recognition'
  | 'post_position_panic'
  | 'class_confusion'
  | 'equipment_misunderstanding';

/** Direction of the inefficiency */
export type InefficiencyDirection =
  | 'overbet' // Public betting too heavily (odds too low)
  | 'underbet'; // Public avoiding (odds too high - our opportunity)

/** Market inefficiency detection result */
export interface InefficiencyDetection {
  /** Type of inefficiency detected */
  type: InefficiencyType;
  /** Direction - underbet = opportunity */
  direction: InefficiencyDirection;
  /** Magnitude on 1-10 scale */
  magnitude: number;
  /** Confidence in detection (0-100%) */
  confidence: number;
  /** Brief description */
  title: string;
  /** Detailed explanation */
  explanation: string;
  /** Why this creates value */
  valueReason: string;
  /** Evidence supporting detection */
  evidence: string[];
  /** Additional magnitude modifier for EV */
  evBonus: number;
}

/** Complete inefficiency analysis for a horse */
export interface MarketInefficiencyAnalysis {
  /** Program number */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** All detected inefficiencies */
  inefficiencies: InefficiencyDetection[];
  /** Primary inefficiency (highest magnitude) */
  primaryInefficiency: InefficiencyDetection | null;
  /** Combined inefficiency score */
  totalMagnitude: number;
  /** Has any exploitable inefficiency */
  hasExploitableInefficiency: boolean;
  /** Market is mispricing this horse */
  isMispriced: boolean;
  /** Summary for display */
  summary: string;
  /** Overall recommendation */
  recommendation: 'strong_bet' | 'bet' | 'watch' | 'neutral' | 'avoid';
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Inefficiency type metadata */
export const INEFFICIENCY_META: Record<
  InefficiencyType,
  {
    name: string;
    icon: string;
    color: string;
    bgColor: string;
  }
> = {
  public_overreaction: {
    name: 'Public Overreaction',
    icon: 'trending_down',
    color: '#22c55e',
    bgColor: '#22c55e20',
  },
  recency_bias: {
    name: 'Recency Bias',
    icon: 'history',
    color: '#3b82f6',
    bgColor: '#3b82f620',
  },
  name_recognition: {
    name: 'Name Recognition',
    icon: 'person_search',
    color: '#f59e0b',
    bgColor: '#f59e0b20',
  },
  post_position_panic: {
    name: 'Post Position Panic',
    icon: 'view_column',
    color: '#8b5cf6',
    bgColor: '#8b5cf620',
  },
  class_confusion: {
    name: 'Class Confusion',
    icon: 'swap_vert',
    color: '#ec4899',
    bgColor: '#ec489920',
  },
  equipment_misunderstanding: {
    name: 'Equipment Misunderstanding',
    icon: 'build',
    color: '#06b6d4',
    bgColor: '#06b6d420',
  },
};

/** Minimum magnitude to flag inefficiency */
const MIN_MAGNITUDE = 3;

/** Minimum edge to consider exploitable */
const MIN_EXPLOITABLE_EDGE = 5;

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect Public Overreaction
 *
 * Public avoids horses with bad last race, creating overlays
 */
function detectPublicOverreaction(
  horse: HorseEntry,
  score: HorseScore,
  edge: number
): InefficiencyDetection | null {
  const pps = horse.pastPerformances;
  if (pps.length < 2) return null;

  const lastRace = pps[0];
  const priorRace = pps[1];

  if (!lastRace || !priorRace) return null;

  // Check for terrible last race
  const lastFinish = lastRace.finishPosition ?? 10;
  const priorFinish = priorRace?.finishPosition ?? lastFinish;
  const fieldSize = lastRace.fieldSize ?? 10;

  // Only trigger if last race was notably worse
  const wasDisaster = lastFinish > 6 && lastFinish > priorFinish + 2;
  const wasBackOfPack = lastFinish > fieldSize * 0.7;
  const hasExcuse = detectLegitimateExcuse(lastRace);

  if (!wasDisaster && !wasBackOfPack) return null;
  if (edge < 10) return null; // Need meaningful edge

  // Calculate magnitude based on score vs odds discrepancy
  const magnitude = Math.min(10, Math.round(edge / 5 + (hasExcuse ? 2 : 0)));

  if (magnitude < MIN_MAGNITUDE) return null;

  const evidence: string[] = [];
  evidence.push(`Last race finish: ${lastFinish}${lastFinish > 10 ? '+' : ''} of ${fieldSize}`);

  if (priorFinish <= 4) {
    evidence.push(`Prior race finish: ${priorFinish} (much better)`);
  }

  if (hasExcuse) {
    evidence.push(`Legitimate excuse detected: ${hasExcuse}`);
  }

  evidence.push(`Our score: ${score.total} pts (solid despite last race)`);
  evidence.push(`Edge: +${edge.toFixed(0)}% over market`);

  return {
    type: 'public_overreaction',
    direction: 'underbet',
    magnitude,
    confidence: Math.min(85, 60 + magnitude * 2),
    title: 'Public Avoiding After Bad Race',
    explanation: `Public overreacting to poor finish in last race. Our analysis shows ${hasExcuse ? 'a legitimate excuse' : 'the horse is better than last race suggests'}.`,
    valueReason: `Market odds reflect public avoidance, creating overlay of ${edge.toFixed(0)}%`,
    evidence,
    evBonus: magnitude * 2,
  };
}

/**
 * Detect legitimate excuse in past performance
 */
function detectLegitimateExcuse(pp: PastPerformance): string | null {
  // Check comment field for trip notes and excuses
  const comments = (pp as { comment?: string }).comment?.toLowerCase() || '';
  const notes = comments;

  // Wide trip
  if (notes.includes('wide') || notes.includes('4-5 wide') || notes.includes('parked')) {
    return 'Wide trip';
  }

  // Traffic trouble
  if (
    notes.includes('blocked') ||
    notes.includes('in tight') ||
    notes.includes('steadied') ||
    notes.includes('checked') ||
    notes.includes('bumped')
  ) {
    return 'Traffic trouble';
  }

  // Bad start
  if (
    notes.includes('stumbled') ||
    notes.includes('dwelt') ||
    notes.includes('slow break') ||
    notes.includes('pinched back')
  ) {
    return 'Poor start';
  }

  // Equipment issues
  if (notes.includes('lost shoe') || notes.includes('equipment')) {
    return 'Equipment issue';
  }

  // Track condition issues
  if (notes.includes("didn't handle") || notes.includes('slipping')) {
    return 'Track condition';
  }

  return null;
}

/**
 * Detect Recency Bias
 *
 * Public overbets recent winners, underbets recent losers
 */
function detectRecencyBias(
  horse: HorseEntry,
  score: HorseScore,
  edge: number
): InefficiencyDetection | null {
  const pps = horse.pastPerformances;
  if (pps.length < 3) return null;

  const recentResults = pps.slice(0, 3);
  const wins = recentResults.filter((pp) => pp.finishPosition === 1).length;
  const losses = recentResults.filter((pp) => (pp.finishPosition ?? 10) > 5).length;

  const decimalOdds = parseOddsToDecimal(horse.morningLineOdds);
  const marketProb = oddsToMarketProbability(horse.morningLineOdds);
  const ourProb = scoreToWinProbability(score.total);

  // Recent loser being avoided (underbet) - our opportunity
  if (losses >= 2 && edge > 10 && score.total >= 140) {
    // Check if classAnalysis shows dropping (movement string contains "dropping")
    const hasClassDrop =
      score.breakdown.classAnalysis?.movement.toLowerCase().includes('drop') ?? false;
    const magnitude = Math.min(10, Math.round(edge / 4) + (hasClassDrop ? 2 : 0));

    if (magnitude < MIN_MAGNITUDE) return null;

    return {
      type: 'recency_bias',
      direction: 'underbet',
      magnitude,
      title: 'Recent Loser Being Avoided',
      explanation: `Public avoiding due to ${losses} losses in last 3, but our analysis shows improvement factors (score: ${score.total}).`,
      valueReason: `Recency bias creating ${edge.toFixed(0)}% edge`,
      evidence: [
        `Recent record: ${wins}W-${losses}L in last 3`,
        `Market probability: ${marketProb.toFixed(0)}% (too low)`,
        `Our probability: ${ourProb.toFixed(0)}%`,
        hasClassDrop ? 'Class drop detected - improvement likely' : '',
      ].filter(Boolean),
      confidence: Math.min(80, 55 + magnitude * 2),
      evBonus: magnitude * 1.5,
    };
  }

  // Recent winner being overbet (overbet) - avoid
  if (wins >= 2 && edge < -15 && decimalOdds < 3.0) {
    const magnitude = Math.min(10, Math.round(Math.abs(edge) / 5));

    if (magnitude < MIN_MAGNITUDE) return null;

    return {
      type: 'recency_bias',
      direction: 'overbet',
      magnitude,
      title: 'Recent Winner Overbet',
      explanation: `Public chasing recent wins (${wins} in last 3), creating underlay. Odds don't offer value.`,
      valueReason: `Market has absorbed the wins, no value remaining`,
      evidence: [
        `Recent record: ${wins}W in last 3 races`,
        `Market probability: ${marketProb.toFixed(0)}% (too high)`,
        `Our probability: ${ourProb.toFixed(0)}%`,
        `Edge: ${edge.toFixed(0)}% (negative = avoid)`,
      ],
      confidence: Math.min(75, 50 + magnitude * 2),
      evBonus: 0, // No bonus for bets to avoid
    };
  }

  return null;
}

/**
 * Detect Name Recognition Bias
 *
 * Famous jockeys/trainers get overbet, unknown connections underbet
 */
function detectNameRecognitionBias(
  horse: HorseEntry,
  score: HorseScore,
  edge: number
): InefficiencyDetection | null {
  const trainerName = horse.trainerName.toLowerCase();
  const jockeyName = horse.jockeyName.toLowerCase();

  // Famous names that get overbet
  const famousTrainers = ['pletcher', 'baffert', 'brown', 'mott', 'cox', 'ward'];
  const famousJockeys = [
    'irad ortiz',
    'ortiz jr',
    'velazquez',
    'rosario',
    'prat',
    'castellano',
    'saez',
  ];

  const hasFamousTrainer = famousTrainers.some((n) => trainerName.includes(n));
  const hasFamousJockey = famousJockeys.some((n) => jockeyName.includes(n));

  const connectionScore = score.breakdown.connections.total;

  // Unknown connections doing well - opportunity
  if (!hasFamousTrainer && !hasFamousJockey && connectionScore >= 35 && edge > 8) {
    const magnitude = Math.min(10, Math.round(edge / 5) + 2);

    if (magnitude < MIN_MAGNITUDE) return null;

    return {
      type: 'name_recognition',
      direction: 'underbet',
      magnitude,
      title: 'Strong Unknown Connections',
      explanation: `Public overlooking due to lesser-known connections, but trainer/jockey stats are solid.`,
      valueReason: `Market undervaluing connections, creating ${edge.toFixed(0)}% edge`,
      evidence: [
        `Trainer: ${horse.trainerName} - strong stats but not famous`,
        `Jockey: ${horse.jockeyName} - capable but under radar`,
        `Connections score: ${connectionScore}/55`,
        `Edge: +${edge.toFixed(0)}%`,
      ],
      confidence: Math.min(75, 55 + magnitude * 2),
      evBonus: magnitude * 1.5,
    };
  }

  // Famous connections but poor score - overbet
  if ((hasFamousTrainer || hasFamousJockey) && connectionScore < 25 && edge < -10) {
    const magnitude = Math.min(10, Math.round(Math.abs(edge) / 5));

    if (magnitude < MIN_MAGNITUDE) return null;

    const famous = hasFamousTrainer ? horse.trainerName : horse.jockeyName;

    return {
      type: 'name_recognition',
      direction: 'overbet',
      magnitude,
      title: 'Famous Name, Weak Fit',
      explanation: `Public betting on name "${famous}" but actual stats here are weak.`,
      valueReason: `Name recognition creating underlay - avoid`,
      evidence: [
        `Famous connection: ${famous}`,
        `Connections score: ${connectionScore}/55 (weak in this spot)`,
        `Edge: ${edge.toFixed(0)}% (negative)`,
      ],
      confidence: Math.min(70, 50 + magnitude * 2),
      evBonus: 0,
    };
  }

  return null;
}

/**
 * Detect Post Position Panic
 *
 * Public overreacts to post positions without understanding track biases
 */
function detectPostPositionPanic(
  horse: HorseEntry,
  score: HorseScore,
  edge: number,
  raceHeader: RaceHeader
): InefficiencyDetection | null {
  const postPosition = horse.postPosition;
  const fieldSize = raceHeader.fieldSize;

  const postScore = score.breakdown.postPosition;
  const isGoldenPost = postScore.isGoldenPost;
  const hasBias = postScore.trackBiasApplied;

  // Outside post being avoided but we score it well
  if (postPosition >= fieldSize - 2 && postScore.total >= 30 && edge > 12) {
    const magnitude = Math.min(10, Math.round(edge / 4) + 1);

    if (magnitude < MIN_MAGNITUDE) return null;

    return {
      type: 'post_position_panic',
      direction: 'underbet',
      magnitude,
      title: 'Outside Post Overpenalized',
      explanation: `Public avoiding outside post ${postPosition}, but track data shows this isn't as bad as feared.`,
      valueReason: `Post panic creating ${edge.toFixed(0)}% edge`,
      evidence: [
        `Post position: ${postPosition} of ${fieldSize}`,
        `Post score: ${postScore.total}/45 (solid)`,
        hasBias ? 'Track bias data considered' : 'No significant track bias',
        `Edge: +${edge.toFixed(0)}%`,
      ],
      confidence: Math.min(75, 55 + magnitude * 2),
      evBonus: magnitude * 1.5,
    };
  }

  // Golden post not reflected in odds - hidden value
  if (isGoldenPost && postScore.total >= 38 && edge > 8) {
    const magnitude = Math.min(10, Math.round(edge / 3));

    if (magnitude < MIN_MAGNITUDE) return null;

    return {
      type: 'post_position_panic',
      direction: 'underbet',
      magnitude,
      title: 'Golden Post Undervalued',
      explanation: `Post ${postPosition} is historically the best on this track, but odds don't reflect this.`,
      valueReason: `Optimal post position creating additional edge`,
      evidence: [
        `Post position: ${postPosition} (Golden Post)`,
        `Post score: ${postScore.total}/45`,
        'Historical data shows this post wins at higher rate',
        `Edge: +${edge.toFixed(0)}%`,
      ],
      confidence: Math.min(80, 60 + magnitude * 2),
      evBonus: magnitude * 2,
    };
  }

  return null;
}

/**
 * Detect Class Confusion
 *
 * Public doesn't understand hidden class drops
 */
function detectClassConfusion(
  _horse: HorseEntry,
  score: HorseScore,
  edge: number
): InefficiencyDetection | null {
  const classAnalysis = score.breakdown.classAnalysis;
  if (!classAnalysis) return null;

  const hiddenDrops = classAnalysis.hiddenDrops || [];
  const isValuePlay = classAnalysis.isValuePlay;

  // Significant hidden drops not reflected in odds
  if (hiddenDrops.length > 0 && isValuePlay && edge > 10) {
    const primaryDrop = hiddenDrops[0];

    if (!primaryDrop) return null;

    const totalDropsValue = hiddenDrops.reduce((sum, d) => sum + d.pointsBonus, 0);
    const magnitude = Math.min(10, Math.round(totalDropsValue / 2) + Math.round(edge / 6));

    if (magnitude < MIN_MAGNITUDE) return null;

    return {
      type: 'class_confusion',
      direction: 'underbet',
      magnitude,
      title: 'Hidden Class Drop',
      explanation: `Public sees surface class level but misses hidden drop: ${primaryDrop.description}`,
      valueReason: `Hidden class advantage creating ${edge.toFixed(0)}% edge`,
      evidence: [
        `Primary drop: ${primaryDrop.type} - ${primaryDrop.description}`,
        ...hiddenDrops.slice(1).map((d) => `Additional: ${d.type}`),
        `Class analysis score: ${classAnalysis.total}`,
        `Movement: ${classAnalysis.movement}`,
      ],
      confidence: Math.min(85, 60 + magnitude * 2),
      evBonus: magnitude * 2.5,
    };
  }

  // Class rise being avoided but horse proved at higher level
  const movement = classAnalysis.movement.toLowerCase();
  if (movement.includes('rising') && classAnalysis.provenAtLevelScore > 8 && edge > 8) {
    const magnitude = Math.min(8, Math.round(edge / 5));

    if (magnitude < MIN_MAGNITUDE) return null;

    return {
      type: 'class_confusion',
      direction: 'underbet',
      magnitude,
      title: 'Class Rise But Proven',
      explanation: `Public avoiding class rise, but horse has proven capable at this level before.`,
      valueReason: `Unwarranted class fear creating ${edge.toFixed(0)}% edge`,
      evidence: [
        `Movement: ${classAnalysis.movement}`,
        `Proven at level score: ${classAnalysis.provenAtLevelScore}`,
        `Edge: +${edge.toFixed(0)}%`,
      ],
      confidence: Math.min(70, 50 + magnitude * 2),
      evBonus: magnitude * 1.5,
    };
  }

  return null;
}

/**
 * Detect Equipment Misunderstanding
 *
 * Public overreacts to equipment changes without context
 */
function detectEquipmentMisunderstanding(
  horse: HorseEntry,
  score: HorseScore,
  edge: number
): InefficiencyDetection | null {
  const equipmentScore = score.breakdown.equipment;
  const hasChanges = equipmentScore.hasChanges;
  const equipmentTotal = equipmentScore.total;

  if (!hasChanges) return null;

  const firstTimeEquip = horse.equipment.firstTimeEquipment || [];
  const hasBlinkers = firstTimeEquip.some((e) => e.toLowerCase().includes('blinker') || e === 'b');
  const hasLasix = firstTimeEquip.some((e) => e.toLowerCase().includes('lasix') || e === 'l');

  // Strong equipment score but horse being avoided
  if (equipmentTotal >= 18 && edge > 12) {
    const magnitude = Math.min(10, Math.round(edge / 4) + equipmentTotal / 8);

    if (magnitude < MIN_MAGNITUDE) return null;

    const changeDesc = hasBlinkers ? 'Blinkers' : hasLasix ? 'First Lasix' : 'Equipment change';

    return {
      type: 'equipment_misunderstanding',
      direction: 'underbet',
      magnitude,
      title: `${changeDesc} Advantage Missed`,
      explanation: `${changeDesc} should help but public isn't buying it. Trainer patterns suggest this works.`,
      valueReason: `Equipment edge not priced in: ${edge.toFixed(0)}% overlay`,
      evidence: [
        `Equipment change: ${changeDesc}`,
        `Equipment score: ${equipmentTotal}/25`,
        equipmentScore.reasoning,
        `Edge: +${edge.toFixed(0)}%`,
      ],
      confidence: Math.min(75, 55 + magnitude * 2),
      evBonus: magnitude * 1.5,
    };
  }

  // Blinkers off being penalized incorrectly
  if (equipmentTotal >= 15 && edge > 8) {
    const magnitude = Math.min(8, Math.round(edge / 5));

    if (magnitude < MIN_MAGNITUDE) return null;

    return {
      type: 'equipment_misunderstanding',
      direction: 'underbet',
      magnitude,
      title: 'Equipment Change Misread',
      explanation: `Public misreading equipment change implications.`,
      valueReason: `Equipment misunderstanding creating ${edge.toFixed(0)}% edge`,
      evidence: [
        `Equipment score: ${equipmentTotal}/25 (positive)`,
        equipmentScore.reasoning,
        `Edge: +${edge.toFixed(0)}%`,
      ],
      confidence: Math.min(70, 50 + magnitude * 2),
      evBonus: magnitude,
    };
  }

  return null;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze market inefficiencies for a single horse
 */
export function analyzeMarketInefficiency(
  horse: HorseEntry,
  score: HorseScore,
  raceHeader: RaceHeader
): MarketInefficiencyAnalysis {
  const ourProb = scoreToWinProbability(score.total);
  const marketProb = oddsToMarketProbability(horse.morningLineOdds);
  const edge = calculateEdge(ourProb, marketProb);

  const inefficiencies: InefficiencyDetection[] = [];

  // Run all detection functions
  const overreaction = detectPublicOverreaction(horse, score, edge);
  if (overreaction) inefficiencies.push(overreaction);

  const recency = detectRecencyBias(horse, score, edge);
  if (recency) inefficiencies.push(recency);

  const nameRecog = detectNameRecognitionBias(horse, score, edge);
  if (nameRecog) inefficiencies.push(nameRecog);

  const postPanic = detectPostPositionPanic(horse, score, edge, raceHeader);
  if (postPanic) inefficiencies.push(postPanic);

  const classConf = detectClassConfusion(horse, score, edge);
  if (classConf) inefficiencies.push(classConf);

  const equipment = detectEquipmentMisunderstanding(horse, score, edge);
  if (equipment) inefficiencies.push(equipment);

  // Sort by magnitude descending
  inefficiencies.sort((a, b) => b.magnitude - a.magnitude);

  const primaryInefficiency = inefficiencies[0] ?? null;
  const totalMagnitude = inefficiencies.reduce((sum, i) => sum + i.magnitude, 0);

  const hasExploitableInefficiency = inefficiencies.some(
    (i) => i.direction === 'underbet' && i.magnitude >= MIN_MAGNITUDE
  );

  const isMispriced = Math.abs(edge) > MIN_EXPLOITABLE_EDGE && inefficiencies.length > 0;

  // Generate summary
  let summary = 'No significant market inefficiencies detected.';
  if (primaryInefficiency) {
    const meta = INEFFICIENCY_META[primaryInefficiency.type];
    summary = `${meta.name}: ${primaryInefficiency.title}. ${primaryInefficiency.explanation}`;
  }

  // Determine recommendation
  let recommendation: MarketInefficiencyAnalysis['recommendation'] = 'neutral';

  if (hasExploitableInefficiency) {
    if (totalMagnitude >= 15) {
      recommendation = 'strong_bet';
    } else if (totalMagnitude >= 8) {
      recommendation = 'bet';
    } else {
      recommendation = 'watch';
    }
  } else if (inefficiencies.some((i) => i.direction === 'overbet')) {
    recommendation = 'avoid';
  }

  logger.logDebug(`Market inefficiency analysis for ${horse.horseName}`, {
    component: 'marketInefficiency',
    programNumber: horse.programNumber,
    inefficiencyCount: inefficiencies.length,
    primaryType: primaryInefficiency?.type || 'none',
    recommendation,
  });

  return {
    programNumber: horse.programNumber,
    horseName: horse.horseName,
    inefficiencies,
    primaryInefficiency,
    totalMagnitude,
    hasExploitableInefficiency,
    isMispriced,
    summary,
    recommendation,
  };
}

/**
 * Analyze market inefficiencies for all horses in a race
 */
export function analyzeRaceInefficiencies(
  horses: Array<{ horse: HorseEntry; score: HorseScore }>,
  raceHeader: RaceHeader
): MarketInefficiencyAnalysis[] {
  return horses
    .filter((h) => !h.score.isScratched)
    .map(({ horse, score }) => analyzeMarketInefficiency(horse, score, raceHeader));
}

/**
 * Get best inefficiency opportunities in a race
 */
export function getBestInefficiencyPlays(
  analyses: MarketInefficiencyAnalysis[],
  limit: number = 3
): MarketInefficiencyAnalysis[] {
  return analyses
    .filter((a) => a.hasExploitableInefficiency)
    .sort((a, b) => b.totalMagnitude - a.totalMagnitude)
    .slice(0, limit);
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get icon for inefficiency type
 */
export function getInefficiencyIcon(type: InefficiencyType): string {
  return INEFFICIENCY_META[type].icon;
}

/**
 * Get color for inefficiency type
 */
export function getInefficiencyColor(type: InefficiencyType): string {
  return INEFFICIENCY_META[type].color;
}

/**
 * Format magnitude for display
 */
export function formatMagnitude(magnitude: number): string {
  if (magnitude >= 8) return 'Very Strong';
  if (magnitude >= 6) return 'Strong';
  if (magnitude >= 4) return 'Moderate';
  return 'Slight';
}

/**
 * Get display badge for inefficiency
 */
export function getInefficiencyBadge(detection: InefficiencyDetection): {
  text: string;
  color: string;
  bgColor: string;
} {
  const meta = INEFFICIENCY_META[detection.type];

  return {
    text: `${meta.name}: ${formatMagnitude(detection.magnitude)}`,
    color: meta.color,
    bgColor: meta.bgColor,
  };
}
